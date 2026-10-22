// The guard's state, and the only way it changes: applying one entry of the record (ADR-010).
// Admission reads it; a restart rebuilds it by applying every entry again, in order.
//
//   reservations   what each allowed decision holds against the windows, until it ages out
//                  or an outcome releases it: "failed" releases the value but keeps the fees,
//                  which may have been paid; "expired" releases both; "unknown" releases nothing
//   intents        attempts at the same effects, so a second signature waits while an earlier
//                  one could still land (docs/SPEC.md §7)
//   latch          tripped by a run of denials or by REGROUND; released only by the operator
//   sensor         what the sensors remember of the proposal stream

import { createPolicy, type Policy } from "./policy.ts";
import { OUTCOMES, type ControlRequestEntry, type ControlResponseEntry, type DecisionEntry, type Entry, type Outcome, type ReportEntry, type RedeemEntry } from "./log.ts";
import { verifyControlStart, verifyControlResponse } from "./control-request.ts";
import { RECENT, SENSOR_V1 } from "./sensor.ts";
import { parseReleaseText, verifyEd25519 } from "./latch.ts";
import { requestKey, verifyRequest } from "./request.ts";
import { verifySigning, type SigningHistory } from "./signing.ts";
import { copyAuthority } from "./authority.ts";

type Status = "pending" | Outcome;

export interface Attempt {
  decision: string;
  lastValidBlockHeight: bigint | null;
  status: Status;
}

export interface Intent {
  firstAt: number;
  attempts: Attempt[];
  /** An attempt landed: the intent is done. */
  done: boolean;
}

export interface Reservation {
  at: number;
  intentKey: string;
  sol: bigint;
  tokens: Map<string, bigint>;
  fees: bigint;
  valueReleased: boolean;
  feesReleased: boolean;
}

/** What the sensors remember of the proposal stream, from one release of the latch to the next. */
export interface SensorMemory {
  recent: { intentKey: string; shape: string; fees: bigint; landed: boolean }[];
  failureStreak: number;
  unknownStreak: number;
  lastAt: number | null;
  times: number[];
}

export interface GuardState {
  signing: Map<string, SigningHistory>;
  /** Full request history until the accepted disk index replaces in-memory retention. */
  requests: Map<string, DecisionEntry | ControlRequestEntry>;
  responses: Map<string, ControlResponseEntry>;
  /** During full restore/replay, retain entries needed by any recorded or incoming window. */
  retentionMs: number;
  seq: number;
  head: string;
  /** The latest time any entry carried. Windows are measured from here, so a clock that steps back cannot shrink them. */
  maxAt: number | null;
  consecutiveDenials: number;
  latched: { seq: number } | null;
  /** Allowed decisions still able to change state: reported on, redeemed, or counted. */
  allowed: Map<string, DecisionEntry>;
  reservations: Map<string, Reservation>;
  intents: Map<string, Intent>;
  redeemed: Set<string>;
  sensor: SensorMemory;
}

export function initialState(): GuardState {
  return {
    signing: new Map(),
    requests: new Map(),
    responses: new Map(),
    retentionMs: 0,
    seq: 0,
    head: "",
    maxAt: null,
    consecutiveDenials: 0,
    latched: null,
    allowed: new Map(),
    reservations: new Map(),
    intents: new Map(),
    redeemed: new Set(),
    sensor: { recent: [], failureStreak: 0, unknownStreak: 0, lastAt: null, times: [] },
  };
}

/** The longest window any policy in the record, or the current one, has used. */
export function retentionWindow(entries: readonly Entry[], current: number): number {
  let window = current;
  for (const entry of entries) if (entry.kind === "policy") window = Math.max(window, createPolicy(JSON.parse(entry.policy)).policy.windowMs);
  return window;
}

/** The effective time of a proposal at `at`: never earlier than anything already recorded. */
export const nowFor = (state: GuardState, at: number) => Math.max(at, state.maxAt ?? at);

/** An attempt that could still land: its outcome is not final, and no trusted height shows its blockhash expired. */
export function couldStillLand(attempt: Attempt, blockHeight: bigint | null): boolean {
  if (attempt.status !== "pending" && attempt.status !== "unknown") return false;
  return !(blockHeight !== null && attempt.lastValidBlockHeight !== null && blockHeight > attempt.lastValidBlockHeight);
}

/**
 * An attempt whose outcome nobody has reported as final. Past its last valid height it can no longer
 * land, but it may already have: until a report says which, it holds its intent (D14).
 */
