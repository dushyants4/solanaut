// SNP-3: faults affect only the new checkpoint codec, not the staged mutation inputs.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "packages/sdk/src/checkpoint.ts", original = readFileSync(path, "utf8");
const faults = [
  ["key-length-bound", 'import { isAddress } from "./base58.ts";', 'import { decodeBase58, encodeBase58 } from "./base58.ts";\nconst isAddress = (value: string) => { try { const bytes = decodeBase58(value); return bytes.length === 32 && encodeBase58(bytes) === value; } catch { return false; } };'],
  ["format", "b.format !== 1", "false"],
  ["profile", "canonicalJSON(b.profile) !== canonicalJSON(EVALUATION_PROFILE)", "false"],
  ["sequence", "!Number.isSafeInteger(b.seq)", "false"],
  ["policy-version", "(b.policyVersion as number) <= 0", "false"],
  ["head", 'b.seq === 0 ? b.head !== "" : !digest(b.head)', "false"],
  ["principal-role", "t.principalKeys.includes(t.checkpointKey)", "false"],
  ["anchor-role", "t.checkpointKey === t.anchorKey", "false"],
  ["guard-pin", "b.guardId !== t.guardId", "false"],
  ["network-pin", "b.cluster !== t.cluster", "false"],
  ["key-pin", "b.checkpointKey !== t.checkpointKey", "false"],
  ["mutable-guard-pin", "b.guardId !== t.guardId", "b.guardId !== trust.guardId"],
  ["mutable-state-digest", "b.stateDigest !== observed.stateDigest", "b.stateDigest !== digests.stateDigest"],
  ["archive-digest", "b.archiveDigest !== observed.archiveDigest", "false"],
  ["state-digest", "b.stateDigest !== observed.stateDigest", "false"],
  ["prefix-digest", "b.prefixDigest !== observed.prefixDigest", "false"],
  ["snapshot-signature", "!signature(t.checkpointKey, prepareCheckpointText(b), a.snapshot)", "false"],
  ["prefix-signature", "!signature(t.checkpointKey, prepareCheckpointPrefixText(b), a.prefix)", "false"],
  ["signature-domain", '"solanaut checkpoint keel prefix\\n"', '"solanaut checkpoint\\n"'],
  ["canonical-base64", 'bytes.toString("base64") === value', "true"],
  ["immutable-result", "Object.freeze({ ...b, profile: EVALUATION_PROFILE })", "({ ...b, profile: EVALUATION_PROFILE })"],
] as const;
const run = () => spawnSync(process.execPath, ["--test", "packages/sdk/test/checkpoint.test.ts"], { encoding: "utf8", timeout: 15_000 });
const baseline = run(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.equal(original.split(from).length, 2, "missing or ambiguous checkpoint fault: " + name);
  try {
    writeFileSync(path, original.replace(from, to)); const changed = run();
    assert.equal(changed.status, 1, changed.stdout + changed.stderr); assert.match(changed.stdout, /SNP-3/); assert.match(changed.stdout, /tests 18\b/);
    console.log("caught checkpoint fault: " + name);
  } finally { writeFileSync(path, original); }
}
const entry = "packages/sdk/src/index.ts", entrySource = readFileSync(entry, "utf8");
try {
  const damaged = entrySource.replace(/^export .*from "\.\/checkpoint\.ts";\n/m, ""); assert.notEqual(damaged, entrySource);
  writeFileSync(entry, damaged); const changed = run(); assert.equal(changed.status, 1, changed.stdout + changed.stderr);
  assert.match(changed.stdout, /candidate SDK entry exports/); assert.match(changed.stdout, /tests 18\b/);
  console.log("caught checkpoint fault: candidate-export");
} finally { writeFileSync(entry, entrySource); }
const restored = run(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All checkpoint faults caught; restored source passes");
