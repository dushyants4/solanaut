import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const faults=[
  ["missing-process","if(status!==0)","if(false)"],
  ["wrong-quantile","Math.ceil(samples.length*0.99)","Math.ceil(samples.length*1)"],
  ["pre-latency","pre>5_000_000","pre>5_000_001"],
  ["synced-latency","persisted>25_000_000","persisted>25_000_001"],
  ["decision-rate","*200n","*199n"],
  ["replay-rate","*5_000n","*4_999n"],
  ["restart-population","restart.decisions!==100_000","false"],
  ["snapshot-trust","restart.snapshotVerified!==true","false"],
  ["keel-replay","restart.keelReplayed!==true","false"],
  ["restart-duration","restart.elapsedNs>5_000_000_000","restart.elapsedNs>5_000_000_001"],
  ["freshness","value>1_000_000_000","value>1_000_000_001"],
  ["pre-regression","BigInt(pre)*5n","BigInt(pre)*4n"],
  ["synced-regression","BigInt(persisted)*5n","BigInt(persisted)*4n"],
  ["compatible-reference","baseline[key]!==evidence[key]","false"],
  ["zero-sample","value>0","value>=0"],
  ["missing-observations",'throw new Error("incomplete timing samples")',"void 0"],
] as const;
const path="evals/ci/performance.ts", original=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","evals/ci/performance.test.ts"],{encoding:"utf8",timeout:15_000});
const baseline=run(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,from,to] of faults) {
  assert.equal(original.split(from).length,2,"missing or ambiguous timing site: "+name);
  try {
    writeFileSync(path,original.replace(from,to)); const changed=run();
    assert.equal(changed.status,1,changed.stdout+changed.stderr); assert.match(changed.stdout,/CI-2/); assert.match(changed.stdout,/tests 8\b/);
    console.log("caught timing fault: "+name);
  } finally {writeFileSync(path,original);}
}
const restored=run(); assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All timing faults caught; restored source passes");
