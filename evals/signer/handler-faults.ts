// LIF-4/SIG-3: sequential handler faults, exact restoration.
import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path = "apps/signer/src/handler.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["concurrent-payload", "if (active.payload !== payload)", "if (false)"],
  ["duplicate-work", "const active = pending.get(key);", "const active = undefined;"],
  ["ignore-cached-answer", "if (old !== undefined) return old;", "if (false) return old;"],
  ["ignore-new-deadline", "if (validDeadline())", "if (true)"],
  ["ignore-late-deadline", "if (!validDeadline())", "if (false)"],
  ["omit-request-deadline", "await core.report(r.decision as string, r.deadline as number);", "await core.report(r.decision as string);"],
  ["ignore-control-namespace", 'prior.method !== "propose" || prior.payload !== controlPayload("propose", input)', "false"],
  ["omit-refusal-answer", 'guard.finishRequest(start.hash, { status: "denied", code: validDeadline() ? "unavailable" : "deadline" });', 'void start;'],
  ["admission-as-refusal", 'if (guard.entries().some((e) => e.kind === "decision" && e.request && requestKey(e.request) === key))\n            throw error;', 'void error;'],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "apps/signer/test/handler.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const r = battery(); const output = r.stdout + r.stderr;
    assert.equal(r.status, 1, output); assert.match(output, /tests 15/); assert.match(output, /AssertionError/);
    console.log(`caught handler fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All handler faults caught; restored source passes");
