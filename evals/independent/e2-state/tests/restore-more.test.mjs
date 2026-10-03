// §7 Restore: Keel and the sensor are rebuilt by replay; a record outlives a policy change; a closed guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createGuard } from "@solanaut/sdk";
import { setup, transfer, prop, keypair, calmSensor, loopSensor, logPath, rmLog } from "./lib/helpers.mjs";

const T0 = 7_000_000;
const stranger = keypair().address;

test("S70 §7 'On start ... rebuilds ... Keel's state': Keel resumes where it was, not from a fresh state", async () => {
  // loopSensor: a fresh Keel answers DEFAULT on its first tick and REGROUND on its second.
  const s = setup();
  const log = logPath("keel");
  try {
    const g = await createGuard({ policy: s.policy, sensor: loopSensor, log });
    assert.equal(g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250)).posture, "DEFAULT");
    g.close();
    const g2 = await createGuard({ policy: s.policy, sensor: loopSensor, log });
    const d = g2.check(prop(transfer(s.agent, s.dest, 1001n), T0 + 1, 100, 250));
    assert.equal(d.posture, "REGROUND", "Keel's second tick, across the restart");
    assert.equal(d.rule, "loop-reground");
    g2.close();
  } finally { rmLog(log); }
});

test("S71 §11 restart / §7 Restore: with the default sensor, a restart at any point leaves every later entry byte-identical", async () => {
  const s = setup({ intents: { maxAttempts: 3 } });
  // fixed bytes, so two runs see the same proposals
  const m = {
    A: transfer(s.agent, s.dest, 1000n), A2: transfer(s.agent, s.dest, 1000n),
    X: transfer(s.agent, stranger, 1n), B: transfer(s.agent, s.dest, 2000n), B2: transfer(s.agent, s.dest, 2000n),
    C: transfer(s.agent, s.dest, 3000n), C2: transfer(s.agent, s.dest, 3000n), D: transfer(s.agent, s.dest, 4000n),
  };
  const ops = [
    (g, d) => { d.A = g.check(prop(m.A, T0, 100, 250)); },
    (g, d) => { g.report(d.A.hash, "landed"); },
    (g, d) => { d.A2 = g.check(prop(m.A2, T0 + 5_000, 110, 260)); },
    (g, d) => { g.check(prop(m.X, T0 + 9_000, 120, 270)); },
    (g, d) => { d.B = g.check(prop(m.B, T0 + 14_000, 130, 280)); },
    (g, d) => { g.report(d.B.hash, "failed"); },
    (g, d) => { d.B2 = g.check(prop(m.B2, T0 + 20_000, 140, 290)); },
    (g, d) => { d.C = g.check(prop(m.C, T0 + 26_000, 150, 300)); },
    (g, d) => { g.report(d.C.hash, "unknown"); },
    (g, d) => { g.check(prop(m.C2, T0 + 31_000, 160, 310)); },
    (g, d) => { d.D = g.check(prop(m.D, T0 + 37_000, 170, 320)); },
    (g, d) => { g.redeem(m.D, d.D.hash, 170n); },
  ];
  async function run(restartAfter) {
    const log = logPath("equiv");
    try {
      let g = await createGuard({ policy: s.policy, log });
      const d = {};
      for (let i = 0; i < ops.length; i++) {
        if (i === restartAfter) { g.close(); g = await createGuard({ policy: s.policy, log }); }
        ops[i](g, d);
      }
      const es = g.entries();
      const out = { hashes: es.map((e) => e.hash), status: g.status(),
        moved: es.some((e) => e.kind === "decision" && e.telemetry && (e.telemetry.repetition > 0 || e.telemetry.valence < 0.2)) };
      g.close();
      return out;
    } finally { rmLog(log); }
  }
  const ref = await run(-1);
  assert.ok(ref.moved, "precondition: the stream moves the default sensor's repetition or valence");
  for (let k = 1; k < ops.length; k++) {
    const r = await run(k);
    assert.deepEqual(r.status, ref.status, `status after a restart before op ${k}`);
    const at = r.hashes.findIndex((h, i) => h !== ref.hashes[i]);
    assert.equal(at, -1, `restart before op ${k}: entry ${at} differs from the unbroken run`);
  }
});

test("S72 §7 'A record outlives a policy change': the window carries over to the new policy's cap", async () => {
  const s = setup({ sol: { maxPerTx: 1000n, maxPerWindow: 10_000n } });
  const d2 = keypair().address;
  const p1 = { ...s.policy, destinations: { allow: [s.dest, d2] } };
  const log = logPath("carry");
  try {
    const g = await createGuard({ policy: p1, sensor: calmSensor, log });
    const a = g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
    g.report(a.hash, "landed");
    g.close();
    const p2 = { ...p1, sol: { maxPerTx: 1000n, maxPerWindow: 1500n } };
    const g2 = await createGuard({ policy: p2, sensor: calmSensor, log });
    assert.equal(g2.check(prop(transfer(s.agent, d2, 1000n), T0 + 1, 100, 250)).rule, "over-window-cap", "1000 + 1000 > 1500");
    assert.equal(g2.check(prop(transfer(s.agent, d2, 500n), T0 + 2, 100, 250)).allow, true, "1000 + 500 = 1500");
    g2.close();
  } finally { rmLog(log); }
});

test("S73 API close(): 'The guard decides nothing after' — no allow, nothing written", async () => {
  const s = setup();
  const log = logPath("closed");
  try {
    const g = await createGuard({ policy: s.policy, sensor: calmSensor, log });
    g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
    g.close();
    const size = fs.statSync(log).size;
    const d = g.check(prop(transfer(s.agent, s.dest, 2000n), T0 + 1, 100, 250));
    assert.equal(d.allow, false);
    assert.equal(fs.statSync(log).size, size, "the record is untouched");
  } finally { rmLog(log); }
});
