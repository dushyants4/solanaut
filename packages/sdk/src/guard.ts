// The guard (docs/SPEC.md §5 and §7, ADR-004, ADR-010): message bytes in, a decision out, by rules
// 0 to 19 in order; the first rule that fails is the reason. Every decision is an entry of a
// hash-chained record, kept by a store before the guard answers; an allowed one is a receipt bound
// to the exact bytes. The record is the guard's state: on start the guard applies every entry
// again, Keel included, and continues where it stopped. Every error is a denial: a guard that
// cannot decide, or cannot record, does not sign.
//
// The file reads in that order: the guard's API and createGuard, then replay, then the rules that
// make one decision, then how a recorded entry is applied again, then the checks on Keel itself,
// and last the private companions a signer host uses.

import { readFileSync } from "node:fs";
import { registerRefusalChannel, notifyRefusal, type RefusalObserver } from "./errors.ts";
import { fileURLToPath } from "node:url";
import { Governor, wasmDigest, type Decision as KeelDecision, type Posture, type Telemetry } from "@gubernaut/core";
import { effectsOf, type ClassifyContext, type EffectsV1 } from "./classify.ts";
import { canonicalJSON, sha256hex } from "./canonical.ts";
import { parseReleaseText, releaseText, verifyEd25519 } from "./latch.ts";
import {
  hashOf,
  OUTCOMES,
  seal,
  type Amounts,
  type ControlRequestEntry,
  type ControlResponseEntry,
  type Decision,
  type DecisionEntry,
  type Entry,
  type Outcome,
  type PolicyEntry,
  type RedeemEntry,
  type ReleaseEntry,
  type ReportEntry,
  type RuleV1,
  type SigningEntry,
} from "./log.ts";
import { EVALUATION_PROFILE, VERIFIED_KEEL_DIGEST, VERIFIED_KEEL_MODULE } from "./profile.ts";
import {
  PolicyAuthorizationError,
  verifyPolicyAuthorization,
  verifyPolicyEntry,
  type PolicyAuthorization,
  type PolicyTrust,
} from "./signed-policy.ts";
import { DecodeError } from "./message.ts";
import { contextOf, createPolicy, type Policy } from "./policy.ts";
import { fileStore, lookupOwnedRequestIndex, memoryStore, type EntryStore } from "./record.ts";
import { sensorV1, type Sensor } from "./sensor.ts";
import { bindRequest, requestKey, type RequestIdentity } from "./request.ts";
import { verifySigning, type SigningEvent } from "./signing.ts";
import { copyAuthority, type RuntimeAuthority } from "./authority.ts";
import { controlBinding, controlPayload, controlResult, type ControlMethod } from "./control-request.ts";
import {
  apply,
  couldStillLand,
  currentIntent,
  initialState,
  nowFor,
  retentionWindow,
  unresolved,
  windowTotals,
  type GuardState,
} from "./state.ts";

export type { Decision, Entry, Outcome, RuleV1 } from "./log.ts";
export type { EntryStore } from "./record.ts";
export type { Sensor, SensorView } from "./sensor.ts";

/** The controller Solanaut was built and tested against: @gubernaut/core 1.0.1's embedded wasm, by SHA-256. */
export { VERIFIED_KEEL_DIGEST } from "./profile.ts";
/** The module that runs it, `dist/index.js` of @gubernaut/core 1.0.1, by SHA-256: the JavaScript around the wasm counts too. */
export { VERIFIED_KEEL_MODULE } from "./profile.ts";
const KEEL_VERSION = "1.0.1";

/** Every guard verifies the controller's bytes before it exists, so every decision it makes says so. */
const KEEL = { version: KEEL_VERSION, digest: wasmDigest, verified: "bytes" as const };

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

/** Everything a decision needs that is not the proposal. */
interface Env {
  authority?: RuntimeAuthority;
  policy: Policy;
  policyHash: string;
  context: ClassifyContext;
  sensor: Sensor;
  governor: Governor;
  state: GuardState;
  trust?: PolicyTrust;
  policyEntry?: PolicyEntry;
}

type DecisionBody = Omit<DecisionEntry, "v" | "seq" | "prev" | "hash">;

