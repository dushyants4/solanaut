// Keel and sensor v1. Expectations from SPEC.md §5 (rules 17-19), §6, §10 (D3, D4).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { Governor } from "@gubernaut/core";
import { createGuard, verifyKeelSource, VERIFIED_KEEL_DIGEST, VERIFIED_KEEL_MODULE } from "@solanaut/sdk";
import { world, randomAddress, transferMessage } from "./helpers.mjs";

const T0 = Date.parse("2026-10-01T00:00:00Z");
const GOOD = { intensity: 0.1, valence: 0.2, repetition: 0 };

/** One proposal through a fresh guard whose sensor returns `tel` (or calls it). */
async function oneWith(tel) {
  const w = await world({ sensor: typeof tel === "function" ? tel : () => tel });
  return w.guard.check({ message: w.pay(0, 1_000n), at: T0 });
}

// ---------- D3: telemetry validated before Keel ticks ----------

test("E42 §6 D3 non-number telemetry (null, a string, a boolean, an array, a bigint, an object) denies as fail-closed, and Keel does not run", async (t) => {
  const cases = {
    "intensity null": { ...GOOD, intensity: null },
    'valence "0.2"': { ...GOOD, valence: "0.2" },
    "repetition true": { ...GOOD, repetition: true },
    "intensity [0.7]": { ...GOOD, intensity: [0.7] },
    "repetition 0n": { ...GOOD, repetition: 0n },
    "valence {valueOf}": { ...GOOD, valence: { valueOf: () => 0.2 } },
  };
  for (const [name, tel] of Object.entries(cases)) {
    const d = await oneWith(tel);
    t.diagnostic(`${name}: allow=${d.allow} rule=${d.rule} posture=${d.posture}`);
    assert.equal(d.allow, false, name);
    assert.equal(d.rule, "fail-closed", name);
    assert.equal(d.posture, null, `${name}: Keel ran`);
  }
});

test("E43 §6 D3 non-finite, out-of-range or missing telemetry, or a sensor that throws, denies as fail-closed", async (t) => {
  const cases = {
    "intensity NaN": { ...GOOD, intensity: NaN },
    "valence Infinity": { ...GOOD, valence: Infinity },
    "repetition -Infinity": { ...GOOD, repetition: -Infinity },
    "intensity 1.5": { ...GOOD, intensity: 1.5 },
    "valence -1.5": { ...GOOD, valence: -1.5 },
    "repetition -0.1": { ...GOOD, repetition: -0.1 },
    "intensity -1e-12": { ...GOOD, intensity: -1e-12 },
    "repetition missing": { intensity: 0.1, valence: 0.2 },
    "sensor returns null": null,
    "sensor returns undefined": () => undefined,
    "sensor throws": () => { throw new Error("sensor broke"); },
  };
  for (const [name, tel] of Object.entries(cases)) {
    const d = await oneWith(tel);
    t.diagnostic(`${name}: allow=${d.allow} rule=${d.rule} posture=${d.posture}`);
    assert.equal(d.allow, false, name);
    assert.equal(d.rule, "fail-closed", name);
    assert.equal(d.posture, null, `${name}: Keel ran`);
  }
});

test("E44 §6 D3 Keel does not tick on refused telemetry: three coercible string triples leave its state untouched", async () => {
  const seq = [GOOD, { intensity: "1", valence: "-1", repetition: "1" }, { intensity: "1", valence: "-1", repetition: "1" }, { intensity: "1", valence: "-1", repetition: "1" }, GOOD];
  let i = 0;
  const w = await world({ nDest: 5, sensor: () => seq[i++] });
  const ds = seq.map((_, k) => w.guard.check({ message: w.pay(k, 1_000n + BigInt(k)), at: T0 + k * 20_000 }));
  assert.deepEqual(ds.slice(1, 4).map((d) => d.rule), ["fail-closed", "fail-closed", "fail-closed"]);
  const g = await Governor.create();
  g.tick(GOOD);
  const expect = g.tick(GOOD);
  assert.equal(ds[4].posture, expect.posture, `after refused telemetry Keel is at ${ds[4].posture} (rule ${ds[4].rule})`);
  assert.equal(ds[4].temperatureMax, expect.temperatureMax);
  assert.equal(ds[4].allow, true);
});

