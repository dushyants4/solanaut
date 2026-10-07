import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path="packages/sdk/src/checkpoint-state.ts",source=readFileSync(path,"utf8");
const execute=()=>spawnSync(process.execPath,["--test","packages/sdk/test/checkpoint-state.test.ts"],{encoding:"utf8",timeout:15_000});
const baseline=execute();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["full-replay","await prepareCheckpointPrefix(captured,policySeed,endpoint,pins)","void 0"],
  ["history-capture","captured=structuredClone(input)","captured=input"],
  ["policy-capture","policySeed=structuredClone(policyInput)","policySeed=policyInput"],
  ["trust-capture","pins=structuredClone(trust)","pins=trust"],
  ["map-retention","if(value instanceof Map)return [...value].map(([key,item])=>[key,values(item)])","if(value instanceof Map)return []"],
  ["receipt-retention","if(value instanceof Set)return [...value]","if(value instanceof Set)return []"],
  ["amounts",'return value.toString()', 'return "0"'],
  ["maximal-window","retentionWindow(entries,policy.windowMs)","policy.windowMs"],
  ["apply-state","apply(state,entry,policy)","void 0"],
  ["previous-decision","previousDecision=entry","previousDecision=null"],
  ["policy-version","version:previous!.version","version:previous!.version+1"],
  ["policy-hash","canonical:canonicalJSON(policy),hash",'canonical:canonicalJSON(policy),hash:"0".repeat(64)'],
  ["policy-content","canonical:canonicalJSON(policy)",'canonical:"{}"'],
  ["profile","profile:EVALUATION_PROFILE",'profile:{...EVALUATION_PROFILE,sensor:"foreign"}'],
  ["digest","digest:sha256hex(text)",'digest:sha256hex("bogus")'],
  ["immutable","Object.freeze({text,digest:sha256hex(text)})","({text,digest:sha256hex(text)})"],
] as const;
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"missing or ambiguous state fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=execute();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 6\b/);console.log("caught checkpoint state fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=execute();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All checkpoint state faults caught; restored source passes");