export async function createGuard(opts: GuardOptions): Promise<Guard> {
  verifyLoadedKeel(opts.expectedDigest ?? VERIFIED_KEEL_DIGEST);
  const { policy, hash: policyHash } = createPolicy(opts.policy);
  const authority = opts.authority && copyAuthority(opts.authority);
  if (authority && policy.latch.cluster !== "devnet") throw new Error("signer authority requires a devnet policy");
  const authorization = opts.authorization && Object.freeze({ ...opts.authorization });
  if (authorization) verifyPolicyAuthorization(policy, authorization);
  if (policy.disclosure === "full" && !authorization)
    throw new PolicyAuthorizationError("full disclosure requires an operator-signed policy");
  const observer = opts.onRefusal;
  if (observer !== undefined && typeof observer !== "function") throw new Error("onRefusal must be a function");
  if (authorization && opts.sensor && opts.sensor !== sensorV1)
    throw new Error("signed policy evaluation profile requires sensor v1");

  const env: Env = {
    policy,
    policyHash,
    context: contextOf(policy),
    sensor: opts.sensor ?? sensorV1,
    governor: await Governor.create(),
    state: initialState(),
    trust: authorization,
    authority,
  };
  const { state, governor } = env;
  const store = openStore(opts.log);
  restore(env, store, policy, policyHash, authorization);

  /** Why the guard stopped deciding, if it did: a record it could not write, or close(). */
  let shut: string | null = null;

  if (authorization && (!env.policyEntry || env.policyEntry.version !== authorization.version)) {
    recordTheSignedPolicy(authorization);
  }

  const guard: Guard = {
    beginRequest,
    finishRequest,
    requestResult,
    check,
    recordSigning,
    report,
    release,
    releaseText: currentReleaseText,
    redeem,
    status,
    entries,
    close,
    policy,
    policyHash,
  };
  registerRefusalChannel(guard, policy.disclosure ?? "class", observer);
  if (authorization) serveOwnedRequests(authorization);
  return guard;

  /** Seal an entry onto the record and apply it. A record that cannot be written shuts the guard. */
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
    if (entry.kind === "release") governor.reset();
    return entry;
  }

  /** A denial that is not in the record, for when the guard cannot record one. Nothing may be signed on it. */
  function unrecorded(reason: string): Decision {
    const decision = Object.freeze({
      kind: "decision",
      v: 1,
      seq: -1,
      prev: state.head,
      hash: "",
      at: state.maxAt ?? 0,
      source: "caller",
      message: "",
      blockHeight: null,
      lastValidBlockHeight: null,
      intentKey: null,
      group: null,
      messageHash: null,
      shape: null,
      amounts: null,
      allow: false,
      rule: "fail-closed",
      reason,
      posture: null,
      telemetry: null,
      temperatureMax: null,
      policyHash,
      keel: KEEL,
    }) as Decision;
    notifyRefusal(guard, "fail-closed", reason, decision);
    return decision;
  }

  function recordTheSignedPolicy(signed: PolicyAuthorization) {
    try {
      commit<PolicyEntry>({
        kind: "policy",
        at: state.maxAt ?? 0,
        policy: canonicalJSON(policy),
        version: signed.version,
        issued: signed.issued,
        text: signed.text,
        signature: signed.signature,
        profile: EVALUATION_PROFILE,
      });
    } catch (error) {
      store.close();
      throw error;
    }
  }

  function check(p: ProposalV1, request?: RequestIdentity): Decision {
    if (shut) return unrecorded(shut);
    try {
      const binding =
        request === undefined ? undefined : bindRequest(policy.latch.guardId, request, p?.message, p?.intent);
      if (binding) {
        const recorded = state.requests.get(requestKey(binding));
        if (recorded) {
          if (recorded.kind !== "decision" || recorded.request!.digest !== binding.digest)
            return unrecorded("request identity was reused with a different payload");
          return recorded;
        }
      }
      const previous = store.entries.findLast((entry): entry is DecisionEntry => entry.kind === "decision");
      const body = evaluate(env, p, previous);
      const decision = commit<DecisionEntry>(binding ? { ...body, request: binding } : body);
      if (!decision.allow) notifyRefusal(guard, decision.rule!, decision.reason, decision);
      return decision;
    } catch (err) {
      // Nothing may be signed on a decision that is not in the record.
      return unrecorded(shut ?? `the guard could not decide, so it denies: ${(err as Error)?.message ?? String(err)}`);
    }
  }

  function report(decisionHash: string, outcome: Outcome) {
    if (!OUTCOMES.includes(outcome))
      throw new Error(`outcome must be one of ${OUTCOMES.join(", ")}, not ${String(outcome)}`);
    const decision = state.allowed.get(decisionHash);
    if (!decision)
      throw new Error(`no allowed decision of this guard has hash ${decisionHash}; a denial has nothing to report`);
    const reservation = state.reservations.get(decisionHash)!;
    const attempt = state.intents
      .get(reservation.intentKey)
      ?.attempts.find((attempt) => attempt.decision === decisionHash);
    if (attempt && attempt.status !== "pending" && attempt.status !== "unknown") {
      throw new Error(`decision ${decisionHash} was already reported ${attempt.status}, which is final`);
    }
    commit<ReportEntry>({
      kind: "report",
      at: state.maxAt ?? decision.at,
      decision: decisionHash,
      outcome,
      source: authority ? "signer" : "caller",
    });
  }

  function currentReleaseText(expires: string) {
    if (!state.latched) throw new Error("the guard is not latched");
    return releaseText({
      guardId: policy.latch.guardId,
      cluster: policy.latch.cluster,
      policyHash,
      seq: state.latched.seq,
      expires,
    });
  }

  function release(text: string, signature: Uint8Array, at: number) {
    const no = (reason: string) => ({ released: false, reason });
    if (shut) return no(shut);
    if (!state.latched) return no("the guard is not latched");
    const fields = parseReleaseText(text);
    if (!fields) return no("the text is not a release message in the exact form");
    if (fields.guardId !== policy.latch.guardId)
      return no(`the release names guard ${fields.guardId}, not ${policy.latch.guardId}`);
    if (fields.cluster !== policy.latch.cluster)
      return no(`the release names cluster ${fields.cluster}, not ${policy.latch.cluster}`);
    if (fields.policyHash !== policyHash) return no("the release names another policy");
    if (fields.seq !== state.latched.seq)
      return no(`the release is for the latch at seq ${fields.seq}; this guard latched at ${state.latched.seq}`);
    // Judged on the latest recorded time, as the windows are, so a clock that steps back cannot revive it (D19).
    const now = typeof at === "number" && Number.isFinite(at) ? nowFor(state, at) : Number.NaN;
    if (!(Date.parse(fields.expires) > now)) return no(`the release expired at ${fields.expires}`);
    if (!verifyEd25519(policy.latch.releaseKey, new TextEncoder().encode(text), signature))
      return no("the signature is not the release key's, over this text");
    try {
      commit<ReleaseEntry>({
        kind: "release",
        at: now,
        latchSeq: fields.seq,
        text,
        signature: Buffer.from(signature).toString("base64"),
      });
    } catch (err) {
      return no((err as Error).message);
    }
    return { released: true, reason: "" };
  }

  function redeem(message: Uint8Array, decisionHash: string, blockHeight?: bigint) {
    const no = (reason: string) => ({ ok: false, reason });
    if (shut) return no(shut);
    const decision = state.allowed.get(decisionHash);
    if (!decision) return no("not an allowed decision of this guard");
    if (state.redeemed.has(decisionHash)) return no("the receipt was already used");
    // A final outcome released, or spent, what the decision reserved: its bytes must not be signed now (D18).
    const reservation = state.reservations.get(decisionHash);
    const attempt =
      reservation &&
      state.intents.get(reservation.intentKey)?.attempts.find((attempt) => attempt.decision === decisionHash);
    if (attempt && !unresolved(attempt)) return no(`the decision was already reported ${attempt.status}`);
    if (!(message instanceof Uint8Array) || sha256hex(message) !== decision.messageHash)
      return no("these bytes are not the ones the receipt admitted");
    if (decision.policyHash !== policyHash) return no("the receipt was issued under another policy");
    if (decision.expires) {
      if (typeof blockHeight !== "bigint")
        return no("the receipt expires by block height, and no height was given to check it");
      if (blockHeight > BigInt(decision.expires.lastValidBlockHeight))
        return no(
          `block height ${blockHeight} is past the receipt's last valid height ${decision.expires.lastValidBlockHeight}`,
        );
    }
    try {
      commit<RedeemEntry>({
        kind: "redeem",
        at: state.maxAt ?? decision.at,
        decision: decisionHash,
        blockHeight: typeof blockHeight === "bigint" ? blockHeight.toString() : null,
      });
    } catch (err) {
      return no((err as Error).message);
    }
    return { ok: true, reason: "" };
  }

  function beginRequest(identity: RequestIdentity, method: ControlMethod, input: unknown, at: number) {
    if (!Number.isFinite(at) || at < 0) throw new Error("invalid request time");
    const payload = controlPayload(method, input);
    const request = controlBinding(policy.latch.guardId, identity, method, payload);
    const old = state.requests.get(requestKey(request));
    if (old) {
      if (old.kind !== "request" || old.request.digest !== request.digest)
        throw new Error("request identity reused with different payload");
      return old;
    }
    return commit<ControlRequestEntry>({ kind: "request", at: nowFor(state, at), request, method, payload });
  }

  function finishRequest(startHash: string, input: unknown) {
    if (![...state.requests.values()].some((entry) => entry.kind === "request" && entry.hash === startHash))
      throw new Error("unknown control request");
    const result = controlResult(input);
    const old = state.responses.get(startHash);
    if (old) {
      if (old.result !== result) throw new Error("request response cannot change");
      return old;
    }
    return commit<ControlResponseEntry>({ kind: "response", at: state.maxAt ?? 0, request: startHash, result });
  }

  function requestResult(startHash: string) {
    const response = state.responses.get(startHash);
    return response ? JSON.parse(response.result) : undefined;
  }

  function recordSigning(event: SigningEvent) {
    const copy = Object.freeze({ ...event }) as SigningEvent;
    const history = state.signing.get(copy.decision);
    verifySigning(copy, history, history?.redeemed === true, policyHash);
    return commit<SigningEntry>({ kind: "signing", at: state.maxAt ?? 0, event: copy });
  }

  function status() {
    return {
      latched: state.latched !== null,
      latchSeq: state.latched?.seq ?? null,
      seq: state.seq,
      consecutiveDenials: state.consecutiveDenials,
    };
  }

  function entries() {
    return Object.freeze([...store.entries]);
  }

  function close() {
    shut ??= "the guard was closed";
    store.close();
  }

  /**
   * A signer host's admissions and control requests, served one at a time in arrival order. Each
   * first proves the record on disk is the one in memory, then answers from it or decides anew.
   */
  function serveOwnedRequests(authorization: PolicyAuthorization) {
    let queue: Promise<void> = Promise.resolve();
    const startControl = guard.beginRequest,
      completeControl = guard.finishRequest;
    function enqueue<T>(run: () => Promise<T>): Promise<T> {
      const pending = queue.then(run);
      queue = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    }
    ownedAdmissions.set(guard, (proposal, identity) => {
      // The caller may change input while earlier admissions are waiting on disk reads.
      const captured = structuredClone(proposal),
        id = structuredClone(identity);
      // structuredClone preserves SharedArrayBuffer backing; own the actual message bytes too.
      if (captured?.message instanceof Uint8Array) captured.message = new Uint8Array(captured.message);
      const binding = bindRequest(policy.latch.guardId, id, captured?.message, captured?.intent);
      const run = async (): Promise<Decision> => {
        if (shut) throw new OwnedRequestAdmissionError("owned admission guard is closed or failed");
        const evidence = await lookupOwnedRequestIndex(store, id, { policyTrust: authorization });
        if (shut || evidence.seq !== state.seq || evidence.head !== state.head)
          throw new OwnedRequestAdmissionError("owned admission history changed before commit");
        const historical = evidence.row?.start;
        if (historical) {
          if (historical.kind !== "decision" || historical.request!.digest !== binding.digest)
            return frozenCopy(unrecorded("request identity was reused with a different payload"));
          return frozenCopy(historical);
        }
        // No await separates verified absence from the existing synchronous evaluation/commit.
        return frozenCopy(check(captured, id));
      };
      return enqueue(run);
    });
    const currentControl = async <T>(
      controlId: RequestIdentity,
      work: (row: Awaited<ReturnType<typeof lookupOwnedRequestIndex>>["row"]) => T,
    ): Promise<T> => {
      if (shut) throw new OwnedControlRequestError("owned control guard is closed or failed");
      const controlEvidence = await lookupOwnedRequestIndex(store, controlId, { policyTrust: authorization });
      if (shut || controlEvidence.seq !== state.seq || controlEvidence.head !== state.head)
        throw new OwnedControlRequestError("owned control history changed before commit");
      // No await separates the authenticated current head from bookkeeping or reply capture.
      return work(controlEvidence.row);
    };
    ownedControls.set(guard, {
      begin(identity, method, input, at) {
        if (!Number.isFinite(at) || at < 0) throw new OwnedControlRequestError("invalid request time");
        const id = structuredClone(identity),
          payload = controlPayload(method, input);
        const binding = controlBinding(policy.latch.guardId, id, method, payload);
        return enqueue(() =>
          currentControl(id, (row) => {
            if (row) {
              if (row.start.kind !== "request" || row.start.request.digest !== binding.digest)
                throw new OwnedControlRequestError("request identity reused with different payload");
              return frozenCopy(row.start);
            }
            return frozenCopy(startControl(id, method, JSON.parse(payload), at));
          }),
        );
      },
      finish(identity, startHash, input) {
        const id = structuredClone(identity),
          result = controlResult(input);
        return enqueue(() =>
          currentControl(id, (row) => {
            if (row?.start.kind !== "request" || row.start.hash !== startHash)
              throw new OwnedControlRequestError("unknown control request");
            if (row.response) {
              if (row.response.kind !== "response" || row.response.result !== result)
                throw new OwnedControlRequestError("request response cannot change");
              return frozenCopy(row.response);
            }
            return frozenCopy(completeControl(startHash, JSON.parse(result)));
          }),
        );
      },
      result(identity, startHash) {
        const id = structuredClone(identity);
        return enqueue(() =>
          currentControl(id, (row) => {
            if (row?.start.kind !== "request" || row.start.hash !== startHash)
              throw new OwnedControlRequestError("unknown control request");
            if (!row.response) return undefined;
            if (row.response.kind !== "response") throw new OwnedControlRequestError("invalid control response");
            return frozenCopy(JSON.parse(row.response.result));
          }),
        );
      },
    });
  }
}

