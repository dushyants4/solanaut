import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "packages/sdk/src/archive.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["blocking-fifo-open", " | constants.O_NONBLOCK", ""],
  ["ignore-version", "entry.v !== 1", "false"],
  ["ignore-kind", "!kinds.has(entry.kind)", "false"],
  ["ignore-sequence", "entry.seq !== seq", "false"],
  ["ignore-predecessor", "entry.prev !== previous", "false"],
  ["ignore-content-hash", "entry.hash !== hash", "false"],
  ["complete-line-bound", "end - start > maxLine", "false"],
  ["unfinished-line-bound", "pending.length > maxLine", "false"],
  ["ignore-source-change", "before.size !== after.size", "false"],
  ["ignore-path-replacement", "named.ino !== before.ino", "false"],
  ["ignore-head-pin", "head !== expectedHead", "false"],
  ["ignore-byte-pin", "sha256 !== expectedDigest", "false"],
  ["mutable-head-pin", "head !== expectedHead", "head !== options.expectedHead"],
  ["reject-fractional-clock", "!Number.isFinite(entry.at)", "!Number.isSafeInteger(entry.at)"],
  ["unsafe-sequence-overflow", "nextSeq === Number.MAX_SAFE_INTEGER", "false"],
  ["leak-descriptor", "await handle.close()", "void 0"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "packages/sdk/test/archive.test.ts"], { encoding: "utf8", timeout: 30_000 });
const clean = battery(); assert.equal(clean.status, 0, clean.stdout + clean.stderr);
for (const [name, from, to] of faults) {
  assert.equal(original.split(from).length, 2, `missing or ambiguous site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery();
    assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stdout + result.stderr, /AssertionError|ArchiveError/);
    console.log(`caught archive fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All archive faults caught; restored source passes");
