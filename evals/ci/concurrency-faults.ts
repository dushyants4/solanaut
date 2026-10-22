import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "evals/ci/concurrency.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["short-budget", "result.proposed < 1000", "result.proposed < 0"],
  ["over-admission", "result.admitted !== 7", "false"],
  ["incomplete-evidence", "count !== result.proposed", "false"],
  ["wrong-reservations", 'result.reserved !== "7000000"', "false"],
  ["wrong-rule", 'result.deniedRules[0] !== "over-window-cap"', "false"],
  ["skip-barrier", "await barrier;", ""],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "evals/ci/concurrency.test.ts"], { encoding: "utf8", timeout: 30_000 });
for (const [name, from, to] of faults) {
  assert.equal(original.split(from).length, 2, `missing or ambiguous site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery();
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /AssertionError|before barrier release/);
    console.log(`caught SDK concurrency fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const guardPath = "packages/sdk/src/guard.ts"; const source = readFileSync(guardPath, "utf8");
const site = "reserved.sol + total.sol > policy.sol.maxPerWindow"; assert.equal(source.split(site).length, 2);
try {
  writeFileSync(guardPath, source.replace(site, "false")); const result = battery();
  assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stdout + result.stderr, /concurrent admission totals differ/);
  console.log("caught SDK concurrency product fault: ignored-pending-window");
} finally { writeFileSync(guardPath, source); }
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All SDK concurrency faults caught; restored source passes");
