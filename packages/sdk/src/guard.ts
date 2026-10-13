// The guard (docs/SPEC.md §5 and §7, ADR-004, ADR-010): message bytes in, a decision out, by rules
// 0 to 19 in order; the first rule that fails is the reason. Every decision is an entry of a
// hash-chained record, kept by a store before the guard answers; an allowed one is a receipt bound
// to the exact bytes. The record is the guard's state: on start the guard applies every entry
// again, Keel included, and continues where it stopped. Every error is a denial: a guard that
// cannot decide, or cannot record, does not sign.

import { readFileSync } from "node:fs";
import { registerRefusalChannel, notifyRefusal, type RefusalObserver } from "./errors.ts";
import { fileURLToPath } from "node:url";
import { Governor, wasmDigest, type Posture, type Telemetry } from "@gubernaut/core";
import { effectsOf, type ClassifyContext, type EffectsV1 } from "./classify.ts";
import { canonicalJSON, sha256hex } from "./canonical.ts";
import { parseReleaseText, releaseText, verifyEd25519 } from "./latch.ts";
import { hashOf, OUTCOMES, seal, type Amounts, type Decision, type DecisionEntry, type Entry, type Outcome, type PolicyEntry, type RedeemEntry, type ReleaseEntry, type ReportEntry, type RuleV1, type SigningEntry } from "./log.ts";
import { EVALUATION_PROFILE, VERIFIED_KEEL_DIGEST, VERIFIED_KEEL_MODULE } from "./profile.ts";
import { PolicyAuthorizationError, verifyPolicyAuthorization, verifyPolicyEntry, type PolicyAuthorization, type PolicyTrust } from "./signed-policy.ts";
import { DecodeError } from "./message.ts";
import { contextOf, createPolicy, type Policy } from "./policy.ts";
import { fileStore, lookupOwnedRequestIndex, memoryStore, type EntryStore } from "./record.ts";
import { sensorV1, type Sensor } from "./sensor.ts";
import { bindRequest, requestKey, type RequestIdentity } from "./request.ts";
import { verifySigning, type SigningEvent } from "./signing.ts";
import { copyAuthority, type RuntimeAuthority } from "./authority.ts";
import { controlBinding, controlPayload, controlResult, type ControlMethod } from "./control-request.ts";
import type { ControlRequestEntry, ControlResponseEntry } from "./log.ts";
import { apply, couldStillLand, currentIntent, initialState, nowFor, retentionWindow, unresolved, windowTotals, type GuardState } from "./state.ts";

export type { Decision, Entry, Outcome, RuleV1 } from "./log.ts";
export type { EntryStore } from "./record.ts";
export type { Sensor, SensorView } from "./sensor.ts";

/** The controller Solanaut was built and tested against: @gubernaut/core 1.0.1's embedded wasm, by SHA-256. */
export { VERIFIED_KEEL_DIGEST } from "./profile.ts";
/** The module that runs it, `dist/index.js` of @gubernaut/core 1.0.1, by SHA-256: the JavaScript around the wasm counts too. */
export { VERIFIED_KEEL_MODULE } from "./profile.ts";
const KEEL_VERSION = "1.0.1";

/**
 * Hash a Keel module's source and the controller embedded in it (defect D4). Keel 1.0.1 declares
 * its digest as a constant and checks only the length of what it loads (upstream finding U-1), so
 * Solanaut hashes the bytes itself: the wasm against the declared digest, and the whole module,
 * which is the code that runs the wasm, against the pinned file.
 */
export function verifyKeelSource(text: string): { ok: boolean; moduleSha256: string; wasmSha256: string; problem: string } {
  const moduleSha256 = sha256hex(text);
  const m = /var WASM_BASE64 = "([A-Za-z0-9+/=]+)";/.exec(text);
  const wasmSha256 = m ? sha256hex(new Uint8Array(Buffer.from(m[1]!, "base64"))) : "";
  let problem = "";
  if (!m) problem = "the module embeds no controller";
  else if (wasmSha256 !== VERIFIED_KEEL_DIGEST) problem = `the embedded controller hashes to ${wasmSha256}, not the verified ${VERIFIED_KEEL_DIGEST}`;
  else if (moduleSha256 !== VERIFIED_KEEL_MODULE) problem = `the module that runs the controller hashes to ${moduleSha256}, not the verified ${VERIFIED_KEEL_MODULE}`;
  return { ok: problem === "", moduleSha256, wasmSha256, problem };
}

/** Verify the Keel module this process actually loads, by the path Node resolves for it. */
function verifyLoadedKeel(expectedDigest: string): void {
  const path = fileURLToPath(import.meta.resolve("@gubernaut/core"));
  const v = verifyKeelSource(readFileSync(path, "utf8"));
  if (!v.ok) throw new Error(`Keel's controller failed verification: ${v.problem}. Refusing to guard with an unverified controller.`);
  if (v.wasmSha256 !== expectedDigest || wasmDigest !== expectedDigest) {
    throw new Error(`Keel's controller digest is ${v.wasmSha256}, not the expected ${expectedDigest}. Refusing to guard with an unverified controller.`);
  }
}

export interface ProposalV1 {
  /** The serialized message the signatures will cover: legacy, v0 or v1. */
  message: Uint8Array;
  /** Milliseconds, from the caller's clock in SDK mode. */
  at: number;
  /** The current block height, as the caller last read it. */
  blockHeight?: bigint;
  /** From getLatestBlockhash: the last height at which this message's blockhash is valid. */
  lastValidBlockHeight?: bigint;
  /** The caller's own grouping key. Recorded; never used to decide. */
  intent?: string;
}

