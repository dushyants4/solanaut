import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "evals/ci/replay.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["short-history", "evidence.decisions < 10_000", "evidence.decisions < 0"],
  ["ignore-divergence", "!evidence.ok", "false"],
  ["ignore-recomputed-count", "evidence.replayed !== evidence.decisions", "false"],
  ["ignore-entry-count", "evidence.entries < evidence.decisions", "false"],
  ["ignore-head", "evidence.head !== expected", "false"],
  ["ignore-workload-kind", "!evidence.kinds.includes(kind)", "false"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "evals/ci/replay.test.ts"], { encoding: "utf8", timeout: 30_000 });
for (const [name, from, to] of faults) {
  assert.equal(original.split(from).length, 2, `missing or ambiguous site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery();
    assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stdout + result.stderr, /AssertionError/);
    console.log(`caught replay gate fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const guardPath = "packages/sdk/src/guard.ts"; const source = readFileSync(guardPath, "utf8");
const site = "t.sol > policy.sol.maxPerTx"; assert.equal(source.split(site).length, 2);
try {
  writeFileSync(guardPath, source.replace(site, "false"));
  const result = battery();
  assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stdout + result.stderr, /AssertionError/);
  console.log("caught replay product fault: previously-missed-per-tx-cap");
} finally { writeFileSync(guardPath, source); }
const destination = 'if (sol) return decide(false, "destination-not-allowed"';
assert.equal(source.split(destination).length, 2);
try {
  writeFileSync(guardPath, source.replace(destination, 'if (false) return decide(false, "destination-not-allowed"'));
  const result = spawnSync(process.execPath, [path], { encoding: "utf8", timeout: 60_000 });
  assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stderr, /baseline digest differs/);
  console.log("caught replay product fault: changed-record-and-evaluation");
} finally { writeFileSync(guardPath, source); }
const restored = spawnSync(process.execPath, [path], { encoding: "utf8", timeout: 60_000 });
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All replay faults caught; restored pinned workload passes");
