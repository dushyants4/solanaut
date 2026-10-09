// Builder-authored semantic faults: actual owned reads, never fabricated successful evidence.
import {strict as assert} from "node:assert";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/guard.ts",source=readFileSync(path,"utf8"),directory=".sandbox/solanaut-1/owned-controls/faults";
mkdirSync(directory,{recursive:true});
const faults=[
  ["genuine-capability",'if (!controls) throw new OwnedControlRequestError("owned controls require a genuine signed guard");','if (!controls) return undefined as T;',"lack owned control authority"],
  ["error-code",'readonly code = "owned-control-request"','readonly code = "foreign"',"corrupt or missing index"],
  ["disk-evidence","await lookupOwnedRequestIndex(store, controlId, { policyTrust: authorization })","({seq:state.seq,head:state.head,row:null})","corrupt or missing index"],
  ["current-head","controlEvidence.seq !== state.seq || controlEvidence.head !== state.head","false","actual control lookup followed"],
  ["late-close","if (shut || controlEvidence.seq","if (controlEvidence.seq","actual control lookup followed"],
  ["begin-identity","const id = structuredClone(identity), payload = controlPayload(method, input);","const id = identity, payload = controlPayload(method, input);","captured before queueing"],
  ["begin-payload","startControl(id, method, JSON.parse(payload), at)","startControl(id, method, input, at)","captured before queueing"],
  ["begin-collision",'row.start.kind !== "request" || row.start.request.digest !== binding.digest',"false","share the identity namespace"],
  ["finish-identity","const id = structuredClone(identity), result = controlResult(input);","const id = identity, result = controlResult(input);","captured before queueing"],
  ["finish-payload","completeControl(startHash, JSON.parse(result))","completeControl(startHash, input)","captured before queueing"],
  ["start-hash",'row?.start.kind !== "request" || row.start.hash !== startHash','row?.start.kind !== "request"',"foreign start and wrong start hash"],
  ["immutable-response",'row.response.kind !== "response" || row.response.result !== result','row.response.kind !== "response"',"differing canonical replies"],
  ["historical-time","return controlReply(row.start);","return controlReply({...row.start,at});","prefix and tail"],
  ["pending-only","if (!row.response) return undefined;","return undefined;","pending result remains undefined"],
  ["shared-fifo","return enqueue(() => currentControl","return Promise.resolve().then(() => currentControl","mixed operations share FIFO"],
  ["queue-recovery","queue = pending.then(() => undefined, () => undefined);","queue = pending.then(() => undefined);","queued refusal does not poison"],
  ["reply-detachment","const reply = structuredClone(input); freezeReply(reply); return reply;","const reply = input; freezeReply(reply); return reply;","cannot alias retained journal"],
  ["reply-freeze","const reply = structuredClone(input); freezeReply(reply); return reply;","const reply = structuredClone(input); return reply;","pending result remains undefined"],
  ["private-start","startControl(id, method, JSON.parse(payload), at)","guard.beginRequest(id, method, JSON.parse(payload), at)","mutable public SDK methods"],
  ["private-response","completeControl(startHash, JSON.parse(result))","guard.finishRequest(startHash, JSON.parse(result))","mutable public SDK methods"],
] as const;
function run(name:string,pattern?:string){
  const result=spawnSync(process.execPath,["--test","--test-isolation=none",...(pattern?["--test-name-pattern="+pattern]:[]),"packages/sdk/test/owned-control-request.test.ts"],{encoding:"utf8",timeout:20000,killSignal:"SIGKILL"});
  writeFileSync(directory+"/"+name+".txt",result.stdout+result.stderr);return result;
}
const baseline=run("baseline");assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,before,after,pattern] of faults){
  const sites=source.split(before).length-1;assert.equal(sites,name==="shared-fifo"?3:name==="start-hash"?2:1,"fault site inventory: "+name);
  try{
    writeFileSync(path,source.replaceAll(before,after));const result=run(name,pattern);
    assert.equal(result.error,undefined,name);assert.equal(result.signal,null,name);assert.equal(result.status,1,name+result.stdout+result.stderr);
    assert.match(result.stdout,/tests 1\b/);assert.match(result.stdout,/AssertionError|OwnedControlRequestError/);
    assert.doesNotMatch(result.stdout+result.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND|ETIMEDOUT/);
    console.log("caught owned control fault: "+name);
  }finally{writeFileSync(path,source);}
}
const restored=run("restored");assert.equal(restored.status,0,restored.stdout+restored.stderr);assert.equal(readFileSync(path,"utf8"),source);
console.log("All owned control faults caught; exact source restored");