export interface GuardOptions {
  /** Operator-only observer; never include its output in model tool responses. */
  onRefusal?: RefusalObserver;
  /** Trusted signer-host attribution; SDK callers can bypass it, so this is not an isolation proof. */
  authority?: RuntimeAuthority;
  /** Policy v1. Validated here (rule 0): an invalid policy throws a PolicyError and no guard exists. */
  policy: unknown;
  /** Signature and external operator/identity pin. SDK mode remains advisory; signer mode requires it. */
  authorization?: PolicyAuthorization;
  /** Replace the telemetry source. Tests use it to drive Keel, and to prove the guard fails closed. */
  sensor?: Sensor;
  /** The Keel digest to require. Defaults to the verified one. */
  expectedDigest?: string;
  /**
   * Where the record lives: a file path (one JSON entry per line, synced before each answer, locked
   * to this guard), or a store. Without one, the record lives in memory and a restart forgets it.
   */
  log?: string | EntryStore;
}

export interface GuardStatus {
  latched: boolean;
  latchSeq: number | null;
  /** The seq the next entry will take: the number of entries so far. */
  seq: number;
  consecutiveDenials: number;
}

export interface Guard {
  /** Trusted host bookkeeping for status/report; neither API signs or sends. */
  beginRequest(identity: RequestIdentity, method: ControlMethod, payload: unknown, at: number): ControlRequestEntry;
  finishRequest(startHash: string, result: unknown): ControlResponseEntry;
  requestResult(startHash: string): unknown;
  /** Decide. Never throws. */
  check(p: ProposalV1, request?: RequestIdentity): Decision;
  /** Trusted SDK journal API; it signs and sends nothing. Not a signer socket method. */
  recordSigning(event: SigningEvent): SigningEntry;
  /** Record how an allowed decision went on chain. Throws for anything but an allowed decision of this guard. */
  report(decisionHash: string, outcome: Outcome): void;
  /** Release the latch with the operator's signature over `releaseText`. */
  release(text: string, signature: Uint8Array, at: number): { released: boolean; reason: string };
  /** The text the operator signs to release the current latch. */
  releaseText(expires: string): string;
  /** Before signing: these bytes are the ones a receipt admitted, once, and still in time. */
  redeem(message: Uint8Array, decisionHash: string, blockHeight?: bigint): { ok: boolean; reason: string };
  status(): GuardStatus;
  /** The record so far, oldest first. */
  entries(): readonly Entry[];
  /** Close the record and release its lock. The guard decides nothing after. */
  close(): void;
  readonly policy: Policy;
  readonly policyHash: string;
}

export class OwnedRequestAdmissionError extends Error {
  readonly code = "owned-request-admission";
  constructor(message: string) { super(message); this.name = "OwnedRequestAdmissionError"; }
}
const ownedAdmissions = new WeakMap<Guard, (proposal: ProposalV1, identity: RequestIdentity) => Promise<Decision>>();
export class OwnedControlRequestError extends Error {
  readonly code = "owned-control-request";
  constructor(message: string) { super(message); this.name = "OwnedControlRequestError"; }
}
interface OwnedControls {
  begin(identity: RequestIdentity, method: ControlMethod, input: unknown, at: number): Promise<ControlRequestEntry>;
  finish(identity: RequestIdentity, startHash: string, input: unknown): Promise<ControlResponseEntry>;
  result(identity: RequestIdentity, startHash: string): Promise<unknown>;
}
const ownedControls = new WeakMap<Guard, OwnedControls>();
async function ownedControl<T>(guard: Guard, work: (controls: OwnedControls) => Promise<T>): Promise<T> {
  const controls = ownedControls.get(guard);
  if (!controls) throw new OwnedControlRequestError("owned controls require a genuine signed guard");
  try { return await work(controls); }
  catch { throw new OwnedControlRequestError("owned control cannot establish current request evidence"); }
}
/** Internal companions share the owned admission FIFO; no signing or sending. */
export function beginOwnedRequest(guard: Guard, identity: RequestIdentity, method: ControlMethod, input: unknown, at: number): Promise<ControlRequestEntry> {
  return ownedControl(guard, controls => controls.begin(identity, method, input, at));
}
export function finishOwnedRequest(guard: Guard, identity: RequestIdentity, startHash: string, input: unknown): Promise<ControlResponseEntry> {
  return ownedControl(guard, controls => controls.finish(identity, startHash, input));
}
export function ownedRequestResult(guard: Guard, identity: RequestIdentity, startHash: string): Promise<unknown> {
  return ownedControl(guard, controls => controls.result(identity, startHash));
}
function controlReply<T>(input: T): T {
  const freezeReply = (value: unknown): void => {
    if (value && typeof value === "object") { for (const child of Object.values(value)) freezeReply(child); Object.freeze(value); }
  };
  const reply = structuredClone(input); freezeReply(reply); return reply;
}
function admissionReply(decision: Decision): Decision {
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  };
  const reply = structuredClone(decision); freeze(reply); return reply;
}
/** Internal companion: unchanged synchronous SDK methods still retain their full history. */
export async function checkOwnedRequest(guard: Guard, proposal: ProposalV1, identity: RequestIdentity): Promise<Decision> {
  const admit = ownedAdmissions.get(guard);
  if (!admit) throw new OwnedRequestAdmissionError("owned admission requires a genuine signed guard");
  try { return await admit(proposal, identity); }
  catch (error) {
    if (error instanceof OwnedRequestAdmissionError) throw error;
    throw new OwnedRequestAdmissionError("owned admission cannot establish current request evidence");
  }
}

const fmt = (n: bigint) => n.toLocaleString("en-US");
const isHeight = (h: unknown) => h === undefined || (typeof h === "bigint" && h >= 0n);
const telemetryAccepted = (t: unknown): t is Telemetry => {
  if (t === null || typeof t !== "object") return false;
  const x = t as Record<string, unknown>;
  return ["intensity", "valence", "repetition"].every((k) => typeof x[k] === "number") && Governor.accepts(t as Telemetry);
};
const describeTelemetry = (t: unknown) => {
  try {
    return JSON.stringify(t, (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v)) ?? String(t);
  } catch {
    return String(t);
  }
};

