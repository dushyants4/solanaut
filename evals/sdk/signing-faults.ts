// LIF-2: each mutation must produce a behavioural assertion failure, then restore.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "packages/sdk/src/signing.ts";
const original = readFileSync(path, "utf8");
const faults = [
  ["no-redemption", "if (!redeemed)", "if (false)"],
  ["changed-bytes", 'if (Buffer.from(tx.message).toString("base64") !== d.message)', "if (false)"],
  ["invalid-signature", "!verifyEd25519(decoded.staticAccounts[0]!, tx.message, sig)", "false"],
  ["send-before-signed", "if (!signed)", "if (false)"],
  ["expired-send", "if (!d.expires || BigInt(event.blockHeight) > BigInt(d.expires.lastValidBlockHeight))", "if (false)"],
  ["repeat-send", "if (started)", "if (false)"],
  ["repeat-response", "if (response)", "if (false)"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "packages/sdk/test/signing-history.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery();
assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = battery(); const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /tests 9/); assert.match(output, /AssertionError/);
    console.log(`caught signing fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All signing faults caught; restored source passes");
