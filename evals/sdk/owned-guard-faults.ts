// Builder-authored semantic trials; no independent security-review claim.
import {strict as assert} from "node:assert";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/owned-guard.ts",source=readFileSync(path,"utf8"),directory=".sandbox/solanaut-1/owned-facade/faults";
mkdirSync(directory,{recursive:true});
const faults=[
  ["fresh-history","ownership:\"kernel\",create:false","ownership:\"kernel\",create:true","missing, empty and unsigned"],
  ["startup-capture","const options=structuredClone(input);","const options=input;","startup captures signed configuration"],
  ["implicit-upgrade","lastPolicy.version!==options.authorization.version||lastPolicy.text!==options.authorization.text","false","configuration cannot upgrade"],
  ["index-evidence","const evidence=await lookupOwnedRequestIndex(store,{clientId:\"owned-startup\",id:\"validation\"},{policyTrust:options.authorization});","const evidence={seq:guard.status().seq,head:store.entries.at(-1)?.hash};","corrupt index"],
  ["startup-cleanup","if(guard)guard.close();else store?.close();","void guard;","corrupt index"],
  ["error-code","readonly code=\"owned-guard\"","readonly code=\"foreign\"","missing, empty and unsigned"],
  ["surface-freeze","return Object.freeze({","return ({","frozen asynchronous surface"],
  ["policy-freeze","freeze(copy);return copy;","return copy;","frozen asynchronous surface"],
  ["private-history","policy,policyHash:guard.policyHash,","guard,policy,policyHash:guard.policyHash,","frozen asynchronous surface"],
  ["fifo-status","status(){return enqueue(()=>detached(guard.status()));}","status(){return Promise.resolve(detached(guard.status()));}","observations share one FIFO"],
  ["identity-capture","const id=structuredClone(identity),value=structuredClone(payload);","const id=identity,value=structuredClone(payload);","observations share one FIFO"],
  ["payload-capture","const id=structuredClone(identity),value=structuredClone(payload);","const id=structuredClone(identity),value=payload;","observations share one FIFO"],
  ["answer-capture","const id=structuredClone(identity),value=structuredClone(result);","const id=structuredClone(identity),value=result;","observations share one FIFO"],
  ["shared-bytes","if(p?.message instanceof Uint8Array)p.message=new Uint8Array(p.message);","void p;","copy shared bytes"],
  ["drain-close","closing=queue.then(()=>{closed=true;guard.close();})","closing=Promise.resolve().then(()=>{closed=true;guard.close();})","close drains preceding work"],
  ["refuse-after-close","if(!accepting)return Promise.reject(new OwnedGuardError());\n    const pending=queue.then(()=>{if(closed)throw new OwnedGuardError();return work();})","const pending=queue.then(()=>work())","close drains preceding work"],
  ["recover-queue","queue=pending.then(()=>undefined,()=>undefined);","queue=pending.then(()=>undefined);","refusal does not poison"],
] as const;
function run(name:string,pattern?:string){const result=spawnSync(process.execPath,["--test","--test-isolation=none",...(pattern?["--test-name-pattern="+pattern]:[]),"packages/sdk/test/owned-guard.test.ts"],{encoding:"utf8",timeout:20000,killSignal:"SIGKILL"});writeFileSync(directory+"/"+name+".txt",result.stdout+result.stderr);return result;}
const baseline=run("baseline");assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,before,after,pattern] of faults){assert.equal(source.split(before).length-1,1,"fault site: "+name);try{
  writeFileSync(path,source.replace(before,after));const result=run(name,pattern);assert.equal(result.error,undefined,name);assert.equal(result.signal,null,name);assert.equal(result.status,1,name+result.stdout+result.stderr);
  assert.match(result.stdout,/tests 1\b/);assert.match(result.stdout,/AssertionError|OwnedGuardError/);assert.doesNotMatch(result.stdout+result.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND|ETIMEDOUT/);console.log("caught owned facade fault: "+name);
}finally{writeFileSync(path,source);}}
const restored=run("restored");assert.equal(restored.status,0,restored.stdout+restored.stderr);assert.equal(readFileSync(path,"utf8"),source);console.log("All owned facade faults caught; exact source restored");
