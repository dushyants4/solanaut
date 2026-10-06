import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validateReplay, type ReplayEvidence } from "./replay.ts";
import { createGuard } from "../../packages/sdk/src/guard.ts";
import { WORKLOAD_POLICY } from "../../packages/sdk/test/support/workload.ts";
import { craftLegacy, enc, key } from "../../packages/sdk/test/support/craft.ts";
const head = "a".repeat(64);
const clean: ReplayEvidence = { ok: true, decisions: 10_000, replayed: 10_000, entries: 12_000, head, kinds: ["decision", "report", "redeem", "release"] };
test("CI-2 replay gate rejects short histories and unsuccessful/incomplete recomputation", () => {
  for (const result of [{ ...clean, decisions: 9999, replayed: 9999 }, { ...clean, decisions: NaN }, { ...clean, ok: false }, { ...clean, replayed: 9999 }, { ...clean, entries: 9999 }, { ...clean, entries: NaN }]) assert.throws(() => validateReplay(result, head));
});
test("CI-2 replay gate rejects changed/missing digests and missing workload kinds", () => {
  for (const result of [{ ...clean, head: "b".repeat(64) }, { ...clean, head: "" }, { ...clean, kinds: ["decision"] }]) assert.throws(() => validateReplay(result, head));
  assert.throws(() => validateReplay(clean, ""));
});
test("CI-2 replay gate accepts a complete mixed history matching the pinned digest", () => {
  validateReplay(clean, head);
});
test("CI-2 replay campaign: per-tx cap regression covers the mixed workload's missing boundary", async () => {
  const guard = await createGuard({ policy: WORKLOAD_POLICY });
  try {
    const message = craftLegacy({ keys: [key(1), key(2), key(0)], header: [1, 0, 1],
      instructions: [{ program: 2, accounts: [0, 1], data: [...enc.u32(2), ...enc.u64(1_000_000_001n)] }] });
    const result = guard.check({ message, at: 1000 });
    assert.equal(result.allow, false); assert.equal(result.rule, "over-per-tx-cap");
  } finally { guard.close(); }
});
