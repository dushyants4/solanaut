import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
const path="packages/sdk/bin/verify-archive.ts",original=readFileSync(path,"utf8");
const faults=[
  ["paired-flags",'seen.has("--anchor-seq") !== seen.has("--anchor-head")',"false"],
  ["sequence-value","anchorSeq = Number(value)","anchorSeq=Number(value)+1"],
  ["head-value","head: anchorHead!",'head:"0".repeat(64)'],
  ["drop-anchor","if (anchorSeq !== undefined)","if(false)"],
] as const;
const run=()=>spawnSync(process.execPath,["--test","--test-name-pattern=ANC-3","packages/sdk/test/archive-cli.test.ts"],{encoding:"utf8",timeout:30_000});
const baseline=run(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,from,to] of faults) {
  assert.equal(original.split(from).length,2,"missing or ambiguous anchor command fault: "+name);
  try {writeFileSync(path,original.replace(from,to)); const changed=run(); assert.equal(changed.status,1,changed.stdout+changed.stderr); assert.match(changed.stdout,/ANC-3/); assert.match(changed.stdout,/tests 2\b/); console.log("caught anchor command fault: "+name);}
  finally {writeFileSync(path,original);}
}
const restored=run(); assert.equal(restored.status,0,restored.stdout+restored.stderr); console.log("All anchor command faults caught; restored command passes");
