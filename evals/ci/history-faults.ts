// PUB-1: mutate only this new inventory checker, never the SDK under qualification.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "evals/ci/history.ts";
const faults = [
  ["commit-body-read", "readableCommit(commit);", "void 0;"],
  ["commit-body-hash",'digest("hex")!==commit.id','digest("hex")!==commit.id && false'],
  ["commit-tree-metadata",'headers[0]!==`tree ${commit.tree}`',"false"],
  ["commit-parent-metadata","JSON.stringify(parents)!==JSON.stringify(commit.parents)","false"],
  ["blob-metadata-count","metadata.length !== blobIds.length","false"],
  ["lazy-fetch", 'env.GIT_NO_LAZY_FETCH = "1"', 'env.GIT_NO_LAZY_FETCH = "0"'],
  ["graft-ancestry", 'env.GIT_GRAFT_FILE = "/dev/null"', 'void 0'],
  ["whole-history", '"--parents", "--all", "HEAD"', '"--parents", "HEAD"'],
  ["detached-head", '"--parents", "--all", "HEAD"', '"--parents", "--branches", "--tags"'],
  ["shallow-refusal", 'git(["rev-parse", "--is-shallow-repository"]).trim() !== "false"', "false"],
  ["ref-closure", "targets.some(target => !commitIds.has(target))", "false"],
  ["tree-framing", 'tree && !tree.endsWith("\\0")', "false"],
  ["blob-shape", 'fields.length !== 3 || fields[0] !== blobIds[index] || fields[1] !== "blob" || !/^(0|[1-9][0-9]*)$/.test(fields[2]!) || !Number.isSafeInteger(size)', "false"],
  ["changing-scope", "JSON.stringify(before) !== JSON.stringify(scope())", "false"],
  ["shared-paths", "value.paths.add(path!)", "value.paths = new Set([path!])"],
  ["shared-modes", "value.modes.add(mode!)", "value.modes = new Set([mode!])"],
  ["gitlinks", "links.set(object!, paths)", "void 0"],
  ["digest", 'createHash("sha256").update(JSON.stringify(inventory)).digest("hex")', '"0".repeat(64)'],
] as const;
const run = () => spawnSync(process.execPath, ["--test", "evals/ci/history.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = run(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  const original = readFileSync(path, "utf8"); assert.equal(original.split(from).length, 2, "missing or ambiguous history fault site: " + name);
  try {
    writeFileSync(path, original.replace(from, to)); const result = run();
    assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stdout, /PUB-1/); assert.match(result.stdout, /tests 16\b/);
    console.log("caught history inventory fault: " + name);
  } finally { writeFileSync(path, original); }
}
const restored = run(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All history inventory faults caught; restored source passes");
