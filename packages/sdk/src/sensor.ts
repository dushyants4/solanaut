// Sensors: the guard's numbers for Keel. A stream of proposals in, three numbers out. Keel acts
// faithfully on whatever a sensor reports, so the sensor, not the controller, is where loop
// detection is won or lost. Every coefficient is stated here, and none was tuned after looking at
// a battery's result (docs/SPEC.md §6).

import type { Telemetry } from "@gubernaut/core";
import type { EffectsV1 } from "./classify.ts";
import type { Policy } from "./policy.ts";

/** What a sensor may read of the guard's state. Rebuilt from the record on restore. */
export interface SensorView {
  /** The last parsed proposals, oldest first: their intent, shape, fees with tips, and whether that intent has since landed. */
  readonly recent: readonly {
    readonly intentKey: string;
    readonly shape: string;
    readonly fees: bigint;
    readonly landed?: boolean;
  }[];
  /** Denials, failed and expired outcomes since the last landed one. */
  readonly failureStreak: number;
  /** Unknown outcomes since the last landed one. */
  readonly unknownStreak: number;
  readonly lastAt: number | null;
  /** When the parsed proposals of the last minute came, oldest first. */
  readonly times: readonly number[];
}

export type Sensor = (effects: EffectsV1, view: SensorView, policy: Policy, at: number, shape: string) => Telemetry;

export const RECENT = 8;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const ratio = (amount: bigint, cap: bigint) => (cap === 0n ? (amount > 0n ? 1 : 0) : Number(amount) / Number(cap));

/** The largest share of a per-transaction cap this message would use: SOL, or any listed mint. */
function value(e: EffectsV1, policy: Policy): number {
  let v = ratio(
    e.sol.reduce((t, x) => t + x.lamports, 0n),
    policy.sol.maxPerTx,
  );
  for (const t of policy.tokens) {
    const amount = e.tokens
      .filter((x) => x.mint === t.mint && x.program === t.program)
      .reduce((sum, x) => sum + x.amount, 0n);
    v = Math.max(v, ratio(amount, t.maxPerTx));
  }
  return v;
}

/**
 * Sensor v0, kept for comparison (milestone 2a.5 ported it from proposals to effects, coefficients
 * unchanged). Its rate term reads any two proposals a second apart as full intensity, which on a
 * real clock is most fast legitimate payments: defect D8.
 *
 *   intensity   the larger of value against the per-transaction cap, and the rate against one proposal a second
 *   valence     0.2, less 0.3 for each denial or failed outcome since the last landed one
 *   repetition  1 for the same intent as one of the last 8; 0.5 for the same shape at another amount; else 0
 */
export const sensorV0: Sensor = (e, s, policy, at, shape) => {
  const gap = s.lastAt === null ? Infinity : Math.max(0, at - s.lastAt);
  const rate = gap === Infinity ? 0 : clamp(1000 / Math.max(gap, 1), 0, 1);
  const intensity = clamp(Math.max(value(e, policy), rate), 0, 1);
  const valence = clamp(0.2 - 0.3 * s.failureStreak, -1, 1);
  let repetition = 0;
  for (const prev of s.recent.slice(-RECENT)) {
    if (prev.intentKey === e.intentKey) {
      repetition = 1;
      break;
    }
    if (prev.shape === shape) repetition = Math.max(repetition, 0.5);
  }
  return { intensity, valence, repetition };
};

/** Sensor v1's coefficients, all of them (milestone 2a.7, docs/SPEC.md §6). */
export const SENSOR_V1 = {
  /** The rate is counted over the trailing minute. */
  minuteMs: 60_000,
  /** The rate term is 0 at or below the policy's expected rate, and reaches 1 at this many times it. */
  rateFull: 5,
  valenceStart: 0.2,
  /** Subtracted for each denial, failed, expired or unknown outcome since the last landed one. */
  valenceStep: 0.3,
  /**
   * The same intent at the same fees as a recent proposal that has not landed: the same payment,
   * retried. Once an intent lands, the same payment again is a new one, at most the same shape.
   */
  repeatSame: 1,
  /** The same intent at other fees, or the same shape at higher fees than a payment that has not landed: fee escalation. */
  repeatEscalating: 0.8,
  /** The same programs and destinations at another amount. */
  repeatShape: 0.5,
  /** How many recent proposals repetition looks back over. */
  recent: RECENT,
} as const;

/**
 * Sensor v1.
 *
 *   intensity   the larger of value against the per-transaction cap, and the rate term: proposals in
 *               the trailing minute against `policy.sensor.expectedPerMinute`, 0 at or below it,
 *               rising linearly to 1 at five times it
 *   valence     0.2, less 0.3 for each denial, failed, expired or unknown outcome since the last landed one
 *   repetition  1, 0.8, 0.5 or 0, as SENSOR_V1 describes, over the last 8 parsed proposals; a
 *               recent intent that has landed counts only as the same shape, and higher fees than
 *               a payment that landed are not escalation
 *
 * Changed twice in definition, never in a coefficient, each time re-run on fresh seeds:
 *   1. After its first battery run, which counted a landed payment, repeated, as a retry
 *      (repetition 1): recurring payments read as a saturating loop (evals/sdk/keel.md).
 *   2. After the independent evaluator's varied-fee streams, where the same shape at higher fees
 *      than a payment that had landed read as escalation, and 15 of 3,000 benign payments were
 *      stopped (evals/sdk/fee-escalation.md; docs/RISKS.md RK20).
 */
export const sensorV1: Sensor = (e, s, policy, at, shape) => {
  const k = SENSOR_V1;
  const n = s.times.filter((t) => t > at - k.minuteMs).length + 1;
  const rate = clamp((n / policy.sensor.expectedPerMinute - 1) / (k.rateFull - 1), 0, 1);
  const intensity = clamp(Math.max(value(e, policy), rate), 0, 1);
  const valence = clamp(k.valenceStart - k.valenceStep * (s.failureStreak + s.unknownStreak), -1, 1);

  const fees = e.priorityFee + e.baseFee + e.tips;
  let repetition = 0;
  for (const prev of s.recent.slice(-k.recent)) {
    if (prev.intentKey === e.intentKey && !prev.landed) {
      repetition = Math.max(repetition, fees === prev.fees ? k.repeatSame : k.repeatEscalating);
    } else if (prev.shape === shape) {
      // Fees above a payment that landed are a wallet's estimate moving, not escalation: that payment is done (RK20).
      repetition = Math.max(repetition, fees > prev.fees && !prev.landed ? k.repeatEscalating : k.repeatShape);
    }
  }
  return { intensity, valence, repetition };
};
