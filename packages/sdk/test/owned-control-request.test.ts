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
const refused=(work:()=>Promise<unknown>)=>assert.rejects(Promise.resolve().then(work),{name:"OwnedControlRequestError",code:"owned-control-request"});
async function fixture(change:(policy:typeof WORKLOAD_POLICY)=>void=()=>{}){
  const scratch=".sandbox/solanaut-1/owned-controls/cases";fs.mkdirSync(scratch,{recursive:true});
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
import type {ControlRequestEntry,ControlResponseEntry} from "../src/log.ts";
import type {ControlMethod} from "../src/control-request.ts";
function invoke<T>(name:string,...args:unknown[]):Promise<T>{
  const call=Reflect.get(guards,name);assert.equal(typeof call,"function","owned control consultation must exist");return Reflect.apply(call,undefined,args);
}
const begin=(guard:Guard,id:ReturnType<typeof identity>,method:ControlMethod="status",payload:unknown={},at=1000)=>invoke<ControlRequestEntry>("beginOwnedRequest",guard,id,method,payload,at);
const finish=(guard:Guard,id:ReturnType<typeof identity>,hash:string,input:unknown)=>invoke<ControlResponseEntry>("finishOwnedRequest",guard,id,hash,input);
const result=(guard:Guard,id:ReturnType<typeof identity>,hash:string)=>invoke<unknown>("ownedRequestResult",guard,id,hash);
test("LIF-4/SNP-7: control starts retry exactly from prefix and tail without another entry",async()=>{
  const f=await fixture();try{
    const first=await begin(f.guard,identity("status")),count=f.guard.entries().length;
    assert.equal(first.kind,"request");assert.equal(first.method,"status");assert.equal(first.payload,"{}");
    assert.deepEqual(await begin(f.guard,identity("status"),"status",{},9000),first);assert.equal(f.guard.entries().length,count);
    await publishOwnedRequestIndex(f.store,{policyTrust:f.policyTrust});assert.deepEqual(await begin(f.guard,identity("status")),first);
  }finally{f.close();}
});
test("LIF-4/LIF-1: methods, payloads and admission share the identity namespace",async()=>{
  const f=await fixture();try{
    const start=await begin(f.guard,identity("same"));
    for(const [method,payload] of [["report",{decision:"a".repeat(64)}],["propose",{message:"AA==",group:null}]] as const)await refused(()=>begin(f.guard,identity("same"),method,payload));
    const denial=await check(f.guard,f.proposal(),identity("same"));assert.equal(denial.seq,-1);assert.equal(denial.allow,false);
    await check(f.guard,f.proposal(),identity("admission"));await refused(()=>begin(f.guard,identity("admission")));
    assert.deepEqual(await begin(f.guard,identity("same")),start);
  }finally{f.close();}
});
test("LIF-5: a pre-admission refusal and its exact bounded reply survive index publication",async()=>{
  const f=await fixture();try{
    const payload={message:"AA==",group:"refused"},id=identity("refusal"),start=await begin(f.guard,id,"propose",payload),answer={ok:false,error:{code:"expired"}};
    const response=await finish(f.guard,id,start.hash,answer);assert.equal(response.kind,"response");
    await publishOwnedRequestIndex(f.store,{policyTrust:f.policyTrust});
    assert.deepEqual(await begin(f.guard,id,"propose",payload,9000),start);assert.deepEqual(await result(f.guard,id,start.hash),answer);
  }finally{f.close();}
});
test("LIF-4/SNP-7: response commits once and differing canonical replies refuse",async()=>{
  const f=await fixture();try{
    const id=identity("answer"),start=await begin(f.guard,id),first=await finish(f.guard,id,start.hash,{ready:true,nested:{at:1}}),count=f.guard.entries().length;
    assert.deepEqual(await finish(f.guard,id,start.hash,{nested:{at:1},ready:true}),first);assert.equal(f.guard.entries().length,count);
    await refused(()=>finish(f.guard,id,start.hash,{ready:false}));assert.equal(f.guard.entries().length,count);
    await publishOwnedRequestIndex(f.store,{policyTrust:f.policyTrust});assert.deepEqual(await finish(f.guard,id,start.hash,{ready:true,nested:{at:1}}),first);
  }finally{f.close();}
});
test("LIF-4: unknown identity, admission, foreign start and wrong start hash cannot return or finish controls",async()=>{
  const f=await fixture();try{
    const id=identity("known"),start=await begin(f.guard,id);await finish(f.guard,id,start.hash,{ready:true});
    const decision=await check(f.guard,f.proposal(),identity("proposal")),count=f.guard.entries().length;
    for(const [other,hash] of [[identity("missing"),start.hash],[identity("proposal"),decision.hash],[id,"a".repeat(64)]]){
      await refused(()=>finish(f.guard,other as ReturnType<typeof identity>,hash as string,{ready:true}));
      await refused(()=>result(f.guard,other as ReturnType<typeof identity>,hash as string));
    }assert.equal(f.guard.entries().length,count);
  }finally{f.close();}
});
test("LIF-4: pending result remains undefined; null and nested completed replies are detached and frozen",async()=>{
  const f=await fixture();try{
    const id=identity("pending"),start=await begin(f.guard,id);assert.equal(await result(f.guard,id,start.hash),undefined);
    const answer={nested:{items:[1,2]}};await finish(f.guard,id,start.hash,answer);answer.nested.items[0]=9;
    const value=await result(f.guard,id,start.hash) as typeof answer;assert.deepEqual(value,{nested:{items:[1,2]}});
    assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.nested));assert.ok(Object.isFrozen(value.nested.items));assert.throws(()=>value.nested.items.push(3),TypeError);
    const nil=identity("null"),nilStart=await begin(f.guard,nil);await finish(f.guard,nil,nilStart.hash,null);assert.equal(await result(f.guard,nil,nilStart.hash),null);
    assert.equal((await result(f.guard,id,start.hash) as typeof answer).nested.items[0],1);
  }finally{f.close();}
});
test("LIF-4/SNP-7: identities, canonical payloads and result values are captured before queueing",async()=>{
  const f=await fixture();try{
    const id=identity("captured"),payload={decision:"a".repeat(64)},pending=begin(f.guard,id,"report",payload);
    id.id="changed";payload.decision="b".repeat(64);const start=await pending;assert.equal(start.request.id,"captured");assert.equal(JSON.parse(start.payload).decision,"a".repeat(64));
    const responseId=identity("captured"),answer={nested:{ready:true}},response=finish(f.guard,responseId,start.hash,answer);
    responseId.id="changed";answer.nested.ready=false;assert.equal(JSON.parse((await response).result).nested.ready,true);
  }finally{f.close();}
});
test("LIF-4/SNP-7: concurrent mixed operations share FIFO ordering with proposal admission",async()=>{
  const f=await fixture(),original=asyncFs.open;try{
    let release!:()=>void,reached!:()=>void,held=false;const gate=new Promise<void>(resolve=>release=resolve),reading=new Promise<void>(resolve=>reached=resolve);
    asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(!held&&String(args[0]).endsWith(".jsonl")){held=true;reached();await gate;}return handle;}) as typeof asyncFs.open;
    const first=check(f.guard,f.proposal(),identity("first"));await reading;
    const second=begin(f.guard,identity("second")),third=check(f.guard,f.proposal(1,1001,21),identity("third"));
    release();const [a,b,c]=await Promise.all([first,second,third]);assert.ok(held);assert.equal(a.seq+1,b.seq);assert.equal(b.seq+1,c.seq);
    const fourth=finish(f.guard,identity("second"),b.hash,{ready:true}),fifth=begin(f.guard,identity("fifth"));const [d,e]=await Promise.all([fourth,fifth]);assert.equal(d.seq+1,e.seq);
  }finally{asyncFs.open=original;f.close();}
});
test("OWN-2/SNP-7: copied, unsigned, memory and manual guards lack owned control authority",async()=>{
  const f=await fixture();try{
    const unsigned=await guards.createGuard({policy:f.policy,log:memoryStore()}),memory=await guards.createGuard({policy:f.policy,authorization:f.authorization(f.policy,1),log:memoryStore()}),manual=await guards.createGuard({policy:f.policy,authorization:f.authorization(f.policy,1),log:fileStore(join(f.directory,"manual.jsonl"))});
    try{for(const guard of [{...f.guard},unsigned,memory,manual]){await refused(()=>begin(guard,identity("new")));await refused(()=>finish(guard,identity("new"),"a".repeat(64),{}));await refused(()=>result(guard,identity("new"),"a".repeat(64)));}}finally{unsigned.close();memory.close();manual.close();}
  }finally{f.close();}
});
test("OWN-2/SNP-7: corrupt or missing index evidence blocks control mutations and reads",async()=>{
  for(const mode of ["missing","corrupt"]){const f=await fixture();try{
    const id=identity("old"),start=f.guard.beginRequest(id,"status",{},1000);f.guard.finishRequest(start.hash,{ready:true});
    if(mode==="missing")fs.unlinkSync(f.path+".request-index");else fs.writeFileSync(f.path+".request-index","corrupt\n");
    const count=f.guard.entries().length;await refused(()=>begin(f.guard,identity("new")));await refused(()=>finish(f.guard,id,start.hash,{ready:true}));await refused(()=>result(f.guard,id,start.hash));assert.equal(f.guard.entries().length,count);
  }finally{f.close();}}
});
test("LIF-4: malformed identities, methods, payloads, time and oversized responses make no durable entry",async()=>{
  const f=await fixture();try{
    const count=f.guard.entries().length;
    for(const [id,method,payload,at] of [[identity(""),"status",{},1000],[identity("method"),"bad",{},1000],[identity("payload"),"status",{extra:true},1000],[identity("time"),"status",{},NaN]])await refused(()=>begin(f.guard,id as ReturnType<typeof identity>,method as ControlMethod,payload,at as number));
    assert.equal(f.guard.entries().length,count);const id=identity("size"),start=await begin(f.guard,id);
    await refused(()=>finish(f.guard,id,start.hash,{large:"x".repeat(12288)}));assert.equal(f.guard.entries().length,count+1);
  }finally{f.close();}
});
test("LIF-4/SNP-7: duplicate concurrent starts and replies write exactly once",async()=>{
  const f=await fixture();try{
    const id=identity("duplicate"),starts=await Promise.all(Array.from({length:5},()=>begin(f.guard,id)));
    for(const start of starts)assert.deepEqual(start,starts[0]);const count=f.guard.entries().length;
    const replies=await Promise.all(Array.from({length:5},()=>finish(f.guard,id,starts[0]!.hash,{ready:true})));
    for(const reply of replies)assert.deepEqual(reply,replies[0]);assert.equal(f.guard.entries().length,count+1);
  }finally{f.close();}
});
test("LIF-4/SNP-7: authenticated prefix replies remain exact after genuine owner restart",async()=>{
  const f=await fixture();let reopened:Guard|undefined;try{
    const id=identity("restart"),start=await begin(f.guard,id),answer=await finish(f.guard,id,start.hash,{ready:true});
    await publishOwnedRequestIndex(f.store,{policyTrust:f.policyTrust});f.guard.close();
    reopened=await guards.createGuard({policy:f.policy,authorization:f.authorization(f.policy,1),log:fileStore(f.path,{ownership:"kernel",create:false})});
    const count=reopened.entries().length;assert.deepEqual(await begin(reopened,id),start);assert.deepEqual(await finish(reopened,id,start.hash,{ready:true}),answer);assert.deepEqual(await result(reopened,id,start.hash),{ready:true});assert.equal(reopened.entries().length,count);
  }finally{reopened?.close();f.close();}
});
test("STO-1/LIF-4: control append failure leaves the failed writer unavailable without a reply",async()=>{
  const f=await fixture(),original=fs.writeSync;try{
    fs.writeSync=(()=>{throw new Error("injected write failure");}) as typeof fs.writeSync;syncBuiltinESMExports();
    await refused(()=>begin(f.guard,identity("failed")));fs.writeSync=original;syncBuiltinESMExports();
    await refused(()=>begin(f.guard,identity("later")));assert.equal(f.guard.entries().filter(e=>e.kind==="request").length,0);
  }finally{fs.writeSync=original;syncBuiltinESMExports();f.close();}
});
test("SNP-7/OWN-2: closure and trusted mutation during actual reads forbid stale control commits",async()=>{
  for(const mode of ["close","change"]){const f=await fixture(),original=asyncFs.open;try{
    let changed=false;asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(!changed&&String(args[0]).endsWith(".jsonl")){changed=true;if(mode==="close")f.guard.close();else f.guard.check({message:Uint8Array.of(255),at:1000});}return handle;}) as typeof asyncFs.open;
    await refused(()=>begin(f.guard,identity("stale")));assert.ok(changed);assert.equal(f.guard.entries().filter(e=>e.kind==="request").length,0);
  }finally{asyncFs.open=original;f.close();}}
});
test("SNP-7: actual control lookup followed by closure or a trusted mutation cannot authorize stale work",async()=>{
  const fixtures:Awaited<ReturnType<typeof fixture>>[]=[],inputs:unknown[]=[];
  try{
    for(const operation of ["begin","finish","result"])for(const mode of ["head","close"]){
      const f=await fixture();fixtures.push(f);const id=identity("gap"),start=f.guard.beginRequest(id,"status",{},1000);f.guard.finishRequest(start.hash,{ready:true});f.guard.close();
      inputs.push({path:f.path,policy:f.guard.policy,authorization:f.authorization(f.policy,1),id,hash:start.hash,operation,mode});
    }
    const script=`import{strict as assert}from"node:assert";import{readFileSync}from"node:fs";import{registerHooks}from"node:module";
      const {cases,recordURL,guardURL}=JSON.parse(readFileSync(0,"utf8")),real=await import(recordURL);
      const replacement='import * as real from '+JSON.stringify(recordURL)+';export * from '+JSON.stringify(recordURL)+';export async function lookupOwnedRequestIndex(...args){const answer=await real.lookupOwnedRequestIndex(...args);globalThis.afterOwnedLookup();return answer;}';
      const hook=registerHooks({resolve(specifier,context,next){if(specifier==="./record.ts"&&context.parentURL===guardURL)return{url:"data:text/javascript,"+encodeURIComponent(replacement),shortCircuit:true};return next(specifier,context);}});
      const guards=await import(guardURL);hook.deregister();const completed=[];
      for(const input of cases){
        const store=real.fileStore(input.path,{ownership:"kernel",create:false}),guard=await guards.createGuard({policy:input.policy,authorization:input.authorization,log:store});
        try{globalThis.afterOwnedLookup=()=>input.mode==="close"?guard.close():guard.check({message:Uint8Array.of(255),at:1000});
          const call=input.operation==="begin"?()=>guards.beginOwnedRequest(guard,input.id,"status",{},9000):input.operation==="finish"?()=>guards.finishOwnedRequest(guard,input.id,input.hash,{ready:true}):()=>guards.ownedRequestResult(guard,input.id,input.hash);
          await assert.rejects(call,{name:"OwnedControlRequestError",code:"owned-control-request"});assert.equal(guard.entries().filter(e=>e.kind==="request").length,1);assert.equal(guard.entries().filter(e=>e.kind==="response").length,1);
          completed.push(input.operation+":"+input.mode);
        }finally{delete globalThis.afterOwnedLookup;guard.close();}
      }
      assert.deepEqual(completed,["begin:head","begin:close","finish:head","finish:close","result:head","result:close"]);console.log(JSON.stringify(completed));`;
    const child=spawnSync(process.execPath,["--input-type=module","-e",script],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL",input:JSON.stringify({cases:inputs,guardURL:new URL("../src/guard.ts",import.meta.url).href,recordURL:new URL("../src/record.ts",import.meta.url).href},(_key,value)=>typeof value==="bigint"?value.toString():value)});
    assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0,child.stdout+child.stderr);
    assert.deepEqual(JSON.parse(child.stdout),["begin:head","begin:close","finish:head","finish:close","result:head","result:close"]);
  }finally{for(const f of fixtures)f.close();}
});
test("LIF-4/SNP-7: a queued refusal does not poison subsequent verified work",async()=>{
  const f=await fixture();try{
    const id=identity("conflict"),start=await begin(f.guard,id);await finish(f.guard,id,start.hash,{ready:true});
    const bad=finish(f.guard,id,start.hash,{ready:false}),next=begin(f.guard,identity("after-failure"));
    await refused(()=>bad);assert.equal((await next).request.id,"after-failure");
  }finally{f.close();}
});
test("LIF-4: fresh starts and responses cannot alias retained journal objects",async()=>{
  const f=await fixture();try{
    const id=identity("detached"),start=await begin(f.guard,id),response=await finish(f.guard,id,start.hash,{ready:true});
    assert.notEqual(start,f.guard.entries().find(e=>e.hash===start.hash));assert.notEqual(response,f.guard.entries().find(e=>e.hash===response.hash));
    assert.ok(Object.isFrozen(start));assert.ok(Object.isFrozen(start.request));assert.ok(Object.isFrozen(response));
    assert.throws(()=>{start.request.id="changed";},TypeError);assert.equal((await begin(f.guard,id)).request.id,"detached");
  }finally{f.close();}
});
test("OWN-2/LIF-4: mutable public SDK methods cannot replace private owned bookkeeping",async()=>{
  const f=await fixture();try{
    const id=identity("private"),oldBegin=f.guard.beginRequest,oldFinish=f.guard.finishRequest;let called=false;
    f.guard.beginRequest=(()=>{called=true;throw new Error("public start replaced");}) as typeof oldBegin;
    f.guard.finishRequest=(()=>{called=true;throw new Error("public finish replaced");}) as typeof oldFinish;
    const start=await begin(f.guard,id),response=await finish(f.guard,id,start.hash,{ready:true});
    assert.equal(called,false);assert.equal(response.request,start.hash);assert.deepEqual(await result(f.guard,id,start.hash),{ready:true});
    assert.equal(f.guard.entries().filter(e=>e.kind==="request").length,1);assert.equal(f.guard.entries().filter(e=>e.kind==="response").length,1);
  }finally{f.close();}
});