function openStore(log: GuardOptions["log"]): EntryStore {
  if (log === undefined) return memoryStore();
  if (typeof log === "string") return fileStore(log);
  return log;
}

/**
 * Restore: apply every recorded entry again, Keel included. A record that does not replay does
 * not run, and its store is closed.
 */
function restore(
  env: Env,
  store: EntryStore,
  policy: Policy,
  policyHash: string,
  authorization: PolicyAuthorization | undefined,
) {
  try {
    env.state.retentionMs = retentionWindow(store.entries, policy.windowMs);
    for (const entry of store.entries) {
      if (hashOf(entry) !== entry.hash)
        throw new Error(`the record is damaged: the hash of seq ${entry.seq} does not match its entry`);
      reapply(env, entry);
    }
    if (authorization && env.policyEntry) refuseRollback(env.policyEntry, authorization, policy);
    env.policy = policy;
    env.policyHash = policyHash;
    env.context = contextOf(policy);
    env.state.retentionMs = 0; // Live pruning uses the active policy; a later restart rebuilds from history.
  } catch (err) {
    store.close();
    throw err;
  }
}

/** A signed policy may move forward, never back, and never change its content under the same version. */
function refuseRollback(recorded: PolicyEntry, authorization: PolicyAuthorization, policy: Policy) {
  const rolledBack = authorization.version < recorded.version;
  const changedInPlace =
    authorization.version === recorded.version &&
    (canonicalJSON(policy) !== recorded.policy || authorization.text !== recorded.text);
  if (rolledBack || changedInPlace)
    throw new PolicyAuthorizationError("policy version rollback or changed content at equal version");
}