test("E45 §6 D3 boundary telemetry: fail-closed exactly when Governor.accepts() refuses", async (t) => {
  const vals = { intensity: [0, -0, 1, Number.MIN_VALUE, 1 - Number.EPSILON / 2, 1 + Number.EPSILON, -Number.MIN_VALUE], valence: [-1, 1, -0, -1 - Number.EPSILON, 1 + Number.EPSILON], repetition: [0, 1, 1 + Number.EPSILON, -Number.MIN_VALUE] };
  const mismatches = [];
  for (const [field, list] of Object.entries(vals)) {
    for (const v of list) {
      const tel = { intensity: 0, valence: 0, repetition: 0, [field]: v };
      const accepts = Governor.accepts(tel);
      const d = await oneWith(tel);
      const failClosed = d.rule === "fail-closed";
      if (failClosed === accepts) mismatches.push(`${field}=${Object.is(v, -0) ? "-0" : v}: accepts=${accepts} rule=${d.rule}`);
    }
  }
  t.diagnostic(mismatches.join("; ") || "no mismatch");
  assert.deepEqual(mismatches, []);
});

test("E77 §6 §7 D3 telemetry is read once: getters that change between reads cannot make Keel tick on numbers other than the recorded ones", async () => {
  const sensor = () => {
    let reads = 0;
    const o = { intensity: 0, valence: 0.2 };
    Object.defineProperty(o, "repetition", { enumerable: true, get: () => (reads++ === 0 ? 0 : 1) });
    return o;
  };
  const w = await world({ nDest: 4, sensor });
  const ds = [0, 1, 2].map((k) => w.guard.check({ message: w.pay(k, 1_000n + BigInt(k)), at: T0 + k * 30_000 }));
  const g = await Governor.create();
  const mismatch = [];
  for (const d of ds) {
    if (!d.telemetry) { mismatch.push(`seq ${d.seq}: no telemetry, rule ${d.rule}`); continue; }
    const e = g.tick({ ...d.telemetry });
    if (e.posture !== d.posture) mismatch.push(`seq ${d.seq}: recorded ${JSON.stringify(d.telemetry)} gives ${e.posture}, guard said ${d.posture}`);
  }
  assert.deepEqual(mismatch, []);
});

// ---------- D4: Keel's bytes ----------

const require = createRequire(import.meta.url);
const KEEL_PATH = require.resolve("@gubernaut/core").replace(/index\.cjs$/, "index.js");
const KEEL_TEXT = fs.readFileSync(KEEL_PATH, "utf8");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

test("E46 §6 D4 verifyKeelSource on the real module's text: ok, and both hashes are the bytes' own", () => {
  const r = verifyKeelSource(KEEL_TEXT);
  assert.equal(r.ok, true, r.problem);
  assert.equal(r.moduleSha256, sha(KEEL_TEXT));
  assert.equal(r.moduleSha256, VERIFIED_KEEL_MODULE);
  const b64 = KEEL_TEXT.match(/WASM_BASE64 = "([^"]+)"/)[1];
  assert.equal(r.wasmSha256, sha(Buffer.from(b64, "base64")));
  assert.equal(r.wasmSha256, VERIFIED_KEEL_DIGEST);
});

