// POL-4/LIF-7: restored source is verified after every sequential fault campaign.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const faults = [
  ["skip-final-executor-check", "apps/signer/src/core.ts", 'if (guard.entries().some((e) => e.kind === "report" && e.decision === d!.hash && e.outcome !== "unknown"))', "if (false)"],
  ["forget-final-history", "packages/sdk/src/state.ts", 'if (entry.outcome !== "unknown" && state.signing.has(entry.decision))', "if (false)"],
  ["unknown-becomes-final", "packages/sdk/src/state.ts", 'if (entry.outcome !== "unknown" && state.signing.has(entry.decision))', "if (state.signing.has(entry.decision))"],
  ["allow-settled-signing", "packages/sdk/src/signing.ts", 'if (history.settled && event.stage !== "response")', "if (false)"],
  ["allow-old-policy-send", "packages/sdk/src/signing.ts", 'if (d.policyHash !== policyHash) throw new Error("send under another policy is refused");', "void policyHash;"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "apps/signer/test/policy-recovery.test.ts", "packages/sdk/test/signing-history.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, path, from, to] of faults) {
  const original = readFileSync(path, "utf8");
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery();
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output); assert.match(output, /tests 17/); assert.match(output, /AssertionError/);
    console.log(`caught policy recovery fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All policy recovery faults caught; restored source passes");
