// The loop and benign batteries, measured (SPEC.md §6 "Measured", §11 loop and benign). No threshold is assumed:
// each test passes when the measurement completes; the numbers are written to results/batteries.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { world, wilson, prng } from "./helpers.mjs";

const T0 = Date.parse("2026-10-01T00:00:00Z");
const OUT = new URL("../results/batteries.json", import.meta.url);
const results = {};
function save() {
  fs.mkdirSync(new URL("../results/", import.meta.url), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
}

/** Run a retry loop: `make(w, k)` builds turn k's message; each allowed attempt is reported `outcome`. */
async function loop({ make, turns = 30, spacingMs = 5_000, outcome = "failed", maxAttempts }) {
  const overrides = maxAttempts ? { intents: { maxAttempts } } : {};
  const w = await world({ nDest: 4, overrides });
  const trace = [];
  let stop = null;
  for (let k = 1; k <= turns; k++) {
    const d = w.guard.check({ message: make(w, k), at: T0 + k * spacingMs });
    trace.push({ turn: k, allow: d.allow, rule: d.rule ?? null, posture: d.posture, telemetry: d.telemetry });
    if (!d.allow) { stop ??= { turn: k, rule: d.rule, posture: d.posture }; break; }
    w.guard.report(d.hash, outcome);
  }
  return { stop, turnsRun: trace.length, maxAttempts: maxAttempts ?? w.policy.intents.maxAttempts, trace };
}

const identical = (w) => w.pay(0, 1_000n);
const risingFees = (w, k) => w.pay(0, 1_000n, { cuLimit: 200_000, cuPrice: 1_000 * 2 ** k });
const alternating = (w, k) => w.pay(k % 2, 1_000n + BigInt(k));

test("E65 §11 loop battery: identical failing retries, stop turn measured", async (t) => {
  const r = { attemptsCap3: await loop({ make: identical }), attemptsCap50: await loop({ make: identical, maxAttempts: 50 }) };
  results.loopIdentical = r;
  save();
  t.diagnostic(`cap 3: stop ${JSON.stringify(r.attemptsCap3.stop)}; cap 50: stop ${JSON.stringify(r.attemptsCap50.stop)}`);
  assert.ok(r.attemptsCap3.trace.length > 0);
});

test("E66 §11 loop battery: retries with rising fees, stop turn measured", async (t) => {
  const r = { attemptsCap3: await loop({ make: risingFees }), attemptsCap50: await loop({ make: risingFees, maxAttempts: 50 }) };
  results.loopRisingFees = r;
  save();
  t.diagnostic(`cap 3: stop ${JSON.stringify(r.attemptsCap3.stop)}; cap 50: stop ${JSON.stringify(r.attemptsCap50.stop)}`);
  assert.ok(r.attemptsCap3.trace.length > 0);
});

test("E67 §11 loop battery: retries alternating two shapes with a changing amount, stop turn measured (30 turns)", async (t) => {
  const r = { attemptsCap3: await loop({ make: alternating }), attemptsCap50: await loop({ make: alternating, maxAttempts: 50 }) };
  results.loopAlternating = r;
  save();
  const last = r.attemptsCap3.trace.at(-1);
  t.diagnostic(`cap 3: stop ${JSON.stringify(r.attemptsCap3.stop)} after ${r.attemptsCap3.turnsRun} turns, last telemetry ${JSON.stringify(last.telemetry)} posture ${last.posture}; cap 50: stop ${JSON.stringify(r.attemptsCap50.stop)}`);
  assert.ok(r.attemptsCap3.trace.length > 0);
});

/**
 * A benign stream: n in-policy payments, each reported landed. A false stop is any denial. When the guard latches, the
 * operator releases it (counted) so the stream can continue.
 */
async function benign({ n = 600, seed, gaps, fee, nDest = 20 }) {
  const rnd = prng(seed);
  const w = await world({ nDest, overrides: { sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 1_000_000_000_000n }, sensor: { expectedPerMinute: 6 } } });
  const stops = {};
  let falseStops = 0, latches = 0, t = T0;
  const postures = {};
  const context = [];
  const recent = [];
  for (let i = 0; i < n; i++) {
    t += gaps(rnd, i);
    const dest = Math.floor(rnd() * nDest);
    const lamports = BigInt(1_000_000 + Math.floor(rnd() * 199_000_000));
    const d = w.guard.check({ message: w.pay(dest, lamports, fee ? fee(rnd) : {}), at: t });
    postures[d.posture] = (postures[d.posture] ?? 0) + 1;
    recent.push({ i, dest, lamports: String(lamports), fees: d.amounts?.fees ?? null, tel: d.telemetry, posture: d.posture });
    if (recent.length > 4) recent.shift();
    if (d.allow) { w.guard.report(d.hash, "landed"); continue; }
    falseStops++;
    stops[d.rule] = (stops[d.rule] ?? 0) + 1;
    context.push({ rule: d.rule, last4: [...recent] });
    if (w.guard.status().latched) {
      latches++;
      const text = w.guard.releaseText(new Date(t + 3_600_000).toISOString());
      const r = w.guard.release(text, w.operator.sign(Buffer.from(text, "utf8")), t + 1);
      if (!r.released) throw new Error(`release refused: ${r.reason}`);
    }
  }
  const [lo, hi] = wilson(falseStops, n);
  return { n, seed, falseStops, rate: falseStops / n, ci95: [lo, hi], latches, stops, postures, spanMinutes: (t - T0) / 60_000, perMinute: n / ((t - T0) / 60_000), context };
}

