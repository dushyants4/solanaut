// Milestone 2a.7, Keel hardened (docs/SPEC.md §6): the controller's bytes are hashed when a guard
// is created (D4); telemetry is checked before Keel sees it (D3); sensor v1 replaces sensor v0's
// rate term, which read fast legitimate payments as full intensity (D8). Upstream findings U-2 and
// U-3 (kb/REGISTRY.md) are reproduced here, or refuted, before anything rests on them.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Governor, INITIAL_STATE } from "@gubernaut/core";
import { createGuard, VERIFIED_KEEL_DIGEST, VERIFIED_KEEL_MODULE, verifyKeelSource } from "../src/guard.ts";
import { SENSOR_V1, sensorV1, type SensorView } from "../src/sensor.ts";
import { createPolicy } from "../src/policy.ts";
import type { EffectsV1 } from "../src/classify.ts";
import { craftLegacy, key } from "./support/craft.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";

const keelPath = fileURLToPath(import.meta.resolve("@gubernaut/core"));
const keelSource = readFileSync(keelPath, "utf8");
const pay = (to: number, lamports: number) =>
  craftLegacy({ header: [1, 0, 1], keys: [key(1), key(to), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, ...Array.from({ length: 8 }, (_, i) => Math.floor(lamports / 256 ** i) % 256)] }] });

// --- D4: the bytes ----------------------------------------------------------------------------------

test("D4: the loaded controller module and its embedded wasm hash to the pinned values", () => {
  const v = verifyKeelSource(keelSource);
  assert.deepEqual(v, { ok: true, moduleSha256: VERIFIED_KEEL_MODULE, wasmSha256: VERIFIED_KEEL_DIGEST, problem: "" });
});

test("D4: a controller with one byte changed, in the wasm or in the JavaScript around it, is refused", () => {
  const at = keelSource.indexOf('var WASM_BASE64 = "') + 40;
  const flipped = keelSource.slice(0, at) + (keelSource[at] === "A" ? "B" : "A") + keelSource.slice(at + 1);
  const wasm = verifyKeelSource(flipped);
  assert.equal(wasm.ok, false);
  assert.notEqual(wasm.wasmSha256, VERIFIED_KEEL_DIGEST);

  const wrapper = verifyKeelSource(keelSource.replace("var wasmDigest = WASM_SHA256;", "var wasmDigest = WASM_SHA256; "));
  assert.equal(wrapper.ok, false, "the wasm is intact, but the code that runs it changed");
  assert.equal(wrapper.wasmSha256, VERIFIED_KEEL_DIGEST);
  assert.match(wrapper.problem, /module/);

  assert.equal(verifyKeelSource("export const nothing = 1;").ok, false, "no embedded controller at all");
});

test("D4: a guard's decisions say the controller was verified by its bytes", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  const d = g.check({ message: pay(2, 1_000), at: 1 });
  assert.equal(d.keel.verified, "bytes");
  assert.equal(d.keel.digest, VERIFIED_KEEL_DIGEST);
});

// --- D3 and the upstream findings --------------------------------------------------------------------

test("U-2, reproduced: Keel's tick() takes telemetry that accepts() refuses, coercing it", async () => {
  const outcomes: string[] = [];
  for (const bad of [null, "0.5", true, [0.7]]) {
    const t = { intensity: bad, valence: 0, repetition: 0 } as never;
    assert.equal(Governor.accepts(t), false, `accepts(${JSON.stringify(bad)})`);
    const gov = await Governor.create();
    let posture: string;
    try {
      posture = gov.tick(t).posture;
    } catch (e) {
      posture = `throws ${(e as Error).name}`;
    }
    outcomes.push(`${JSON.stringify(bad)} → ${posture}`);
  }
  console.log(`  U-2: tick() on telemetry accepts() refuses: ${outcomes.join("; ")}`);
  assert.ok(outcomes.some((o) => !o.includes("throws")), "at least one refused value is ticked rather than thrown");
});

test("D3: telemetry that is not three finite numbers in range never reaches Keel; the proposal denies, and Keel's state does not move", async () => {
  for (const bad of [null, "0.5", true, [0.7], Number.NaN, 2, -0.1]) {
    const g = await createGuard({ policy: WORKLOAD_POLICY, sensor: (() => ({ intensity: bad, valence: 0, repetition: 0 })) as never });
    const d = g.check({ message: pay(2, 1_000), at: 1 });
    assert.deepEqual([d.allow, d.rule, d.posture], [false, "fail-closed", null], `intensity ${JSON.stringify(bad)}`);
    assert.match(d.reason, /telemetry/);
  }
});

test("U-3, reproduced or refuted: Governor.create() with a non-finite or out-of-range state", async () => {
  let created: string;
  try {
    const gov = await Governor.create({ ...INITIAL_STATE, equilibrium: Number.NaN, arousal: 5 });
    const d = gov.tick({ intensity: 0.5, valence: 0, repetition: 0 });
    created = `created; the next tick gives ${d.posture} with equilibrium ${d.equilibrium}`;
  } catch (e) {
    created = `refused: ${(e as Error).message}`;
  }
  console.log(`  U-3: Governor.create({ equilibrium: NaN, arousal: 5 }) → ${created}`);
  // Solanaut's side either way: a guard's Keel is only ever created fresh and rebuilt by replaying its own record.
  assert.ok(created.length > 0);
});

// --- sensor v1 (D8) ------------------------------------------------------------------------------------