// --- replay ----------------------------------------------------------------------------------------

export interface ReplayResult {
  /** True when every decision recomputes as recorded. */
  ok: boolean;
  /** Decisions checked, up to the first divergence. */
  decisions: number;
  /** The first entry that does not replay, and the first field that differs. */
  divergence: { seq: number; field: string; recorded: unknown; recomputed: unknown } | null;
}

/** The fields of a decision that replay recomputes and compares. */
const COMPARED = [
  "allow",
  "rule",
  "intentKey",
  "messageHash",
  "amounts",
  "posture",
  "telemetry",
  "temperatureMax",
  "expires",
  "latch",
  "disclosure",
] as const;

/**
 * Recompute every decision of a record from its bytes, under `policy`, and name the first that
 * differs. Under the policy it was written with, a sound record replays exactly; under another
 * policy, replay says where that policy would have decided differently.
 */
export async function replay(
  entries: readonly Entry[],
  policyInput: unknown,
  sensor: Sensor = sensorV1,
  trust?: PolicyTrust,
): Promise<ReplayResult> {
  verifyLoadedKeel(VERIFIED_KEEL_DIGEST);
  const firstPolicy = entries.find((entry): entry is PolicyEntry => entry.kind === "policy");
  const { policy, hash } = createPolicy(policyInput ?? (firstPolicy ? JSON.parse(firstPolicy.policy) : undefined));
  if (firstPolicy && sensor !== sensorV1) throw new Error("signed policy evaluation profile requires sensor v1");
  const env: Env = {
    policy,
    policyHash: hash,
    context: contextOf(policy),
    sensor,
    governor: await Governor.create(),
    state: initialState(),
    trust,
  };
  env.state.retentionMs = retentionWindow(entries, policy.windowMs);
  const checker = replayChecker(env);
  for (const entry of entries) {
    const divergence = checker.accept(entry);
    if (divergence) return divergence;
  }
  return checker.finish();
}

export class StreamReplayError extends Error {
  readonly code = "stream-replay";
  constructor(message: string) {
    super(message);
    this.name = "StreamReplayError";
  }
}

/**
 * Replay a record read twice from a source: once to find its policies and their longest window,
 * once to recompute it. The second read must match the first, byte for byte. Active and request
 * state still need separate bounds.
 */
export async function replayStream(
  open: () => AsyncIterable<Entry>,
  policyInput: unknown,
  sensor: Sensor = sensorV1,
  trust?: PolicyTrust,
): Promise<ReplayResult> {
  try {
    const policySeed = structuredClone(policyInput),
      pins = structuredClone(trust);
    if (typeof open !== "function") throw new StreamReplayError("replay source factory is required");
    verifyLoadedKeel(VERIFIED_KEEL_DIGEST);
    let firstPolicy: PolicyEntry | undefined;
    let retentionMs = 0;
    let count = 0;
    let fingerprint = "";
    // A future longer policy window must not lose reservations pruned by an earlier one.
    for await (const input of open()) {
      const text = canonicalJSON(input);
      const entry = JSON.parse(text) as Entry;
      fingerprint = sha256hex(fingerprint + text);
      count++;
      if (entry.kind === "policy") {
        firstPolicy ??= entry;
        retentionMs = Math.max(retentionMs, createPolicy(JSON.parse(entry.policy)).policy.windowMs);
      }
    }
    const { policy, hash } = createPolicy(policySeed ?? (firstPolicy ? JSON.parse(firstPolicy.policy) : undefined));
    if (firstPolicy && sensor !== sensorV1)
      throw new StreamReplayError("signed policy evaluation profile requires sensor v1");
    const env: Env = {
      policy,
      policyHash: hash,
      context: contextOf(policy),
      sensor,
      governor: await Governor.create(),
      state: initialState(),
      trust: pins,
    };
    env.state.retentionMs = Math.max(retentionMs, policy.windowMs);
    let checked = 0;
    let checkedFingerprint = "";
    const records = async function* () {
      for await (const input of open()) {
        const text = canonicalJSON(input);
        checkedFingerprint = sha256hex(checkedFingerprint + text);
        checked++;
        yield JSON.parse(text) as Entry;
      }
    };
    const result = await recompute(env, records());
    if (result.ok && (checked !== count || checkedFingerprint !== fingerprint))
      throw new StreamReplayError("replay source changed between complete reads");
    return result;
  } catch (error) {
    if (error instanceof StreamReplayError) throw error;
    throw new StreamReplayError("streamed replay could not complete");
  }
}

async function recompute(env: Env, entries: Iterable<Entry> | AsyncIterable<Entry>): Promise<ReplayResult> {
  const checker = replayChecker(env);
  for await (const entry of entries) {
    const divergence = checker.accept(entry);
    if (divergence) return divergence;
  }
  return checker.finish();
}

