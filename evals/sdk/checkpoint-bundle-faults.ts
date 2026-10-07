import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path="packages/sdk/src/checkpoint-bundle.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/checkpoint-bundle.test.ts"],{encoding:"utf8",timeout:15000});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["endpoint-capture","endpoint=structuredClone(context)","endpoint=context"],
  ["policy-pins-capture","pins=structuredClone(policyTrust)","pins=policyTrust"],
  ["checkpoint-pins-capture","trust=structuredClone(checkpointTrust)","trust=checkpointTrust"],
  ["history-capture","history=structuredClone(input)","history=input"],
  ["catalogue-capture","catalogue=structuredClone(receipts)","catalogue=receipts"],
  ["anchor-role","trust.checkpointKey===trust.anchorKey","false"],
  ["trust-shape","Array.isArray(trust)","false"],
  ["principal-role","trust.principalKeys.includes(trust.checkpointKey)","false"],
  ["current-principals","!current.principal.every((key:string)=>trust.principalKeys.includes(key))","false"],
  ["identity","admission.guardId!==trust.guardId || admission.cluster!==trust.cluster","false"],
  ["version","policyVersion:admission.policy.version","policyVersion:admission.policy.version+1"],
  ["policy-hash","policyHash:admission.policy.hash",'policyHash:"0".repeat(64)'],
  ["sequence","seq:endpoint.seq","seq:endpoint.seq+1"],
  ["head","head:endpoint.head",'head:"0".repeat(64)'],
  ["archive-digest","archiveDigest:archives.digest",'archiveDigest:"0".repeat(64)'],
  ["state-digest","stateDigest:state.digest",'stateDigest:"0".repeat(64)'],
  ["prefix-digest","prefixDigest:prefix.digest",'prefixDigest:"0".repeat(64)'],
  ["prefix-domain","prefixText=prepareCheckpointPrefixText(binding)","prefixText=prepareCheckpointText(binding)"],
  ["immutable-binding","Object.freeze({format:1","({format:1"],
  ["immutable-result","Object.freeze({binding,archives:archives.text","({binding,archives:archives.text"],
] as const;
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"missing bundle fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=run();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/tests 6\b/);console.log("caught checkpoint bundle fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All checkpoint bundle faults caught; restored source passes");
