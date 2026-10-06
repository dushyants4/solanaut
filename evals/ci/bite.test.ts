// CI-1: aggregation must reject failed, omitted and non-restoring campaigns.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readdirSync } from "node:fs";
import { CAMPAIGNS, executeCampaigns, validateInventory } from "./bite.ts";
test("CI-1: exact inventory accepts every maintained campaign and rejects omission/addition/duplication", () => {
  assert.doesNotThrow(() => validateInventory([...CAMPAIGNS]));
  assert.doesNotThrow(() => validateInventory((readdirSync("evals", { recursive: true }) as string[]).filter((path) => /(?:^|\/|-)faults\.ts$/.test(path))));
  for (const paths of [CAMPAIGNS.slice(1), [...CAMPAIGNS, "new-faults.ts"], [...CAMPAIGNS, CAMPAIGNS[0]]]) assert.throws(() => validateInventory(paths), /inventory/);
});
test("CI-1: all campaigns run sequentially; failure/null exit fails aggregation without hiding other findings", () => {
  const seen: string[] = [];
  const result = executeCampaigns((path) => { seen.push(path); return path === CAMPAIGNS[0] ? 1 : path === CAMPAIGNS[1] ? null : 0; }, () => "restored");
  assert.deepEqual(seen, [...CAMPAIGNS]); assert.equal(result.ok, false);
  assert.deepEqual(result.failed, [CAMPAIGNS[0], CAMPAIGNS[1]]); assert.deepEqual(result.skipped, []);
  const clean = executeCampaigns(() => 0, () => "restored"); assert.deepEqual(clean, { ok: true, failed: [], skipped: [] });
});
test("CI-1: changed source stops further mutation, reports skipped work and fails the gate", () => {
  let calls = 0; let source = "original";
  const result = executeCampaigns(() => { calls++; source = "mutated"; return 0; }, () => source);
  assert.equal(calls, 1); assert.equal(result.ok, false);
  assert.deepEqual(result.failed, [CAMPAIGNS[0]]); assert.deepEqual(result.skipped, CAMPAIGNS.slice(1));
});
