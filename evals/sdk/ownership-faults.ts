// OWN/STO: sequential mutations; always restore the exact original source.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const path = "packages/sdk/src/record.ts";
const original = readFileSync(path, "utf8");
const faults = [
  ["ignore-kernel-lock", "if (result.status !== 0)", "if (false)"],
  ["automatic-stale-takeover", 'if ((error as NodeJS.ErrnoException).code === "EEXIST") throw', 'if ((error as NodeJS.ErrnoException).code === "EEXIST") return lock(path, "kernel"); if (false) throw'],
  ["unlink-mutex", 'if (mode === "manual") { sameFile(fd, lockPath); unlinkSync(lockPath); }', '{ sameFile(fd, lockPath); unlinkSync(lockPath); }'],
  ["create-missing-history", 'options.create === false ? 0 : constants.O_CREAT', 'constants.O_CREAT'],
  ["incomplete-short-write", "offset += written;", "return;"],
  ["ignore-sync-failure", "fsyncSync(fd);\n      } catch", "try { fsyncSync(fd); } catch {}\n      } catch"],
] as const;
function battery() {
  return spawnSync(process.execPath, ["--test", "packages/sdk/test/ownership.test.ts", "packages/sdk/test/storage-failures.test.ts"], { encoding: "utf8", timeout: 30_000 });
}
const baseline = battery();
assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = battery();
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /tests 9/, "setup errors cannot count as caught faults");
    assert.match(output, /AssertionError/, "must fail a behavioural assertion");
    console.log(`caught ownership/storage fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery();
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All ownership/storage faults caught; restored source passes");
