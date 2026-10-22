import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { requirePropertyFaultExit } from "./properties.ts";
const faults = [
  ["per-tx-boundary", "packages/sdk/src/guard.ts", "total.sol > policy.sol.maxPerTx", "total.sol >= policy.sol.maxPerTx", "packages/sdk/test/caps.property.test.ts", "per-tx"],
  ["per-tx-disabled", "packages/sdk/src/guard.ts", "total.sol > policy.sol.maxPerTx", "false", "packages/sdk/test/caps.property.test.ts", "per-tx"],
  ["window-boundary", "packages/sdk/src/guard.ts", "reserved.sol + total.sol > policy.sol.maxPerWindow", "reserved.sol + total.sol >= policy.sol.maxPerWindow", "packages/sdk/test/caps.property.test.ts", "window"],
  ["ignore-reservation", "packages/sdk/src/guard.ts", "reserved.sol + total.sol > policy.sol.maxPerWindow", "total.sol > policy.sol.maxPerWindow", "packages/sdk/test/caps.property.test.ts", "window"],
  ["async-short-run", "evals/ci/properties.ts", "await fc.check(property, propertyTrialOptions(runs, seed, process.env.SOLANAUT_PROPERTY_TRIAL))", "await fc.check(property, {...propertyTrialOptions(runs, seed, process.env.SOLANAUT_PROPERTY_TRIAL),numRuns:1})", "evals/ci/properties.test.ts", "asynchronous"],
] as const;
for (const [name, path, from, to, tests, pattern] of faults) {
  const original = readFileSync(path, "utf8"); assert.equal(original.split(from).length, 2, `missing or ambiguous site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = spawnSync(process.execPath, ["--test", `--test-name-pattern=${pattern}`, tests], { encoding: "utf8", timeout: 30_000, env: {...process.env,SOLANAUT_PROPERTY_TRIAL:"first-failure"} });
    const output = result.stdout + result.stderr;
    requirePropertyFaultExit(result); assert.match(output, /property failed|property run incomplete/);
    console.log(output);
    console.log(`caught cap property fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = spawnSync(process.execPath, ["--test", "evals/ci/properties.test.ts", "packages/sdk/test/caps.property.test.ts"], { encoding: "utf8", timeout: 30_000 });
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All cap property faults caught; restored source passes");
