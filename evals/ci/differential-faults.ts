import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const faults=[
  ["process","differential.ts","if(status!==0)","if(false)"],
  ["population","differential.ts","evidence.transactions<1000","evidence.transactions<999"],
  ["digest","differential.ts","evidence.digest!==expected","false"],
  ["versions","differential.ts","evidence.versions[key]!<1","evidence.versions[key]!<0"],
  ["programs","differential.ts","evidence.programs[key]!<1","evidence.programs[key]!<0"],
  ["completion","differential.ts","evidence.completed!==evidence.transactions","false"],
  ["mismatch","differential.ts","evidence.mismatches!==0","false"],
  ["oracle-comparison","differential-check.ts","assert.deepEqual(actual,reference)","void 0"],
  ["strict-refusal","differential-check.ts","strictRefusal=true","strictRefusal=false"],
  ["corpus-pin","differential-run.ts",'throw new Error("corpus digest differs")',"void 0"],
  ["corpus-framing","differential-run.ts",'if(!text.endsWith("\\n"))','if(false)'],
  ["duplicate-transaction","differential-run.ts","wires.has(row.wire)","false"],
] as const;
const run=()=>spawnSync(process.execPath,["--test","evals/ci/differential.test.ts","evals/ci/differential-check.test.ts","evals/ci/differential-run.test.ts"],{encoding:"utf8",timeout:20_000});
const baseline=run(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,file,from,to] of faults) {
  const path="evals/ci/"+file, original=readFileSync(path,"utf8"); assert.equal(original.split(from).length,2,"missing or ambiguous differential site: "+name);
  try {
    writeFileSync(path,original.replace(from,to)); const changed=run(); assert.equal(changed.status,1,changed.stdout+changed.stderr);
    assert.match(changed.stdout,/CI-2/); assert.match(changed.stdout,/tests 11\b/); console.log("caught differential fault: "+name);
  } finally {writeFileSync(path,original);}
}
const restored=run(); assert.equal(restored.status,0,restored.stdout+restored.stderr); console.log("All differential faults caught; restored sources pass");
