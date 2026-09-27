// The guard: the policy decides what may be signed at all, and Gubernaut Keel's control loop
// decides when a stream of proposals has become a loop. A proposal is allowed only if both
// agree. Every error is a denial: a guard that cannot decide does not sign.

import { Governor, wasmDigest, type Posture, type Telemetry } from "@gubernaut/core";
import { checkPolicy, total, type Policy, type PolicyRule, type Proposal } from "./policy.ts";
import { initialSensorState, sensorV0, type Outcome, type Sensor, type SensorState } from "./sensor.ts";

/** The controller Solanaut was built and tested against: @gubernaut/core 1.0.1. */
export const VERIFIED_KEEL_DIGEST = "834015d73e6576d6c597b5a32a62c24ac56a50c7023261bf84b96beb01ded7d8";

export type Rule = PolicyRule | "loop-reground" | "fail-closed";

export interface Decision {
  allow: boolean;
  /** Set on every denial: which rule decided it. */
  rule?: Rule;
  reason: string;
  /** Keel's posture for this proposal, or null if the controller never ran. */
  posture: Posture | null;
  telemetry: Telemetry | null;
  turn: number;
}

export interface GuardOptions {
  policy: Policy;
  /** Replace the telemetry source. Tests use it to prove the guard fails closed. */
  sensor?: Sensor;
  /** The Keel digest to require. Defaults to the verified one. */
  expectedDigest?: string;
}

export interface Guard {
  evaluate(p: Proposal): Decision;
  /** Tell the guard how the last allowed proposal went on chain. */
  report(outcome: Outcome): void;
  readonly policy: Readonly<Policy>;
}

export async function createGuard(opts: GuardOptions): Promise<Guard> {
  const expected = opts.expectedDigest ?? VERIFIED_KEEL_DIGEST;
  if (wasmDigest !== expected) {
    throw new Error(`Keel's controller digest is ${wasmDigest}, not the verified ${expected}. Refusing to guard with an unverified controller.`);
  }
  const policy: Policy = structuredClone(opts.policy);
  const sensor = opts.sensor ?? sensorV0;
  const gov = await Governor.create();
  const state: SensorState = initialSensorState();
  const allowed: { at: number; lamports: number }[] = [];
  let turn = 0;
  let pending = false;

  const evaluate = (p: Proposal): Decision => {
    turn += 1;
    try {
      const spent = allowed.filter((a) => p.at - a.at < policy.windowMs).reduce((s, a) => s + a.lamports, 0);
      const verdict = checkPolicy(policy, p, spent);

      // Every proposal reaches the controller, denied or not: an agent re-proposing a
      // transfer the policy refused is a loop too.
      const telemetry = sensor(p, state, policy);
      const d = gov.tick(telemetry);
      state.recent.push(p);
      state.lastAt = p.at;

      if (!verdict.ok) {
        state.failureStreak += 1;
        pending = false;
        return { allow: false, rule: verdict.rule, reason: verdict.reason, posture: d.posture, telemetry, turn };
      }
      if (d.posture === "REGROUND") {
        state.failureStreak += 1;
        pending = false;
        return {
          allow: false,
          rule: "loop-reground",
          reason: `Keel reports a saturating loop (REGROUND) at turn ${turn}: repetition ${telemetry.repetition}, valence ${telemetry.valence.toFixed(2)}`,
          posture: d.posture,
          telemetry,
          turn,
        };
      }
      allowed.push({ at: p.at, lamports: total(p) });
      pending = true;
      return { allow: true, reason: "", posture: d.posture, telemetry, turn };
    } catch (e) {
      pending = false;
      return { allow: false, rule: "fail-closed", reason: `the guard could not decide, so it denies: ${(e as Error).message}`, posture: null, telemetry: null, turn };
    }
  };

  const report = (outcome: Outcome) => {
    if (!pending) return;
    pending = false;
    state.failureStreak = outcome === "failure" ? state.failureStreak + 1 : 0;
  };

  return { evaluate, report, policy };
}
