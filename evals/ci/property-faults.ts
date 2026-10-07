// CI-2: budget checks and external-oracle properties must fail on planted faults.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { requirePropertyFaultExit } from "./properties.ts";
const faults = [
  ["incomplete-process", "evals/ci/properties.ts", 'if (result.status !== 1 || result.signal !== null || result.error !== undefined) throw new Error("fault trial process failed or did not complete");', "return;", "evals/ci/property-trial.test.ts"],
  ["ordinary-diagnostics", "evals/ci/properties.ts", "if (mode === undefined) return options;", "if (mode === undefined) return {...options,endOnFailure:true};", "evals/ci/property-trial.test.ts"],
  ["first-counterexample", "evals/ci/properties.ts", "return {...options,endOnFailure:true};", "return {...options,endOnFailure:false};", "evals/ci/property-trial.test.ts"],
  ["fault-mode-whitelist", "evals/ci/properties.ts", 'if (mode !== "first-failure") throw new Error("invalid fault trial mode");', 'if (false) throw new Error("invalid fault trial mode");', "evals/ci/property-trial.test.ts"],
  ["budget-floor", "evals/ci/properties.ts", "requested < MIN_RUNS", "requested < 0", "evals/ci/properties.test.ts"],
  ["incomplete-count", "evals/ci/properties.ts", "result.numRuns !== requested", "false", "evals/ci/properties.test.ts"],
  ["skips", "evals/ci/properties.ts", "result.numSkips !== 0", "false", "evals/ci/properties.test.ts"],
  ["failed-result", "evals/ci/properties.ts", "if (result.failed) throw new Error(\"property failed\")", "if (false) throw new Error(\"property failed\")", "evals/ci/properties.test.ts"],
  ["seed-validation", "evals/ci/properties.ts", "String(seed) !== value", "false", "evals/ci/properties.test.ts"],
  ["address-alphabet", "packages/sdk/src/base58.ts", '"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"', '"213456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"', "packages/sdk/test/properties.test.ts"],
  ["account-writability", "packages/sdk/src/message.ts", "i < nStatic - roUnsigned", "false", "packages/sdk/test/properties.test.ts"],
  ["unexpected-error", "packages/sdk/src/message.ts", 'new DecodeError("malformed-proposal", why)', "new Error(why)", "packages/sdk/test/properties.test.ts"],
] as const;
const battery = (path: string) => spawnSync(process.execPath, ["--test", path], { encoding: "utf8", timeout: 60_000 });
for (const [name, path, from, to, tests] of faults) {
  const original = readFileSync(path, "utf8");
  assert.equal(original.split(from).length, 2, `missing or ambiguous site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = battery(tests); const output = result.stdout + result.stderr;
    requirePropertyFaultExit(result); assert.match(output, /AssertionError|property failed/);
    console.log(`caught property fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
for (const path of ["evals/ci/properties.test.ts", "packages/sdk/test/properties.test.ts", "evals/ci/property-trial.test.ts"]) {
  const restored = battery(path); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
}
console.log("All property faults caught; restored source passes");