/** Accepts a record's entries in order, recomputing each decision, and reports the first divergence. */
function replayChecker(env: Env) {
  let decisions = 0;
  let previous: DecisionEntry | undefined;
  return {
    accept(entry: Entry): ReplayResult | null {
      const diverge = (field: string, recorded: unknown, recomputed: unknown): ReplayResult => ({
        ok: false,
        decisions,
        divergence: { seq: entry.seq, field, recorded, recomputed },
      });
      if (hashOf(entry) !== entry.hash) return diverge("hash", entry.hash, hashOf(entry));
      if (entry.kind === "decision" && env.policyEntry && entry.policyHash !== env.policyHash)
        return diverge("policyHash", entry.policyHash, env.policyHash);
      if (entry.kind === "decision") {
        decisions++;
        const prior = previous;
        previous = entry;
        if (entry.input === "invalid") {
          // The proposal itself was ill-formed; the record keeps no more of it than that.
          if (entry.allow || entry.rule !== "malformed-proposal")
            return diverge("rule", entry.rule, "malformed-proposal");
        } else {
          const again = evaluate(env, proposalOf(entry), prior);
          for (const field of COMPARED) {
            if (canonicalJSON(entry[field] ?? null) !== canonicalJSON(again[field] ?? null))
              return diverge(field, entry[field], again[field]);
          }
          // Keel has ticked in evaluate; apply the entry without ticking it twice.
          try {
            apply(env.state, entry, env.policy, env.policyEntry ? env.policyHash : undefined);
          } catch (err) {
            return diverge("chain", entry.prev, (err as Error).message);
          }
          return null;
        }
      }
      try {
        reapply(env, entry);
      } catch (err) {
        return diverge("chain", entry.prev, (err as Error).message);
      }
      return null;
    },
    finish(): ReplayResult {
      return { ok: true, decisions, divergence: null };
    },
  };
}

/** The proposal a recorded decision was made on, rebuilt from the record. */
function proposalOf(entry: DecisionEntry): ProposalV1 {
  return {
    message: new Uint8Array(Buffer.from(entry.message, "base64")),
    at: entry.at,
    ...(entry.blockHeight === null ? {} : { blockHeight: BigInt(entry.blockHeight) }),
    ...(entry.lastValidBlockHeight === null ? {} : { lastValidBlockHeight: BigInt(entry.lastValidBlockHeight) }),
    ...(entry.group === null ? {} : { intent: entry.group }),
  };
}

// --- one decision ----------------------------------------------------------------------------------

/**
 * One decision, by rules 1 to 19 in order, against the state as it stands. It ticks Keel for
 * every parsed proposal and changes nothing else: committing the result is the caller's. A denial
 * that completes the policy's run of denials trips the latch. At REGROUND, Keel's own denial
 * or a second consecutive REGROUND denial trips it (ADR-012 C).
 */
function evaluate(env: Env, p: ProposalV1, previous: DecisionEntry | undefined): DecisionBody {
  const body = evaluateRules(env, p);
  const { state, policy } = env;
  const regroundTrips =
    body.posture === "REGROUND" &&
    (body.rule === "loop-reground" || (previous?.allow === false && previous.posture === "REGROUND"));
  const trips =
    !body.allow && !state.latched && (state.consecutiveDenials + 1 >= policy.latch.afterDenials || regroundTrips);
  return trips ? { ...body, latch: true } : body;
}

/** A rule's verdict on a proposal it refuses: which rule, and why, in words the operator reads. */
interface Denial {
  rule: RuleV1;
  reason: string;
}

/** What rules 4 to 18 judge: the decoded effects and their totals, what Keel made of them, and when. */
interface Judged {
  policy: Policy;
  state: GuardState;
  effects: EffectsV1;
  total: Totals;
  telemetry: Telemetry;
  keel: KeelDecision;
  now: number;
  blockHeight: bigint | null;
}

function evaluateRules(env: Env, p: ProposalV1): DecisionBody {
  const { policy, state } = env;
  const at = typeof p?.at === "number" && Number.isFinite(p.at) && p.at >= 0 ? p.at : (state.maxAt ?? 0);
  const base = {
    kind: "decision" as const,
    ...(policy.disclosure === "full" ? { disclosure: "full" as const } : {}),
    at,
    source: env.authority ? ("signer" as const) : ("caller" as const),
    ...(env.authority ? { deployment: env.authority } : {}),
    message: p?.message instanceof Uint8Array ? Buffer.from(p.message).toString("base64") : "",
    blockHeight: typeof p?.blockHeight === "bigint" ? p.blockHeight.toString() : null,
    lastValidBlockHeight: typeof p?.lastValidBlockHeight === "bigint" ? p.lastValidBlockHeight.toString() : null,
    group: typeof p?.intent === "string" ? p.intent : null,
    policyHash: env.policyHash,
    keel: KEEL,
  };
  const parsed = {
    intentKey: null as string | null,
    messageHash: null as string | null,
    shape: null as string | null,
    amounts: null as Amounts | null,
  };
  const keelSaw = {
    posture: null as Posture | null,
    telemetry: null as Telemetry | null,
    temperatureMax: null as number | null,
  };
  const decide = (
    allow: boolean,
    rule: RuleV1 | undefined,
    reason: string,
    extra: Partial<DecisionBody> = {},
  ): DecisionBody => ({ ...base, ...parsed, ...keelSaw, allow, ...(rule ? { rule } : {}), reason, ...extra });

  try {
    // Rule 1, the proposal's own shape; then rules 1 to 3, inside decoding.
    const problem = proposalProblem(p);
    if (problem) return decide(false, "malformed-proposal", problem, { input: "invalid" });
    let effects: EffectsV1;
    try {
      effects = effectsOf(p.message, env.context);
    } catch (err) {
      if (err instanceof DecodeError) return decide(false, err.rule, err.message);
      throw err;
    }
    const total = totals(effects);
    parsed.intentKey = effects.intentKey;
    parsed.messageHash = effects.messageHash;
    parsed.shape = sha256hex(
      canonicalJSON({
        programs: [...effects.programs].sort(),
        to: [...effects.sol.map((outflow) => outflow.to), ...effects.tokens.map((token) => token.toAccount)].sort(),
      }),
    );
    parsed.amounts = {
      sol: total.sol.toString(),
      tokens: [...total.tokens].map(([mint, amount]) => ({ mint, amount: amount.toString() })),
      fees: total.fees.toString(),
    };

    // Every parsed proposal reaches Keel, allowed or denied: re-proposing a refused transfer is a loop too.
    const telemetry = env.sensor(effects, state.sensor, policy, at, parsed.shape);
    // Keel's tick() coerces null, strings, booleans and arrays (upstream finding U-2), so telemetry
    // is checked here, and refused before Keel sees it (defect D3).
    if (!telemetryAccepted(telemetry)) {
      return decide(
        false,
        "fail-closed",
        `the sensor's telemetry was refused before Keel saw it: ${describeTelemetry(telemetry)}`,
      );
    }
    keelSaw.telemetry = {
      intensity: telemetry.intensity,
      valence: telemetry.valence,
      repetition: telemetry.repetition,
    };
    const keel = env.governor.tick(telemetry);
    keelSaw.posture = keel.posture;
    keelSaw.temperatureMax = keel.temperatureMax;

    const denial = firstDenial({
      policy,
      state,
      effects,
      total,
      telemetry,
      keel,
      now: nowFor(state, at),
      blockHeight: p.blockHeight ?? null,
    });
    if (denial) return decide(false, denial.rule, denial.reason);
    const expires =
      p.lastValidBlockHeight === undefined
        ? {}
        : { expires: { lastValidBlockHeight: p.lastValidBlockHeight.toString() } };
    return decide(true, undefined, "", expires);
  } catch (err) {
    return decide(
      false,
      "fail-closed",
      `the guard could not decide, so it denies: ${(err as Error)?.message ?? String(err)}`,
    );
  }
}

