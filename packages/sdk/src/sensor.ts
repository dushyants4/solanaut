// Sensor v0: a proposal stream in, Keel's three numbers out. Unmeasured heuristics, stated as
// such. Keel acts faithfully on whatever this reports, so this file, not the controller, is
// where Solanaut's loop detection is won or lost, and where it gets measured next (H1).
//
//   intensity   how hard the agent is pushing: the larger of this proposal's value against the
//               per-transaction cap, and its rate against one proposal a second.
//   valence     how things are going: failure streaks push it negative, successes pull it back.
//   repetition  how closely this proposal repeats a recent one: 1 for an identical
//               fingerprint (same programs, same destinations, same amounts), 0.5 for the same
//               programs and destinations with a different amount, else 0.

import type { Telemetry } from "@gubernaut/core";
import { total, type Policy, type Proposal } from "./policy.ts";

export type Outcome = "success" | "failure";

export interface SensorState {
  recent: Proposal[];
  failureStreak: number;
  lastAt: number | null;
}

export type Sensor = (p: Proposal, s: Readonly<SensorState>, policy: Policy) => Telemetry;

const WINDOW = 8;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const shape = (p: Proposal) =>
  JSON.stringify([[...p.programIds].sort(), p.transfers.map((t) => t.to).sort()]);
const fingerprint = (p: Proposal) =>
  JSON.stringify([[...p.programIds].sort(), p.transfers.map((t) => [t.to, t.lamports]).sort()]);

export const sensorV0: Sensor = (p, s, policy) => {
  const value = policy.maxLamportsPerTx > 0 ? total(p) / policy.maxLamportsPerTx : 1;
  const gap = s.lastAt === null ? Infinity : Math.max(0, p.at - s.lastAt);
  const rate = gap === Infinity ? 0 : clamp(1000 / Math.max(gap, 1), 0, 1);
  const intensity = clamp(Math.max(value, rate), 0, 1);

  const valence = clamp(0.2 - 0.3 * s.failureStreak, -1, 1);

  let repetition = 0;
  for (const prev of s.recent.slice(-WINDOW)) {
    if (fingerprint(prev) === fingerprint(p)) { repetition = 1; break; }
    if (shape(prev) === shape(p)) repetition = Math.max(repetition, 0.5);
  }
  return { intensity, valence, repetition };
};

export const initialSensorState = (): SensorState => ({ recent: [], failureStreak: 0, lastAt: null });