test("E47 §6 D4 verifyKeelSource on altered text: a JS-only edit, a wasm edit with its declared digest updated, and a module with no wasm all fail", (t) => {
  const b64 = KEEL_TEXT.match(/WASM_BASE64 = "([^"]+)"/)[1];
  const wasm = Buffer.from(b64, "base64");
  const evilWasm = Buffer.from(wasm);
  evilWasm[evilWasm.length - 10] ^= 0x01;
  const evilB64 = evilWasm.toString("base64");
  const variants = {
    "length check removed": KEEL_TEXT.replace("if (bytes.length !== WASM_BYTE_LENGTH)", "if (false)"),
    "wasm changed, digest constant updated": KEEL_TEXT.replace(b64, evilB64).replace(VERIFIED_KEEL_DIGEST, sha(evilWasm)),
    "no wasm in the text": KEEL_TEXT.replace(/var WASM_BASE64 = "[^"]+";/, 'var WASM_BASE64 = "";'),
    "empty text": "",
  };
  for (const [name, text] of Object.entries(variants)) {
    assert.notEqual(text, KEEL_TEXT, `${name}: the edit did not apply`);
    let r;
    assert.doesNotThrow(() => { r = verifyKeelSource(text); }, name);
    t.diagnostic(`${name}: ok=${r.ok} problem=${r.problem}`);
    assert.equal(r.ok, false, name);
    assert.ok(r.problem.length > 0, `${name}: no problem named`);
  }
});

test("E48 §6 D4 createGuard with a wrong expectedDigest: no guard exists; with the verified one, decisions carry verified: bytes", async () => {
  const w = await world();
  await assert.rejects(createGuard({ policy: w.policy, expectedDigest: "0".repeat(64) }));
  await assert.rejects(createGuard({ policy: w.policy, expectedDigest: VERIFIED_KEEL_DIGEST.slice(0, 63) + (VERIFIED_KEEL_DIGEST.endsWith("0") ? "1" : "0") }));
  const g = await createGuard({ policy: w.policy, expectedDigest: VERIFIED_KEEL_DIGEST });
  const d = g.check({ message: w.pay(0, 1_000n), at: T0 });
  assert.deepEqual({ ...d.keel }, { version: "1.0.1", digest: VERIFIED_KEEL_DIGEST, verified: "bytes" });
});

// ---------- sensor v1 ----------

test("E49 §6 sensor v1 intensity, value term: a payment of half the per-transaction cap reads 0.5, a quarter reads 0.25", async () => {
  const w = await world();
  const a = w.guard.check({ message: w.pay(0, 500_000_000n), at: T0 });
  const b = w.guard.check({ message: w.pay(1, 250_000_000n), at: T0 + 30_000 });
  assert.ok(Math.abs(a.telemetry.intensity - 0.5) < 1e-9, `half the cap reads ${a.telemetry.intensity}`);
  assert.ok(Math.abs(b.telemetry.intensity - 0.25) < 1e-9, `a quarter reads ${b.telemetry.intensity}`);
});

test("E50 §6 sensor v1 intensity, rate term: 0 at or below expectedPerMinute, linear to 1 at five times it, 0 again after a quiet minute", async (t) => {
  const E = 6;
  const w = await world({ nDest: 45, overrides: { sensor: { expectedPerMinute: E } } });
  const xs = [];
  for (let i = 0; i < 40; i++) {
    const d = w.guard.check({ message: w.pay(i, 1n), at: T0 + i * 1_000 });
    if (d.allow) w.guard.report(d.hash, "landed");
    xs.push(d.telemetry ? +d.telemetry.intensity.toFixed(6) : null);
  }
  const after = w.guard.check({ message: w.pay(41, 1n), at: T0 + 39_000 + 61_000 });
  t.diagnostic(`intensities: ${xs.join(" ")} | after a quiet minute: ${after.telemetry?.intensity}`);
  const first = xs.findIndex((x) => x > 1e-3);
  assert.ok(first === E || first === E + 1, `rate term starts at proposal ${first + 1}`);
  for (let i = first; i < first + 4 * E - 1; i++) assert.ok(Math.abs(xs[i + 1] - xs[i] - 1 / (4 * E)) < 1e-4, `slope at ${i}: ${xs[i]} -> ${xs[i + 1]}`);
  const sat = xs.findIndex((x) => x >= 1 - 1e-9);
  assert.equal(sat, first + 4 * E - 1, `saturates at proposal ${sat + 1}`);
  assert.ok(xs.every((x) => x === null || x <= 1));
  assert.ok(after.telemetry.intensity < 1e-3, `after a quiet minute: ${after.telemetry.intensity}`);
});

