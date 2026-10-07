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
import type { ControlRequestEntry, ControlResponseEntry, DecisionEntry, Entry, Outcome } from "./log.ts";
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
  sensor: { recent: { intentKey: string; shape: string; fees: bigint; landed: boolean }[]; failureStreak: number; unknownStreak: number; lastAt: number | null; times: number[] };
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

const big = (s: string | null) => (s === null ? null : BigInt(s));

export function retentionWindow(entries: readonly Entry[], current: number): number {
  let window = current;
  for (const e of entries) if (e.kind === "policy") window = Math.max(window, createPolicy(JSON.parse(e.policy)).policy.windowMs);
  return window;
}

/** The effective time of a proposal at `at`: never earlier than anything already recorded. */
export const nowFor = (s: GuardState, at: number) => Math.max(at, s.maxAt ?? at);

/** An attempt that could still land: its outcome is not final, and no trusted height shows its blockhash expired. */
export function couldStillLand(a: Attempt, blockHeight: bigint | null): boolean {
  if (a.status !== "pending" && a.status !== "unknown") return false;
  return !(blockHeight !== null && a.lastValidBlockHeight !== null && blockHeight > a.lastValidBlockHeight);
}

/**
 * An attempt whose outcome nobody has reported as final. Past its last valid height it can no longer
 * land, but it may already have: until a report says which, it holds its intent (D14).
 */
export const unresolved = (a: Attempt): boolean => a.status === "pending" || a.status === "unknown";

/**
 * The live attempts at these effects, or null if the next allowed one starts a new intent. An
 * intent ends when an attempt lands, or once its window has passed since its first attempt with
 * nothing still able to land, so an exhausted intent is not blocked forever.
 */
export function currentIntent(s: GuardState, policy: Policy, intentKey: string, now: number, blockHeight: bigint | null): Intent | null {
  const i = s.intents.get(intentKey);
  if (!i || i.done) return null;
  if (now - i.firstAt >= policy.windowMs && !i.attempts.some((a) => couldStillLand(a, blockHeight))) return null;
  return i;
}

/**
 * What the window ending at `now` already holds. An attempt that a trusted height shows can still land stays counted
 * past the window, or a short window would admit a second payment beside it (D20).
 */
export function windowTotals(s: GuardState, policy: Policy, now: number, blockHeight: bigint | null = null) {
  let sol = 0n;
  let fees = 0n;
  const tokens = new Map<string, bigint>();
  const stillLanding = (hash: string, r: Reservation) => {
    if (blockHeight === null) return false;
    const a = s.intents.get(r.intentKey)?.attempts.find((x) => x.decision === hash);
    return a !== undefined && unresolved(a) && a.lastValidBlockHeight !== null && blockHeight <= a.lastValidBlockHeight;
  };
  for (const [hash, r] of s.reservations) {
    if (r.at <= now - policy.windowMs && !stillLanding(hash, r)) continue;
    if (!r.valueReleased) {
      sol += r.sol;
      for (const [mint, amount] of r.tokens) tokens.set(mint, (tokens.get(mint) ?? 0n) + amount);
    }
    if (!r.feesReleased) fees += r.fees;
  }
  return { sol, fees, tokens };
}

