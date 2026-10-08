import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="tools/stop-supervised-run.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","evals/ci/mutation-stop.test.ts"],{encoding:"utf8",timeout:15000});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["PID-boundary",'!Number.isSafeInteger(ticket.supervisorPid)||ticket.supervisorPid<=1',"false"],
  ["early-return","const end=process.hrtime.bigint()+10_000_000_000n;","return;const end=process.hrtime.bigint()+10_000_000_000n;"],
  ["pending-signal",'process.kill(ticket.supervisorPid,"SIGTERM");',"void 0;"],
  ["completed-signal","if(result===null){","{"],
  ["initial-evidence","let result=readSupervisedResult(ticket);","let result=null;"],
  ["completion-shape",'typeof result!=="object"||Reflect.get(result,"format")!==1||Reflect.get(result,"state")!=="complete"',"false"],
  ["group-confirmation",'Reflect.get(result,"error")==="process group termination unconfirmed"',"false"],
] as const;
for(const [name,before,after] of faults){assert.equal(source.split(before).length,2,"missing stop fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=run();assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 2\b/);assert.doesNotMatch(result.stdout+result.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);console.log("caught mutation stop fault: "+name);}
  finally{writeFileSync(path,source);}
}
const readerPath="tools/run-supervisor.ts",reader=readFileSync(readerPath,"utf8"),missing='throw new Error("supervised completion evidence is missing",{cause:error});';
assert.equal(reader.split(missing).length,2,"missing completion-evidence fault target");
try{writeFileSync(readerPath,reader.replace(missing,"return null;"));const result=run();assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/Missing expected exception/);assert.doesNotMatch(result.stdout+result.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);console.log("caught mutation stop fault: missing-completion-evidence");}
finally{writeFileSync(readerPath,reader);}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All mutation stop faults caught; restored sources pass");
