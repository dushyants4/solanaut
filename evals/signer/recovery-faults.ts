// LIF-6: sequential faults; restoration runs even if a fault escapes detection.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "apps/signer/src/core.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["abort-on-attempt-error", "} catch {\n          complete = false;\n        }\n        // Failed pre-send work", "} catch {\n          throw new Error(\"recovery aborted\");\n        }\n        // Failed pre-send work"],
  ["hide-attempt-error", "} catch {\n          complete = false;\n        }\n        // Failed pre-send work", "} catch {\n          complete = true;\n        }\n        // Failed pre-send work"],
  ["skip-chain-after-refusal", "try {\n          if (e.allow) await report(e.hash);\n        }", "try { if (e.allow && complete) await report(e.hash); }"],
  ["invent-recovery-success", "results.push({ decision: e.hash, complete });", "results.push({ decision: e.hash, complete: true });"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "apps/signer/test/core.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery();
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output); assert.match(output, /tests 17/); assert.match(output, /✖ LIF-6/);
    console.log(`caught recovery fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All recovery faults caught; restored source passes");
