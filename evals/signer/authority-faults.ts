import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const faults = [
  ["mutable-host-configuration", "packages/sdk/src/authority.ts", 'return Object.freeze({ mode: value.mode, clock: Object.freeze({ wall: clock.wall, monotonicNs: clock.monotonicNs }) });', 'return value;'],
  ["caller-decision-attribution", "packages/sdk/src/guard.ts", 'source: env.authority ? ("signer" as const) : ("caller" as const),', 'source: "caller" as const,'],
  ["caller-report-attribution", "packages/sdk/src/guard.ts", 'source: authority ? "signer" : "caller"', 'source: "caller"'],
  ["allow-non-devnet", "packages/sdk/src/guard.ts", 'if (authority && policy.latch.cluster !== "devnet")', 'if (false)'],
  ["use-changing-wall-clock", "apps/signer/src/clock.ts", 'anchor.wall + Number(monotonic() - origin) / 1_000_000', 'wall()'],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "packages/sdk/test/authority.test.ts", "apps/signer/test/clock.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, path, from, to] of faults) {
  const original = readFileSync(path, "utf8");
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery(); const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output); assert.match(output, /tests 5/); assert.match(output, /AssertionError/);
    console.log(`caught authority fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All authority faults caught; restored source passes");
