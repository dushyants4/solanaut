// Builder-authored semantic faults; setup, syntax, signal and timeout do not receive catch credit.
import {strict as assert} from "node:assert";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/guard.ts",source=readFileSync(path,"utf8"),directory=".sandbox/solanaut-1/owned-admission/faults";
mkdirSync(directory,{recursive:true});
function run(name:string){
  const result=spawnSync(process.execPath,["--test","--test-isolation=none","packages/sdk/test/owned-request-admission.test.ts"],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL"});
  writeFileSync(directory+"/"+name+".txt",result.stdout+result.stderr);return result;
}
const baseline=run("baseline");assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["genuine-capability",'if (!admit) throw new OwnedRequestAdmissionError("owned admission requires a genuine signed guard");',"if (!admit) return guard.check(proposal, identity);"],
  ["proposal-capture","const captured = structuredClone(proposal), id = structuredClone(identity);","const captured = proposal, id = structuredClone(identity);"],
  ["identity-capture","const captured = structuredClone(proposal), id = structuredClone(identity);","const captured = structuredClone(proposal), id = identity;"],
  ["shared-message-copy","if (captured?.message instanceof Uint8Array) captured.message = new Uint8Array(captured.message);","void 0;"],
  ["group-binding","id, captured?.message, captured?.intent)","id, captured?.message)"],
  ["time-capture","const run = async (): Promise<Decision> => {","const run = async (): Promise<Decision> => { captured.at = proposal.at;"],
  ["group-capture","const run = async (): Promise<Decision> => {","const run = async (): Promise<Decision> => { captured.intent = proposal.intent;"],
  ["height-capture","const run = async (): Promise<Decision> => {","const run = async (): Promise<Decision> => { captured.blockHeight = proposal.blockHeight; captured.lastValidBlockHeight = proposal.lastValidBlockHeight;"],
  ["owned-disk-consultation","await lookupOwnedRequestIndex(store, id, { policyTrust: authorization })","({seq:state.seq,head:state.head,row:null})"],
  ["current-head","evidence.seq !== state.seq || evidence.head !== state.head","false"],
  ["late-closure",'if (shut || evidence.seq !== state.seq',"if (evidence.seq !== state.seq"],
  ["payload-collision",'historical.kind !== "decision" || historical.request!.digest !== binding.digest',"false"],
  ["historical-answer","return admissionReply(historical);","return admissionReply({...historical,at:captured.at});"],
  ["historical-policy-retry","return admissionReply(historical);",'if(historical.policyHash !== policyHash)return admissionReply(unrecorded("old policy"));return admissionReply(historical);'],
  ["admission-identity","return admissionReply(check(captured, id));","return admissionReply(check(captured));"],
  ["private-check-context","return admissionReply(check(captured, id));","return admissionReply(guard.check(captured, id));"],
  ["fifo","const pending = queue.then(run);","const pending = run();"],
  ["queue-rejection-recovery","queue = pending.then(() => undefined, () => undefined);","queue = pending.then(() => undefined);"],
  ["reply-detachment","const reply = structuredClone(decision); freeze(reply); return reply;","const reply = decision; freeze(reply); return reply;"],
  ["recursive-reply-freeze","for (const child of Object.values(value)) freeze(child);","void 0;"],
  ["collision-reply-freeze",'return admissionReply(unrecorded("request identity was reused with a different payload"));','return unrecorded("request identity was reused with a different payload");'],
] as const;
const misses:string[]=[];
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"fault must select exactly one site: "+name);
  try{
    writeFileSync(path,source.replace(before,after));const result=run(name);
    assert.equal(result.error,undefined,name);assert.equal(result.signal,null,name);
    if(result.status===0){misses.push(name);console.log("MISSED owned admission fault: "+name);continue;}
    assert.equal(result.status,1,name+result.stdout+result.stderr);assert.match(result.stdout,/tests 18\b/);
    assert.match(result.stdout,/AssertionError|OwnedRequestAdmissionError/);assert.doesNotMatch(result.stdout+result.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);
    console.log("caught owned admission fault: "+name);
  }finally{writeFileSync(path,source);}
}
const restored=run("restored");assert.equal(restored.status,0,restored.stdout+restored.stderr);assert.equal(readFileSync(path,"utf8"),source);
assert.deepEqual(misses,[],"missed semantic faults require regressions");console.log("All owned admission faults caught; source restored");