function proposalProblem(p: unknown): string | null {
  if (p === null || typeof p !== "object") return "the proposal is not an object";
  const q = p as Record<string, unknown>;
  if (!(q.message instanceof Uint8Array)) return "message must be the serialized message, as a Uint8Array";
  if (typeof q.at !== "number" || !Number.isFinite(q.at) || q.at < 0) return "at must be a time in milliseconds";
  if (!isHeight(q.blockHeight)) return "blockHeight must be a non-negative bigint";
  if (!isHeight(q.lastValidBlockHeight)) return "lastValidBlockHeight must be a non-negative bigint";
  if (q.intent !== undefined && (typeof q.intent !== "string" || q.intent.length > 256)) return "intent must be text of at most 256 characters";
  return null;
}

/** What a message would move, totalled: SOL, each mint, and fees with tips. */
function totals(e: EffectsV1) {
  const sol = e.sol.reduce((t, x) => t + x.lamports, 0n);
  const tokens = new Map<string, bigint>();
  for (const t of e.tokens) if (t.mint !== null) tokens.set(t.mint, (tokens.get(t.mint) ?? 0n) + t.amount);
  return { sol, tokens, fees: e.priorityFee + e.baseFee + e.tips };
}

/** Everything a decision needs that is not the proposal. */
interface Env {
  authority?: RuntimeAuthority;
  policy: Policy;
  policyHash: string;
  ctx: ClassifyContext;
  sensor: Sensor;
  gov: Governor;
  state: GuardState;
  trust?: PolicyTrust;
  policyEntry?: PolicyEntry;
}

type DecisionBody = Omit<DecisionEntry, "v" | "seq" | "prev" | "hash">;

/** Every guard verifies the controller's bytes before it exists, so every decision it makes says so. */
const KEEL = { version: KEEL_VERSION, digest: wasmDigest, verified: "bytes" as const };

/**
 * One decision, by rules 1 to 19 in order, against the state as it stands. It ticks Keel for
 * every parsed proposal and changes nothing else: committing the result is the caller's. A denial
 * that completes the policy's run of denials trips the latch. At REGROUND, Keel's own denial
 * or a second consecutive REGROUND denial trips it (ADR-012 C).
 */
function evaluate(env: Env, p: ProposalV1, previous: DecisionEntry | undefined): DecisionBody {
  const body = evaluateRules(env, p);
  const { state, policy } = env;
  const regroundTrips = body.posture === "REGROUND" && (body.rule === "loop-reground" || (previous?.allow === false && previous.posture === "REGROUND"));
  const trips = !body.allow && !state.latched && (state.consecutiveDenials + 1 >= policy.latch.afterDenials || regroundTrips);
  return trips ? { ...body, latch: true } : body;
}

