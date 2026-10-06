// CI-1: aggregation checks themselves must detect planted faults.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "evals/ci/bite.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["omit-campaign", '"sdk/request-faults.ts", ', ""],
  ["ignore-failed-exit", "if (result !== 0)", "if (false)"],
  ["ignore-unrestored-source", "if (fingerprint() !== original)", "if (false)"],
  ["invent-clean-result", "ok: failed.length === 0 && skipped.length === 0", "ok: true"],
  ["skip-first-campaign", "of CAMPAIGNS.entries()", "of CAMPAIGNS.slice(1).entries()"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "evals/ci/bite.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery(); const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output); assert.match(output, /tests 3/); assert.match(output, /AssertionError/);
    console.log(`caught bite aggregation fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All bite aggregation faults caught; restored source passes");