export const unresolved = (attempt: Attempt): boolean => attempt.status === "pending" || attempt.status === "unknown";

/**
 * The live attempts at these effects, or null if the next allowed one starts a new intent. An
 * intent ends when an attempt lands, or once its window has passed since its first attempt with
 * nothing still able to land, so an exhausted intent is not blocked forever.
 */
export function currentIntent(state: GuardState, policy: Policy, intentKey: string, now: number, blockHeight: bigint | null): Intent | null {
  const intent = state.intents.get(intentKey);
  if (!intent || intent.done) return null;
  if (now - intent.firstAt >= policy.windowMs && !intent.attempts.some((attempt) => couldStillLand(attempt, blockHeight))) return null;
  return intent;
}

/**
 * What the window ending at `now` already holds. An attempt that a trusted height shows can still land stays counted
 * past the window, or a short window would admit a second payment beside it (D20).
 */
export function windowTotals(state: GuardState, policy: Policy, now: number, blockHeight: bigint | null = null) {
  let sol = 0n;
  let fees = 0n;
  const tokens = new Map<string, bigint>();
  const stillLanding = (hash: string, reservation: Reservation) => {
    if (blockHeight === null) return false;
    const attempt = state.intents.get(reservation.intentKey)?.attempts.find((candidate) => candidate.decision === hash);
    return attempt !== undefined && unresolved(attempt) && attempt.lastValidBlockHeight !== null && blockHeight <= attempt.lastValidBlockHeight;
  };
  for (const [hash, reservation] of state.reservations) {
    if (reservation.at <= now - policy.windowMs && !stillLanding(hash, reservation)) continue;
    if (!reservation.valueReleased) {
      sol += reservation.sol;
      for (const [mint, amount] of reservation.tokens) tokens.set(mint, (tokens.get(mint) ?? 0n) + amount);
    }
    if (!reservation.feesReleased) fees += reservation.fees;
  }
  return { sol, fees, tokens };
}

/** Apply one entry. Deterministic: the same entries, in the same order, give the same state. */
export function apply(state: GuardState, entry: Entry, policy: Policy, signedPolicyHash?: string): void {
  if (entry.v !== 1) throw new Error("unsupported record format version");
  if (entry.kind === "decision") verifyAttribution(entry);
  if (entry.kind === "decision" && entry.request) {
    verifyRequest(entry, policy.latch.guardId);
    if (state.requests.has(requestKey(entry.request))) throw new Error("duplicate recorded request identity");
  }
  if (entry.kind === "request") verifyControlStart(entry, policy.latch.guardId, state.requests);
  if (entry.kind === "response") verifyControlResponse(entry, state.requests, state.responses);
  if (entry.seq !== state.seq || entry.prev !== state.head) {
    throw new Error(`the record breaks at seq ${entry.seq}: expected seq ${state.seq} after ${state.head || "the start"}`);
  }
  // Recovery enforces the live report contract before advancing any state (D22).
  if (entry.kind === "report") verifyReport(state, entry);
  if (entry.kind === "redeem") verifyRedeem(state, entry, signedPolicyHash);
  state.seq += 1;
  state.head = entry.hash;
  state.maxAt = Math.max(state.maxAt ?? entry.at, entry.at);

  switch (entry.kind) {
    case "request":
      state.requests.set(requestKey(entry.request), entry);
      return;
    case "response":
      state.responses.set(entry.request, entry);
      return;
    case "policy":
      return; // The guard verifies and selects it; this entry changes no admission state.
    case "decision":
      return applyDecision(state, entry, policy);
    case "report":
      return applyReport(state, entry, policy);
    case "release":
      return applyRelease(state, entry, policy);
    case "signing":
      return applySigning(state, entry, policy);
    case "redeem":
      return applyRedeem(state, entry);
    default:
      throw new Error("unsupported record entry kind");
  }
}

/** A decision made by the signer names its deployment; a caller's never does. */
function verifyAttribution(entry: DecisionEntry): void {
  if (entry.source === "signer") {
    if (!entry.deployment) throw new Error("signer authority is missing");
    copyAuthority(entry.deployment);
  } else if (entry.deployment) {
    throw new Error("caller decision cannot claim signer authority");
  }
}

