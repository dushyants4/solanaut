// SNP-7/LIF-1: disk evidence through a captured head precedes owned admission.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import fs from "node:fs";
import asyncFs from "node:fs/promises";
import {syncBuiltinESMExports} from "node:module";
import {spawnSync} from "node:child_process";
import {join} from "node:path";
import * as guards from "../src/guard.ts";
import type {Guard,ProposalV1,Decision} from "../src/guard.ts";
import {fileStore,memoryStore,publishOwnedRequestIndex,type EntryStore} from "../src/record.ts";
import {encodeBase58} from "../src/base58.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";
const identity=(id:string)=>({clientId:"client",id});
const check=(guard:Guard,proposal:ProposalV1,id:ReturnType<typeof identity>):Promise<Decision>=>{
  const call=Reflect.get(guards,"checkOwnedRequest");assert.equal(typeof call,"function","owned serialized admission must exist");return Reflect.apply(call,undefined,[guard,proposal,id]);
};
const refused=(work:()=>Promise<unknown>)=>assert.rejects(Promise.resolve().then(work),{name:"OwnedRequestAdmissionError",code:"owned-request-admission"});
async function fixture(change:(policy:typeof WORKLOAD_POLICY)=>void=()=>{}){
  const scratch=".sandbox/solanaut-1/owned-admission/cases";fs.mkdirSync(scratch,{recursive:true});
  const directory=fs.mkdtempSync(join(scratch,"case-")),path=join(directory,"guard.jsonl");
  const operator=generateKeyPairSync("ed25519"),agent=generateKeyPairSync("ed25519");
  const address=(pair:typeof operator)=>encodeBase58(Buffer.from(pair.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...structuredClone(WORKLOAD_POLICY),principal:[address(agent)],latch:{...WORKLOAD_POLICY.latch,cluster:"devnet" as const,releaseKey:address(operator)}};change(policy);
  const policyTrust={operatorKey:address(operator),guardId:policy.latch.guardId,cluster:policy.latch.cluster},issued="2026-10-08T00:00:00.000Z";
  const authorization=(p:unknown,version:number)=>{const text=preparePolicyText(p,version,issued);return {...policyTrust,version,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};};
  const store=fileStore(path,{ownership:"kernel"}),guard=await guards.createGuard({policy,authorization:authorization(policy,1),log:store});
  const message=(amount=1,seed=20)=>craftLegacy({header:[1,0,1],keys:[[...Buffer.from(agent.publicKey.export({format:"jwk"}).x!,"base64url")],key(2),key(0)],blockhash:key(seed),instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,amount,0,0,0,0,0,0,0]}]});
  const proposal=(amount=1,at=1000,seed=20):ProposalV1=>({message:message(amount,seed),at,blockHeight:10n,lastValidBlockHeight:100n});
  await publishOwnedRequestIndex(store,{policyTrust});
  return {directory,path,store,guard,policy,policyTrust,authorization,operator,agent,message,proposal,close(){guard.close();fs.rmSync(directory,{recursive:true,force:true});}};
}
test("SNP-7/LIF-1: prefix and tail retries return exact durable admissions without reevaluation",async()=>{
  const f=await fixture();try{
    const first=await check(f.guard,f.proposal(),identity("payment"));assert.ok(first.allow);assert.ok(first.request);const status=f.guard.status(),entries=f.guard.entries();
    assert.deepEqual(await check(f.guard,{...f.proposal(),at:9000,blockHeight:1000n},identity("payment")),first);assert.deepEqual(f.guard.status(),status);assert.deepEqual(f.guard.entries(),entries);
    await publishOwnedRequestIndex(f.store,{policyTrust:f.policyTrust});assert.deepEqual(await check(f.guard,f.proposal(),identity("payment")),first);assert.deepEqual(f.guard.status(),status);
  }finally{f.close();}
});
test("SNP-7: fresh replies and collision denials are detached and deeply immutable",async()=>{
  const f=await fixture();try{
    const first=await check(f.guard,f.proposal(),identity("payment")),before=structuredClone(f.guard.entries());assert.ok(first.allow);assert.ok(first.expires);assert.ok(first.amounts);assert.ok(first.telemetry);assert.ok(first.request);
    const cached=f.store.entries.find(entry=>entry.hash===first.hash)!;assert.notEqual(first,cached);assert.notEqual(first.request,(cached as Decision).request);
    for(const value of [first,first.expires,first.amounts,first.amounts.tokens,first.telemetry,first.keel,first.request])assert.ok(Object.isFrozen(value));
    for(const mutate of [()=>{first.expires!.lastValidBlockHeight="99999";},()=>{first.amounts!.sol="99999";},()=>{first.telemetry!.intensity=1;},()=>{first.keel.digest="foreign";},()=>{first.request!.digest="foreign";}])assert.throws(mutate,TypeError);
    assert.deepEqual(f.guard.entries(),before);assert.deepEqual(await check(f.guard,f.proposal(),identity("payment")),first);
    const collision=await check(f.guard,f.proposal(2),identity("payment"));assert.equal(collision.seq,-1);assert.ok(Object.isFrozen(collision));assert.ok(Object.isFrozen(collision.keel));assert.throws(()=>{collision.keel.digest="foreign";},TypeError);assert.deepEqual(f.guard.entries(),before);
  }finally{f.close();}
});
test("LIF-1: changed bytes, group and control methods cannot reuse a request identity",async()=>{
  const f=await fixture();try{
    const first=await check(f.guard,{...f.proposal(),intent:"original"},identity("same")),before=f.guard.entries().length;assert.ok(first.allow);
    assert.deepEqual(await check(f.guard,{...f.proposal(),intent:"original",at:1001},identity("same")),first);
    for(const proposal of [{...f.proposal(2),intent:"original"},{...f.proposal(),intent:"changed"}]){
      const denial=await check(f.guard,proposal,identity("same"));assert.equal(denial.seq,-1);assert.equal(denial.allow,false);assert.match(denial.reason,/identity.*payload/);
    }
    assert.equal(f.guard.entries().length,before);const start=f.guard.beginRequest(identity("control"),"status",{},1001),count=f.guard.entries().length;
    const denial=await check(f.guard,f.proposal(),identity("control"));assert.equal(denial.seq,-1);assert.equal(denial.allow,false);assert.equal(f.guard.entries().length,count);assert.equal(start.kind,"request");
  }finally{f.close();}
});
test("SNP-7/LIF-1: FIFO concurrent identities observe reservations from earlier admissions",async()=>{
  const f=await fixture(policy=>{policy.sol.maxPerTx=2n;policy.sol.maxPerWindow=2n;});try{
    const work=[check(f.guard,f.proposal(2),identity("one")),check(f.guard,f.proposal(1,1001),identity("two")),check(f.guard,f.proposal(2,1002),identity("one"))];
    const [first,second,again]=await Promise.all(work);assert.ok(first!.allow);assert.equal(second!.allow,false);assert.equal(second!.rule,"over-window-cap");assert.deepEqual(again,first);
    assert.equal(f.guard.entries().filter(entry=>entry.kind==="decision").length,2);assert.equal(first!.seq+1,second!.seq);
  }finally{f.close();}
});
test("LIF-1: concurrent identical payloads admit once; conflicting queued payloads refuse",async()=>{
  const f=await fixture();try{
    const results=await Promise.all(Array.from({length:5},()=>check(f.guard,f.proposal(),identity("one"))));for(const result of results)assert.deepEqual(result,results[0]);
    assert.equal(f.guard.entries().filter(entry=>entry.kind==="decision").length,1);
    const [same,changed]=await Promise.all([check(f.guard,f.proposal(),identity("one")),check(f.guard,f.proposal(2),identity("one"))]);assert.deepEqual(same,results[0]);assert.equal(changed.seq,-1);assert.equal(changed.allow,false);
  }finally{f.close();}
});
test("SNP-7: proposal bytes, identity, grouping, time and lifetime are captured before queueing",async()=>{
  const f=await fixture();try{
    const proposal={...f.proposal(),intent:"captured"},id=identity("captured"),bytes=Buffer.from(proposal.message).toString("base64"),pending=check(f.guard,proposal,id);
    proposal.message.fill(255);proposal.intent="changed";proposal.at=5000;proposal.blockHeight=1000n;proposal.lastValidBlockHeight=1n;id.id="changed";
    const decision=await pending;assert.ok(decision.allow);assert.equal(decision.message,bytes);assert.equal(decision.group,"captured");assert.equal(decision.at,1000);assert.equal(decision.blockHeight,"10");assert.equal(decision.lastValidBlockHeight,"100");assert.equal(decision.request?.id,"captured");
  }finally{f.close();}
});
test("SNP-7/LIF-1: shared-memory message bytes cannot change the captured admission payload",async()=>{
  const f=await fixture();try{
    const original=f.message(),shared=new Uint8Array(new SharedArrayBuffer(original.length));shared.set(original);
    const pending=check(f.guard,{...f.proposal(),message:shared},identity("shared"));shared.set(f.message(2));
    const decision=await pending;assert.ok(decision.allow);assert.equal(decision.message,Buffer.from(original).toString("base64"));assert.equal(decision.amounts?.sol,"1");
    assert.deepEqual(await check(f.guard,f.proposal(),identity("shared")),decision);
  }finally{f.close();}
});
test("OWN-2/SNP-7: missing or corrupt disk evidence refuses before any admission",async()=>{
  for(const change of ["missing","pointer","shard"]){const f=await fixture();try{
    if(change==="missing")fs.unlinkSync(f.path+".request-index");else if(change==="pointer")fs.writeFileSync(f.path+".request-index","corrupt\n");else{const pointer=JSON.parse(fs.readFileSync(f.path+".request-index","utf8"));fs.writeFileSync(join(f.directory,pointer.generation,"0.jsonl"),"corrupt\n");}
    const before=f.guard.entries(),status=f.guard.status();await refused(()=>check(f.guard,f.proposal(),identity("new")));assert.deepEqual(f.guard.entries(),before);assert.deepEqual(f.guard.status(),status);
  }finally{f.close();}}
});
test("OWN-2: copied, unsigned, memory and manual guards cannot obtain owned admission authority",async()=>{
  const f=await fixture();try{
    await refused(()=>check({...f.guard},f.proposal(),identity("fake")));
    const unsigned=await guards.createGuard({policy:f.policy,log:memoryStore()}),signedMemory=await guards.createGuard({policy:f.policy,authorization:f.authorization(f.policy,1),log:memoryStore()});
    const manual=fileStore(join(f.directory,"manual.jsonl")),signedManual=await guards.createGuard({policy:f.policy,authorization:f.authorization(f.policy,1),log:manual});
    try{for(const guard of [unsigned,signedMemory,signedManual])await refused(()=>check(guard,f.proposal(),identity("new")));assert.equal(unsigned.entries().length,0);assert.equal(signedMemory.entries().length,1);assert.equal(signedManual.entries().length,1);}finally{unsigned.close();signedMemory.close();signedManual.close();}
  }finally{f.close();}
});
test("OWN-2/SNP-7: caller-replaced public methods cannot redirect the private admission context",async()=>{
  const f=await fixture();try{
    f.guard.check=()=>{throw new Error("caller substituted check");};f.guard.status=()=>({latched:true,latchSeq:999,seq:999,consecutiveDenials:999});f.guard.entries=()=>[];
    const decision=await check(f.guard,f.proposal(),identity("private"));assert.ok(decision.allow);assert.equal(f.store.entries.filter(entry=>entry.kind==="decision").length,1);assert.equal(f.store.entries.at(-1)?.hash,decision.hash);
  }finally{f.close();}
});
test("SNP-7: a failed queued lookup does not poison subsequent work after evidence is restored",async()=>{
  const f=await fixture();try{
    const path=f.path+".request-index",original=fs.readFileSync(path);fs.unlinkSync(path);await refused(()=>check(f.guard,f.proposal(),identity("first")));fs.writeFileSync(path,original);
    const next=await check(f.guard,f.proposal(),identity("second"));assert.ok(next.allow);assert.equal(f.guard.entries().filter(entry=>entry.kind==="decision").length,1);
  }finally{f.close();}
});
test("SNP-7/OWN-2: closure before queue execution or during an actual shard read prevents admission",async()=>{
  for(const when of ["queued","reading"]){const f=await fixture(),original=asyncFs.open;try{
    let changed=false;if(when==="reading")asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(String(args[0]).endsWith(".jsonl")&&!changed){changed=true;f.guard.close();}return handle;}) as typeof asyncFs.open;
    const count=f.guard.entries().length,pending=check(f.guard,f.proposal(),identity("new"));if(when==="queued")f.guard.close();await refused(()=>pending);assert.equal(f.guard.entries().length,count);if(when==="reading")assert.ok(changed);
  }finally{asyncFs.open=original;f.close();}}
});
test("SNP-7: trusted synchronous mutation during owned lookup invalidates its captured head",async()=>{
  const f=await fixture(),original=asyncFs.open;try{
    let changed=false;asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(String(args[0]).endsWith(".jsonl")&&!changed){changed=true;f.guard.check({message:Uint8Array.of(255),at:1000});}return handle;}) as typeof asyncFs.open;
    await refused(()=>check(f.guard,f.proposal(),identity("new")));assert.ok(changed);assert.equal(f.guard.entries().filter(entry=>entry.kind==="decision").length,1);assert.equal(f.guard.entries().some(entry=>entry.kind==="decision"&&entry.request?.id==="new"),false);
  }finally{asyncFs.open=original;f.close();}
});
test("SNP-7: an actual owned result followed by a trusted mutation cannot authorize stale absence",async()=>{
  for(const mode of ["head","close"]){const f=await fixture();try{
    f.guard.close();const script=`import{strict as assert}from"node:assert";import{readFileSync}from"node:fs";import{registerHooks}from"node:module";
      const input=JSON.parse(readFileSync(0,"utf8"));const real=await import(input.recordURL);
      const replacement='import * as real from '+JSON.stringify(input.recordURL)+';export * from '+JSON.stringify(input.recordURL)+';export async function lookupOwnedRequestIndex(...args){const answer=await real.lookupOwnedRequestIndex(...args);globalThis.afterOwnedLookup();return answer;}';
      const hook=registerHooks({resolve(specifier,context,next){if(specifier==="./record.ts"&&context.parentURL===input.guardURL)return{url:"data:text/javascript,"+encodeURIComponent(replacement),shortCircuit:true};return next(specifier,context);}});
      const guards=await import(input.guardURL);hook.deregister();const store=real.fileStore(input.path,{ownership:"kernel",create:false});
      const guard=await guards.createGuard({policy:input.policy,authorization:input.authorization,log:store});
      try{globalThis.afterOwnedLookup=()=>input.mode==="close"?guard.close():guard.check({message:Uint8Array.of(255),at:1000});
        assert.equal(typeof guards.checkOwnedRequest,"function");await assert.rejects(guards.checkOwnedRequest(guard,{message:Buffer.from(input.message,"base64"),at:1001,blockHeight:10n,lastValidBlockHeight:100n},{clientId:"client",id:"gap"}),{name:"OwnedRequestAdmissionError",code:"owned-request-admission"});
        assert.equal(guard.entries().filter(entry=>entry.kind==="decision").length,input.mode==="close"?0:1);assert.equal(guard.entries().some(entry=>entry.kind==="decision"&&entry.request?.id==="gap"),false);
      }finally{guard.close();}`;
    const result=spawnSync(process.execPath,["--input-type=module","-e",script],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL",input:JSON.stringify({guardURL:new URL("../src/guard.ts",import.meta.url).href,recordURL:new URL("../src/record.ts",import.meta.url).href,path:f.path,policy:f.guard.policy,authorization:f.authorization(f.policy,1),message:Buffer.from(f.message()).toString("base64"),mode},(_key,value)=>typeof value==="bigint"?value.toString():value)});
    assert.equal(result.signal,null,result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.status,0,result.stdout+result.stderr);
  }finally{f.close();}}
});
test("STO-1/SNP-7: append failure admits nothing and the failed writer remains unavailable",async()=>{
  const f=await fixture(),original=fs.writeSync;try{
    fs.writeSync=(()=>{throw Object.assign(new Error("injected storage loss"),{code:"ENOSPC"});}) as typeof fs.writeSync;syncBuiltinESMExports();
    const decision=await check(f.guard,f.proposal(),identity("new"));assert.equal(decision.allow,false);assert.equal(decision.seq,-1);assert.equal(f.guard.entries().filter(entry=>entry.kind==="decision").length,0);
    fs.writeSync=original;syncBuiltinESMExports();await refused(()=>check(f.guard,f.proposal(),identity("later")));assert.equal(f.guard.check(f.proposal(),identity("trusted")).allow,false);
  }finally{fs.writeSync=original;syncBuiltinESMExports();f.close();}
});
test("LIF-1/7/POL-4: historical retry preserves pending reservations and used receipts across signed policy replacement",async()=>{
  const f=await fixture();let store:EntryStore|undefined,guard:Guard|undefined;try{
    const first=await check(f.guard,f.proposal(),identity("pending"));assert.ok(first.allow);assert.ok(f.guard.redeem(f.message(),first.hash,10n).ok);f.guard.report(first.hash,"unknown");f.guard.close();
    const next={...f.policy,windowMs:30000},nextAuthorization=f.authorization(next,2);store=fileStore(f.path,{ownership:"kernel",create:false});guard=await guards.createGuard({policy:next,authorization:nextAuthorization,log:store});
    const before=guard.entries(),status=guard.status();assert.deepEqual(await check(guard,{...f.proposal(),at:50000,blockHeight:1000n},identity("pending")),first);assert.deepEqual(guard.entries(),before);assert.deepEqual(guard.status(),status);
    assert.equal(guard.redeem(f.message(),first.hash,10n).ok,false);const retry=await check(guard,{...f.proposal(),at:1001},identity("fresh"));assert.equal(retry.allow,false);assert.equal(retry.rule,"intent-in-flight");
    guard.report(first.hash,"landed");assert.deepEqual(await check(guard,f.proposal(),identity("pending")),first);assert.equal(guard.redeem(f.message(),first.hash,10n).ok,false);
  }finally{guard?.close();store?.close();f.close();}
});
test("LIF-1/SNP-7: historical denials preserve latch and cannot accumulate denial ticks",async()=>{
  const f=await fixture(policy=>{policy.latch.afterDenials=1;});try{
    const denied=await check(f.guard,{message:Uint8Array.of(255),at:1000},identity("denied"));assert.equal(denied.allow,false);assert.ok(f.guard.status().latched);const before=f.guard.entries(),status=f.guard.status();
    assert.deepEqual(await check(f.guard,{message:Uint8Array.of(255),at:9000},identity("denied")),denied);assert.deepEqual(f.guard.entries(),before);assert.deepEqual(f.guard.status(),status);
    const next=await check(f.guard,f.proposal(),identity("new"));assert.equal(next.allow,false);assert.equal(next.rule,"latched");
  }finally{f.close();}
});
test("SNP-7: malformed proposal identity rejects without a record; ordinary proposal validation stays synchronous",async()=>{
  const f=await fixture();try{
    for(const [proposal,id] of [[f.proposal(),identity("")],[null,identity("null")],[{...f.proposal(),message:"not bytes"},identity("bytes")]] as const)await refused(()=>check(f.guard,proposal as never,id));
    const count=f.guard.entries().length,bad=await check(f.guard,{...f.proposal(),at:NaN},identity("time"));assert.equal(bad.allow,false);assert.equal(bad.rule,"malformed-proposal");assert.equal(f.guard.entries().length,count+1);
    const result=f.guard.check({message:Uint8Array.of(255),at:1001});assert.equal(typeof Reflect.get(result,"then"),"undefined");assert.equal(result.allow,false);
  }finally{f.close();}
});