function evaluateRules(env: Env, p: ProposalV1): DecisionBody {
  const { policy, state } = env;
  const at = typeof p?.at === "number" && Number.isFinite(p.at) && p.at >= 0 ? p.at : (state.maxAt ?? 0);
  const base = {
    kind: "decision" as const,
    ...(policy.disclosure === "full" ? { disclosure: "full" as const } : {}),
    at,
    source: env.authority ? "signer" as const : "caller" as const,
    ...(env.authority ? { deployment: env.authority } : {}),
    message: p?.message instanceof Uint8Array ? Buffer.from(p.message).toString("base64") : "",
    blockHeight: typeof p?.blockHeight === "bigint" ? p.blockHeight.toString() : null,
    lastValidBlockHeight: typeof p?.lastValidBlockHeight === "bigint" ? p.lastValidBlockHeight.toString() : null,
    group: typeof p?.intent === "string" ? p.intent : null,
    policyHash: env.policyHash,
    keel: KEEL,
  };
  const parsed = { intentKey: null as string | null, messageHash: null as string | null, shape: null as string | null, amounts: null as Amounts | null };
  const keelSaw = { posture: null as Posture | null, telemetry: null as Telemetry | null, temperatureMax: null as number | null };
  const decide = (allow: boolean, rule: RuleV1 | undefined, reason: string, extra: Partial<DecisionBody> = {}): DecisionBody =>
    ({ ...base, ...parsed, ...keelSaw, allow, ...(rule ? { rule } : {}), reason, ...extra });

  try {
    // Rule 1, the proposal's own shape; then rules 1 to 3, inside decoding.
    const problem = proposalProblem(p);
    if (problem) return decide(false, "malformed-proposal", problem, { input: "invalid" });
    let e: EffectsV1;
    try {
      e = effectsOf(p.message, env.ctx);
    } catch (err) {
      if (err instanceof DecodeError) return decide(false, err.rule, err.message);
      throw err;
    }
    const t = totals(e);
    parsed.intentKey = e.intentKey;
    parsed.messageHash = e.messageHash;
    parsed.shape = sha256hex(canonicalJSON({ programs: [...e.programs].sort(), to: [...e.sol.map((s) => s.to), ...e.tokens.map((x) => x.toAccount)].sort() }));
    parsed.amounts = { sol: t.sol.toString(), tokens: [...t.tokens].map(([mint, amount]) => ({ mint, amount: amount.toString() })), fees: t.fees.toString() };

    // Every parsed proposal reaches Keel, allowed or denied: re-proposing a refused transfer is a loop too.
    const telemetry = env.sensor(e, state.sensor, policy, at, parsed.shape);
    // D3: Keel's tick() coerces null, strings, booleans and arrays (upstream finding U-2), so
    // telemetry is checked here, and refused before Keel sees it.
    if (!telemetryAccepted(telemetry)) {
      return decide(false, "fail-closed", `the sensor's telemetry was refused before Keel saw it: ${describeTelemetry(telemetry)}`);
    }
    keelSaw.telemetry = { intensity: telemetry.intensity, valence: telemetry.valence, repetition: telemetry.repetition };
    const k = env.gov.tick(telemetry);
    keelSaw.posture = k.posture;
    keelSaw.temperatureMax = k.temperatureMax;

    // Rule 4.
    if (state.latched) return decide(false, "latched", `the guard latched at decision ${state.latched.seq}; only the operator's signed release frees it`);
    // Rule 5.
    const nonce = e.denied.find((d) => d.rule === "durable-nonce-denied");
    if (e.nonce || nonce) return decide(false, "durable-nonce-denied", nonce?.reason ?? "the first instruction advances a durable nonce");
    // Rule 6.
    if (e.otherSigners.length) return decide(false, "other-signer", `${e.otherSigners.join(", ")} must sign too, and only the principal may sign while co-signing is off`);
    // Rule 7.
    const program = e.programs.find((x) => !policy.programs.allow.includes(x));
    if (program) return decide(false, "program-not-allowed", `program ${program} is not on the allowlist`);
    // Rule 8.
    if (e.opaque.length && policy.programs.opaque === "deny") return decide(false, "opaque-program", `the guard does not decode ${e.opaque.join(", ")}, and the policy denies opaque programs`);
    // Rule 9.
    const ix = e.denied.find((d) => d.rule === "instruction-denied");
    if (ix) return decide(false, "instruction-denied", `instruction ${ix.index}, ${ix.instruction}: ${ix.reason}`);
    // Rule 10.
    const sol = e.sol.find((s) => !policy.destinations.allow.includes(s.to));
    if (sol) return decide(false, "destination-not-allowed", `${fmt(sol.lamports)} lamports to ${sol.to}, which is not an allowed destination`);
    const tok = e.tokens.find((x) => x.toOwner === null && !policy.destinations.allow.includes(x.toAccount));
    if (tok) return decide(false, "destination-not-allowed", `tokens to ${tok.toAccount}, which is neither an allowed owner's associated account nor an allowed address`);
    // Rule 11.
    for (const x of e.tokens) {
      if (x.mint === null) return decide(false, "token-mint-unknown", `a ${x.program} Transfer from ${x.fromAccount} names no mint, and that account is not the principal's associated account for a listed mint`);
      if (!policy.tokens.some((l) => l.mint === x.mint && l.program === x.program)) return decide(false, "mint-not-allowed", `mint ${x.mint} under the ${x.program} program is not listed`);
    }
    // Rule 12.
    if (t.sol > policy.sol.maxPerTx) return decide(false, "over-per-tx-cap", `${fmt(t.sol)} lamports is over the per-transaction cap of ${fmt(policy.sol.maxPerTx)}`);
    for (const l of policy.tokens) {
      const amount = t.tokens.get(l.mint) ?? 0n;
      if (amount > l.maxPerTx) return decide(false, "over-per-tx-cap", `${fmt(amount)} of ${l.mint} is over its per-transaction cap of ${fmt(l.maxPerTx)}`);
    }
    // Rule 13.
    if (e.priorityFee > policy.fees.maxPriorityPerTx) return decide(false, "over-fee-cap", `a priority fee of ${fmt(e.priorityFee)} lamports is over the cap of ${fmt(policy.fees.maxPriorityPerTx)}`);
    // Rules 14 and 15.
    const now = nowFor(state, at);
    const blockHeight = p.blockHeight ?? null;
    const intent = currentIntent(state, policy, e.intentKey, now, blockHeight);
    if (intent) {
      const live = intent.attempts.find((a) => couldStillLand(a, blockHeight));
      if (live) return decide(false, "intent-in-flight", `an earlier attempt at the same effects (decision ${live.decision.slice(0, 12)}…) could still land; report its outcome, or propose once its last valid block height has passed`);
      const open = intent.attempts.find(unresolved);
      if (open) return decide(false, "intent-in-flight", `an earlier attempt at the same effects (decision ${open.decision.slice(0, 12)}…) is past its last valid block height, but its outcome was never reported, so it may have landed; report landed, failed or expired, or propose once the window has passed since the first attempt`);
      if (intent.attempts.length >= policy.intents.maxAttempts) return decide(false, "intent-attempts-exhausted", `the same effects have been attempted ${intent.attempts.length} times, the most the policy allows`);
    }
    // Rule 16, counted at admission against what is already reserved.
    const w = windowTotals(state, policy, now, blockHeight);
    if (w.sol + t.sol > policy.sol.maxPerWindow) return decide(false, "over-window-cap", `${fmt(w.sol)} + ${fmt(t.sol)} lamports would pass the cap of ${fmt(policy.sol.maxPerWindow)} per ${policy.windowMs} ms`);
    for (const l of policy.tokens) {
      const held = w.tokens.get(l.mint) ?? 0n;
      const amount = t.tokens.get(l.mint) ?? 0n;
      if (amount > 0n && held + amount > l.maxPerWindow) return decide(false, "over-window-cap", `${fmt(held)} + ${fmt(amount)} of ${l.mint} would pass its cap of ${fmt(l.maxPerWindow)} per window`);
    }
    if (w.fees + t.fees > policy.fees.maxPerWindow) return decide(false, "over-window-cap", `${fmt(w.fees)} + ${fmt(t.fees)} lamports of fees and tips would pass the cap of ${fmt(policy.fees.maxPerWindow)} per window`);
    // Rule 17.
    if (k.posture === "REGROUND") return decide(false, "loop-reground", `Keel reports a saturating loop (REGROUND): repetition ${telemetry.repetition}, valence ${telemetry.valence.toFixed(2)}`);
    // Rule 18: under INHIBIT, nothing over the per-transaction cap times Keel's clamp. Solanaut's mapping, not Gubernaut's.
    if (k.posture === "INHIBIT") {
      const scale = BigInt(Math.round(k.temperatureMax * 1_000_000));
      const over = (amount: bigint, cap: bigint) => amount * 1_000_000n > cap * scale;
      if (over(t.sol, policy.sol.maxPerTx)) return decide(false, "inhibit-cap", `under INHIBIT, ${fmt(t.sol)} lamports is over ${k.temperatureMax} of the per-transaction cap`);
      for (const l of policy.tokens) {
        if (over(t.tokens.get(l.mint) ?? 0n, l.maxPerTx)) return decide(false, "inhibit-cap", `under INHIBIT, ${l.mint} is over ${k.temperatureMax} of its per-transaction cap`);
      }
    }
    const expires = p.lastValidBlockHeight === undefined ? {} : { expires: { lastValidBlockHeight: p.lastValidBlockHeight.toString() } };
    return decide(true, undefined, "", expires);
  } catch (err) {
    return decide(false, "fail-closed", `the guard could not decide, so it denies: ${(err as Error)?.message ?? String(err)}`);
  }
}