function verifyReport(state: GuardState, entry: ReportEntry): void {
  if (!OUTCOMES.includes(entry.outcome)) throw new Error("recorded report outcome is unsupported");
  if (entry.source !== "caller" && entry.source !== "signer") throw new Error("recorded report attribution is unsupported");
  if (!Number.isFinite(entry.at) || entry.at < 0) throw new Error("recorded report time is invalid");
  const reservation = state.reservations.get(entry.decision);
  const attempt = reservation && state.intents.get(reservation.intentKey)?.attempts.find((candidate) => candidate.decision === entry.decision);
  if (!state.allowed.has(entry.decision) || !reservation || !attempt) throw new Error(`report for ${entry.decision}, which holds no reservation`);
  if (!unresolved(attempt)) throw new Error("recorded report names an attempt with a final outcome");
}

function verifyRedeem(state: GuardState, entry: RedeemEntry, signedPolicyHash?: string): void {
  if (!Number.isFinite(entry.at) || entry.at < 0) throw new Error("recorded redemption time is invalid");
  const decision = state.allowed.get(entry.decision);
  const reservation = state.reservations.get(entry.decision);
  const attempt = reservation && state.intents.get(reservation.intentKey)?.attempts.find((candidate) => candidate.decision === entry.decision);
  if (!decision || !reservation || !attempt) throw new Error("recorded redemption names no allowed reservation");
  if (state.redeemed.has(entry.decision)) throw new Error("recorded receipt was already used");
  if (!unresolved(attempt)) throw new Error("recorded redemption names a final outcome");
  // Unsigned SDK records carry no historical policy selection; preserve their restore contract.
  if (signedPolicyHash !== undefined && decision.policyHash !== signedPolicyHash) throw new Error("recorded redemption names another signed policy");
  let height: bigint | null = null;
  if (entry.blockHeight !== null) {
    try {
      if (typeof entry.blockHeight !== "string") throw new Error();
      height = BigInt(entry.blockHeight);
      if (height.toString() !== entry.blockHeight) throw new Error();
    } catch {
      throw new Error("recorded redemption height is invalid");
    }
  }
  if (decision.expires && (height === null || height > BigInt(decision.expires.lastValidBlockHeight))) throw new Error("recorded redemption has missing or expired lifetime evidence");
}

/** A decision feeds the sensors; an allowed one starts or joins an intent and reserves what it moves. */
function applyDecision(state: GuardState, entry: DecisionEntry, policy: Policy): void {
  if (entry.request) state.signing.set(entry.hash, { decision: entry });
  if (entry.request) state.requests.set(requestKey(entry.request), entry);
  if (entry.intentKey !== null && entry.shape !== null) {
    state.sensor.recent.push({ intentKey: entry.intentKey, shape: entry.shape, fees: BigInt(entry.amounts?.fees ?? "0"), landed: false });
    if (state.sensor.recent.length > RECENT) state.sensor.recent.shift();
    state.sensor.lastAt = entry.at;
    state.sensor.times.push(entry.at);
    state.sensor.times = state.sensor.times.filter((time) => time > state.maxAt! - SENSOR_V1.minuteMs);
    if (!entry.allow) state.sensor.failureStreak += 1;
  }
  if (entry.allow && entry.intentKey !== null && entry.amounts !== null) {
    const blockHeight = heightOrNull(entry.blockHeight);
    let intent = currentIntent(state, policy, entry.intentKey, nowFor(state, entry.at), blockHeight);
    if (!intent) {
      intent = { firstAt: entry.at, attempts: [], done: false };
      state.intents.set(entry.intentKey, intent);
    }
    intent.attempts.push({ decision: entry.hash, lastValidBlockHeight: heightOrNull(entry.lastValidBlockHeight), status: "pending" });
    state.reservations.set(entry.hash, {
      at: entry.at,
      intentKey: entry.intentKey,
      sol: BigInt(entry.amounts.sol),
      tokens: new Map(entry.amounts.tokens.map((token) => [token.mint, BigInt(token.amount)])),
      fees: BigInt(entry.amounts.fees),
      valueReleased: false,
      feesReleased: false,
    });
    state.allowed.set(entry.hash, entry);
  }
  state.consecutiveDenials = entry.allow ? 0 : state.consecutiveDenials + 1;
  if (!state.latched && entry.latch) state.latched = { seq: entry.seq };
  prune(state, policy);
}

