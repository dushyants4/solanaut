// Denials, as an agent sees them and as the operator does. A reason belongs to the operator: an
// adapter's error tells the agent only the class of its denial and the decision to look up, since
// a precise reason is a map of the fence, showing a model where to push (ADR-025). The operator
// hears the rule and the reason through the observer the guard was created with.

import type { Decision, RuleV1 } from "./log.ts";

export type DeniedRule =
  | RuleV1
  /** Off-chain message signing: a raw ed25519 signature over chosen bytes can be a transaction signature. */
  | "message-signing-denied"
  /** The wallet signed something other than the admitted message, or its signature does not verify over it. */
  | "wallet-changed-message"
  | "blockhash-expired" | "rpc-unavailable" | "failure-budget";

export type DenialClass = "refused" | "retry-later" | "invalid";

export interface Refusal {
  readonly rule: DeniedRule;
  readonly reason: string;
  readonly decision: Decision | null;
}

export type RefusalObserver = (refusal: Refusal) => void | Promise<void>;

/** What an agent may do about each rule: fix its input, wait and try again, or nothing. */
const CLASSES: Readonly<Record<string, DenialClass>> = Object.freeze({
  "invalid-policy": "invalid", "malformed-proposal": "invalid", "unsupported-version": "invalid",
  "intent-in-flight": "retry-later", "blockhash-expired": "retry-later", "rpc-unavailable": "retry-later",
  "lookup-table-unpinned": "refused", latched: "refused", "durable-nonce-denied": "refused",
  "other-signer": "refused", "program-not-allowed": "refused", "opaque-program": "refused",
  "instruction-denied": "refused", "destination-not-allowed": "refused", "mint-not-allowed": "refused",
  "token-mint-unknown": "refused", "over-per-tx-cap": "refused", "over-fee-cap": "refused",
  "intent-attempts-exhausted": "refused", "over-window-cap": "refused", "loop-reground": "refused",
  "inhibit-cap": "refused", "fail-closed": "refused", "message-signing-denied": "refused",
  "wallet-changed-message": "refused", "failure-budget": "refused",
});

/** Each guard's disclosure and operator observer, captured when it was created. */
const channels = new WeakMap<object, { disclosure: "class" | "full"; observer?: RefusalObserver }>();

export class SolanautDenied extends Error {
  readonly ref: number;
  readonly class: DenialClass;
  declare readonly rule?: DeniedRule;
  declare readonly reason?: string;
  constructor(rule: DeniedRule, reason: string, decision: Decision | null) {
    const seq = decision?.seq;
    const ref = Number.isSafeInteger(seq) && seq! >= 0 ? seq! : -1;
    const classification = denialClass(rule);
    super(`${classification} (decision ${ref})`);
    this.name = "SolanautDenied";
    this.ref = ref;
    this.class = classification;
    this.stack = `${this.name}: ${this.message}`;
  }
}

/** Internal adapter boundary; the configured operator channel is captured at guard creation. */
export function denied(guard: object, rule: DeniedRule, reason: string, decision: Decision | null): SolanautDenied {
  if (decision?.allow !== false) notifyRefusal(guard, rule, reason, decision);
  const error = new SolanautDenied(rule, reason, decision);
  if (channels.get(guard)?.disclosure === "full") {
    Object.assign(error, { rule, reason });
    error.message = `${rule}: ${reason}`;
    error.stack = `${error.name}: ${error.message}`;
  }
  return error;
}

/** Run an adapter's work; anything it throws that is not already a denial becomes one. */
export async function adapterBoundary<T>(guard: object, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SolanautDenied) throw error;
    throw denied(guard, "fail-closed", "adapter operation failed", null);
  }
}

export function denialClass(rule: string): DenialClass {
  return Object.hasOwn(CLASSES, rule) ? CLASSES[rule]! : "refused";
}

export function registerRefusalChannel(guard: object, disclosure: "class" | "full", observer?: RefusalObserver): void {
  channels.set(guard, { disclosure, observer });
}

/** Tell the operator's observer, if there is one, with a frozen copy it cannot use to change anything. */
export function notifyRefusal(guard: object, rule: DeniedRule, reason: string, decision: Decision | null): void {
  const observer = channels.get(guard)?.observer;
  if (!observer) return;
  try {
    const detail = freeze(structuredClone({ rule, reason, decision }));
    Promise.resolve(observer(detail)).catch(() => observerFailure(decision?.seq ?? -1));
  } catch {
    observerFailure(decision?.seq ?? -1);
  }
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function observerFailure(ref: number): void {
  try {
    process.stderr.write(JSON.stringify({ code: "refusal-observer-failed", ref }) + "\n");
  } catch {
    // An operator diagnostic cannot change a recorded verdict.
  }
}
