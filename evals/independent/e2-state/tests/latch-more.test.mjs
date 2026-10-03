// §5 "A malformed proposal ... counts toward the latch", reports while latched, the release's clock, the lock's form.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createGuard } from "@solanaut/sdk";
import { setup, transfer, prop, keypair, calmSensor, ISO, throws, logPath, rmLog } from "./lib/helpers.mjs";

const T0 = 9_000_000;
const stranger = keypair().address;

test("S78 §5 'A malformed proposal ... counts toward the latch'", async () => {
  const s = setup({ latch: { afterDenials: 3 } });
  const g = await createGuard({ policy: s.policy, sensor: calmSensor });
  for (let i = 0; i < 3; i++) {
    // first byte's high bit clear (legacy), then too short to be a message: rule 1, not rule 2
    const d = g.check({ message: new Uint8Array([1, 2, i]), at: T0 + i });
    assert.equal(d.rule, "malformed-proposal");
  }
  assert.equal(g.status().latched, true);
  assert.equal(g.check(prop(transfer(s.agent, s.dest, 1000n), T0 + 5, 100, 250)).rule, "latched");
});

test("S79 §7: while latched, outcomes of earlier receipts are still taken (a report is not a proposal)", async () => {
  const s = setup({ latch: { afterDenials: 2 } });
  const g = await createGuard({ policy: s.policy, sensor: calmSensor });
  const a = g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  g.check(prop(transfer(s.agent, stranger, 1n), T0 + 1, 100, 250));
  g.check(prop(transfer(s.agent, stranger, 2n), T0 + 2, 100, 250));
  assert.equal(g.status().latched, true);
  assert.equal(throws(() => g.report(a.hash, "landed")), null, "the chain's answer must not be lost to the latch");
  assert.equal(g.entries().at(-1).kind, "report");
});

test("S80 §7 latch release (unclear): an expired release presented with a caller time stepped back before its expiry", async () => {
  const s = setup({ latch: { afterDenials: 2 } });
  const g = await createGuard({ policy: s.policy, sensor: calmSensor });
  g.check(prop(transfer(s.agent, stranger, 1n), T0, 100, 250));
  g.check(prop(transfer(s.agent, stranger, 2n), T0 + 100_000, 100, 250)); // latest recorded time: T0 + 100 s
  const text = g.releaseText(ISO(T0 + 50_000));                            // expired by the latest recorded time
  const r = g.release(text, s.operator.sign(new TextEncoder().encode(text)), T0 + 10_000); // ... but not by this `at`
  console.log(`S80 observed: released=${r.released} reason=${JSON.stringify(r.reason)}`);
});

test("S81 §7 'The lock' (unclear): a lock file that names no process (empty, or garbage), or another host", async () => {
  const s = setup();
  const out = [];
  for (const content of ["", "garbage", JSON.stringify({ pid: 999_999_999, host: "another-host", at: 1 })]) {
    const log = logPath("lockform");
    try {
      fs.writeFileSync(log + ".lock", content);
      try { const g = await createGuard({ policy: s.policy, sensor: calmSensor, log }); g.close(); out.push(`${JSON.stringify(content).slice(0, 30)} -> opened`); }
      catch (e) { out.push(`${JSON.stringify(content).slice(0, 30)} -> refused (${String(e.message).replace(/\/\S*jsonl/g, "<log>").slice(0, 90)})`); }
    } finally { rmLog(log); }
  }
  console.log("S81 observed: " + out.join(" | "));
});