/** Rules 4 to 18, in the order they are applied. The first that refuses is the reason. */
const RULES: readonly ((judged: Judged) => Denial | null)[] = [
  latched,
  durableNonce,
  otherSigner,
  programNotAllowed,
  opaqueProgram,
  instructionDenied,
  destinationNotAllowed,
  mintNotAllowed,
  overPerTxCap,
  overFeeCap,
  intentInFlight,
  overWindowCap,
  loopReground,
  inhibitCap,
];

function firstDenial(judged: Judged): Denial | null {
  for (const rule of RULES) {
    const denial = rule(judged);
    if (denial) return denial;
  }
  return null;
}

/** Rule 4: a latched guard admits nothing until the operator releases it. */
function latched({ state }: Judged): Denial | null {
  if (state.latched)
    return {
      rule: "latched",
      reason: `the guard latched at decision ${state.latched.seq}; only the operator's signed release frees it`,
    };
  return null;
}

/** Rule 5: a durable nonce makes a transaction valid forever, so a receipt for it could never expire. */
function durableNonce({ effects }: Judged): Denial | null {
  const nonce = effects.denied.find((denied) => denied.rule === "durable-nonce-denied");
  if (effects.nonce || nonce)
    return { rule: "durable-nonce-denied", reason: nonce?.reason ?? "the first instruction advances a durable nonce" };
  return null;
}

/** Rule 6: only the principal signs while co-signing is off. */
function otherSigner({ effects }: Judged): Denial | null {
  if (effects.otherSigners.length)
    return {
      rule: "other-signer",
      reason: `${effects.otherSigners.join(", ")} must sign too, and only the principal may sign while co-signing is off`,
    };
  return null;
}

/** Rule 7. */
function programNotAllowed({ effects, policy }: Judged): Denial | null {
  const program = effects.programs.find((id) => !policy.programs.allow.includes(id));
  if (program) return { rule: "program-not-allowed", reason: `program ${program} is not on the allowlist` };
  return null;
}

/** Rule 8: an allowlisted program the guard cannot decode runs only if the policy allows opaque programs. */
function opaqueProgram({ effects, policy }: Judged): Denial | null {
  if (effects.opaque.length && policy.programs.opaque === "deny")
    return {
      rule: "opaque-program",
      reason: `the guard does not decode ${effects.opaque.join(", ")}, and the policy denies opaque programs`,
    };
  return null;
}

/** Rule 9: an instruction the classifier refused, such as an Approve or a SetAuthority. */
function instructionDenied({ effects }: Judged): Denial | null {
  const instruction = effects.denied.find((denied) => denied.rule === "instruction-denied");
  if (instruction)
    return {
      rule: "instruction-denied",
      reason: `instruction ${instruction.index}, ${instruction.instruction}: ${instruction.reason}`,
    };
  return null;
}

/** Rule 10: SOL and tokens go only to the policy's destinations. */
function destinationNotAllowed({ effects, policy }: Judged): Denial | null {
  const sol = effects.sol.find((outflow) => !policy.destinations.allow.includes(outflow.to));
  if (sol)
    return {
      rule: "destination-not-allowed",
      reason: `${readable(sol.lamports)} lamports to ${sol.to}, which is not an allowed destination`,
    };
  const token = effects.tokens.find(
    (outflow) => outflow.toOwner === null && !policy.destinations.allow.includes(outflow.toAccount),
  );
  if (token)
    return {
      rule: "destination-not-allowed",
      reason: `tokens to ${token.toAccount}, which is neither an allowed owner's associated account nor an allowed address`,
    };
  return null;
}

/** Rule 11: every token moved is of a listed mint, under its listed program. */
function mintNotAllowed({ effects, policy }: Judged): Denial | null {
  for (const token of effects.tokens) {
    if (token.mint === null)
      return {
        rule: "token-mint-unknown",
        reason: `a ${token.program} Transfer from ${token.fromAccount} names no mint, and that account is not the principal's associated account for a listed mint`,
      };
    if (!policy.tokens.some((listed) => listed.mint === token.mint && listed.program === token.program))
      return {
        rule: "mint-not-allowed",
        reason: `mint ${token.mint} under the ${token.program} program is not listed`,
      };
  }
  return null;
}

/** Rule 12. */
function overPerTxCap({ total, policy }: Judged): Denial | null {
  if (total.sol > policy.sol.maxPerTx)
    return {
      rule: "over-per-tx-cap",
      reason: `${readable(total.sol)} lamports is over the per-transaction cap of ${readable(policy.sol.maxPerTx)}`,
    };
  for (const limit of policy.tokens) {
    const amount = total.tokens.get(limit.mint) ?? 0n;
    if (amount > limit.maxPerTx)
      return {
        rule: "over-per-tx-cap",
        reason: `${readable(amount)} of ${limit.mint} is over its per-transaction cap of ${readable(limit.maxPerTx)}`,
      };
  }
  return null;
}

/** Rule 13. */
function overFeeCap({ effects, policy }: Judged): Denial | null {
  if (effects.priorityFee > policy.fees.maxPriorityPerTx)
    return {
      rule: "over-fee-cap",
      reason: `a priority fee of ${readable(effects.priorityFee)} lamports is over the cap of ${readable(policy.fees.maxPriorityPerTx)}`,
    };
  return null;
}

