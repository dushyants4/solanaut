// LIF-4: mutate one boundary at a time, with exact restoration.
import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const helper = "packages/sdk/src/control-request.ts"; const guard = "packages/sdk/src/guard.ts";
const originals = new Map([helper, guard].map((p) => [p, readFileSync(p, "utf8")]));
const faults = [
  [guard, "control-payload-reuse", 'old.kind !== "request" || old.request.digest !== request.digest', "false"],
  [guard, "proposal-namespace-reuse", 'recorded.kind !== "decision" || recorded.request!.digest !== binding.digest', "false"],
  [guard, "change-answer", 'if (old.result !== result)', "if (false)"],
  [helper, "record-digest", "canonicalJSON(e.request) !== canonicalJSON(expected)", "false"],
  [helper, "duplicate-start", "requests.has(requestKey(expected))", "false"],
  [helper, "unknown-response", '![...requests.values()].some((r) => r.kind === "request" && r.hash === e.request)', "false"],
  [helper, "duplicate-response", "responses.has(e.request)", "false"],
  [helper, "response-bound", "Buffer.byteLength(result) > 12_288", "false"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "packages/sdk/test/control-request.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [path, name, from, to] of faults) {
  const original = originals.get(path)!;
  assert.ok(original.includes(from), `missing fault site ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const r = battery(); const output = r.stdout + r.stderr;
    assert.equal(r.status, 1, output); assert.match(output, /tests 9/); assert.match(output, /AssertionError/);
    console.log(`caught control-request fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All control-request faults caught; restored source passes");
