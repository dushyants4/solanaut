// The deterministic half of the guard. A policy is configuration the agent's model never sees
// and cannot change, so it holds even when the model has been fully talked into a transfer.
// This is Solanaut's injection defence. The control loop (guard.ts) is not: it reads numbers
// about the transaction stream, and it exists for loops and escalation.

/** What an agent may sign. Addresses are base58. Amounts are lamports. */
export interface Policy {
  allowedPrograms: string[];
  allowedDestinations: string[];
  maxLamportsPerTx: number;
  maxLamportsPerWindow: number;
  windowMs: number;
}

/** A proposed transaction, reduced to what the policy and the sensor need. */
export interface Proposal {
  programIds: string[];
  transfers: { to: string; lamports: number }[];
  /** Milliseconds, from the caller's clock. The guard keeps no clock of its own. */
  at: number;
}

export type Verdict = { ok: true } | { ok: false; rule: PolicyRule; reason: string };
export type PolicyRule =
  | "program-not-allowed"
  | "destination-not-allowed"
  | "over-per-tx-cap"
  | "over-window-cap"
  | "malformed-proposal";

export const total = (p: Proposal): number => p.transfers.reduce((s, t) => s + t.lamports, 0);

/**
 * Check one proposal. `spentInWindow` is what the guard has already allowed within
 * `policy.windowMs` of this proposal. Rules are checked in a fixed order, so the same
 * proposal always fails the same way.
 */
export function checkPolicy(policy: Policy, p: Proposal, spentInWindow: number): Verdict {
  if (!Array.isArray(p.programIds) || !Array.isArray(p.transfers) || !Number.isFinite(p.at)) {
    return { ok: false, rule: "malformed-proposal", reason: "proposal is missing its programs, transfers or time" };
  }
  for (const t of p.transfers) {
    if (!Number.isSafeInteger(t.lamports) || t.lamports < 0) {
      return { ok: false, rule: "malformed-proposal", reason: `transfer amount ${t.lamports} is not a whole, non-negative number of lamports` };
    }
  }
  const program = p.programIds.find((id) => !policy.allowedPrograms.includes(id));
  if (program) return { ok: false, rule: "program-not-allowed", reason: `program ${program} is not on the allowlist` };

  const dest = p.transfers.find((t) => !policy.allowedDestinations.includes(t.to));
  if (dest) return { ok: false, rule: "destination-not-allowed", reason: `destination ${dest.to} is not on the allowlist` };

  const amount = total(p);
  if (amount > policy.maxLamportsPerTx) {
    return { ok: false, rule: "over-per-tx-cap", reason: `${amount} lamports is over the per-transaction cap of ${policy.maxLamportsPerTx}` };
  }
  if (spentInWindow + amount > policy.maxLamportsPerWindow) {
    return {
      ok: false,
      rule: "over-window-cap",
      reason: `${spentInWindow} + ${amount} lamports would pass the cap of ${policy.maxLamportsPerWindow} per ${policy.windowMs} ms`,
    };
  }
  return { ok: true };
}