/**
 * Rules 14 and 15: no new attempt at the same effects while an earlier one could still land, or
 * may have landed unreported, and no more attempts than the policy allows.
 */
function intentInFlight({ state, policy, effects, now, blockHeight }: Judged): Denial | null {
  const intent = currentIntent(state, policy, effects.intentKey, now, blockHeight);
  if (!intent) return null;
  const live = intent.attempts.find((attempt) => couldStillLand(attempt, blockHeight));
  if (live)
    return {
      rule: "intent-in-flight",
      reason: `an earlier attempt at the same effects (decision ${live.decision.slice(0, 12)}…) could still land; report its outcome, or propose once its last valid block height has passed`,
    };
  const open = intent.attempts.find(unresolved);
  if (open)
    return {
      rule: "intent-in-flight",
      reason: `an earlier attempt at the same effects (decision ${open.decision.slice(0, 12)}…) is past its last valid block height, but its outcome was never reported, so it may have landed; report landed, failed or expired, or propose once the window has passed since the first attempt`,
    };
  if (intent.attempts.length >= policy.intents.maxAttempts)
    return {
      rule: "intent-attempts-exhausted",
      reason: `the same effects have been attempted ${intent.attempts.length} times, the most the policy allows`,
    };
  return null;
}

/** Rule 16, counted at admission against what is already reserved. */
function overWindowCap({ state, policy, total, now, blockHeight }: Judged): Denial | null {
  const reserved = windowTotals(state, policy, now, blockHeight);
  if (reserved.sol + total.sol > policy.sol.maxPerWindow)
    return {
      rule: "over-window-cap",
      reason: `${readable(reserved.sol)} + ${readable(total.sol)} lamports would pass the cap of ${readable(policy.sol.maxPerWindow)} per ${policy.windowMs} ms`,
    };
  for (const limit of policy.tokens) {
    const held = reserved.tokens.get(limit.mint) ?? 0n;
    const amount = total.tokens.get(limit.mint) ?? 0n;
    if (amount > 0n && held + amount > limit.maxPerWindow)
      return {
        rule: "over-window-cap",
        reason: `${readable(held)} + ${readable(amount)} of ${limit.mint} would pass its cap of ${readable(limit.maxPerWindow)} per window`,
      };
  }
  if (reserved.fees + total.fees > policy.fees.maxPerWindow)
    return {
      rule: "over-window-cap",
      reason: `${readable(reserved.fees)} + ${readable(total.fees)} lamports of fees and tips would pass the cap of ${readable(policy.fees.maxPerWindow)} per window`,
    };
  return null;
}

/** Rule 17: Keel's REGROUND, a saturating loop, refuses outright. */
function loopReground({ keel, telemetry }: Judged): Denial | null {
  if (keel.posture === "REGROUND")
    return {
      rule: "loop-reground",
      reason: `Keel reports a saturating loop (REGROUND): repetition ${telemetry.repetition}, valence ${telemetry.valence.toFixed(2)}`,
    };
  return null;
}

/** Rule 18: under INHIBIT, nothing over the per-transaction cap times Keel's clamp. Solanaut's mapping, not Gubernaut's. */
function inhibitCap({ keel, total, policy }: Judged): Denial | null {
  if (keel.posture !== "INHIBIT") return null;
  const scale = BigInt(Math.round(keel.temperatureMax * 1_000_000));
  const over = (amount: bigint, cap: bigint) => amount * 1_000_000n > cap * scale;
  if (over(total.sol, policy.sol.maxPerTx))
    return {
      rule: "inhibit-cap",
      reason: `under INHIBIT, ${readable(total.sol)} lamports is over ${keel.temperatureMax} of the per-transaction cap`,
    };
  for (const limit of policy.tokens) {
    if (over(total.tokens.get(limit.mint) ?? 0n, limit.maxPerTx))
      return {
        rule: "inhibit-cap",
        reason: `under INHIBIT, ${limit.mint} is over ${keel.temperatureMax} of its per-transaction cap`,
      };
  }
  return null;
}

function proposalProblem(p: unknown): string | null {
  if (p === null || typeof p !== "object") return "the proposal is not an object";
  const fields = p as Record<string, unknown>;
  if (!(fields.message instanceof Uint8Array)) return "message must be the serialized message, as a Uint8Array";
  if (typeof fields.at !== "number" || !Number.isFinite(fields.at) || fields.at < 0)
    return "at must be a time in milliseconds";
  if (!isHeight(fields.blockHeight)) return "blockHeight must be a non-negative bigint";
  if (!isHeight(fields.lastValidBlockHeight)) return "lastValidBlockHeight must be a non-negative bigint";
  if (fields.intent !== undefined && (typeof fields.intent !== "string" || fields.intent.length > 256))
    return "intent must be text of at most 256 characters";
  return null;
}

function isHeight(height: unknown) {
  return height === undefined || (typeof height === "bigint" && height >= 0n);
}

type Totals = ReturnType<typeof totals>;

/** What a message would move, totalled: SOL, each mint, and fees with tips. */
function totals(effects: EffectsV1) {
  const sol = effects.sol.reduce((sum, outflow) => sum + outflow.lamports, 0n);
  const tokens = new Map<string, bigint>();
  for (const token of effects.tokens)
    if (token.mint !== null) tokens.set(token.mint, (tokens.get(token.mint) ?? 0n) + token.amount);
  return { sol, tokens, fees: effects.priorityFee + effects.baseFee + effects.tips };
}

function telemetryAccepted(telemetry: unknown): telemetry is Telemetry {
  if (telemetry === null || typeof telemetry !== "object") return false;
  const fields = telemetry as Record<string, unknown>;
  return (
    ["intensity", "valence", "repetition"].every((name) => typeof fields[name] === "number") &&
    Governor.accepts(telemetry as Telemetry)
  );
}

function describeTelemetry(telemetry: unknown) {
  try {
    return (
      JSON.stringify(telemetry, (_key, value) =>
        typeof value === "number" && !Number.isFinite(value) ? String(value) : value,
      ) ?? String(telemetry)
    );
  } catch {
    return String(telemetry);
  }
}

/** Amounts in reasons, grouped by thousands: 1,000,000. */
function readable(amount: bigint) {
  return amount.toLocaleString("en-US");
}

// --- applying a recorded entry again ---------------------------------------------------------------

