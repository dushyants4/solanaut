// LIF-3: restored core and journal are checked after each sequential mutation.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "apps/signer/src/core.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["ignore-deadline", "if (!Number.isFinite(value) || value <= now() || value > now() + 30_000)", "if (false)"],
  ["ignore-completed-payload", "if (old && old.request!.digest !== binding.digest)", "if (false)"],
  ["invent-outcome", 'const outcome = await rpc.outcome(signed.signature, now() + 30_000);', 'const outcome = (await rpc.outcome(signed.signature, now() + 30_000)) ?? "landed";'],
  ["send-without-intent", 'guard.recordSigning({ stage: "send-started", decision: d.hash, blockHeight: height.toString() });', 'void height;'],
  ["forget-persisted-response", "if (old.response) return old.response;", "if (false) return old.response!;"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "apps/signer/test/core.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = battery(); const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output); assert.match(output, /tests 12/); assert.match(output, /AssertionError/);
    console.log(`caught signer core fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All signer core faults caught; restored source passes");
