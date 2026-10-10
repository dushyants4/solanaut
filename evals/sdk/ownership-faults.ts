// OWN/STO: sequential mutations; always restore the exact original source.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const path = "packages/sdk/src/record.ts";
const original = readFileSync(path, "utf8");
const faults = [
  ["ignore-kernel-lock", "if (result.status !== 0)", "if (false)"],
  ["automatic-stale-takeover", 'if ((error as NodeJS.ErrnoException).code === "EEXIST") throw', 'if ((error as NodeJS.ErrnoException).code === "EEXIST") return lock(path, "kernel"); if (false) throw'],
  ["unlink-mutex", 'if (mode === "manual") { sameFile(fd, lockPath); unlinkSync(lockPath); }', '{ sameFile(fd, lockPath); unlinkSync(lockPath); }'],
  ["create-missing-history", 'options.create === false ? 0 : constants.O_CREAT', 'constants.O_CREAT'],
  ["incomplete-short-write", "offset += written;", "return;"],
  ["ignore-sync-failure", "fsyncSync(fd);\n        owner.held", "try { fsyncSync(fd); } catch {}\n        owner.held"],
  ["ignore-external-size", "current.size !== expected.size ||", "false ||"],
  ["ignore-external-times", "current.mtimeNs !== expected.mtimeNs || current.ctimeNs !== expected.ctimeNs", "false"],
  ["revive-damaged-writer", "failed = true; throw error;", "failed = false; throw error;"],
  ["ignore-single-link", "held.nlink !== 1n || named.nlink !== 1n", "false"],
  ["ignore-read-stability", "before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs", "false"],
  ["ignore-read-completion", "BigInt(bytes.length) !== before.size", "false"],
  ["decoded-read-count", "BigInt(bytes.length) !== before.size", 'BigInt(Buffer.byteLength(bytes.toString("utf8"))) !== before.size'],
  ["ignore-append-completion", "synced.size !== current.size + BigInt(bytes.length)", "false"],
  ["ignore-append-base", "synced.size !== current.size + BigInt(bytes.length)", "synced.size !== BigInt(bytes.length)"],
  ["ignore-post-append-owner", "owner.held(); sameFile(fd, path);\n        const synced", "sameFile(fd, path);\n        const synced"],
  ["ignore-post-append-record", "owner.held(); sameFile(fd, path);\n        const synced", "owner.held();\n        const synced"],
] as const;
const outputDirectory = ".sandbox/solanaut-1/ownership-faults";
mkdirSync(outputDirectory, { recursive: true });
function battery() {
  return spawnSync(process.execPath, ["--test", "packages/sdk/test/ownership.test.ts", "packages/sdk/test/storage-failures.test.ts"], { encoding: "utf8", timeout: 30_000 });
}
const baseline = battery();
writeFileSync(outputDirectory + "/baseline.txt", baseline.stdout + baseline.stderr);
assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = battery();
    const output = result.stdout + result.stderr;
    writeFileSync(outputDirectory + "/" + name + ".txt", output);
    assert.equal(result.status, 1, output);
    assert.match(output, /tests 40\b/, "setup errors cannot count as caught faults");
    assert.match(output, /AssertionError/, "must fail a behavioural assertion");
    console.log(`caught ownership/storage fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery();
writeFileSync(outputDirectory + "/restored.txt", restored.stdout + restored.stderr);
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All ownership/storage faults caught; restored source passes");