/** Apply a recorded entry to the state and to Keel, as restore and replay both must. */
function reapply(env: Env, e: Entry): void {
  if (e.kind === "decision" && e.input === "invalid" && (e.posture !== null || e.telemetry !== null || e.temperatureMax !== null)) {
    throw new Error("malformed proposal history cannot contain Keel observations");
  }
  if (e.kind === "decision" && env.policyEntry && e.policyHash !== env.policyHash) throw new Error("recorded decision names another signed policy");
  if (e.kind === "policy") {
    env.policy = verifyPolicyEntry(e, env.trust, env.policyEntry);
    env.policyHash = createPolicy(env.policy).hash;
    env.ctx = contextOf(env.policy);
    env.policyEntry = e;
  }
  if (e.kind === "decision" && e.posture !== null && e.telemetry !== null) {
    const k = env.gov.tick(e.telemetry);
    if (k.posture !== e.posture) throw new Error(`the record does not replay: at seq ${e.seq} Keel gives ${k.posture}, and the record says ${e.posture}`);
  }
  apply(env.state, e, env.policy, env.policyEntry ? env.policyHash : undefined);
  if (e.kind === "release") env.gov.reset();
}

export async function createGuard(opts: GuardOptions): Promise<Guard> {
  verifyLoadedKeel(opts.expectedDigest ?? VERIFIED_KEEL_DIGEST);
  const { policy, hash: policyHash } = createPolicy(opts.policy);
  const authority = opts.authority && copyAuthority(opts.authority);
  if (authority && policy.latch.cluster !== "devnet") throw new Error("signer authority requires a devnet policy");
  const authorization = opts.authorization && Object.freeze({ ...opts.authorization });
  if (authorization) verifyPolicyAuthorization(policy, authorization);
  if (policy.disclosure === "full" && !authorization) throw new PolicyAuthorizationError("full disclosure requires an operator-signed policy");
  const observer = opts.onRefusal;
  if (observer !== undefined && typeof observer !== "function") throw new Error("onRefusal must be a function");
  if (authorization && opts.sensor && opts.sensor !== sensorV1) throw new Error("signed policy evaluation profile requires sensor v1");
  const env: Env = { policy, policyHash, ctx: contextOf(policy), sensor: opts.sensor ?? sensorV1, gov: await Governor.create(), state: initialState(), trust: authorization, authority };
  const { state, gov } = env;
  const store = opts.log === undefined ? memoryStore() : typeof opts.log === "string" ? fileStore(opts.log) : opts.log;

  // Restore: apply every recorded entry again, Keel included. A record that does not replay does not run.
  try {
    state.retentionMs = retentionWindow(store.entries, policy.windowMs);
    for (const e of store.entries) {
      if (hashOf(e) !== e.hash) throw new Error(`the record is damaged: the hash of seq ${e.seq} does not match its entry`);
      reapply(env, e);
    }
    if (authorization && env.policyEntry) {
      const old = env.policyEntry;
      const a = authorization;
      if (a.version < old.version || (a.version === old.version && (canonicalJSON(policy) !== old.policy || a.text !== old.text))) throw new PolicyAuthorizationError("policy version rollback or changed content at equal version");
    }
    env.policy = policy;
    env.policyHash = policyHash;
    env.ctx = contextOf(policy);
    state.retentionMs = 0; // Live pruning uses the active policy; a later restart rebuilds from history.
  } catch (err) {
    store.close();
    throw err;
  }

  /** Why the guard stopped deciding, if it did: a record it could not write, or close(). */
  let shut: string | null = null;

  function commit<T extends Entry>(body: Omit<T, "v" | "seq" | "prev" | "hash">): T {
    if (shut) throw new Error(shut);
    const entry = seal<T>({ v: 1, seq: state.seq, prev: state.head, ...body } as Omit<T, "hash">);
    try {
      store.append(entry);
    } catch (err) {
      shut = `the record could not be written (${(err as Error)?.message ?? String(err)}), so this guard decides nothing more until it is restarted`;
      throw new Error(shut);
    }
    apply(state, entry, policy, env.policyEntry ? policyHash : undefined);
    if (entry.kind === "release") gov.reset();
    return entry;
  }

  const unrecorded = (reason: string): Decision => {
    const decision = Object.freeze({ kind: "decision", v: 1, seq: -1, prev: state.head, hash: "", at: state.maxAt ?? 0, source: "caller", message: "", blockHeight: null, lastValidBlockHeight: null, intentKey: null, group: null, messageHash: null, shape: null, amounts: null, allow: false, rule: "fail-closed", reason, posture: null, telemetry: null, temperatureMax: null, policyHash, keel: KEEL }) as Decision;
    notifyRefusal(guard, "fail-closed", reason, decision);
    return decision;
  };

  if (authorization && (!env.policyEntry || env.policyEntry.version !== authorization.version)) {
    const a = authorization;
    try {
      commit<PolicyEntry>({ kind: "policy", at: state.maxAt ?? 0, policy: canonicalJSON(policy), version: a.version,
        issued: a.issued, text: a.text, signature: a.signature, profile: EVALUATION_PROFILE });
    } catch (error) { store.close(); throw error; }
  }

  const check = (p: ProposalV1, request?: RequestIdentity): Decision => {
    if (shut) return unrecorded(shut);
    try {
      const binding = request === undefined ? undefined : bindRequest(policy.latch.guardId, request, p?.message, p?.intent);
      if (binding) {
        const recorded = state.requests.get(requestKey(binding));
        if (recorded) {
          if (recorded.kind !== "decision" || recorded.request!.digest !== binding.digest) return unrecorded("request identity was reused with a different payload");
          return recorded;
        }
      }
      const previous = store.entries.findLast((e): e is DecisionEntry => e.kind === "decision");
      const body = evaluate(env, p, previous);
      const decision = commit<DecisionEntry>(binding ? { ...body, request: binding } : body);
      if (!decision.allow) notifyRefusal(guard, decision.rule!, decision.reason, decision);
      return decision;
    } catch (err) {
      // Nothing may be signed on a decision that is not in the record.
      return unrecorded(shut ?? `the guard could not decide, so it denies: ${(err as Error)?.message ?? String(err)}`);
    }
  };

  const report = (decisionHash: string, outcome: Outcome) => {
    if (!OUTCOMES.includes(outcome)) throw new Error(`outcome must be one of ${OUTCOMES.join(", ")}, not ${String(outcome)}`);
    const d = state.allowed.get(decisionHash);
    if (!d) throw new Error(`no allowed decision of this guard has hash ${decisionHash}; a denial has nothing to report`);
    const r = state.reservations.get(decisionHash)!;
    const attempt = state.intents.get(r.intentKey)?.attempts.find((a) => a.decision === decisionHash);
    if (attempt && attempt.status !== "pending" && attempt.status !== "unknown") {
      throw new Error(`decision ${decisionHash} was already reported ${attempt.status}, which is final`);
    }
    commit<ReportEntry>({ kind: "report", at: state.maxAt ?? d.at, decision: decisionHash, outcome, source: authority ? "signer" : "caller" });
  };

  const currentReleaseText = (expires: string) => {
    if (!state.latched) throw new Error("the guard is not latched");
    return releaseText({ guardId: policy.latch.guardId, cluster: policy.latch.cluster, policyHash, seq: state.latched.seq, expires });
  };

  const release = (text: string, signature: Uint8Array, at: number) => {
    const no = (reason: string) => ({ released: false, reason });
    if (shut) return no(shut);
    if (!state.latched) return no("the guard is not latched");
    const f = parseReleaseText(text);
    if (!f) return no("the text is not a release message in the exact form");
    if (f.guardId !== policy.latch.guardId) return no(`the release names guard ${f.guardId}, not ${policy.latch.guardId}`);
    if (f.cluster !== policy.latch.cluster) return no(`the release names cluster ${f.cluster}, not ${policy.latch.cluster}`);
    if (f.policyHash !== policyHash) return no("the release names another policy");
    if (f.seq !== state.latched.seq) return no(`the release is for the latch at seq ${f.seq}; this guard latched at ${state.latched.seq}`);
    // Judged on the latest recorded time, as the windows are, so a clock that steps back cannot revive it (D19).
    const now = typeof at === "number" && Number.isFinite(at) ? nowFor(state, at) : Number.NaN;
    if (!(Date.parse(f.expires) > now)) return no(`the release expired at ${f.expires}`);
    if (!verifyEd25519(policy.latch.releaseKey, new TextEncoder().encode(text), signature)) return no("the signature is not the release key's, over this text");
    try {
      commit<ReleaseEntry>({ kind: "release", at: now, latchSeq: f.seq, text, signature: Buffer.from(signature).toString("base64") });
    } catch (err) {
      return no((err as Error).message);
    }
    return { released: true, reason: "" };
  };

  const redeem = (message: Uint8Array, decisionHash: string, blockHeight?: bigint) => {
    const no = (reason: string) => ({ ok: false, reason });
    if (shut) return no(shut);
    const d = state.allowed.get(decisionHash);
    if (!d) return no("not an allowed decision of this guard");
    if (state.redeemed.has(decisionHash)) return no("the receipt was already used");
    // A final outcome released, or spent, what the decision reserved: its bytes must not be signed now (D18).
    const r = state.reservations.get(decisionHash);
    const attempt = r && state.intents.get(r.intentKey)?.attempts.find((a) => a.decision === decisionHash);
    if (attempt && !unresolved(attempt)) return no(`the decision was already reported ${attempt.status}`);
    if (!(message instanceof Uint8Array) || sha256hex(message) !== d.messageHash) return no("these bytes are not the ones the receipt admitted");
    if (d.policyHash !== policyHash) return no("the receipt was issued under another policy");
    if (d.expires) {
      if (typeof blockHeight !== "bigint") return no("the receipt expires by block height, and no height was given to check it");
      if (blockHeight > BigInt(d.expires.lastValidBlockHeight)) return no(`block height ${blockHeight} is past the receipt's last valid height ${d.expires.lastValidBlockHeight}`);
    }
    try {
      commit<RedeemEntry>({ kind: "redeem", at: state.maxAt ?? d.at, decision: decisionHash, blockHeight: typeof blockHeight === "bigint" ? blockHeight.toString() : null });
    } catch (err) {
      return no((err as Error).message);
    }
    return { ok: true, reason: "" };
  };

  const guard: Guard = {
    beginRequest(identity, method, input, at) {
      if (!Number.isFinite(at) || at < 0) throw new Error("invalid request time");
      const payload = controlPayload(method, input); const request = controlBinding(policy.latch.guardId, identity, method, payload);
      const old = state.requests.get(requestKey(request));
      if (old) {
        if (old.kind !== "request" || old.request.digest !== request.digest) throw new Error("request identity reused with different payload");
        return old;
      }
      return commit<ControlRequestEntry>({ kind: "request", at: nowFor(state, at), request, method, payload });
    },
    finishRequest(startHash, input) {
      if (![...state.requests.values()].some((r) => r.kind === "request" && r.hash === startHash)) throw new Error("unknown control request");
      const result = controlResult(input); const old = state.responses.get(startHash);
      if (old) { if (old.result !== result) throw new Error("request response cannot change"); return old; }
      return commit<ControlResponseEntry>({ kind: "response", at: state.maxAt ?? 0, request: startHash, result });
    },
    requestResult(startHash) { const response = state.responses.get(startHash); return response ? JSON.parse(response.result) : undefined; },
    check,
    recordSigning(event) {
      const copy = Object.freeze({ ...event }) as SigningEvent;
      const history = state.signing.get(copy.decision);
      verifySigning(copy, history, history?.redeemed === true, policyHash);
      return commit<SigningEntry>({ kind: "signing", at: state.maxAt ?? 0, event: copy });
    },
    report,
    release,
    releaseText: currentReleaseText,
    redeem,
    status: () => ({ latched: state.latched !== null, latchSeq: state.latched?.seq ?? null, seq: state.seq, consecutiveDenials: state.consecutiveDenials }),
    entries: () => Object.freeze([...store.entries]),
    close: () => {
      shut ??= "the guard was closed";
      store.close();
    },
    policy,
    policyHash,
  };
  registerRefusalChannel(guard, policy.disclosure ?? "class", observer);
  if (authorization) {
    let queue: Promise<void> = Promise.resolve();
    const startControl = guard.beginRequest, completeControl = guard.finishRequest;
    function enqueue<T>(run: () => Promise<T>): Promise<T> {
      const pending = queue.then(run);
      queue = pending.then(() => undefined, () => undefined);
      return pending;
    }
    ownedAdmissions.set(guard, (proposal, identity) => {
      // The caller may change input while earlier admissions are waiting on disk reads.
      const captured = structuredClone(proposal), id = structuredClone(identity);
      // structuredClone preserves SharedArrayBuffer backing; own the actual message bytes too.
      if (captured?.message instanceof Uint8Array) captured.message = new Uint8Array(captured.message);
      const binding = bindRequest(policy.latch.guardId, id, captured?.message, captured?.intent);
      const run = async (): Promise<Decision> => {
        if (shut) throw new OwnedRequestAdmissionError("owned admission guard is closed or failed");
        const evidence = await lookupOwnedRequestIndex(store, id, { policyTrust: authorization });
        if (shut || evidence.seq !== state.seq || evidence.head !== state.head) throw new OwnedRequestAdmissionError("owned admission history changed before commit");
        const historical = evidence.row?.start;
        if (historical) {
          if (historical.kind !== "decision" || historical.request!.digest !== binding.digest) return admissionReply(unrecorded("request identity was reused with a different payload"));
          return admissionReply(historical);
        }
        // No await separates verified absence from the existing synchronous evaluation/commit.
        return admissionReply(check(captured, id));
      };
      return enqueue(run);
    });
    const currentControl = async <T>(controlId: RequestIdentity, work: (row: Awaited<ReturnType<typeof lookupOwnedRequestIndex>>["row"]) => T): Promise<T> => {
      if (shut) throw new OwnedControlRequestError("owned control guard is closed or failed");
      const controlEvidence = await lookupOwnedRequestIndex(store, controlId, { policyTrust: authorization });
      if (shut || controlEvidence.seq !== state.seq || controlEvidence.head !== state.head) throw new OwnedControlRequestError("owned control history changed before commit");
      // No await separates the authenticated current head from bookkeeping or reply capture.
      return work(controlEvidence.row);
    };
    ownedControls.set(guard, {
      begin(identity, method, input, at) {
        if (!Number.isFinite(at) || at < 0) throw new OwnedControlRequestError("invalid request time");
        const id = structuredClone(identity), payload = controlPayload(method, input);
        const binding = controlBinding(policy.latch.guardId, id, method, payload);
        return enqueue(() => currentControl(id, row => {
          if (row) {
            if (row.start.kind !== "request" || row.start.request.digest !== binding.digest) throw new OwnedControlRequestError("request identity reused with different payload");
            return controlReply(row.start);
          }
          return controlReply(startControl(id, method, JSON.parse(payload), at));
        }));
      },
      finish(identity, startHash, input) {
        const id = structuredClone(identity), result = controlResult(input);
        return enqueue(() => currentControl(id, row => {
          if (row?.start.kind !== "request" || row.start.hash !== startHash) throw new OwnedControlRequestError("unknown control request");
          if (row.response) {
            if (row.response.kind !== "response" || row.response.result !== result) throw new OwnedControlRequestError("request response cannot change");
            return controlReply(row.response);
          }
          return controlReply(completeControl(startHash, JSON.parse(result)));
        }));
      },
      result(identity, startHash) {
        const id = structuredClone(identity);
        return enqueue(() => currentControl(id, row => {
          if (row?.start.kind !== "request" || row.start.hash !== startHash) throw new OwnedControlRequestError("unknown control request");
          if (!row.response) return undefined;
          if (row.response.kind !== "response") throw new OwnedControlRequestError("invalid control response");
          return controlReply(JSON.parse(row.response.result));
        }));
      },
    });
  }
  return guard;
}

