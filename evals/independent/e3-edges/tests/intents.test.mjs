// D14 at the guard: an unresolved attempt holds its intent. Expectations from SPEC.md §7 and §10 (D14), §11 double-send.
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./helpers.mjs";

const T0 = Date.parse("2026-10-01T00:00:00Z");

test("E62 §7 §10 D14 an unreported attempt past its last valid height still holds its intent: a re-sign is intent-in-flight", async () => {
  const w = await world();
  const a = w.guard.check({ message: w.pay(0, 1_000n), at: T0, blockHeight: 100n, lastValidBlockHeight: 250n });
  assert.equal(a.allow, true);
  const b = w.guard.check({ message: w.pay(0, 1_000n), at: T0 + 120_000, blockHeight: 10_000n, lastValidBlockHeight: 10_150n });
  assert.equal(b.rule, "intent-in-flight");
});

test("E63 §11 D14 re-sign after expiry with the outcome reported unknown: intent-in-flight", async () => {
  const w = await world();
  const a = w.guard.check({ message: w.pay(0, 1_000n), at: T0, blockHeight: 100n, lastValidBlockHeight: 250n });
  w.guard.report(a.hash, "unknown");
  const b = w.guard.check({ message: w.pay(0, 1_000n), at: T0 + 120_000, blockHeight: 10_000n, lastValidBlockHeight: 10_150n });
  assert.equal(b.rule, "intent-in-flight");
});

test("E64 §7 D14 the hold ends once the window has passed since the intent's first attempt", async () => {
  const w = await world();
  const a = w.guard.check({ message: w.pay(0, 1_000n), at: T0, blockHeight: 100n, lastValidBlockHeight: 250n });
  assert.equal(a.allow, true);
  const b = w.guard.check({ message: w.pay(0, 1_000n), at: T0 + w.policy.windowMs + 1_000, blockHeight: 10_000n, lastValidBlockHeight: 10_150n });
  assert.equal(b.allow, true, `${b.rule}: ${b.reason}`);
});
