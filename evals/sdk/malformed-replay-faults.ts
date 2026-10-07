import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path="packages/sdk/src/guard.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/malformed-replay.test.ts"],{encoding:"utf8",timeout:15000});
const faults=[
  ["posture","e.posture !== null || ",""],
  ["telemetry","e.telemetry !== null || ",""],
  ["temperature","e.temperatureMax !== null","false"],
  ["invalid-input-scope",' && e.input === "invalid"',""] ,
  ["entire-refusal",'if (e.kind === "decision" && e.input === "invalid" && (e.posture !== null || e.telemetry !== null || e.temperatureMax !== null))','if (false)'],
] as const;
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"fault must have one target");
  try{
    writeFileSync(path,source.replace(before,after));
    const result=run();assert.equal(result.status,1,name+result.stdout+result.stderr);
    assert.equal(result.signal,null);assert.equal(result.error,undefined);
    assert.match(result.stdout,/tests 3\b/);console.log("caught malformed replay fault: "+name);
  }finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All malformed replay faults caught; restored source passes");
