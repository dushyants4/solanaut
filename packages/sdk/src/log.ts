// The guard's record (docs/SPEC.md §3 and §7, ADR-010): one entry per decision, outcome report,
// latch release and receipt redemption, each hash-chained to the one before. The guard's state
// is whatever applying these entries in order produces, so the record is the state.
//
// Every field is a JSON primitive, so an entry hashes the same everywhere: amounts and block
// heights are decimal strings, bytes are base64.

import type { Posture, Telemetry } from "@gubernaut/core";
import { canonicalJSON, sha256hex } from "./canonical.ts";

export type RuleV1 =
  | "invalid-policy"
  | "malformed-proposal"
  | "unsupported-version"
  | "lookup-table-unpinned"
  | "latched"
  | "durable-nonce-denied"
  | "other-signer"
  | "program-not-allowed"
  | "opaque-program"
  | "instruction-denied"
  | "destination-not-allowed"
  | "mint-not-allowed"
  | "token-mint-unknown"
  | "over-per-tx-cap"
  | "over-fee-cap"
  | "intent-in-flight"
  | "intent-attempts-exhausted"
  | "over-window-cap"
  | "loop-reground"
  | "inhibit-cap"
  | "fail-closed";

export type Outcome = "landed" | "failed" | "expired" | "unknown";
export const OUTCOMES: readonly Outcome[] = ["landed", "failed", "expired", "unknown"];

interface EntryBase {
  v: 1;
  seq: number;
  /** The previous entry's hash; "" for the first. */
  prev: string;
  at: number;
  /** sha256(canonical JSON of the entry without this field), hex. */
  hash: string;
}

/** What an allowed decision reserves against the windows, as decimal strings. */
export interface Amounts {
  sol: string;
  tokens: { mint: string; amount: string }[];
  /** Priority fee, base fee and tips together. */
  fees: string;
}

export interface DecisionEntry extends EntryBase {
  kind: "decision";
  /** Explicit development disclosure; absent means the legacy/class channel. */
  disclosure?: "full";
  /** Optional SDK request identity, committed atomically with this decision. */
  request?: import("./request.ts").RequestBinding;
  /** Where time, heights and outcomes came from (docs/SPEC.md §2.1). */
  source: "caller" | "signer";
  deployment?: import("./authority.ts").RuntimeAuthority;
  /** The proposal's message bytes, base64, so the record replays on its own; "" if they were not bytes. */
  message: string;
  blockHeight: string | null;
  lastValidBlockHeight: string | null;
  /** Null if the bytes could not be parsed. */
  intentKey: string | null;
  /** The caller's own grouping key, recorded and never used to decide. */
  group: string | null;
  messageHash: string | null;
  /** Programs and destinations, hashed: the sensor's "same shape". */
  shape: string | null;
  amounts: Amounts | null;
  allow: boolean;
  /** Set on every denial: the first rule that failed. */
  rule?: RuleV1;
  reason: string;
  /** Keel's answer; null if the controller never ran for this proposal. */
  posture: Posture | null;
  telemetry: Telemetry | null;
  temperatureMax: number | null;
  policyHash: string;
  keel: { version: string; digest: string; verified: "bytes" | "declared" };
  /** Receipts only: the last block height at which the admitted bytes can land. */
  expires?: { lastValidBlockHeight: string };
  /** Set when the proposal itself was ill-formed (rule 1, before decoding): replay cannot rebuild it. */
  input?: "invalid";
  /** Set on the denial that trips the latch: a recorded fact, so no later policy can undo it. */
  latch?: true;
}

export interface ReportEntry extends EntryBase {
  kind: "report";
  decision: string;
  outcome: Outcome;
  source: "caller" | "signer";
}

export interface ReleaseEntry extends EntryBase {
  kind: "release";
  /** The seq of the decision that latched. */
  latchSeq: number;
  text: string;
  /** The operator's ed25519 signature over `text`, base64. */
  signature: string;
}

export interface RedeemEntry extends EntryBase {
  kind: "redeem";
  decision: string;
  blockHeight: string | null;
}

export interface PolicyEntry extends EntryBase {
  kind: "policy";
  policy: string;
  version: number;
  issued: string;
  text: string;
  signature: string;
  profile: typeof import("./profile.ts").EVALUATION_PROFILE;
}

export interface SigningEntry extends EntryBase {
  kind: "signing";
  event: import("./signing.ts").SigningEvent;
}

export interface ControlRequestEntry extends EntryBase {
  kind: "request";
  request: import("./request.ts").RequestBinding;
  method: import("./control-request.ts").ControlMethod;
  payload: string;
}
export interface ControlResponseEntry extends EntryBase {
  kind: "response";
  request: string;
  result: string;
}
export type Entry = DecisionEntry | ReportEntry | ReleaseEntry | RedeemEntry | PolicyEntry | SigningEntry | ControlRequestEntry | ControlResponseEntry;
export type Decision = DecisionEntry;

/** Hash an entry's body and freeze the result. */
export function seal<T extends Entry>(body: Omit<T, "hash">): T {
  const hash = sha256hex(canonicalJSON(body));
  return Object.freeze({ ...body, hash }) as T;
}

/** Recompute an entry's hash. */
export function hashOf(entry: Entry): string {
  const { hash: _hash, ...body } = entry;
  return sha256hex(canonicalJSON(body));
}