test("E51 §6 sensor v1 valence: 0.2, less 0.3 per failed, expired, denial or unknown since the last landed; a landed one resets", async (t) => {
  const w = await world({ nDest: 8 });
  const at = (k) => T0 + k * 30_000;
  const p1 = w.guard.check({ message: w.pay(0, 1_000n), at: at(0) }); w.guard.report(p1.hash, "failed");
  const p2 = w.guard.check({ message: w.pay(1, 1_000n), at: at(1) }); w.guard.report(p2.hash, "expired");
  const p3 = w.guard.check({ message: transferMessage({ from: w.agent.address, to: randomAddress(), lamports: 1_000n }), at: at(2) });
  const p4 = w.guard.check({ message: w.pay(2, 1_000n), at: at(3) }); w.guard.report(p4.hash, "unknown");
  const p5 = w.guard.check({ message: w.pay(3, 1_000n), at: at(4) }); w.guard.report(p5.hash, "landed");
  const p6 = w.guard.check({ message: w.pay(4, 1_000n), at: at(5) });
  const v = [p1, p2, p3, p4, p5, p6].map((d) => d.telemetry?.valence);
  t.diagnostic(`valences: ${v.join(" ")}; rules: ${[p1, p2, p3, p4, p5, p6].map((d) => d.rule ?? "allow").join(" ")}`);
  assert.equal(p3.rule, "destination-not-allowed");
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(close(v[0], 0.2), `p1 ${v[0]}`);
  assert.ok(close(v[1], -0.1), `p2 ${v[1]}`);
  assert.ok(close(v[3], -0.7), `p4 ${v[3]}`);
  assert.ok(close(v[4], -1.0), `p5 ${v[4]}`);
  assert.ok(close(v[5], 0.2), `p6 ${v[5]}`);
});

test("E52 §6 sensor v1 valence after five failed outcomes: 0.2 - 0.3×5 = -1.3 lies outside Keel's range; what does the guard do?", async (t) => {
  const w = await world({ nDest: 8 });
  const ds = [];
  for (let k = 0; k < 7; k++) {
    const d = w.guard.check({ message: w.pay(k, 1_000n), at: T0 + k * 30_000 });
    ds.push(d);
    if (d.allow) w.guard.report(d.hash, "failed");
  }
  t.diagnostic(ds.map((d, k) => `p${k + 1}: valence=${d.telemetry?.valence} rule=${d.rule ?? "allow"} posture=${d.posture}`).join(" | "));
  const last = ds.at(-1);
  // the spec's formula gives -1.6 here; Keel accepts only [-1, 1]
  assert.notEqual(last.rule, "fail-closed", "after a run of failures every proposal fails closed");
  assert.ok(last.telemetry.valence >= -1);
});

test("E53 §6 sensor v1 repetition 1: the same intent at the same fees, not landed", async () => {
  const w = await world();
  const a = w.guard.check({ message: w.pay(0, 1_000n), at: T0 }); w.guard.report(a.hash, "failed");
  const b = w.guard.check({ message: w.pay(0, 1_000n), at: T0 + 30_000 });
  assert.equal(a.telemetry.repetition, 0);
  assert.equal(b.telemetry.repetition, 1);
});

test("E54 §6 sensor v1 repetition 0.8: the same intent at other fees, including lower ones", async () => {
  const w = await world();
  const a = w.guard.check({ message: w.pay(0, 1_000n, { cuLimit: 200_000, cuPrice: 10_000 }), at: T0 }); w.guard.report(a.hash, "failed");
  const b = w.guard.check({ message: w.pay(0, 1_000n, { cuLimit: 200_000, cuPrice: 5_000 }), at: T0 + 30_000 });
  assert.equal(a.intentKey, b.intentKey, "the fee changed the intent key");
  assert.equal(b.telemetry.repetition, 0.8);
});

