// LIF-1: mutate source sequentially and restore exact bytes, including on a missed fault.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const faults = [
  ["ignore-retry", "guard.ts", "if (recorded) {", "if (false && recorded) {"],
  ["ignore-changed-payload", "guard.ts", "recorded.request!.digest !== binding.digest", "false"],
  ["ignore-recorded-binding", "state.ts", "verifyRequest(entry, policy.latch.guardId);", "void entry;"],
  ["ignore-duplicate-history", "state.ts", "if (state.requests.has(requestKey(entry.request)))", "if (false)"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "packages/sdk/test/request-identity.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery();
assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, file, from, to] of faults) {
  const path = `packages/sdk/src/${file}`;
  const original = readFileSync(path, "utf8");
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = battery();
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /tests 8/);
    assert.match(output, /AssertionError/);
    console.log(`caught request fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery();
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All request faults caught; restored source passes");
