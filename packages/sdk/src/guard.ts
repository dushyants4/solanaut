// The guard (docs/SPEC.md §5 and §7, ADR-004, ADR-010): message bytes in, a decision out, by rules
// 0 to 19 in order; the first rule that fails is the reason. Every decision is an entry of a
// hash-chained record, kept by a store before the guard answers; an allowed one is a receipt bound
// to the exact bytes. The record is the guard's state: on start the guard applies every entry
// again, Keel included, and continues where it stopped. Every error is a denial: a guard that
// cannot decide, or cannot record, does not sign.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Governor, wasmDigest, type Posture, type Telemetry } from "@gubernaut/core";
import { effectsOf, type ClassifyContext, type EffectsV1 } from "./classify.ts";
import { canonicalJSON, sha256hex } from "./canonical.ts";
import { parseReleaseText, releaseText, verifyEd25519 } from "./latch.ts";
import { hashOf, OUTCOMES, seal, type Amounts, type Decision, type DecisionEntry, type Entry, type Outcome, type RedeemEntry, type ReleaseEntry, type ReportEntry, type RuleV1 } from "./log.ts";
import { DecodeError } from "./message.ts";
import { contextOf, createPolicy, type Policy } from "./policy.ts";
import { fileStore, memoryStore, type EntryStore } from "./record.ts";
import { sensorV1, type Sensor } from "./sensor.ts";
import { apply, couldStillLand, currentIntent, initialState, nowFor, unresolved, windowTotals, type GuardState } from "./state.ts";

export type { Decision, Entry, Outcome, RuleV1 } from "./log.ts";
export type { EntryStore } from "./record.ts";
export type { Sensor, SensorView } from "./sensor.ts";

/** The controller Solanaut was built and tested against: @gubernaut/core 1.0.1's embedded wasm, by SHA-256. */
export const VERIFIED_KEEL_DIGEST = "834015d73e6576d6c597b5a32a62c24ac56a50c7023261bf84b96beb01ded7d8";
/** The module that runs it, `dist/index.js` of @gubernaut/core 1.0.1, by SHA-256: the JavaScript around the wasm counts too. */
export const VERIFIED_KEEL_MODULE = "8f642684bf1dccbdaed1e35e0092e11d0cfc309c0491b1c79f6472616b9c7190";
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
  /** Policy v1. Validated here (rule 0): an invalid policy throws a PolicyError and no guard exists. */
  policy: unknown;
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
  /** Decide. Never throws. */
  check(p: ProposalV1): Decision;
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
  policy: Policy;
  policyHash: string;
  ctx: ClassifyContext;
  sensor: Sensor;
  gov: Governor;
  state: GuardState;
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
    at,
    source: "caller" as const,
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
  if (e.kind === "decision" && e.posture !== null && e.telemetry !== null) {
    const k = env.gov.tick(e.telemetry);
    if (k.posture !== e.posture) throw new Error(`the record does not replay: at seq ${e.seq} Keel gives ${k.posture}, and the record says ${e.posture}`);
  }
  apply(env.state, e, env.policy);
  if (e.kind === "release") env.gov.reset();
}

export async function createGuard(opts: GuardOptions): Promise<Guard> {
  verifyLoadedKeel(opts.expectedDigest ?? VERIFIED_KEEL_DIGEST);
  const { policy, hash: policyHash } = createPolicy(opts.policy);
  const env: Env = { policy, policyHash, ctx: contextOf(policy), sensor: opts.sensor ?? sensorV1, gov: await Governor.create(), state: initialState() };
  const { state, gov } = env;
  const store = opts.log === undefined ? memoryStore() : typeof opts.log === "string" ? fileStore(opts.log) : opts.log;

  // Restore: apply every recorded entry again, Keel included. A record that does not replay does not run.
  try {
    for (const e of store.entries) {
      if (hashOf(e) !== e.hash) throw new Error(`the record is damaged: the hash of seq ${e.seq} does not match its entry`);
      reapply(env, e);
    }
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
    apply(state, entry, policy);
    if (entry.kind === "release") gov.reset();
    return entry;
  }

  const unrecorded = (reason: string): Decision =>
    Object.freeze({ kind: "decision", v: 1, seq: -1, prev: state.head, hash: "", at: state.maxAt ?? 0, source: "caller", message: "", blockHeight: null, lastValidBlockHeight: null, intentKey: null, group: null, messageHash: null, shape: null, amounts: null, allow: false, rule: "fail-closed", reason, posture: null, telemetry: null, temperatureMax: null, policyHash, keel: KEEL }) as Decision;

  const check = (p: ProposalV1): Decision => {
    if (shut) return unrecorded(shut);
    try {
      const previous = store.entries.findLast((e): e is DecisionEntry => e.kind === "decision");
      return commit<DecisionEntry>(evaluate(env, p, previous));
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
    commit<ReportEntry>({ kind: "report", at: state.maxAt ?? d.at, decision: decisionHash, outcome, source: "caller" });
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

  return {
    check,
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
}

export interface ReplayResult {
  /** True when every decision recomputes as recorded. */
  ok: boolean;
  /** Decisions checked, up to the first divergence. */
  decisions: number;
  /** The first entry that does not replay, and the first field that differs. */
  divergence: { seq: number; field: string; recorded: unknown; recomputed: unknown } | null;
}

const COMPARED = ["allow", "rule", "intentKey", "messageHash", "amounts", "posture", "telemetry", "temperatureMax", "expires", "latch"] as const;

/**
 * Recompute every decision of a record from its bytes, under `policy`, and name the first that
 * differs. Under the policy it was written with, a sound record replays exactly; under another
 * policy, replay says where that policy would have decided differently.
 */
export async function replay(entries: readonly Entry[], policyInput: unknown, sensor: Sensor = sensorV1): Promise<ReplayResult> {
  verifyLoadedKeel(VERIFIED_KEEL_DIGEST);
  const { policy, hash } = createPolicy(policyInput);
  const env: Env = { policy, policyHash: hash, ctx: contextOf(policy), sensor, gov: await Governor.create(), state: initialState() };
  let decisions = 0;
  let previous: DecisionEntry | undefined;
  for (const e of entries) {
    const diverge = (field: string, recorded: unknown, recomputed: unknown): ReplayResult => ({ ok: false, decisions, divergence: { seq: e.seq, field, recorded, recomputed } });
    if (hashOf(e) !== e.hash) return diverge("hash", e.hash, hashOf(e));
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
          apply(env.state, e, policy);
        } catch (err) {
          return diverge("chain", e.prev, (err as Error).message);
        }
        continue;
      }
    }
    try {
      reapply(env, e);
    } catch (err) {
      return diverge("chain", e.prev, (err as Error).message);
    }
  }
  return { ok: true, decisions, divergence: null };
}