export interface ReplayResult {
  /** True when every decision recomputes as recorded. */
  ok: boolean;
  /** Decisions checked, up to the first divergence. */
  decisions: number;
  /** The first entry that does not replay, and the first field that differs. */
  divergence: { seq: number; field: string; recorded: unknown; recomputed: unknown } | null;
}

const COMPARED = ["allow", "rule", "intentKey", "messageHash", "amounts", "posture", "telemetry", "temperatureMax", "expires", "latch", "disclosure"] as const;

export class StreamReplayError extends Error {
  readonly code = "stream-replay";
  constructor(message: string) { super(message); this.name = "StreamReplayError"; }
}

/** Internal two-pass recomputation; active/request state still needs separate bounds. */
export async function replayStream(open: () => AsyncIterable<Entry>, policyInput: unknown, sensor: Sensor = sensorV1, trust?: PolicyTrust): Promise<ReplayResult> {
  try {
    const policySeed = structuredClone(policyInput), pins = structuredClone(trust);
    if (typeof open !== "function") throw new StreamReplayError("replay source factory is required");
    verifyLoadedKeel(VERIFIED_KEEL_DIGEST);
    let firstPolicy: PolicyEntry | undefined, retentionMs = 0, count = 0, fingerprint = "";
    // A future longer policy window must not lose reservations pruned by an earlier one.
    for await (const input of open()) {
      const text = canonicalJSON(input), entry = JSON.parse(text) as Entry;
      fingerprint = sha256hex(fingerprint + text); count++;
      if (entry.kind === "policy") {
        firstPolicy ??= entry;
        retentionMs = Math.max(retentionMs, createPolicy(JSON.parse(entry.policy)).policy.windowMs);
      }
    }
    const { policy, hash } = createPolicy(policySeed ?? (firstPolicy ? JSON.parse(firstPolicy.policy) : undefined));
    if (firstPolicy && sensor !== sensorV1) throw new StreamReplayError("signed policy evaluation profile requires sensor v1");
    const env: Env = { policy, policyHash: hash, ctx: contextOf(policy), sensor, gov: await Governor.create(), state: initialState(), trust: pins };
    env.state.retentionMs = Math.max(retentionMs, policy.windowMs);
    let checked = 0, checkedFingerprint = "";
    const records = async function* () {
      for await (const input of open()) {
        const text = canonicalJSON(input);
        checkedFingerprint = sha256hex(checkedFingerprint + text); checked++;
        yield JSON.parse(text) as Entry;
      }
    };
    const result = await recompute(env, records());
    if (result.ok && (checked !== count || checkedFingerprint !== fingerprint)) throw new StreamReplayError("replay source changed between complete reads");
    return result;
  } catch (error) {
    if (error instanceof StreamReplayError) throw error;
    throw new StreamReplayError("streamed replay could not complete");
  }
}

