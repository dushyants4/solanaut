import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
const faults=[
  ["process","traffic.ts","if(status!==0)","if(false)"],
  ["definition","traffic.ts","evidence.definition!==1","false"],
  ["profiles","traffic.ts","profile.name!==PROFILE_NAMES[index]","false"],
  ["seeds","traffic.ts","profile.seed!==2606101+index","false"],
  ["population","traffic.ts","profile.proposed!==500","false"],
  ["completion","traffic.ts","profile.completed!==profile.proposed","false"],
  ["denial-counts","traffic.ts","denied<0 || denied>proposed","false"],
  ["rule-counts","traffic.ts","!==profile.denied","<0"],
  ["confidence","traffic.ts","upper95(denied,proposed)>0.02","false"],
  ["uncertainty","traffic.ts","const z2=1.96*1.96","const z2=0"],
  ["burst-cadence","traffic-workload.ts","Math.floor(index/10)*100000","Math.floor(index/10)*90000"],
  ["fee-range","traffic-workload.ts","random.int(5000,20000)","random.int(4000,20000)"],
  ["recurring-effects","traffic-workload.ts","?5_000_000n","?4_000_000n"],
  ["guard-policy","traffic-run.ts","maxPerTx:1_000_000_000n","maxPerTx:1n"],
  ["landed-outcomes","traffic-run.ts",'guard.report(decision.hash,"landed")',"void 0"],
  ["loop-inventory","traffic-run.ts",',"failed-outcomes"].entries()',"].entries()"],
  ["failed-outcomes","traffic-run.ts",'guard.report(decision.hash,"failed")','guard.report(decision.hash,"landed")'],
  ["first-refusal","traffic-run.ts","result.rule=decision.rule; break;","result.rule=decision.rule;"],
] as const;
const run=()=>spawnSync(process.execPath,["--test","evals/ci/traffic.test.ts","evals/ci/traffic-workload.test.ts","evals/ci/traffic-run.test.ts"],{encoding:"utf8",timeout:30_000});
const baseline=run(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,file,from,to] of faults) {
  const path="evals/ci/"+file,original=readFileSync(path,"utf8"); assert.equal(original.split(from).length,2,"missing or ambiguous traffic fault: "+name);
  try {writeFileSync(path,original.replace(from,to)); const changed=run(); assert.equal(changed.status,1,changed.stdout+changed.stderr); assert.match(changed.stdout,/RT-[13]/); assert.match(changed.stdout,/tests 13\b/); console.log("caught traffic fault: "+name);}
  finally {writeFileSync(path,original);}
}
const restored=run(); assert.equal(restored.status,0,restored.stdout+restored.stderr); console.log("All traffic faults caught; restored sources pass");
