// Sensor v0, the guard's numbers for Keel: a stream of proposals in, three numbers out.
// Unmeasured heuristics, stated as such. Keel acts faithfully on whatever this reports, so this
// file, not the controller, is where loop detection is won or lost.
//
// Ported at milestone 2a.5 from proposals to effects, with its coefficients unchanged, so the
// loop measurements stay comparable. Sensor v1 replaces it at milestone 2a.7 (docs/SPEC.md §6,
// defect D8: on a real clock, the rate term reads fast legitimate payments as full intensity).
//
//   intensity   the larger of this message's value against its per-transaction cap (SOL, or
//               any listed mint), and its rate against one proposal a second
//   valence     0.2, less 0.3 for each denial or failed outcome since the last landed one
//   repetition  1 for the same intent as one of the last 8 parsed proposals; 0.5 for the same
//               shape (programs and destinations) at another amount; else 0

import type { Telemetry } from "@gubernaut/core";
import type { EffectsV1 } from "./classify.ts";
import type { Policy } from "./policy.ts";

/** What the sensor may read of the guard's state. Rebuilt from the log on restore. */
export interface SensorView {
  readonly recent: readonly { readonly intentKey: string; readonly shape: string }[];
  readonly failureStreak: number;
  readonly lastAt: number | null;
}

export type Sensor = (effects: EffectsV1, view: SensorView, policy: Policy, at: number, shape: string) => Telemetry;

export const RECENT = 8;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const ratio = (amount: bigint, cap: bigint) => (cap === 0n ? (amount > 0n ? 1 : 0) : Number(amount) / Number(cap));

export const sensorV0: Sensor = (e, s, policy, at, shape) => {
  let value = ratio(e.sol.reduce((t, x) => t + x.lamports, 0n), policy.sol.maxPerTx);
  for (const t of policy.tokens) {
    const amount = e.tokens.filter((x) => x.mint === t.mint && x.program === t.program).reduce((sum, x) => sum + x.amount, 0n);
    value = Math.max(value, ratio(amount, t.maxPerTx));
  }
  const gap = s.lastAt === null ? Infinity : Math.max(0, at - s.lastAt);
  const rate = gap === Infinity ? 0 : clamp(1000 / Math.max(gap, 1), 0, 1);
  const intensity = clamp(Math.max(value, rate), 0, 1);

  const valence = clamp(0.2 - 0.3 * s.failureStreak, -1, 1);

  let repetition = 0;
  for (const prev of s.recent.slice(-RECENT)) {
    if (prev.intentKey === e.intentKey) { repetition = 1; break; }
    if (prev.shape === shape) repetition = Math.max(repetition, 0.5);
  }
  return { intensity, valence, repetition };
};