/**
 * Recompute every decision of a record from its bytes, under `policy`, and name the first that
 * differs. Under the policy it was written with, a sound record replays exactly; under another
 * policy, replay says where that policy would have decided differently.
 */
export async function replay(entries: readonly Entry[], policyInput: unknown, sensor: Sensor = sensorV1, trust?: PolicyTrust): Promise<ReplayResult> {
  verifyLoadedKeel(VERIFIED_KEEL_DIGEST);
  const firstPolicy = entries.find((e): e is PolicyEntry => e.kind === "policy");
  const { policy, hash } = createPolicy(policyInput ?? (firstPolicy ? JSON.parse(firstPolicy.policy) : undefined));
  if (firstPolicy && sensor !== sensorV1) throw new Error("signed policy evaluation profile requires sensor v1");
  const env: Env = { policy, policyHash: hash, ctx: contextOf(policy), sensor, gov: await Governor.create(), state: initialState(), trust };
  env.state.retentionMs = retentionWindow(entries, policy.windowMs);
  const checker = replayChecker(env);
  for (const entry of entries) { const divergence = checker.accept(entry); if (divergence) return divergence; }
  return checker.finish();
}

async function recompute(env: Env, entries: Iterable<Entry> | AsyncIterable<Entry>): Promise<ReplayResult> {
  const checker = replayChecker(env);
  for await (const entry of entries) { const divergence = checker.accept(entry); if (divergence) return divergence; }
  return checker.finish();
}

