import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/guard.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/replay-stream.test.ts"],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL"});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["policy-capture","policySeed = structuredClone(policyInput)","policySeed = policyInput"],
  ["trust-capture","pins = structuredClone(trust)","pins = trust"],
  ["future-window","retentionMs = Math.max(retentionMs, createPolicy(JSON.parse(entry.policy)).policy.windowMs)","retentionMs = 0"],
  ["signed-sensor","if (firstPolicy && sensor !== sensorV1)\n      throw new StreamReplayError","if (false) throw new StreamReplayError"],
  ["source-match","checked !== count || checkedFingerprint !== fingerprint","false"],
  ["source-fingerprint","checkedFingerprint !== fingerprint","false"],
  ["producer-copy","yield JSON.parse(text) as Entry;","yield input;"],
  ["decision-recomputation","const result = await recompute(env, records());","const result: ReplayResult = {ok:true,decisions:0,divergence:null}; for await(const _entry of records())void 0;"],
  ["array-yields","\n  for (const entry of entries) {\n    const divergence = checker.accept(entry);\n    if (divergence) return divergence;\n  }","  return recompute(env, entries);"],
] as const;
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"missing or ambiguous stream replay fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=run();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/tests 10\b/);console.log("caught stream replay fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All stream replay faults caught; restored source passes");
