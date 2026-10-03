// §7 "What an outcome releases" and what may be reported.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuard } from "@solanaut/sdk";
import { mk, transfer, prop, keypair, throws, calmSensor } from "./lib/helpers.mjs";

const T0 = 2_000_000;
const other = keypair().address;

// Two allowed destinations, so a second payment is a different intent and only the window decides it.
async function withTwoDests(over) {
  const d2 = keypair().address;
  const base = await mk(over);
  const policy = { ...base.policy, destinations: { allow: [base.dest, d2] } };
  const guard = await createGuard({ policy, sensor: calmSensor });
  return { ...base, policy, guard, d2 };
}

test("S12 §7 'What an outcome releases': failed releases the value but keeps the fees", async () => {
  // value: SOL window 1000; A reserves 1000; failed; a different 1000 payment fits again
  {
    const { guard, agent, dest, d2 } = await withTwoDests({ sol: { maxPerTx: 1000n, maxPerWindow: 1000n } });
    const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
    assert.equal(a.allow, true);
    guard.report(a.hash, "failed");
    const c = guard.check(prop(transfer(agent, d2, 1000n), T0 + 1, 101, 251));
    assert.equal(c.allow, true, `value should be released: ${c.rule}: ${c.reason}`);
  }
  // fees: fee window 5000 (one base fee); A reserves 5000; failed; any second tx is over the fee window
  {
    const { guard, agent, dest, d2 } = await withTwoDests({ fees: { maxPerWindow: 5000n } });
    const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
    assert.equal(a.allow, true);
    guard.report(a.hash, "failed");
    const c = guard.check(prop(transfer(agent, d2, 1n), T0 + 1, 101, 251));
    assert.equal(c.allow, false, "fees may have been paid: they stay reserved");
    assert.equal(c.rule, "over-window-cap");
  }
});

test("S13 §7 'What an outcome releases': expired releases both value and fees", async () => {
  const { guard, agent, dest, d2 } = await withTwoDests({ sol: { maxPerTx: 1000n, maxPerWindow: 1000n }, fees: { maxPerWindow: 5000n } });
  const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
  assert.equal(a.allow, true);
  guard.report(a.hash, "expired");
  const c = guard.check(prop(transfer(agent, d2, 1000n), T0 + 1, 260, 410));
  assert.equal(c.allow, true, `${c.rule}: ${c.reason}`);
});

test("S14 §7 'What an outcome releases': unknown releases nothing", async () => {
  const { guard, agent, dest, d2 } = await withTwoDests({ sol: { maxPerTx: 1000n, maxPerWindow: 1000n } });
  const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
  assert.equal(a.allow, true);
  guard.report(a.hash, "unknown");
  const c = guard.check(prop(transfer(agent, d2, 1n), T0 + 1, 260, 410));
  assert.equal(c.allow, false);
  assert.equal(c.rule, "over-window-cap");
});

test("S15 §7: landed ends the intent (same effects again are a new intent) and keeps its reservation", async () => {
  {
    const { guard, agent, dest } = await mk();
    const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
    guard.report(a.hash, "landed");
    const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 1, 101, 251));
    assert.equal(b.allow, true, `a landed intent is done: ${b.rule}: ${b.reason}`);
  }
  {
    const { guard, agent, dest, d2 } = await withTwoDests({ sol: { maxPerTx: 1000n, maxPerWindow: 1000n } });
    const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
    guard.report(a.hash, "landed");
    const c = guard.check(prop(transfer(agent, d2, 1n), T0 + 1, 101, 251));
    assert.equal(c.rule, "over-window-cap", "a landed payment stays counted in its window");
  }
});

test("S16 §7: only allowed decisions take reports; reporting a denied decision throws", async () => {
  const { guard, agent } = await mk();
  const d = guard.check(prop(transfer(agent, other, 1000n), T0, 100, 250));
  assert.equal(d.allow, false);
  for (const o of ["landed", "failed", "expired", "unknown"]) {
    assert.ok(throws(() => guard.report(d.hash, o)), `report(${o}) on a denial must throw`);
  }
});

test("S17 §7: a final outcome cannot be reported again (landed, failed, expired, each twice)", async () => {
  for (const o of ["landed", "failed", "expired"]) {
    const { guard, agent, dest } = await mk();
    const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
    guard.report(a.hash, o);
    const n = guard.entries().length;
    assert.ok(throws(() => guard.report(a.hash, o)), `second ${o} must throw`);
    assert.equal(guard.entries().length, n, "nothing recorded for the refused report");
  }
});

test("S18 §7: after a final outcome, a different outcome cannot replace it (landed then failed)", async () => {
  const { guard, agent, dest } = await mk();
  const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
  guard.report(a.hash, "landed");
  assert.ok(throws(() => guard.report(a.hash, "failed")), "failed after landed must throw: it would free a spent reservation");
  assert.ok(throws(() => guard.report(a.hash, "expired")), "expired after landed must throw");
});

test("S19 §7 / §8 D13-D14: unknown is not final; a later landed report is taken and ends the intent", async () => {
  const { guard, agent, dest } = await mk();
  const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
  guard.report(a.hash, "unknown");
  assert.equal(throws(() => guard.report(a.hash, "landed")), null, "landed after unknown must be accepted");
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 1, 101, 251));
  assert.equal(b.allow, true, `${b.rule}: ${b.reason}`);
});

test("S20 API report(): a decision of another guard, and an outcome outside the four, both throw", async () => {
  const g1 = await mk();
  const g2 = await mk();
  const a2 = g2.guard.check(prop(transfer(g2.agent, g2.dest, 1000n), T0, 100, 250));
  assert.equal(a2.allow, true);
  assert.ok(throws(() => g1.guard.report(a2.hash, "failed")), "another guard's decision");
  const a1 = g1.guard.check(prop(transfer(g1.agent, g1.dest, 1000n), T0, 100, 250));
  assert.ok(throws(() => g1.guard.report(a1.hash, "dropped")), "an outcome that is not landed|failed|expired|unknown");
});