/** An outcome settles the attempt, and releases what its reservation held: "failed" the value, "expired" the fees too. */
function applyReport(state: GuardState, entry: ReportEntry, policy: Policy): void {
  if (entry.outcome !== "unknown" && state.signing.has(entry.decision)) state.signing.get(entry.decision)!.settled = true;
  const reservation = state.reservations.get(entry.decision)!;
  const attempt = state.intents.get(reservation.intentKey)!.attempts.find((candidate) => candidate.decision === entry.decision)!;
  // An unknown outcome that becomes known stops counting as unknown.
  if (attempt.status === "unknown") state.sensor.unknownStreak = Math.max(0, state.sensor.unknownStreak - 1);
  attempt.status = entry.outcome;
  if (entry.outcome === "landed") {
    state.intents.get(reservation.intentKey)!.done = true;
    state.sensor.failureStreak = 0;
    state.sensor.unknownStreak = 0;
    for (const recent of state.sensor.recent) if (recent.intentKey === reservation.intentKey) recent.landed = true;
  }
  if (entry.outcome === "failed" || entry.outcome === "expired") {
    reservation.valueReleased = true;
    if (entry.outcome === "expired") reservation.feesReleased = true;
    state.sensor.failureStreak += 1;
  }
  if (entry.outcome === "unknown") state.sensor.unknownStreak += 1;
  prune(state, policy);
}

function applyRelease(state: GuardState, entry: Extract<Entry, { kind: "release" }>, policy: Policy): void {
  // Verified again, as the live guard verified it, so an edited record cannot release a latch (D17).
  const problem = releaseProblem(state, entry, policy);
  if (problem) throw new Error(`the record's release at seq ${entry.seq} does not verify: ${problem}`);
  // The operator has looked: start the stream over. The windows and intents stand.
  state.latched = null;
  state.consecutiveDenials = 0;
  state.sensor = { recent: [], failureStreak: 0, unknownStreak: 0, lastAt: state.sensor.lastAt, times: [] };
}

function applySigning(state: GuardState, entry: Extract<Entry, { kind: "signing" }>, policy: Policy): void {
  const history = state.signing.get(entry.event.decision);
  verifySigning(entry.event, history, history?.redeemed === true, createPolicy(policy).hash);
  if (entry.event.stage === "signed") history!.signed = entry.event;
  if (entry.event.stage === "send-started") history!.started = entry.event;
  if (entry.event.stage === "response") history!.response = entry.event;
}

function applyRedeem(state: GuardState, entry: RedeemEntry): void {
  state.redeemed.add(entry.decision);
  if (state.signing.has(entry.decision)) state.signing.get(entry.decision)!.redeemed = true;
}

/**
 * Why a recorded release does not hold, or null if it does: the latch it names, the guard and cluster, the expiry
 * against its own recorded time, and the release key's signature over its text. The policy hash in the text is bound
 * by the signature, and is not compared, since a record outlives a policy change.
 */
function releaseProblem(state: GuardState, entry: Extract<Entry, { kind: "release" }>, policy: Policy): string | null {
  if (!state.latched) return "the guard was not latched";
  const fields = parseReleaseText(entry.text);
  if (!fields) return "its text is not a release message";
  if (fields.guardId !== policy.latch.guardId || fields.cluster !== policy.latch.cluster) return "it names another guard or cluster";
  if (fields.seq !== entry.latchSeq || fields.seq !== state.latched.seq) return `it releases the latch at seq ${fields.seq}, and the guard latched at ${state.latched.seq}`;
  if (!(Date.parse(fields.expires) > entry.at)) return `it had expired at ${fields.expires}`;
  let signature: Uint8Array;
  try {
    signature = new Uint8Array(Buffer.from(entry.signature, "base64"));
  } catch {
    return "its signature is not base64";
  }
  if (!verifyEd25519(policy.latch.releaseKey, new TextEncoder().encode(entry.text), signature)) return "the signature is not the release key's, over its text";
  return null;
}

/**
 * Forget what can no longer matter: reservations outside the window whose attempt is final, and
 * intents with nothing left to count or wait for. Driven only by recorded times, so a restore
 * prunes exactly as the live guard did.
 */
function prune(state: GuardState, policy: Policy): void {
  const horizon = (state.maxAt ?? 0) - Math.max(policy.windowMs, state.retentionMs);
  for (const [hash, reservation] of state.reservations) {
    if (reservation.at > horizon) continue;
    const intent = state.intents.get(reservation.intentKey);
    const attempt = intent?.attempts.find((candidate) => candidate.decision === hash);
    if (attempt && unresolved(attempt)) continue;
    state.reservations.delete(hash);
    state.allowed.delete(hash);
    state.redeemed.delete(hash);
  }
  for (const [key, intent] of state.intents) {
    const live = intent.attempts.some((attempt) => state.reservations.has(attempt.decision));
    if (!live && (intent.done || intent.firstAt <= horizon)) state.intents.delete(key);
  }
}

function heightOrNull(height: string | null) {
  return height === null ? null : BigInt(height);
}
