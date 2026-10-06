// ADR-012 option C, RT-3: predecessor means the previous decision in the record,
// including after restore, rather than the last entry or transient controller state.

import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createGuard, replay, type Decision, type GuardOptions } from "../src/guard.ts";
import { seal, type Entry } from "../src/log.ts";
import { craftLegacy, key } from "./support/craft.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { latchCases } from "./support/latch-streams.ts";

const hostile: GuardOptions["sensor"] = () => ({ intensity: 1, valence: -1, repetition: 1 });
const quiet: GuardOptions["sensor"] = () => ({ intensity: 0, valence: 0, repetition: 0 });
const policy = { ...WORKLOAD_POLICY, latch: { ...WORKLOAD_POLICY.latch, afterDenials: 100 } };
const message = (to = 3, amount = 1n) => craftLegacy({
  header: [1, 0, 1], keys: [key(1), key(to), key(0)],
  instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, ...Array.from({ length: 8 }, (_, i) => Number((amount >> BigInt(8 * i)) & 255n))] }],
});
const proposal = (turn: number, to = 3) => ({ message: message(to), at: 1_000_000 + turn * 400 });
const regroundDenial = (d: Decision) => {
  assert.equal(d.allow, false);
  assert.equal(d.rule, "destination-not-allowed");
  assert.equal(d.posture, "REGROUND");
};

test("LAT-1 / RT-3: a single REGROUND denial by an earlier rule does not latch", async () => {
  const g = await createGuard({ policy, sensor: hostile });
  try {
    assert.equal(g.check(proposal(0)).posture, "INHIBIT");
    const d = g.check(proposal(1));
    regroundDenial(d);
    assert.equal(d.latch, undefined);
    assert.equal(g.status().latched, false);
  } finally { g.close(); }
});

test("LAT-2 / RT-3: two consecutive REGROUND denials latch, across report and restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "solanaut-latch-"));
  const log = join(dir, "record.jsonl");
  let g = await createGuard({ policy, sensor: hostile, log });
  try {
    const first = g.check(proposal(0, 2));
    assert.equal(first.allow, true);
    const denied = g.check(proposal(1));
    regroundDenial(denied);
    assert.equal(g.status().latched, false);
    g.report(first.hash, "failed");
    g.close();
    g = await createGuard({ policy, sensor: hostile, log });
    assert.equal(g.status().latched, false);
    const again = g.check(proposal(2));
    regroundDenial(again);
    assert.equal(again.latch, true);
    assert.equal(g.status().latched, true);
    assert.equal((await replay(g.entries(), policy, hostile)).ok, true);
  } finally { g.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("LAT-2 / RT-3: a decision without REGROUND breaks the consecutive pair", async () => {
  const g = await createGuard({ policy, sensor: hostile });
  try {
    g.check(proposal(0));
    regroundDenial(g.check(proposal(1)));
    const malformed = g.check({ message: Uint8Array.of(1), at: 1_001_000 });
    assert.equal(malformed.rule, "malformed-proposal");
    assert.equal(malformed.posture, null);
    const separated = g.check(proposal(3));
    regroundDenial(separated);
    assert.equal(separated.latch, undefined);
    const consecutive = g.check(proposal(4));
    regroundDenial(consecutive);
    assert.equal(consecutive.latch, true);
  } finally { g.close(); }
});

test("LAT-3 / RT-3: Keel's own loop denial latches immediately", async () => {
  const g = await createGuard({ policy, sensor: hostile });
  try {
    const first = g.check(proposal(0, 2));
    assert.equal(first.allow, true);
    g.report(first.hash, "landed");
    const d = g.check(proposal(1, 2));
    assert.equal(d.rule, "loop-reground");
    assert.equal(d.latch, true);
  } finally { g.close(); }
});

test("LAT-4 / RT-3: the policy's consecutive-denial threshold still latches without REGROUND", async () => {
  const g = await createGuard({ policy: { ...policy, latch: { ...policy.latch, afterDenials: 3 } }, sensor: quiet });
  try {
    for (let i = 0; i < 2; i++) assert.equal(g.check(proposal(i)).latch, undefined);
    const d = g.check(proposal(2));
    assert.equal(d.posture, "DEFAULT");
    assert.equal(d.rule, "destination-not-allowed");
    assert.equal(d.latch, true);
  } finally { g.close(); }
});

test("LAT-5 / RT-3: replay names the accepted one-time divergence of a V0 latch", async () => {
  const g = await createGuard({ policy, sensor: hostile });
  try {
    g.check(proposal(0));
    regroundDenial(g.check(proposal(1)));
    const entries = g.entries().map((e): Entry => {
      if (e.kind !== "decision" || e.seq !== 1) return e;
      const { hash: _hash, ...body } = e;
      return seal<Decision>({ ...body, latch: true });
    });
    const res = await replay(entries, policy, hostile);
    assert.equal(res.ok, false);
    assert.equal(res.divergence?.seq, 1);
    assert.equal(res.divergence?.field, "latch");
  } finally { g.close(); }
});

for (const [label, run, latchTurn, allowed, legitStopped] of latchCases) {
  test(`LAT-6 / RT-3: option C reproduces the archived stream: ${label}`, async () => {
    const x = await run();
    try {
      assert.deepEqual(x.summary(), { latchTurn, allowed, legitStopped });
      if (label.startsWith("drain storm")) assert.ok(x.ds.every((d) => !d.allow));
      assert.equal((await replay(x.g.entries(), x.g.policy)).ok, true);
    } finally { x.g.close(); }
  });
}
