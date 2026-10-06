import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const faults = [
  ["short-count", "evals/ci/kills.ts", "result.kills < 100", "result.kills < 0"],
  ["ignore-completion", "evals/ci/kills.ts", "result.completed !== result.kills", "false"],
  ["ignore-replay", "evals/ci/kills.ts", "result.replayed !== result.kills", "false"],
  ["ignore-signal", "evals/ci/kills.ts", 'signal !== "SIGKILL"', "false"],
  ["ignore-acknowledgement", "evals/ci/kills.ts", "acknowledged !== expected", "false"],
  ["send-wrong-signal", "evals/ci/kills.ts", 'acknowledged = point; child.kill("SIGKILL")', 'acknowledged = point; child.kill("SIGTERM")'],
  ["skip-state-restore", "packages/sdk/src/guard.ts", "for (const e of store.entries)", "for (const e of [])"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "evals/ci/kills.test.ts"], { encoding: "utf8", timeout: 30_000 });
for (const [name, path, from, to] of faults) {
  const original = readFileSync(path, "utf8"); assert.equal(original.split(from).length, 2, `missing or ambiguous site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery();
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /AssertionError|persisted acknowledgement differs/);
    console.log(`caught kill recovery fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All kill recovery faults caught; restored source passes");
