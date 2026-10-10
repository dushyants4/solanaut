// ADR-019: private durable journal facts; no signing or sending service.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import fs from "node:fs";
import asyncFs from "node:fs/promises";
import {syncBuiltinESMExports} from "node:module";
import {join} from "node:path";
import {createGuard} from "../src/guard.ts";
import {fileStore,publishOwnedRequestIndex} from "../src/record.ts";
import {encodeBase58} from "../src/base58.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import type {OwnedGuard} from "../src/owned-guard.ts";
import type {SigningEvent} from "../src/signing.ts";
import type {SigningEntry} from "../src/log.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";
const {openOwnedGuard}=await import(process.env.SOLANAUT_OWNED_MODULE??"../src/owned-guard.ts") as typeof import("../src/owned-guard.ts");

async function fixture(){
  const root=".sandbox/solanaut-1/owned-signing/cases";fs.mkdirSync(root,{recursive:true});
  const directory=fs.mkdtempSync(join(root,"case-")),path=join(directory,"guard.jsonl");
  const agent=generateKeyPairSync("ed25519"),operator=generateKeyPairSync("ed25519");
  const publicBytes=Buffer.from(agent.publicKey.export({format:"jwk"}).x!,"base64url");
  const operatorKey=encodeBase58(Buffer.from(operator.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...structuredClone(WORKLOAD_POLICY),principal:[encodeBase58(publicBytes)],latch:{...WORKLOAD_POLICY.latch,releaseKey:operatorKey,cluster:"devnet" as const}};
  const issued="2026-10-10T00:00:00.000Z",text=preparePolicyText(policy,1,issued);
  const authorization={operatorKey,guardId:policy.latch.guardId,cluster:policy.latch.cluster,version:1,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};
  const store=fileStore(path,{ownership:"kernel"}),guard=await createGuard({policy,authorization,log:store});
  await publishOwnedRequestIndex(store,{policyTrust:authorization});guard.close();
  const message=craftLegacy({header:[1,0,1],keys:[[...publicBytes],key(2),key(0)],instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
  const signature=sign(null,message,agent.privateKey),wire=Buffer.concat([Buffer.from([1]),signature,message]).toString("base64");
  const open=()=>openOwnedGuard({path,policy,authorization});
  return {path,message,signature:encodeBase58(signature),wire,open,close(){fs.rmSync(directory,{recursive:true,force:true});}};
}
const id=(value:string)=>({clientId:"journal",id:value});
const record=(g:OwnedGuard,event:unknown):Promise<SigningEntry>=>{
  const call=Reflect.get(g,"recordSigning");assert.equal(typeof call,"function","private signing journal must exist");return Reflect.apply(call,g,[event]);
};
const refused=(work:()=>Promise<unknown>)=>assert.rejects(Promise.resolve().then(work),{name:"OwnedGuardError",code:"owned-guard"});
async function admit(f:Awaited<ReturnType<typeof fixture>>,g:OwnedGuard){
  const decision=await g.check({message:f.message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},id("payment"));assert.equal(decision.allow,true);
  await g.redeem(f.message,decision.hash,10n);
  return {decision,signed:{stage:"signed",decision:decision.hash,wire:f.wire,signature:f.signature} as SigningEvent};
}
test("LIF-2/SNP-5: private signing journal persists immutable stages and rejects restart resend",async()=>{
  const f=await fixture();let hash="";try{const g=await f.open();try{
    const {decision,signed}=await admit(f,g);hash=decision.hash;
    const entry=await record(g,signed);assert.equal(entry.kind,"signing");assert.deepEqual(entry.event,signed);assert.ok(Object.isFrozen(entry));assert.ok(Object.isFrozen(entry.event));
    assert.equal(Reflect.set(entry.event,"stage","response"),false);
    const started=await record(g,{stage:"send-started",decision:hash,blockHeight:"11"});assert.equal(started.seq,entry.seq+1);
    const response=await record(g,{stage:"response",decision:hash,status:"sent",signature:f.signature});assert.equal(response.seq,started.seq+1);
  }finally{await g.close();}
    const restored=await f.open();try{const before=await restored.status();await refused(()=>record(restored,{stage:"send-started",decision:hash,blockHeight:"12"}));await refused(()=>record(restored,{stage:"response",decision:hash,status:"sent",signature:f.signature}));assert.deepEqual(await restored.status(),before);await refused(()=>restored.redeem(f.message,hash,12n));}finally{await restored.close();}
  }finally{f.close();}
});
test("LIF-2: private signing journal records denied and conservative unsigned uncertain responses",async()=>{
  const f=await fixture();try{const g=await f.open();try{
    const {decision}=await admit(f,g),denied=await g.check({message:Uint8Array.of(255),at:2000},id("denied"));assert.equal(denied.allow,false);
    const result=await record(g,{stage:"response",decision:denied.hash,status:"denied"});assert.equal(result.at,2000);
    await record(g,{stage:"response",decision:decision.hash,status:"uncertain"});
    const retry=await g.check({message:f.message,at:2001,blockHeight:11n,lastValidBlockHeight:100n},id("reserved"));assert.equal(retry.rule,"intent-in-flight");
  }finally{await g.close();}}finally{f.close();}
});
for(const outcome of ["landed","failed","expired"] as const)test(`LIF-7: private journal forbids signing after final ${outcome} across restart`,async()=>{
  const f=await fixture();let signed:SigningEvent;try{const g=await f.open();try{
    ({signed}=await admit(f,g));await g.report(signed.decision,outcome);const before=await g.status();await refused(()=>record(g,signed));assert.deepEqual(await g.status(),before);
  }finally{await g.close();}
    const restored=await f.open();try{await refused(()=>record(restored,signed!));}finally{await restored.close();}
  }finally{f.close();}
});
test("LIF-7: private journal preserves unknown reservations without settling signing",async()=>{
  const f=await fixture();try{const g=await f.open();try{
    const {signed}=await admit(f,g);await g.report(signed.decision,"unknown");await record(g,signed);
    const retry=await g.check({message:f.message,at:1100,blockHeight:11n,lastValidBlockHeight:100n},id("reserved"));assert.equal(retry.rule,"intent-in-flight");
  }finally{await g.close();}}finally{f.close();}
});
test("LIF-2/SNP-7: private signing journal captures mutable events before queued work and drains before close",async()=>{
  const f=await fixture(),original=asyncFs.open;let unlock=()=>{};try{const g=await f.open();try{
    const {signed}=await admit(f,g);await record(g,signed);let reached!:()=>void,held=false;
    const gate=new Promise<void>(r=>unlock=r),reading=new Promise<void>(r=>reached=r);
    asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(!held&&String(args[0]).endsWith(".jsonl")){held=true;reached();await gate;}return handle;}) as typeof asyncFs.open;
    const preceding=g.beginRequest(id("preceding"),"status",{},1500);await reading;
    const event={stage:"send-started",decision:signed.decision,blockHeight:"11"},pending=record(g,event),observation=g.status(),closing=g.close();event.blockHeight="101";
    unlock();const before=await preceding,entry=await pending;assert.equal(entry.seq,before.seq+1);assert.equal(entry.at,1500);assert.deepEqual(entry.event,{stage:"send-started",decision:signed.decision,blockHeight:"11"});assert.equal((await observation).seq,entry.seq+1);await closing;
    await refused(()=>record(g,event));
  }finally{unlock();asyncFs.open=original;await g.close();}
    const restored=await f.open();try{const entries=fs.readFileSync(f.path,"utf8").trimEnd().split("\n").map(line=>JSON.parse(line));assert.equal(entries.at(-1).event.blockHeight,"11");await refused(()=>record(restored,{stage:"send-started",decision:entries.at(-1).event.decision,blockHeight:"12"}));}finally{await restored.close();}
  }finally{unlock();asyncFs.open=original;f.close();}
});
test("LIF-2: private signing journal refuses invalid stages and forged signed evidence without append",async()=>{
  const f=await fixture();try{const g=await f.open();try{
    const {signed}=await admit(f,g),before=await g.status(),bytes=fs.readFileSync(f.path);
    for(const event of [null,{},{stage:"send-started",decision:signed.decision,blockHeight:"11"},{stage:"signed",decision:signed.decision,wire:"AA==",signature:f.signature},{...signed,signature:"wrong"},{...signed,wire:f.wire+"\n"},{stage:"response",decision:signed.decision,status:"sent",signature:f.signature},{stage:"other",decision:signed.decision}])await refused(()=>record(g,event));
    assert.deepEqual(await g.status(),before);assert.deepEqual(fs.readFileSync(f.path),bytes);
  }finally{await g.close();}}finally{f.close();}
});
test("STO-1/LIF-2: private signing journal never acknowledges storage failure and recovers retained admission",async()=>{
  const f=await fixture(),original=fs.writeSync;let signed:SigningEvent;try{const g=await f.open();try{
    ({signed}=await admit(f,g));const before=await g.status(),bytes=fs.readFileSync(f.path);
    fs.writeSync=(()=>{throw new Error("PRIVATE_SENTINEL: signing journal unavailable");}) as typeof fs.writeSync;syncBuiltinESMExports();
    await assert.rejects(record(g,signed),(error:Error)=>error.name==="OwnedGuardError"&&Reflect.get(error,"code")==="owned-guard"&&!error.message.includes("PRIVATE_SENTINEL"));
    fs.writeSync=original;syncBuiltinESMExports();assert.deepEqual(await g.status(),before);assert.deepEqual(fs.readFileSync(f.path),bytes);await refused(()=>record(g,signed));
  }finally{fs.writeSync=original;syncBuiltinESMExports();await g.close();}
    const restored=await f.open();try{const retry=await restored.check({message:f.message,at:1100,blockHeight:11n,lastValidBlockHeight:100n},id("reserved"));assert.equal(retry.rule,"intent-in-flight");await record(restored,signed!);}finally{await restored.close();}
  }finally{fs.writeSync=original;syncBuiltinESMExports();f.close();}
});
