import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
const path="packages/sdk/bin/prepare-policy.ts",original=readFileSync(path,"utf8");
const faults=[
  ["version-binding","version: Number(version)","version:Number(version)+1"],
  ["text-binding","preparePolicyText(policy, options.version, options.issued)","preparePolicyText(policy,options.version+1,options.issued)"],
  ["identity-binding","guardId: policy.latch.guardId",'guardId:"foreign"'],
  ["cluster-restriction",'policy.latch.cluster !== "devnet" && policy.latch.cluster !== "localnet"',"false"],
  ["bounded-source","limit = 1_048_576","limit=2_097_152"],
  ["symlink-refusal","constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK","constants.O_RDONLY | constants.O_NONBLOCK"],
  ["policy-error",'code: "policy"','code: "source"'],
  ["version-spelling","/^[1-9][0-9]*$/","/^[0-9]+$/"],
  ["timestamp-spelling","new Date(issued).toISOString() !== issued","false"],
] as const;
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/prepare-policy-cli.test.ts"],{encoding:"utf8",timeout:30_000});
const baseline=run(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,from,to] of faults) {
  assert.equal(original.split(from).length,2,"missing or ambiguous policy command fault: "+name);
  try {writeFileSync(path,original.replace(from,to)); const changed=run(); assert.equal(changed.status,1,changed.stdout+changed.stderr); assert.match(changed.stdout,/POL-1/); assert.match(changed.stdout,/tests 7\b/); console.log("caught policy command fault: "+name);}
  finally {writeFileSync(path,original);}
}
const restored=run(); assert.equal(restored.status,0,restored.stdout+restored.stderr); console.log("All policy command faults caught; restored source passes");