/** Apply one entry. Deterministic: the same entries, in the same order, give the same state. */
export function apply(s: GuardState, e: Entry, policy: Policy): void {
  if (e.v !== 1) throw new Error("unsupported record format version");
  if (e.kind === "decision") {
    if (e.source === "signer") { if (!e.deployment) throw new Error("signer authority is missing"); copyAuthority(e.deployment); }
    else if (e.deployment) throw new Error("caller decision cannot claim signer authority");
  }
  if (e.kind === "decision" && e.request) {
    verifyRequest(e, policy.latch.guardId);
    if (s.requests.has(requestKey(e.request))) throw new Error("duplicate recorded request identity");
  }
  if (e.kind === "request") verifyControlStart(e, policy.latch.guardId, s.requests);
  if (e.kind === "response") verifyControlResponse(e, s.requests, s.responses);
  if (e.seq !== s.seq || e.prev !== s.head) {
    throw new Error(`the record breaks at seq ${e.seq}: expected seq ${s.seq} after ${s.head || "the start"}`);
  }
  s.seq += 1;
  s.head = e.hash;
  s.maxAt = Math.max(s.maxAt ?? e.at, e.at);

  switch (e.kind) {
    case "request": s.requests.set(requestKey(e.request), e); return;
    case "response": s.responses.set(e.request, e); return;
    case "policy":
      return; // The guard verifies and selects it; this entry changes no admission state.
    case "decision": {
      if (e.request) s.signing.set(e.hash, { decision: e });
      if (e.request) s.requests.set(requestKey(e.request), e);
      if (e.intentKey !== null && e.shape !== null) {
        s.sensor.recent.push({ intentKey: e.intentKey, shape: e.shape, fees: BigInt(e.amounts?.fees ?? "0"), landed: false });
        if (s.sensor.recent.length > RECENT) s.sensor.recent.shift();
        s.sensor.lastAt = e.at;
        s.sensor.times.push(e.at);
        s.sensor.times = s.sensor.times.filter((t) => t > s.maxAt! - SENSOR_V1.minuteMs);
        if (!e.allow) s.sensor.failureStreak += 1;
      }
      if (e.allow && e.intentKey !== null && e.amounts !== null) {
        const blockHeight = big(e.blockHeight);
        let intent = currentIntent(s, policy, e.intentKey, nowFor(s, e.at), blockHeight);
        if (!intent) {
          intent = { firstAt: e.at, attempts: [], done: false };
          s.intents.set(e.intentKey, intent);
        }
        intent.attempts.push({ decision: e.hash, lastValidBlockHeight: big(e.lastValidBlockHeight), status: "pending" });
        s.reservations.set(e.hash, {
          at: e.at,
          intentKey: e.intentKey,
          sol: BigInt(e.amounts.sol),
          tokens: new Map(e.amounts.tokens.map((t) => [t.mint, BigInt(t.amount)])),
          fees: BigInt(e.amounts.fees),
          valueReleased: false,
          feesReleased: false,
        });
        s.allowed.set(e.hash, e);
      }
      s.consecutiveDenials = e.allow ? 0 : s.consecutiveDenials + 1;
      if (!s.latched && e.latch) s.latched = { seq: e.seq };
      prune(s, policy);
      return;
    }
    case "report": {
      if (e.outcome !== "unknown" && s.signing.has(e.decision)) s.signing.get(e.decision)!.settled = true;
      const r = s.reservations.get(e.decision);
      const attempt = r && s.intents.get(r.intentKey)?.attempts.find((a) => a.decision === e.decision);
      if (!r || !attempt) throw new Error(`report for ${e.decision}, which holds no reservation`);
      // An unknown outcome that becomes known stops counting as unknown.
      if (attempt.status === "unknown") s.sensor.unknownStreak = Math.max(0, s.sensor.unknownStreak - 1);
      attempt.status = e.outcome;
      if (e.outcome === "landed") {
        s.intents.get(r.intentKey)!.done = true;
        s.sensor.failureStreak = 0;
        s.sensor.unknownStreak = 0;
        for (const x of s.sensor.recent) if (x.intentKey === r.intentKey) x.landed = true;
      }
      if (e.outcome === "failed" || e.outcome === "expired") {
        r.valueReleased = true;
        if (e.outcome === "expired") r.feesReleased = true;
        s.sensor.failureStreak += 1;
      }
      if (e.outcome === "unknown") s.sensor.unknownStreak += 1;
      prune(s, policy);
      return;
    }
    case "release": {
      // Verified again, as the live guard verified it, so an edited record cannot release a latch (D17).
      const problem = releaseProblem(s, e, policy);
      if (problem) throw new Error(`the record's release at seq ${e.seq} does not verify: ${problem}`);
      // The operator has looked: start the stream over. The windows and intents stand.
      s.latched = null;
      s.consecutiveDenials = 0;
      s.sensor = { recent: [], failureStreak: 0, unknownStreak: 0, lastAt: s.sensor.lastAt, times: [] };
      return;
    }
    case "signing": {
      const h = s.signing.get(e.event.decision);
      verifySigning(e.event, h, h?.redeemed === true, createPolicy(policy).hash);
      if (e.event.stage === "signed") h!.signed = e.event;
      if (e.event.stage === "send-started") h!.started = e.event;
      if (e.event.stage === "response") h!.response = e.event;
      return;
    }
    case "redeem":
      s.redeemed.add(e.decision);
      if (s.signing.has(e.decision)) s.signing.get(e.decision)!.redeemed = true;
      return;
    default:
      throw new Error("unsupported record entry kind");
  }
}

/**
 * Why a recorded release does not hold, or null if it does: the latch it names, the guard and cluster, the expiry
 * against its own recorded time, and the release key's signature over its text. The policy hash in the text is bound
 * by the signature, and is not compared, since a record outlives a policy change.
 */
function releaseProblem(s: GuardState, e: Extract<Entry, { kind: "release" }>, policy: Policy): string | null {
  if (!s.latched) return "the guard was not latched";
  const f = parseReleaseText(e.text);
  if (!f) return "its text is not a release message";
  if (f.guardId !== policy.latch.guardId || f.cluster !== policy.latch.cluster) return "it names another guard or cluster";
  if (f.seq !== e.latchSeq || f.seq !== s.latched.seq) return `it releases the latch at seq ${f.seq}, and the guard latched at ${s.latched.seq}`;
  if (!(Date.parse(f.expires) > e.at)) return `it had expired at ${f.expires}`;
  let signature: Uint8Array;
  try {
    signature = new Uint8Array(Buffer.from(e.signature, "base64"));
  } catch {
    return "its signature is not base64";
  }
  if (!verifyEd25519(policy.latch.releaseKey, new TextEncoder().encode(e.text), signature)) return "the signature is not the release key's, over its text";
  return null;
}

/**
 * Forget what can no longer matter: reservations outside the window whose attempt is final, and
 * intents with nothing left to count or wait for. Driven only by recorded times, so a restore
 * prunes exactly as the live guard did.
 */
function prune(s: GuardState, policy: Policy): void {
  const horizon = (s.maxAt ?? 0) - Math.max(policy.windowMs, s.retentionMs);
  for (const [hash, r] of s.reservations) {
    if (r.at > horizon) continue;
    const intent = s.intents.get(r.intentKey);
    const attempt = intent?.attempts.find((a) => a.decision === hash);
    if (attempt && (attempt.status === "pending" || attempt.status === "unknown")) continue;
    s.reservations.delete(hash);
    s.allowed.delete(hash);
    s.redeemed.delete(hash);
  }
  for (const [key, intent] of s.intents) {
    const live = intent.attempts.some((a) => s.reservations.has(a.decision));
    if (!live && (intent.done || intent.firstAt <= horizon)) s.intents.delete(key);
  }
}
