// CI-1: maintain the faults already demonstrated in evals/sdk/latch-c.md.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const path = join(root, "packages/sdk/src/guard.ts");
const original = readFileSync(path, "utf8");
const reground = 'body.posture === "REGROUND" && (body.rule === "loop-reground" || (previous?.allow === false && previous.posture === "REGROUND"))';
const predecessor = 'store.entries.findLast((entry): entry is DecisionEntry => entry.kind === "decision")';
const faults = [
  ["v0", reground, 'body.posture === "REGROUND"'],
  ["only-keel", reground, 'body.posture === "REGROUND" && body.rule === "loop-reground"'],
  ["only-previous", reground, 'body.posture === "REGROUND" && previous?.allow === false && previous.posture === "REGROUND"'],
  ["last-entry", predecessor, 'store.entries.at(-1) as DecisionEntry | undefined'],
  ["no-replay-predecessor", "evaluate(env, proposalOf(entry), prior)", "evaluate(env, proposalOf(entry), undefined)"],
  ["no-denial-threshold", "state.consecutiveDenials + 1 >= policy.latch.afterDenials || regroundTrips", "regroundTrips"],
  ["skip-intervening-decision", predecessor, 'store.entries.findLast((entry): entry is DecisionEntry => entry.kind === "decision" && entry.posture === "REGROUND")'],
] as const;

function battery() {
  return spawnSync(process.execPath, ["--test", "packages/sdk/test/latch-c.test.ts"], {
    cwd: root, encoding: "utf8",
  });
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
    assert.match(output, /tests 24/, "setup errors cannot count as caught faults");
    assert.match(output, /AssertionError/, "must fail a behavioural assertion");
    console.log(`caught latch fault: ${name}`);
  } finally {
    writeFileSync(path, original);
  }
}
const restored = battery();
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All latch faults caught; restored source passes");
