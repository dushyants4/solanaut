// A guard's refusal, typed (docs/SPEC.md §8): an agent gets a named rule to act on, not a hang or a
// silent retry. Adapters throw it; the SDK's own check() returns decisions and never throws.

import type { Decision, RuleV1 } from "./log.ts";

export type DeniedRule =
  | RuleV1
  /** Off-chain message signing: a raw ed25519 signature over chosen bytes can be a transaction signature. */
  | "message-signing-denied"
  /** The wallet signed something other than the admitted message, or its signature does not verify over it. */
  | "wallet-changed-message";

export class SolanautDenied extends Error {
  readonly rule: DeniedRule;
  readonly reason: string;
  /** The guard's decision, when there is one. */
  readonly decision: Decision | null;
  constructor(rule: DeniedRule, reason: string, decision: Decision | null) {
    super(`${rule}: ${reason}`);
    this.name = "SolanautDenied";
    this.rule = rule;
    this.reason = reason;
    this.decision = decision;
  }
}