const poisson = (meanMs) => (rnd) => Math.max(200, Math.round(-Math.log(1 - rnd()) * meanMs));
const bursts = () => {
  let left = 0;
  return (rnd) => {
    if (left > 0) { left--; return 1_000 + Math.floor(rnd() * 2_000); }
    left = 1 + Math.floor(rnd() * 5); // bursts of 2 to 6
    return 10_000 + Math.floor(rnd() * 36_000); // a mean of about 6 a minute overall
  };
};

test("E68 §11 benign battery: 600 varied payments at the expected rate (Poisson, 6/min), each landed; false-stop rate with a 95% CI", async (t) => {
  const r = await benign({ seed: 1001, gaps: poisson(10_000) });
  results.benignPoisson = r;
  save();
  t.diagnostic(JSON.stringify({ ...r, context: undefined }));
  assert.equal(r.n, 600);
});

test("E69 §11 benign battery: 600 varied payments in bursts of 2 to 6, each landed; false-stop rate with a 95% CI", async (t) => {
  const r = await benign({ seed: 2002, gaps: bursts() });
  results.benignBursts = r;
  save();
  t.diagnostic(JSON.stringify({ ...r, context: undefined }));
  assert.equal(r.n, 600);
});

test("E70 §11 benign battery: 5 × 600 varied payments at the expected rate whose priority fee varies as a wallet's estimate does; false-stop rate with a 95% CI", async (t) => {
  const runs = [];
  for (const seed of [3003, 3004, 3005, 3006, 3007]) {
    runs.push(await benign({ seed, gaps: poisson(10_000), fee: (rnd) => (rnd() < 0.2 ? {} : { cuLimit: 200_000, cuPrice: 1_000 + Math.floor(rnd() * 49_000) }) }));
  }
  const n = runs.reduce((a, r) => a + r.n, 0);
  const k = runs.reduce((a, r) => a + r.falseStops, 0);
  const agg = { n, falseStops: k, rate: k / n, ci95: wilson(k, n), latches: runs.reduce((a, r) => a + r.latches, 0), perSeed: runs.map((r) => ({ seed: r.seed, falseStops: r.falseStops, latches: r.latches, stops: r.stops })) };
  results.benignVariedFees = { aggregate: agg, runs };
  save();
  t.diagnostic(JSON.stringify(agg));
  assert.equal(runs[0].n, 600);
});
