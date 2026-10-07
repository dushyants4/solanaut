import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path="tools/run-completion.ts";
const faults=[
  ["strict-fields",path,'Object.keys(input).sort().join(",")!==[...fields].sort().join(",")',"false"],
  ["captured-fields",path,'Object.keys(value).sort().join(",")!==[...fields].sort().join(",")',"false"],
  ["external-identity",path,'!digest(expected.inputHash)',"false"],
  ["bound-identity",path,'result[field]!==expected[field]',"false"],
  ["capture-external-pins",path,'expected=capture(identity,ID_FIELDS)','expected=identity as unknown as Record<string,unknown>'],
  ["format",path,'result.format!==1',"false"],
  ["completed-state",path,'result.state!=="complete"',"false"],
  ["process-pid",path,'(result.supervisorPid as number)<=0',"false"],
  ["distinct-process",path,'result.childPid===result.supervisorPid',"false"],
  ["ordered-time",path,'Date.parse(result.completed)<Date.parse(result.started)',"false"],
  ["canonical-time",path,'new Date(time).toISOString()===value',"true"],
  ["actual-exit",path,'result.status!==0',"false"],
  ["signal",path,'result.signal!==null',"false"],
  ["launch-error",path,'result.error!==null',"false"],
  ["deadline",path,'result.timedOut!==false',"false"],
  ["operator-tool-restoration","evals/ci/bite.ts",'root === "tools" || ',""],
] as const;
const battery=()=>spawnSync(process.execPath,["--test","evals/ci/run-completion.test.ts","evals/ci/bite-source.test.ts"],{encoding:"utf8",timeout:30_000});
const baseline=battery();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,file,from,to] of faults) {
  const original=readFileSync(file,"utf8");assert.equal(original.split(from).length,2,"missing or ambiguous fault: "+name);
  try {
    writeFileSync(file,original.replace(from,to));const changed=battery();
    assert.equal(changed.status,1,changed.stdout+changed.stderr);assert.equal(changed.signal,null);assert.equal(changed.error,undefined);
    assert.match(changed.stdout,/tests 9\b/);assert.match(changed.stdout,/CI-[12]/);
    console.log("caught run-completion fault: "+name);
  } finally {writeFileSync(file,original);}
}
const restored=battery();assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All completion faults caught; restored source passes");
