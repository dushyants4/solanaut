import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, symlinkSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("PUB-1: redirected output parents refuse before any evidence write", () => {
  mkdirSync(".sandbox/history-output-fixtures", { recursive: true });
  const directory = mkdtempSync(".sandbox/history-output-fixtures/repository-");
  try {
    const git = (...args) => {
      const result = spawnSync("git", ["-C", directory, ...args], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    };
    git("init", "-q");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "fixture");
    mkdirSync(join(directory, "target"));
    symlinkSync("target", join(directory, "alias"), "dir");
    const driver = process.env.SOLANAUT_HISTORY_OUTPUT_DRIVER ?? "evals/release/history-bytes-run.mjs";
    const result = spawnSync("node", [driver, directory, join(directory, "alias", "evidence")], { encoding: "utf8" });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /output parent must not redirect/);
    assert.equal(existsSync(join(directory, "target", "evidence")), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("PUB-1: an ordinary fresh output parent still records evidence without clearance", () => {
  mkdirSync(".sandbox/history-output-fixtures", { recursive: true });
  const directory = mkdtempSync(".sandbox/history-output-fixtures/repository-");
  try {
    for (const args of [["init", "-q"], ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "fixture"]]) {
      const result = spawnSync("git", ["-C", directory, ...args], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
    const output = join(directory, "evidence");
    const driver = process.env.SOLANAUT_HISTORY_OUTPUT_DRIVER ?? "evals/release/history-bytes-run.mjs";
    const result = spawnSync("node", [driver, directory, output], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(readFileSync(join(output, "contents.json"), "utf8"));
    assert.equal(receipt.clearance, false); assert.equal(receipt.skipped, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