function replayChecker(env: Env) {
  let decisions = 0;
  let previous: DecisionEntry | undefined;
  return { accept(e: Entry): ReplayResult | null {
    const diverge = (field: string, recorded: unknown, recomputed: unknown): ReplayResult => ({ ok: false, decisions, divergence: { seq: e.seq, field, recorded, recomputed } });
    if (hashOf(e) !== e.hash) return diverge("hash", e.hash, hashOf(e));
    if (e.kind === "decision" && env.policyEntry && e.policyHash !== env.policyHash) return diverge("policyHash", e.policyHash, env.policyHash);
    if (e.kind === "decision") {
      decisions++;
      const prior = previous;
      previous = e;
      if (e.input === "invalid") {
        // The proposal itself was ill-formed; the record keeps no more of it than that.
        if (e.allow || e.rule !== "malformed-proposal") return diverge("rule", e.rule, "malformed-proposal");
      } else {
        const p: ProposalV1 = {
          message: new Uint8Array(Buffer.from(e.message, "base64")),
          at: e.at,
          ...(e.blockHeight === null ? {} : { blockHeight: BigInt(e.blockHeight) }),
          ...(e.lastValidBlockHeight === null ? {} : { lastValidBlockHeight: BigInt(e.lastValidBlockHeight) }),
          ...(e.group === null ? {} : { intent: e.group }),
        };
        const again = evaluate(env, p, prior);
        for (const field of COMPARED) {
          if (canonicalJSON(e[field] ?? null) !== canonicalJSON(again[field] ?? null)) return diverge(field, e[field], again[field]);
        }
        // Keel has ticked in evaluate; apply the entry without ticking it twice.
        try {
          apply(env.state, e, env.policy, env.policyEntry ? env.policyHash : undefined);
        } catch (err) {
          return diverge("chain", e.prev, (err as Error).message);
        }
        return null;
      }
    }
    try {
      reapply(env, e);
    } catch (err) {
      return diverge("chain", e.prev, (err as Error).message);
    }
    return null;
  }, finish(): ReplayResult { return { ok: true, decisions, divergence: null }; } };
}
