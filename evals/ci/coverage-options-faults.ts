// CI-2: execution controls cannot filter coverage or change its default scheduling.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "evals/ci/coverage-options.ts";
const faults = [
  ["default-scheduling", "if (argv.length === 0) return [];", 'if (argv.length === 0) return ["--test-concurrency=1"];'],
  ["serial-scheduling", 'return ["--test-concurrency=1"]', 'return ["--test-concurrency=2"]'],
  ["option-whitelist", 'throw new Error("usage: node evals/ci/coverage-run.ts [--serial]");', "return [...argv];"],
] as const;
const run = () => spawnSync(process.execPath, ["--test", "evals/ci/coverage-options.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = run(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  const original = readFileSync(path, "utf8"); assert.equal(original.split(from).length, 2, "missing or ambiguous coverage option fault: " + name);
  try {
    writeFileSync(path, original.replace(from, to)); const result = run();
    assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stdout, /CI-2/); assert.match(result.stdout, /tests 3\b/);
    console.log("caught coverage execution fault: " + name);
  } finally { writeFileSync(path, original); }
}
const restored = run(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All coverage execution faults caught; restored source passes");
