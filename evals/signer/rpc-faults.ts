// RPC: require assertion failures and restore exact source after every mutation.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "apps/signer/src/rpc.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["ignore-network", 'if (await call(p, "getGenesisHash", [], deadline) !== DEVNET_GENESIS)', "if (false)"],
  ["fractional-height", "!Number.isSafeInteger(value)", "false"],
  ["ignore-context", 'if (slot < floor || slot < p.slot || !("value" in result))', 'if (!("value" in result))'],
  ["one-provider-outcome", 'if (values.length !== 2 || !values[0] || !values[1] || JSON.stringify(values[0]) !== JSON.stringify(values[1])) return null;', 'if (values.length === 1) return values[0]?.outcome ?? null; if (values.length !== 2 || !values[0] || !values[1] || JSON.stringify(values[0]) !== JSON.stringify(values[1])) return null;'],
  ["retry-send", "if (!send && attempt < 2 &&", "if (attempt < 2 &&"],
  ["ignore-blockhash", "if (blockhash !== hash)", "if (false)"],
  ["ignore-envelope-id", "body.id !== requestId", "false"],
  ["unreferenced-deadline", 'const timer = setTimeout(() => controller.abort(), Math.max(1, Math.ceil(remaining)));', 'const timer = setTimeout(() => controller.abort(), Math.max(1, Math.ceil(remaining))).unref();'],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "apps/signer/test/rpc.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = battery(); const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output); assert.match(output, /tests 11/); assert.match(output, /AssertionError/);
    console.log(`caught RPC fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All RPC faults caught; restored source passes");
