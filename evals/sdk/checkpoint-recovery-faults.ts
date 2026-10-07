import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/checkpoint-recovery.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/checkpoint-recovery.test.ts"],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL"});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["capture-pins","const pins=structuredClone(options)","const pins=options"],
  ["unknown-configuration",'Object.keys(pins).some(key=>!["archives","checkpointTrust","maxBytes","policyTrust","expectedAnchor"].includes(key))',"false"],
  ["positive-ceiling","pins.maxBytes<=0","false"],
  ["safe-ceiling","!Number.isSafeInteger(pins.maxBytes)","false"],
  ["foreign-guard","trust.guardId!==policy.guardId","false"],
  ["foreign-cluster","trust.cluster!==policy.cluster","false"],
  ["separate-authority","trust.checkpointKey===trust.anchorKey","false"],
  ["principal-coverage","!policy.principal.every((key:string)=>pins.checkpointTrust.principalKeys.includes(key))","false"],
  ["dense-principals","Object.keys(trust.principalKeys).length!==trust.principalKeys.length","false"],
  ["archive-fields","!Object.keys(pins.archives).every((key,index)=>key===String(index))","false"],
  ["principal-fields","!Object.keys(trust.principalKeys).every((key,index)=>key===String(index))","false"],
  ["anchor-binding","pins.expectedAnchor && entries[pins.expectedAnchor.seq]?.hash!==pins.expectedAnchor.head","false"],
  ["derived-checkpoint-validation","await validatePublication(checkpointInput,{checkpointTrust:pins.checkpointTrust,policyTrust:pins.policyTrust,archives:pins.archives,maxBytes:pins.maxBytes},prefixHistory);","void 0;"],
  ["tail-reset",'if(entry.kind==="release")controller.reset();','if(entry.kind==="release")void 0;'],
  ["tail-tick","controller.tick(entry.telemetry).posture!==entry.posture","false"],
  ["tail-posture","controller.tick(entry.telemetry).posture!==entry.posture","(controller.tick(entry.telemetry),false)"],
  ["fallback-prefix","prefix=(await prepareCheckpointPrefix(entries,undefined,context,pins.policyTrust)).text;",'prefix="";'],
  ["fallback-mode",'mode:checkpointSeq===null?"full-replay":"checkpoint"','mode:"checkpoint"'],
  ["admission-state","state:state.text",'state:"{}"'],
  ["immutable-receipt","Object.freeze({mode:checkpointSeq===null?","({mode:checkpointSeq===null?"],
] as const;
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"missing recovery fault: "+name);let changed=source.replace(before,after);
  try{writeFileSync(path,changed);const result=run();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/tests 8\b/);console.log("caught checkpoint recovery fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All checkpoint recovery faults caught; restored source passes");