test("E55 §6 sensor v1 repetition: the same shape at higher fees is 0.8 (escalation); at lower fees and another amount, 0.5", async (t) => {
  const w = await world();
  const a = w.guard.check({ message: w.pay(0, 1_000n, { cuLimit: 200_000, cuPrice: 10_000 }), at: T0 }); w.guard.report(a.hash, "landed");
  const b = w.guard.check({ message: w.pay(0, 2_000n, { cuLimit: 200_000, cuPrice: 50_000 }), at: T0 + 30_000 }); w.guard.report(b.hash, "landed");
  const c = w.guard.check({ message: w.pay(0, 3_000n, { cuLimit: 200_000, cuPrice: 1_000 }), at: T0 + 60_000 });
  t.diagnostic(`b=${b.telemetry.repetition} c=${c.telemetry.repetition}`);
  assert.equal(b.telemetry.repetition, 0.8);
  assert.equal(c.telemetry.repetition, 0.5);
});

test("E56 §6 sensor v1 repetition: a landed intent, repeated at the same fees, counts only as the same shape (0.5)", async () => {
  const w = await world();
  const a = w.guard.check({ message: w.pay(0, 1_000n), at: T0 }); w.guard.report(a.hash, "landed");
  const b = w.guard.check({ message: w.pay(0, 1_000n), at: T0 + 30_000 });
  assert.equal(a.intentKey, b.intentKey);
  assert.equal(b.allow, true);
  assert.equal(b.telemetry.repetition, 0.5);
});

test("E57 §6 sensor v1 repetition looks back over exactly the last 8 parsed proposals", async () => {
  async function gap(n) {
    const w = await world({ nDest: 12 });
    const a = w.guard.check({ message: w.pay(0, 1_000n), at: T0 }); w.guard.report(a.hash, "failed");
    for (let k = 1; k < n; k++) { const d = w.guard.check({ message: w.pay(k, 1_000n + BigInt(k)), at: T0 + k * 30_000 }); if (d.allow) w.guard.report(d.hash, "landed"); }
    return w.guard.check({ message: w.pay(0, 1_000n), at: T0 + n * 30_000 }).telemetry.repetition;
  }
  assert.equal(await gap(8), 1, "8 proposals back is inside the window");
  assert.equal(await gap(9), 0, "9 proposals back is outside the window");
});

// ---------- rules 17 and 18 ----------

test("E58 §5 rule 18 inhibit-cap: under INHIBIT, exactly cap × 0.3 is allowed and one lamport more is denied", async (t) => {
  const inhibit = { intensity: 0.9, valence: -1, repetition: 0 };
  const g1 = await world({ sensor: () => inhibit });
  const at = g1.guard.check({ message: g1.pay(0, 300_000_000n), at: T0 });
  const g2 = await world({ sensor: () => inhibit });
  const over = g2.guard.check({ message: g2.pay(0, 300_000_001n), at: T0 });
  t.diagnostic(`at: ${at.posture} ${at.temperatureMax} ${at.rule ?? "allow"} | over: ${over.posture} ${over.temperatureMax} ${over.rule ?? "allow"}`);
  assert.equal(at.posture, "INHIBIT");
  assert.equal(at.temperatureMax, 0.3);
  assert.equal(at.allow, true, `exactly the clamp: ${at.rule} ${at.reason}`);
  assert.equal(over.rule, "inhibit-cap");
});

test("E59 §5 rule 17 loop-reground: a REGROUND denies, latches the guard, and the next proposal is denied as latched", async () => {
  const w = await world({ sensor: () => ({ intensity: 0, valence: 0.2, repetition: 1 }) });
  const a = w.guard.check({ message: w.pay(0, 1_000n), at: T0 });
  const b = w.guard.check({ message: w.pay(1, 2_000n), at: T0 + 30_000 });
  assert.equal(a.allow, true);
  assert.equal(b.posture, "REGROUND");
  assert.equal(b.rule, "loop-reground");
  assert.equal(w.guard.status().latched, true);
  const c = w.guard.check({ message: w.pay(2, 3_000n), at: T0 + 60_000 });
  assert.equal(c.rule, "latched");
});

