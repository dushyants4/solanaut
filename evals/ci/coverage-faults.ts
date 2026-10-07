import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const faults = [
  ["failed-test-process", "evals/ci/coverage.ts", "if(status!==0)", "if(false)"],
  ["statement-floor", "evals/ci/coverage.ts", "passes(totals.statements,95)", "passes(totals.statements,94)"],
  ["branch-floor", "evals/ci/coverage.ts", "passes(totals.branches,90)", "passes(totals.branches,89)"],
  ["critical-floor", "evals/ci/coverage.ts", "passes(file.branches,85)", "passes(file.branches,84)"],
  ["checkpoint-critical-inventory", "evals/ci/coverage.ts", '"checkpoint.ts",', ""],
  ["catalogue-critical-inventory", "evals/ci/coverage.ts", '"checkpoint-archives.ts",', ""],
  ["prefix-critical-inventory", "evals/ci/coverage.ts", '"checkpoint-prefix.ts",', ""],
  ["snapshot-state-critical-inventory", "evals/ci/coverage.ts", '"checkpoint-state.ts",', ""],
  ["bundle-critical-inventory", "evals/ci/coverage.ts", '"checkpoint-bundle.ts",', ""],
  ["envelope-critical-inventory", "evals/ci/coverage.ts", '"checkpoint-envelope.ts",', ""],
  ["publication-critical-inventory", "evals/ci/coverage.ts", '"checkpoint-publication.ts",', ""],
  ["recovery-critical-inventory", "evals/ci/coverage.ts", '"checkpoint-recovery.ts",', ""],
  ["omit-inventory-check", "evals/ci/coverage.ts", 'throw new Error("coverage inventory differs")', "void 0"],
  ["invalid-counts", "evals/ci/coverage.ts", 'throw new Error("invalid coverage counts")', "void 0"],
  ["wrong-counter-variable", "evals/ci/coverage-instrument.ts", 'coverageVariable:"__solanautCoverage"', 'coverageVariable:"__wrongCoverage"'],
  ["skip-native-stripping", "evals/ci/coverage-instrument.ts", 'stripTypeScriptTypes(source,{mode:"strip",sourceUrl:path})', "source"],
  ["omit-unimported-source", "evals/ci/coverage-merge.ts", "createCoverageMap(Object.fromEntries(expected))", "createCoverageMap({})"],
  ["incomplete-statement-map", "evals/ci/coverage-merge.ts", "keys(file.s)!==keys(template.s)", "false"],
  ["invalid-branch-shape", "evals/ci/coverage-merge.ts", "values.length!==template.b[key]!.length", "false"],
  ["accept-counter-fabrication", "evals/ci/coverage-merge.ts", 'typeof value==="number" && Number.isSafeInteger(value) && value>=0', "true"],
  ["release-input-coercion", "packages/sdk/src/latch.ts", 'if (typeof text !== "string") return null;', ""],
  ["raw-canonical-bytes", "packages/sdk/src/canonical.ts", "value instanceof Uint8Array", "false"],
  ["cross-policy-signing", "packages/sdk/src/signing.ts", 'if (d.policyHash !== policyHash) throw new Error("signing under another policy is refused");', 'if (false) throw new Error("signing under another policy is refused");'],
  ["noncanonical-recorded-policy", "packages/sdk/src/signed-policy.ts", "canonicalJSON(policy) !== e.policy", "false"],
  ["unsupported-signing-stage", "packages/sdk/src/signing.ts", 'throw new Error("unsupported signing stage")', "void 0"],
  ["busy-slot-bound", "apps/signer/src/socket.ts", "sockets.size >= 64", "false"],
  ["expired-provider-lifetime", "apps/signer/src/rpc.ts", "height > lastValid", "false"],
] as const;
const battery=()=>spawnSync(process.execPath,["--test","evals/ci/coverage.test.ts","evals/ci/coverage-instrument.test.ts","evals/ci/coverage-merge.test.ts","evals/ci/coverage-hook.test.ts","packages/sdk/test/boundary-validation.test.ts","packages/sdk/test/signed-policy.test.ts","apps/signer/test/rpc.test.ts","apps/signer/test/socket.test.ts"],{encoding:"utf8",timeout:30_000});
const baseline=battery(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const count=baseline.stdout.match(/\btests (\d+)/); assert.ok(count); assert.ok(Number(count[1])>=50);
for(const [name,path,from,to] of faults) {
  const original=readFileSync(path,"utf8"); assert.equal(original.split(from).length,2,`missing or ambiguous site: ${name}`);
  try {
    writeFileSync(path,original.replace(from,to)); const result=battery();
    assert.equal(result.status,1,result.stdout+result.stderr); assert.match(result.stdout+result.stderr,/CI-2|LAT\/POL|LIF|SIG|RPC/);
    assert.match(result.stdout+result.stderr,new RegExp("\\btests "+count[1]+"\\b"));
    console.log(`caught coverage fault: ${name}`);
  } finally {writeFileSync(path,original);}
}
const restored=battery(); assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All coverage faults caught; restored sources pass");
