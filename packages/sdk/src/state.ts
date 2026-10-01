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

import type { Policy } from "./policy.ts";
import type { DecisionEntry, Entry, Outcome } from "./log.ts";
import { RECENT, SENSOR_V1 } from "./sensor.ts";

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

/** The effective time of a proposal at `at`: never earlier than anything already recorded. */
export const nowFor = (s: GuardState, at: number) => Math.max(at, s.maxAt ?? at);

/** An attempt that could still land: its outcome is not final, and no trusted height shows its blockhash expired. */
export function couldStillLand(a: Attempt, blockHeight: bigint | null): boolean {
  if (a.status !== "pending" && a.status !== "unknown") return false;
  return !(blockHeight !== null && a.lastValidBlockHeight !== null && blockHeight > a.lastValidBlockHeight);
}

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

/** What the window ending at `now` already holds. */
export function windowTotals(s: GuardState, policy: Policy, now: number) {
  let sol = 0n;
  let fees = 0n;
  const tokens = new Map<string, bigint>();
  for (const r of s.reservations.values()) {
    if (r.at <= now - policy.windowMs) continue;
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
  if (e.seq !== s.seq || e.prev !== s.head) {
    throw new Error(`the record breaks at seq ${e.seq}: expected seq ${s.seq} after ${s.head || "the start"}`);
  }
  s.seq += 1;
  s.head = e.hash;
  s.maxAt = Math.max(s.maxAt ?? e.at, e.at);

  switch (e.kind) {
    case "decision": {
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
      // The operator has looked: start the stream over. The windows and intents stand.
      s.latched = null;
      s.consecutiveDenials = 0;
      s.sensor = { recent: [], failureStreak: 0, unknownStreak: 0, lastAt: s.sensor.lastAt, times: [] };
      return;
    }
    case "redeem":
      s.redeemed.add(e.decision);
      return;
  }
}

/**
 * Forget what can no longer matter: reservations outside the window whose attempt is final, and
 * intents with nothing left to count or wait for. Driven only by recorded times, so a restore
 * prunes exactly as the live guard did.
 */
function prune(s: GuardState, policy: Policy): void {
  const horizon = (s.maxAt ?? 0) - policy.windowMs;
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