/** Apply a recorded entry to the state and to Keel, as restore and replay both must. */
function reapply(env: Env, entry: Entry): void {
  if (
    entry.kind === "decision" &&
    entry.input === "invalid" &&
    (entry.posture !== null || entry.telemetry !== null || entry.temperatureMax !== null)
  ) {
    throw new Error("malformed proposal history cannot contain Keel observations");
  }
  if (entry.kind === "decision" && env.policyEntry && entry.policyHash !== env.policyHash)
    throw new Error("recorded decision names another signed policy");
  if (entry.kind === "policy") {
    env.policy = verifyPolicyEntry(entry, env.trust, env.policyEntry);
    env.policyHash = createPolicy(env.policy).hash;
    env.context = contextOf(env.policy);
    env.policyEntry = entry;
  }
  if (entry.kind === "decision" && entry.posture !== null && entry.telemetry !== null) {
    const keel = env.governor.tick(entry.telemetry);
    if (keel.posture !== entry.posture)
      throw new Error(
        `the record does not replay: at seq ${entry.seq} Keel gives ${keel.posture}, and the record says ${entry.posture}`,
      );
  }
  apply(env.state, entry, env.policy, env.policyEntry ? env.policyHash : undefined);
  if (entry.kind === "release") env.governor.reset();
}

// --- Keel, verified --------------------------------------------------------------------------------

/**
 * Hash a Keel module's source and the controller embedded in it. Keel 1.0.1 declares its digest
 * as a constant and checks only the length of what it loads (upstream finding U-1), so Solanaut
 * hashes the bytes itself: the wasm against the declared digest, and the whole module, which is the
 * code that runs the wasm, against the pinned file (defect D4).
 */
export function verifyKeelSource(text: string): {
  ok: boolean;
  moduleSha256: string;
  wasmSha256: string;
  problem: string;
} {
  const moduleSha256 = sha256hex(text);
  const embedded = /var WASM_BASE64 = "([A-Za-z0-9+/=]+)";/.exec(text);
  const wasmSha256 = embedded ? sha256hex(new Uint8Array(Buffer.from(embedded[1]!, "base64"))) : "";
  let problem = "";
  if (!embedded) problem = "the module embeds no controller";
  else if (wasmSha256 !== VERIFIED_KEEL_DIGEST)
    problem = `the embedded controller hashes to ${wasmSha256}, not the verified ${VERIFIED_KEEL_DIGEST}`;
  else if (moduleSha256 !== VERIFIED_KEEL_MODULE)
    problem = `the module that runs the controller hashes to ${moduleSha256}, not the verified ${VERIFIED_KEEL_MODULE}`;
  return { ok: problem === "", moduleSha256, wasmSha256, problem };
}

/** Verify the Keel module this process actually loads, by the path Node resolves for it. */
function verifyLoadedKeel(expectedDigest: string): void {
  const path = fileURLToPath(import.meta.resolve("@gubernaut/core"));
  const verified = verifyKeelSource(readFileSync(path, "utf8"));
  if (!verified.ok)
    throw new Error(
      `Keel's controller failed verification: ${verified.problem}. Refusing to guard with an unverified controller.`,
    );
  if (verified.wasmSha256 !== expectedDigest || wasmDigest !== expectedDigest) {
    throw new Error(
      `Keel's controller digest is ${verified.wasmSha256}, not the expected ${expectedDigest}. Refusing to guard with an unverified controller.`,
    );
  }
}

// --- the signer host's private companions ----------------------------------------------------------
//
// A signer host admits proposals and serves control requests through these, never through the
// guard's own methods: each waits its turn and first proves the record on disk is the one the guard
// holds. Only a guard created with a signed policy has them.

export class OwnedRequestAdmissionError extends Error {
  readonly code = "owned-request-admission";
  constructor(message: string) {
    super(message);
    this.name = "OwnedRequestAdmissionError";
  }
}

export class OwnedControlRequestError extends Error {
  readonly code = "owned-control-request";
  constructor(message: string) {
    super(message);
    this.name = "OwnedControlRequestError";
  }
}

interface OwnedControls {
  begin(identity: RequestIdentity, method: ControlMethod, input: unknown, at: number): Promise<ControlRequestEntry>;
  finish(identity: RequestIdentity, startHash: string, input: unknown): Promise<ControlResponseEntry>;
  result(identity: RequestIdentity, startHash: string): Promise<unknown>;
}

const ownedAdmissions = new WeakMap<Guard, (proposal: ProposalV1, identity: RequestIdentity) => Promise<Decision>>();
const ownedControls = new WeakMap<Guard, OwnedControls>();

/** Internal companion: unchanged synchronous SDK methods still retain their full history. */
export async function checkOwnedRequest(
  guard: Guard,
  proposal: ProposalV1,
  identity: RequestIdentity,
): Promise<Decision> {
  const admit = ownedAdmissions.get(guard);
  if (!admit) throw new OwnedRequestAdmissionError("owned admission requires a genuine signed guard");
  try {
    return await admit(proposal, identity);
  } catch (error) {
    if (error instanceof OwnedRequestAdmissionError) throw error;
    throw new OwnedRequestAdmissionError("owned admission cannot establish current request evidence");
  }
}

/** Internal companions share the owned admission FIFO; no signing or sending. */
export function beginOwnedRequest(
  guard: Guard,
  identity: RequestIdentity,
  method: ControlMethod,
  input: unknown,
  at: number,
): Promise<ControlRequestEntry> {
  return ownedControl(guard, (controls) => controls.begin(identity, method, input, at));
}

export function finishOwnedRequest(
  guard: Guard,
  identity: RequestIdentity,
  startHash: string,
  input: unknown,
): Promise<ControlResponseEntry> {
  return ownedControl(guard, (controls) => controls.finish(identity, startHash, input));
}

export function ownedRequestResult(guard: Guard, identity: RequestIdentity, startHash: string): Promise<unknown> {
  return ownedControl(guard, (controls) => controls.result(identity, startHash));
}

async function ownedControl<T>(guard: Guard, work: (controls: OwnedControls) => Promise<T>): Promise<T> {
  const controls = ownedControls.get(guard);
  if (!controls) throw new OwnedControlRequestError("owned controls require a genuine signed guard");
  try {
    return await work(controls);
  } catch {
    throw new OwnedControlRequestError("owned control cannot establish current request evidence");
  }
}

/** A reply the caller cannot change: a deep copy, frozen all the way down. */
function frozenCopy<T>(input: T): T {
  const reply = structuredClone(input);
  deepFreeze(reply);
  return reply;
}

function deepFreeze(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}