const { policy } = createPolicy(WORKLOAD_POLICY); // 1 SOL per transaction, 6 proposals a minute expected
const effects = (o: Partial<EffectsV1> = {}): EffectsV1 =>
  ({ intentKey: "a", sol: [{ from: "x", to: "y", lamports: 100_000_000n, kind: "transfer" }], tokens: [], priorityFee: 0n, baseFee: 5_000n, tips: 0n, ...o }) as EffectsV1;
const view = (o: Partial<SensorView> = {}): SensorView => ({ recent: [], failureStreak: 0, unknownStreak: 0, lastAt: null, times: [], ...o });
const at = 1_000_000;

test("sensor v1, intensity: the rate term is zero at or below the expected rate, and full at five times it", () => {
  const atRate = (n: number) => view({ times: Array.from({ length: n - 1 }, (_, i) => at - 1_000 * (i + 1)) });
  assert.equal(sensorV1(effects(), atRate(6), policy, at, "s").intensity, 0.1, "6 a minute, as expected: only the value term, 0.1 SOL of 1");
  assert.equal(sensorV1(effects({ sol: [] }), atRate(30), policy, at, "s").intensity, 1, "30 a minute is five times 6");
  assert.equal(sensorV1(effects({ sol: [] }), atRate(18), policy, at, "s").intensity, 0.5, "18 a minute: (3 - 1) / 4");
  assert.equal(sensorV1(effects({ sol: [] }), view({ times: [at - 61_000, at - 60_000] }), policy, at, "s").intensity, 0, "a minute and more ago does not count");
  assert.equal(sensorV1(effects({ sol: [{ from: "x", to: "y", lamports: 2_000_000_000n, kind: "transfer" }] }), view(), policy, at, "s").intensity, 1, "the value term is capped at 1");
});

test("sensor v1, valence: denials, failures, expiries and unknown outcomes lower it; a landing resets it", () => {
  assert.equal(sensorV1(effects(), view(), policy, at, "s").valence, SENSOR_V1.valenceStart);
  assert.ok(Math.abs(sensorV1(effects(), view({ failureStreak: 1, unknownStreak: 1 }), policy, at, "s").valence - (0.2 - 0.6)) < 1e-12);
  assert.equal(sensorV1(effects(), view({ failureStreak: 9 }), policy, at, "s").valence, -1);
});

test("sensor v1, repetition: the same payment 1; the same payment at higher fees 0.8; the same shape 0.5; else 0", () => {
  const recent = [{ intentKey: "a", shape: "s", fees: 5_000n }];
  assert.equal(sensorV1(effects(), view({ recent }), policy, at, "s").repetition, 1, "same intent, same fees");
  assert.equal(sensorV1(effects({ priorityFee: 1n }), view({ recent }), policy, at, "s").repetition, 0.8, "same intent, fees rising: escalation");
  assert.equal(sensorV1(effects({ intentKey: "b", priorityFee: 9n }), view({ recent }), policy, at, "s").repetition, 0.8, "same shape, fees rising");
  assert.equal(sensorV1(effects({ intentKey: "b" }), view({ recent }), policy, at, "s").repetition, 0.5, "same shape, another amount");
  assert.equal(sensorV1(effects({ intentKey: "b" }), view({ recent }), policy, at, "t").repetition, 0, "another shape");
});

test("sensor v1 is the default, and its coefficients are stated", () => {
  assert.deepEqual(SENSOR_V1, { minuteMs: 60_000, rateFull: 5, valenceStart: 0.2, valenceStep: 0.3, repeatSame: 1, repeatEscalating: 0.8, repeatShape: 0.5, recent: 8 });
});

test("sensor v1, repetition: a payment repeated after it landed is a new payment, not a retry", () => {
  const landed = [{ intentKey: "a", shape: "s", fees: 5_000n, landed: true }];
  assert.equal(sensorV1(effects(), view({ recent: landed }), policy, at, "s").repetition, 0.5, "the same shape, at most");
  const retried = [{ intentKey: "a", shape: "s", fees: 5_000n, landed: false }];
  assert.equal(sensorV1(effects(), view({ recent: retried }), policy, at, "s").repetition, 1, "not landed: a retry");
});

// docs/RISKS.md RK20, evals/sdk/fee-escalation.md: a wallet's fee drifts between payments that land.
test("sensor v1, repetition: the same shape at higher fees is escalation only against a payment that did not land", () => {
  const landed = [{ intentKey: "a", shape: "s", fees: 5_000n, landed: true }];
  assert.equal(sensorV1(effects({ intentKey: "b", priorityFee: 9n }), view({ recent: landed }), policy, at, "s").repetition, 0.5, "after a landed payment, a higher fee is a new payment of the same shape");
  const failed = [{ intentKey: "a", shape: "s", fees: 5_000n, landed: false }];
  assert.equal(sensorV1(effects({ intentKey: "b", priorityFee: 9n }), view({ recent: failed }), policy, at, "s").repetition, 0.8, "after one that did not land, still escalation");
});

test("through the guard: the same payment again after it landed reads as the same shape; before it lands, as a retry", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  const first = g.check({ message: pay(2, 1_000), at: 1_000 });
  g.report(first.hash, "landed");
  const again = g.check({ message: pay(2, 1_000), at: 31_000 });
  assert.equal(again.allow, true);
  assert.equal(again.telemetry?.repetition, 0.5, "landed, so a new payment of the same shape");
  const retry = g.check({ message: pay(2, 1_000), at: 61_000 });
  assert.equal(retry.telemetry?.repetition, 1, "the second payment has not landed: this one retries it");
});
