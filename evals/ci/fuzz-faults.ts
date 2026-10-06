// CI-2: the million-input wrapper must not turn short or failed runs into passes.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "evals/ci/fuzz.ts"; const original = readFileSync(path, "utf8");
const battery = () => spawnSync(process.execPath, ["--test", "evals/ci/fuzz.test.ts"], { encoding: "utf8", timeout: 30_000 });
const faults = [
  ["lower-budget", "runs < 1_000_000", "runs < 0"],
  ["ignore-process-failure", "result.status !== 0", "false"],
  ["accept-duplicate-summary", "summaries.length !== 1", "summaries.length === 0"],
  ["ignore-total", "total !== runs", "false"],
  ["ignore-outcome-sum", "accepted + refused !== runs", "false"],
  ["empty-accepted-domain", "accepted <= 0", "false"],
] as const;
const clean = battery(); assert.equal(clean.status, 0, clean.stdout + clean.stderr);
for (const [name, from, to] of faults) {
  assert.equal(original.split(from).length, 2, `missing or ambiguous site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery();
    assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stdout + result.stderr, /AssertionError/);
    console.log(`caught fuzz gate fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const messagePath = "packages/sdk/src/message.ts"; const message = readFileSync(messagePath, "utf8");
const site = 'new DecodeError("malformed-proposal", why)'; assert.equal(message.split(site).length, 2);
try {
  writeFileSync(messagePath, message.replace(site, "new Error(why)"));
  const result = spawnSync(process.execPath, [path], { encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /AssertionError/); assert.match(result.stderr, /fuzz process failed/);
  console.log("caught fuzz product fault: unexpected-decoder-exception");
} finally { writeFileSync(messagePath, message); }
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All fuzz faults caught; restored source passes");