test("E60 §5 §7 a REGROUND on a proposal an earlier rule denies: the earlier rule is named, the posture recorded, and the latch trips", async () => {
  const w = await world({ sensor: () => ({ intensity: 0, valence: 0.2, repetition: 1 }) });
  w.guard.check({ message: w.pay(0, 1_000n), at: T0 });
  const b = w.guard.check({ message: transferMessage({ from: w.agent.address, to: randomAddress(), lamports: 1_000n }), at: T0 + 30_000 });
  assert.equal(b.rule, "destination-not-allowed");
  assert.equal(b.posture, "REGROUND");
  assert.equal(w.guard.status().latched, true);
});

test("E61 §5 every parsed proposal reaches Keel, a malformed one does not: posture recorded on a denial, null on garbage", async () => {
  let calls = 0;
  const w = await world({ sensor: () => { calls++; return GOOD; } });
  const bad = w.guard.check({ message: new Uint8Array([1, 2, 3]), at: T0 });
  assert.equal(bad.rule, "malformed-proposal");
  assert.equal(bad.posture, null);
  assert.equal(calls, 0);
  const denied = w.guard.check({ message: transferMessage({ from: w.agent.address, to: randomAddress(), lamports: 1_000n }), at: T0 + 30_000 });
  assert.equal(denied.rule, "destination-not-allowed");
  assert.equal(calls, 1);
  assert.notEqual(denied.posture, null);
});

test("E82 §5 every parsed proposal reaches Keel: one denied as latched still has a posture recorded", async (t) => {
  const w = await world({ sensor: () => ({ intensity: 0, valence: 0.2, repetition: 1 }) });
  w.guard.check({ message: w.pay(0, 1_000n), at: T0 });
  w.guard.check({ message: w.pay(1, 2_000n), at: T0 + 30_000 }); // REGROUND, latches
  const c = w.guard.check({ message: w.pay(2, 3_000n), at: T0 + 60_000 });
  t.diagnostic(`rule=${c.rule} posture=${c.posture} telemetry=${JSON.stringify(c.telemetry)}`);
  assert.equal(c.rule, "latched");
  assert.notEqual(c.posture, null, "a parsed proposal denied as latched never reached Keel");
});

import { rechain } from "./chain.mjs";

test("E83 §6 D3 §7 restore validates recorded telemetry before ticking: a chained record whose telemetry is strings, or null, does not start", async (t) => {
  const w = await world();
  const a = w.guard.check({ message: w.pay(0, 1_000n), at: T0 });
  w.guard.report(a.hash, "landed");
  w.guard.check({ message: w.pay(1, 2_000n), at: T0 + 30_000 });
  const genuine = w.guard.entries().map((e) => JSON.parse(JSON.stringify(e)));
  const store = (entries) => ({ entries: [...entries], append(e) { this.entries.push(e); }, close() {} });
  // control: the genuine record, re-chained (unchanged), restores
  const control = await createGuard({ policy: w.policy, log: store(rechain(genuine)) });
  assert.equal(control.status().seq, genuine.length, "control restore did not load the record");
  const forge = (fn) => rechain(genuine.map((e, i) => (i === 0 ? { ...e, telemetry: fn(e.telemetry) } : e)));
  const variants = {
    "telemetry as strings": (tm) => ({ intensity: String(tm.intensity), valence: String(tm.valence), repetition: String(tm.repetition) }),
    "intensity null (how NaN serialises)": (tm) => ({ ...tm, intensity: null }),
  };
  const started = [];
  for (const [name, fn] of Object.entries(variants)) {
    let ok = true;
    try { await createGuard({ policy: w.policy, log: store(forge(fn)) }); } catch { ok = false; }
    t.diagnostic(`${name}: ${ok ? "started" : "refused to start"}`);
    if (ok) started.push(name);
  }
  assert.deepEqual(started, [], `restored and ticked Keel on: ${started.join(", ")}`);
});
