// §5 rules 15 and 16, §7 windows and intents, §11 concurrency battery.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuard } from "@solanaut/sdk";
import { mk, setup, transfer, prop, keypair, calmSensor, logPath, rmLog, SYSTEM } from "./lib/helpers.mjs";

const T0 = 10_000_000;
const CB = "ComputeBudget111111111111111111111111111111";

async function withDests(n, over = {}, opts = {}) {
  const s = setup(over);
  const dests = [s.dest, ...Array.from({ length: n - 1 }, () => keypair().address)];
  const policy = { ...s.policy, destinations: { allow: dests } };
  const guard = await createGuard({ policy, sensor: calmSensor, log: opts.log });
  return { ...s, policy, guard, dests };
}

test("S21 §5 rule 16: at the SOL window cap is allowed; one lamport over is over-window-cap", async () => {
  const { guard, agent, dests } = await withDests(3, { sol: { maxPerTx: 3000n, maxPerWindow: 3000n } });
  assert.equal(guard.check(prop(transfer(agent, dests[0], 1000n), T0, 100, 250)).allow, true);
  const over = guard.check(prop(transfer(agent, dests[1], 2001n), T0 + 1, 100, 250));
  assert.equal(over.allow, false);
  assert.equal(over.rule, "over-window-cap");
  const at = guard.check(prop(transfer(agent, dests[2], 2000n), T0 + 2, 100, 250));
  assert.equal(at.allow, true, `exactly at the cap: ${at.rule}: ${at.reason}`);
});

test("S22 §5 rule 16: a payment drops out of the window only after windowMs, not before", async () => {
  const { guard, agent, dests, policy } = await withDests(3, { sol: { maxPerTx: 1000n, maxPerWindow: 1000n } });
  const a = guard.check(prop(transfer(agent, dests[0], 1000n), T0, 100, 250));
  guard.report(a.hash, "landed");
  const early = guard.check(prop(transfer(agent, dests[1], 1000n), T0 + policy.windowMs - 1, 100, 250));
  assert.equal(early.rule, "over-window-cap", "1 ms before the window ends");
  const later = guard.check(prop(transfer(agent, dests[2], 1000n), T0 + policy.windowMs + 1, 100, 250));
  assert.equal(later.allow, true, `1 ms after: ${later.rule}: ${later.reason}`);
});

test("S23 §5 rule 16 / §4 Fees: the fee window counts priority and base fees together, to the lamport", async () => {
  const over = { programs: { allow: [SYSTEM, CB] }, fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 14_000n } };
  const { guard, agent, dests } = await withDests(3, over);
  // ceil(10_000 µlamports × 200_000 CU / 1e6) = 2000 priority + 5000 base = 7000
  const a = guard.check(prop(transfer(agent, dests[0], 1n, { microLamports: 10_000, units: 200_000 }), T0, 100, 250));
  assert.equal(a.allow, true, `${a.rule}: ${a.reason}`);
  assert.equal(a.amounts.fees, "7000");
  // 10_005 µlamports → ceil(2001) = 2001 + 5000 = 7001; 7000 + 7001 = 14001 > 14000
  const b = guard.check(prop(transfer(agent, dests[1], 1n, { microLamports: 10_005, units: 200_000 }), T0 + 1, 100, 250));
  assert.equal(b.allow, false);
  assert.equal(b.rule, "over-window-cap");
  const c = guard.check(prop(transfer(agent, dests[2], 1n, { microLamports: 10_000, units: 200_000 }), T0 + 2, 100, 250));
  assert.equal(c.allow, true, `exactly 14000: ${c.rule}: ${c.reason}`);
});

test("S24 §7 'Windows run on the latest recorded time': a caller clock that steps back cannot shrink the window", async () => {
  const { guard, agent, dests, policy } = await withDests(2, { sol: { maxPerTx: 1000n, maxPerWindow: 1000n } });
  const a = guard.check(prop(transfer(agent, dests[0], 1000n), T0, 100, 250));
  guard.report(a.hash, "landed");
  const back = guard.check(prop(transfer(agent, dests[1], 1000n), T0 - policy.windowMs - 1, 100, 250));
  assert.equal(back.allow, false, "a clock stepped back a whole window must not empty it");
  assert.equal(back.rule, "over-window-cap");
});

test("S25 §5 rule 15: the intent's attempts are capped at intents.maxAttempts", async () => {
  const { guard, agent, dest } = await mk({ intents: { maxAttempts: 2 } });
  for (let k = 0; k < 2; k++) {
    const d = guard.check(prop(transfer(agent, dest, 1000n), T0 + k, 100 + k, 250 + k));
    assert.equal(d.allow, true, `attempt ${k + 1}: ${d.rule}`);
    guard.report(d.hash, "failed");
  }
  const third = guard.check(prop(transfer(agent, dest, 1000n), T0 + 2, 102, 252));
  assert.equal(third.allow, false);
  assert.equal(third.rule, "intent-attempts-exhausted");
});

test("S26 §7 'When an intent ends': an exhausted intent tries again a window after its FIRST attempt, never sooner", async () => {
  const { guard, agent, dest, policy } = await mk({ intents: { maxAttempts: 2 } });
  const w = policy.windowMs;
  const first = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
  guard.report(first.hash, "failed");
  const second = guard.check(prop(transfer(agent, dest, 1000n), T0 + 5000, 105, 255));
  assert.equal(second.allow, true);
  guard.report(second.hash, "failed");
  const sooner = guard.check(prop(transfer(agent, dest, 1000n), T0 + w - 1, 110, 260));
  assert.equal(sooner.rule, "intent-attempts-exhausted", "1 ms before a window after the first attempt");
  const later = guard.check(prop(transfer(agent, dest, 1000n), T0 + w + 1, 111, 261));
  assert.equal(later.allow, true, `a window after the first attempt (before one after the last): ${later.rule}: ${later.reason}`);
});

test("S27 §11 concurrency battery: 50 proposals in one tick against the window cap admit exactly the cap (file record)", async () => {
  const log = logPath("conc");
  try {
    const { guard, agent, dests } = await withDests(50, { sol: { maxPerTx: 1000n, maxPerWindow: 10_000n } }, { log });
    const ds = await Promise.all(dests.map(async (d) => guard.check(prop(transfer(agent, d, 1000n), T0, 100, 250))));
    const allowed = ds.filter((d) => d.allow);
    assert.equal(allowed.length, 10, "exactly cap / amount admitted");
    const sum = allowed.reduce((s, d) => s + BigInt(d.amounts.sol), 0n);
    assert.equal(sum, 10_000n);
    assert.ok(ds.filter((d) => !d.allow).every((d) => d.rule === "over-window-cap"), "every other is over-window-cap");
    guard.close();
  } finally { rmLog(log); }
});
