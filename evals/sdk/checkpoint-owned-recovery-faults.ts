import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/record.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","--test-isolation=none","packages/sdk/test/checkpoint-owned-recovery.test.ts"],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL"});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["named-path-alias",'const named = lstatSync(path, { bigint: true });','const named = lstatSync(path, { bigint: true }).isSymbolicLink()?fstatSync(fd,{bigint:true}):lstatSync(path,{bigint:true});'],
  ["actual-store","recoverers.get(store)","recoverers.get(store) ?? (async()=>({mode:'checkpoint'}))"],
  ["kernel-owner",'mode!=="kernel" || !open || failed',"!open || failed"],
  ["closed-owner",'mode!=="kernel" || !open || failed','mode!=="kernel" || failed'],
  ["failed-owner",'mode!=="kernel" || !open || failed','mode!=="kernel" || !open'],
  ["maintenance-exclusive",'if(publishing)throw new CheckpointRecoveryError',"if(false)throw new CheckpointRecoveryError"],
  ["captured-options","const pins=structuredClone(options);\n      if(!pins ||", "const pins=options;\n      if(!pins ||"],
  ["read-ceiling","!Number.isSafeInteger(pins.maxBytes) || pins.maxBytes<=0","false"],
  ["cached-history",'if(canonicalJSON(history)!==canonicalJSON(entries))throw new CheckpointRecoveryError',"if(false)throw new CheckpointRecoveryError"],
  ["final-ownership","held();const after=fstatSync(fd,{bigint:true});","const after=fstatSync(fd,{bigint:true});"],
  ["final-record-boundary","after.size!==before.size || after.mtimeNs!==before.mtimeNs || after.ctimeNs!==before.ctimeNs || canonicalJSON(history)!==canonicalJSON(entries)","false"],
  ["final-cached-history"," || canonicalJSON(history)!==canonicalJSON(entries))throw new CheckpointRecoveryError", ")throw new CheckpointRecoveryError"],
  ["checkpoint-nofollow","fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);","fd=openSync(path,constants.O_RDONLY|constants.O_NONBLOCK);"],
  ["checkpoint-invalid-reason","return fd===undefined && (error as NodeJS.ErrnoException).code===\"ENOENT\"?undefined:null;","return undefined;"],
  ["checkpoint-reads","if(count===0)break;","break;"],
  ["recovery-result","return recovered;",'return Object.freeze({...recovered,mode:"full-replay" as const});'],
] as const;
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"missing owned recovery fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=run();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/tests 10\b/);console.log("caught owned recovery fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All owned recovery faults caught; restored source passes");
