// Token-2022 TransferCheckedWithFee: each fault puts back one part of the misreading fixed on
// 2026-10-22, and the classifier battery must catch it. The source is restored after each.
import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const path = "packages/sdk/src/classify.ts";
const original = readFileSync(path, "utf8");
const faults = [
  ["amount-at-the-tag", "const amountAt = feeChecked ? 2 : 1;", "const amountAt = 1;"],
  ["decimals-in-the-amount", "decimals: checked ? data[amountAt + 8]! : null", "decimals: checked ? data[9]! : null"],
  ["any-sub-instruction-moves", 'return { name, class: name === "TransferCheckedWithFee" ? "value-moving" : "denied" };', 'return { name: "TransferCheckedWithFee", class: "value-moving" };'],
  ["token-program-fee-extension", "if (program === PROGRAMS.token2022 && discriminator === 26)", "if (discriminator === 26)"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "packages/sdk/test/classify.test.ts"], { encoding: "utf8", timeout: 60_000 });

const baseline = battery();
assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.equal(original.split(from).length, 2, `missing or ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = battery();
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /tests 29\b/);
    assert.match(output, /AssertionError/);
    console.log(`caught Token-2022 fault: ${name}`);
  } finally {
    writeFileSync(path, original);
  }
}
const restored = battery();
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All Token-2022 faults caught; restored source passes");
