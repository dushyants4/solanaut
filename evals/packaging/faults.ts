// Prove the installed-package gate still detects damaged release candidates.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const stage = join(root, ".sandbox/releases/sdk");
function battery() {
  return spawnSync(process.execPath, ["--test", "evals/packaging/packed-sdk.test.ts"], {
    cwd: root, encoding: "utf8", env: { ...process.env, SOLANAUT_PACKAGE: stage },
  });
}
const baseline = battery();
assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
const faults = [
  { name: "export", path: "package.json", caught: "installed JavaScript", damage: (text: string) => {
    const value = JSON.parse(text);
    value.exports["."].import = "./src/index.ts";
    return JSON.stringify(value);
  } },
  { name: "types", path: "dist/src/index.d.ts", caught: "consumer declarations", damage: () => undefined },
  { name: "dependency", path: "package.json", caught: "installed JavaScript", damage: (text: string) => {
    const value = JSON.parse(text);
    value.dependencies = {};
    return JSON.stringify(value);
  } },
  { name: "cli", path: "dist/bin/replay.js", caught: "installed replay", damage: (text: string) => text.replace(/^#![^\n]*\n/, "") },
];
for (const fault of faults) {
  const path = join(stage, fault.path);
  const original = readFileSync(path);
  try {
    const damaged = fault.damage(original.toString("utf8"));
    if (damaged === undefined) rmSync(path);
    else {
      assert.notEqual(damaged, original.toString("utf8"), "fault must change the candidate");
      writeFileSync(path, damaged);
    }
    const result = battery();
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /tests 5/, "a harness setup failure is not a caught product fault");
    const failures = output.split("\n").filter((line) => /[✖]|not ok/.test(line));
    assert.ok(failures.some((line) => line.includes(fault.caught)), output);
    console.log(`caught package fault: ${fault.name}`);
  } finally {
    writeFileSync(path, original);
  }
}
const restored = battery();
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All package faults caught; restored candidate passes");
