// SNP-7: private admission/control ownership; full state retention remains unchanged.
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
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";
import type {OwnedGuard} from "../src/owned-guard.ts";
const modulePath="../src/owned-guard.ts",owned=await import(modulePath).catch(()=>({}));
async function fixture(){
  const root=".sandbox/solanaut-1/owned-facade/cases";fs.mkdirSync(root,{recursive:true});
  const directory=fs.mkdtempSync(join(root,"case-")),path=join(directory,"guard.jsonl"),operator=generateKeyPairSync("ed25519");
  const operatorKey=encodeBase58(Buffer.from(operator.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...structuredClone(WORKLOAD_POLICY),latch:{...WORKLOAD_POLICY.latch,cluster:"devnet" as const,releaseKey:operatorKey}};
  const policyTrust={operatorKey,guardId:policy.latch.guardId,cluster:policy.latch.cluster},issued="2026-10-09T00:00:00.000Z";
  const authorization=(version=1)=>{const text=preparePolicyText(policy,version,issued);return {...policyTrust,version,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};};
  const store=fileStore(path,{ownership:"kernel"}),guard=await createGuard({policy,authorization:authorization(),log:store});
  await publishOwnedRequestIndex(store,{policyTrust});guard.close();
  const options=()=>({path,policy:structuredClone(policy),authorization:authorization()});
  const open=(input:unknown=options()):Promise<OwnedGuard>=>{const call=Reflect.get(owned,"openOwnedGuard");assert.equal(typeof call,"function","private owned guard factory must exist");return Reflect.apply(call,undefined,[input]) as Promise<OwnedGuard>;};
  return {directory,path,policy,operator,policyTrust,issued,authorization,options,open,close(){fs.rmSync(directory,{recursive:true,force:true});}};
}
const identity=(id:string)=>({clientId:"client",id});
const refused=(work:()=>Promise<unknown>)=>assert.rejects(Promise.resolve().then(work),{name:"OwnedGuardError",code:"owned-guard"});
test("SNP-7/OWN-2: factory keeps the guard and history private with a frozen asynchronous surface",async()=>{
  const f=await fixture();try{const g=await f.open();try{
    assert.deepEqual(Object.keys(g).sort(),["beginRequest","check","close","finishRequest","policy","policyHash","redeem","report","release","releaseText","requestResult","status"].sort());
    assert.ok(Object.isFrozen(g));assert.ok(Object.isFrozen(g.policy));assert.ok(Object.isFrozen(g.policy.latch));
    assert.equal(Reflect.get(g,"guard"),undefined);assert.equal(Reflect.get(g,"store"),undefined);assert.equal(Reflect.get(g,"entries"),undefined);
    const pending=g.status();assert.ok(pending instanceof Promise);const status=await pending;assert.equal(status.seq,1);assert.ok(Object.isFrozen(status));
  }finally{await g.close();}}finally{f.close();}
});
const payment=()=>craftLegacy({header:[1,0,1],keys:[key(1),key(2),key(0)],instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
const report=(g:OwnedGuard,hash:unknown,outcome:unknown):Promise<void>=>{const call=Reflect.get(g,"report");assert.equal(typeof call,"function","private trusted SDK report must exist");return Reflect.apply(call,g,[hash,outcome]);};
for(const outcome of ["unknown","failed","expired","landed"])test(`SNP-5/7: private report records ${outcome} durably with caller attribution and preserves used receipts`,async()=>{
  const f=await fixture();try{const g=await f.open();let hash:string;
    try{const message=payment(),decision=await g.check({message,at:1000},identity("report-"+outcome));assert.equal(decision.allow,true);hash=decision.hash;
      await g.redeem(message,hash);const before=await g.status();assert.equal(await report(g,hash,outcome),undefined);assert.equal((await g.status()).seq,before.seq+1);
      const last=JSON.parse(fs.readFileSync(f.path,"utf8").trimEnd().split("\n").at(-1)!);assert.equal(last.kind,"report");assert.equal(last.decision,hash);assert.equal(last.outcome,outcome);assert.equal(last.source,"caller");assert.equal(last.at,1000);
      await refused(()=>g.redeem(message,hash));
    }finally{await g.close();}
    const restored=await f.open();try{const before=await restored.status();if(outcome==="unknown"){await report(restored,hash!,"unknown");assert.equal((await restored.status()).seq,before.seq+1);}else{await refused(()=>report(restored,hash!,outcome));assert.deepEqual(await restored.status(),before);}}finally{await restored.close();}
  }finally{f.close();}
});
test("SNP-7: private report queues behind control work and before observations and closure",async()=>{
  const f=await fixture(),original=asyncFs.open;try{const g=await f.open();try{
    const decision=await g.check({message:payment(),at:1000},identity("report-fifo")),before=await g.status();assert.equal(decision.allow,true);
    let unlock!:()=>void,reached!:()=>void,held=false;const gate=new Promise<void>(r=>unlock=r),reading=new Promise<void>(r=>reached=r);
    asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(!held&&String(args[0]).endsWith(".jsonl")){held=true;reached();await gate;}return handle;}) as typeof asyncFs.open;
    const preceding=g.beginRequest(identity("before-report"),"status",{},2000);await reading;
    let pending:Promise<void>,observed:ReturnType<OwnedGuard["status"]>,closing:Promise<void>;
    try{pending=report(g,decision.hash,"unknown");observed=g.status();closing=g.close();}finally{unlock();}
    const start=await preceding;await pending!;
    assert.equal(start.seq,before.seq);assert.equal((await observed!).seq,before.seq+2);await closing!;
    const last=JSON.parse(fs.readFileSync(f.path,"utf8").trimEnd().split("\n").at(-1)!);assert.equal(last.kind,"report");assert.equal(last.at,2000);
    await refused(()=>report(g,decision.hash,"unknown"));
  }finally{asyncFs.open=original;await g.close();}}finally{asyncFs.open=original;f.close();}
});
test("SNP-7: private report refuses malformed, denied and foreign decisions without evaluating caller coercions",async()=>{
  const f=await fixture();try{const g=await f.open();try{
    const admitted=await g.check({message:payment(),at:1000},identity("report-valid")),denied=await g.check({message:Uint8Array.of(255),at:1001},identity("report-denied"));assert.equal(admitted.allow,true);assert.equal(denied.allow,false);
    const before=await g.status(),bytes=fs.readFileSync(f.path);let coerced=0;const hostile={toString(){coerced++;return "unknown";}};
    for(const [hash,outcome] of [[admitted.hash,hostile],[hostile,"unknown"],[null,"unknown"],[admitted.hash,"unsupported"],[denied.hash,"failed"],["f".repeat(64),"landed"]])await refused(()=>report(g,hash,outcome));
    assert.equal(coerced,0);assert.deepEqual(await g.status(),before);assert.deepEqual(fs.readFileSync(f.path),bytes);
    await report(g,admitted.hash,"unknown");assert.equal((await g.status()).seq,before.seq+1);
  }finally{await g.close();}}finally{f.close();}
});
test("STO-1/SNP-5/7: failed private report hides diagnostics and preserves unresolved reservation on restart",async()=>{
  const f=await fixture(),original=fs.writeSync;let hash:string;try{const g=await f.open();try{
    const message=payment(),decision=await g.check({message,at:1000},identity("report-storage"));assert.equal(decision.allow,true);hash=decision.hash;const before=await g.status(),bytes=fs.readFileSync(f.path);
    fs.writeSync=(()=>{throw new Error("PRIVATE_SENTINEL: report storage unavailable");}) as typeof fs.writeSync;syncBuiltinESMExports();
    await assert.rejects(report(g,hash,"expired"),(error:Error)=>error.name==="OwnedGuardError"&&Reflect.get(error,"code")==="owned-guard"&&!error.message.includes("PRIVATE_SENTINEL"));
    fs.writeSync=original;syncBuiltinESMExports();assert.deepEqual(await g.status(),before);assert.deepEqual(fs.readFileSync(f.path),bytes);await refused(()=>report(g,hash,"expired"));
  }finally{fs.writeSync=original;syncBuiltinESMExports();await g.close();}
    const restored=await f.open();try{const retry=await restored.check({message:payment(),at:2000},identity("still-pending"));assert.equal(retry.allow,false);assert.equal(retry.rule,"intent-in-flight");await report(restored,hash!,"expired");}finally{await restored.close();}
  }finally{fs.writeSync=original;syncBuiltinESMExports();f.close();}
});
const releasePrompt=(g:OwnedGuard,expires="2026-10-10T00:00:00.000Z"):Promise<string>=>{const call=Reflect.get(g,"releaseText");assert.equal(typeof call,"function","private release text must exist");return Reflect.apply(call,g,[expires]);};
const releaseLatch=(g:OwnedGuard,text:string,signature:Uint8Array,at:number):Promise<Readonly<{released:boolean;reason:string}>>=>{const call=Reflect.get(g,"release");assert.equal(typeof call,"function","private release must exist");return Reflect.apply(call,g,[text,signature,at]);};
async function latch(g:OwnedGuard){for(let i=0;i<3;i++)await g.check({message:Uint8Array.of(255),at:2000+i*1000},identity("latch-"+i));assert.equal((await g.status()).latched,true);}
test("SNP-5/7: private operator release captures shared signatures behind control work and preserves reservations",async()=>{
  const f=await fixture(),original=asyncFs.open;try{const g=await f.open();try{
    const message=payment(),admitted=await g.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:20n},identity("pending"));assert.equal(admitted.allow,true);
    const denials=[0,1,2].map(i=>g.check({message:Uint8Array.of(255),at:2000+i*1000},identity("latch-"+i))),preparing=releasePrompt(g);await Promise.all(denials);
    const before=await g.status(),text=await preparing;assert.equal(before.latched,true);assert.match(text,/cluster: devnet/);assert.ok(text.includes("policy: "+g.policyHash));assert.ok(text.includes("seq: "+before.latchSeq));
    let unlock!:()=>void,reached!:()=>void,held=false;const gate=new Promise<void>(r=>unlock=r),reading=new Promise<void>(r=>reached=r);
    asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(!held&&String(args[0]).endsWith(".jsonl")){held=true;reached();await gate;}return handle;}) as typeof asyncFs.open;
    const preceding=g.beginRequest(identity("before-release"),"status",{},4500);await reading;
    const signature=new Uint8Array(new SharedArrayBuffer(64));signature.set(sign(null,Buffer.from(text),f.operator.privateKey));
    const pending=releaseLatch(g,text,signature,5000),observed=g.status();signature.fill(0);unlock();const start=await preceding,result=await pending;
    assert.equal(start.seq,before.seq);assert.deepEqual(result,{released:true,reason:""});assert.ok(Object.isFrozen(result));assert.equal((await observed).latched,false);assert.equal((await observed).seq,before.seq+2);
    const retry=await g.check({message,at:5001,blockHeight:21n,lastValidBlockHeight:30n},identity("still-reserved"));assert.equal(retry.allow,false);assert.equal(retry.rule,"intent-in-flight");
  }finally{asyncFs.open=original;await g.close();}
    const restored=await f.open();try{assert.equal((await restored.status()).latched,false);}finally{await restored.close();}
  }finally{asyncFs.open=original;f.close();}
});
test("OPR-2/SNP-7: private release refuses invalid prompts, signatures, scope and expiry without opening the latch",async()=>{
  const f=await fixture();try{const g=await f.open();try{
    await refused(()=>releasePrompt(g));await latch(g);const before=await g.status(),text=await releasePrompt(g),signature=new Uint8Array(sign(null,Buffer.from(text),f.operator.privateKey));
    await refused(()=>releasePrompt(g,"PRIVATE_SENTINEL"));await refused(()=>releasePrompt(g,null as unknown as string));
    for(const expires of ["2026-10-10","2026-99-99T00:00:00.000Z",{toString:()=>"2026-10-10T00:00:00.000Z"}])await refused(()=>releasePrompt(g,expires as string));
    const expired=await releasePrompt(g,"1970-01-01T00:00:03.000Z"),expiredSignature=new Uint8Array(sign(null,Buffer.from(expired),f.operator.privateKey));
    for(const call of [()=>releaseLatch(g,text,Uint8Array.of(0),5000),()=>releaseLatch(g,text.replace("cluster: devnet","cluster: mainnet-beta"),signature,5000),()=>releaseLatch(g,expired,expiredSignature,5000),()=>releaseLatch(g,text,null as unknown as Uint8Array,5000),()=>releaseLatch(g,text,signature,NaN)])await refused(call);
    assert.deepEqual(await g.status(),before);assert.equal((await releaseLatch(g,text,signature,5000)).released,true);await refused(()=>releaseLatch(g,text,signature,5000));
    await g.close();await refused(()=>releasePrompt(g));await refused(()=>releaseLatch(g,text,signature,5000));
  }finally{await g.close();}}finally{f.close();}
});
test("STO-1/OPR-2/SNP-5: failed private operator release hides diagnostics and preserves latch across restart",async()=>{
  const f=await fixture(),original=fs.writeSync;try{const g=await f.open();try{
    await latch(g);const before=await g.status(),text=await releasePrompt(g),signature=new Uint8Array(sign(null,Buffer.from(text),f.operator.privateKey));
    fs.writeSync=(()=>{throw new Error("PRIVATE_SENTINEL: release storage unavailable");}) as typeof fs.writeSync;syncBuiltinESMExports();
    await assert.rejects(releaseLatch(g,text,signature,5000),(error:Error)=>error.name==="OwnedGuardError"&&Reflect.get(error,"code")==="owned-guard"&&!error.message.includes("PRIVATE_SENTINEL"));
    fs.writeSync=original;syncBuiltinESMExports();assert.deepEqual(await g.status(),before);await refused(()=>releaseLatch(g,text,signature,5000));
  }finally{fs.writeSync=original;syncBuiltinESMExports();await g.close();}
    const restored=await f.open();try{assert.equal((await restored.status()).latched,true);}finally{await restored.close();}
  }finally{fs.writeSync=original;syncBuiltinESMExports();f.close();}
});
const redeem=(g:OwnedGuard,message:Uint8Array,hash:string,height?:bigint):Promise<Readonly<{ok:boolean;reason:string}>>=>{
  const call=Reflect.get(g,"redeem");assert.equal(typeof call,"function","private redemption must exist");return Reflect.apply(call,g,[message,hash,height]);
};
test("LIF-2/SNP-7: private redemption captures bytes, queues observations and survives restart once",async()=>{
  const f=await fixture(),original=asyncFs.open;try{const g=await f.open();let hash:string;try{
    const message=payment(),decision=await g.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:20n},identity("redeem"));assert.equal(decision.allow,true);hash=decision.hash;
    const before=(await g.status()).seq,shared=new Uint8Array(new SharedArrayBuffer(message.length));shared.set(message);
    let release!:()=>void,reached!:()=>void,held=false;const gate=new Promise<void>(r=>release=r),reading=new Promise<void>(r=>reached=r);
    asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(!held&&String(args[0]).endsWith(".jsonl")){held=true;reached();await gate;}return handle;}) as typeof asyncFs.open;
    const preceding=g.beginRequest(identity("before-redemption"),"status",{},1001);await reading;
    const pending=redeem(g,shared,hash,10n),observation=g.status();shared.fill(255);
    release();const start=await preceding,result=await pending;assert.equal(start.seq,before);assert.deepEqual(result,{ok:true,reason:""});assert.ok(Object.isFrozen(result));assert.equal((await observation).seq,before+2);
    await refused(()=>redeem(g,message,hash,10n));assert.equal((await g.status()).seq,before+2);
  }finally{asyncFs.open=original;await g.close();}
    const restored=await f.open();try{await refused(()=>redeem(restored,payment(),hash!,10n));}finally{await restored.close();}
  }finally{asyncFs.open=original;f.close();}
});
test("LIF-2/OPR-2: private redemption refuses changed bytes, foreign receipts and expired lifetimes without consuming them",async()=>{
  const f=await fixture();try{const g=await f.open();try{
    const message=payment(),decision=await g.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:20n},identity("bounds"));assert.equal(decision.allow,true);const before=(await g.status()).seq;
    for(const call of [()=>redeem(g,Uint8Array.of(255),decision.hash,10n),()=>redeem(g,message,"a".repeat(64),10n),()=>redeem(g,message,decision.hash),()=>redeem(g,message,decision.hash,21n),()=>redeem(g,null as unknown as Uint8Array,decision.hash,10n)])await refused(call);
    assert.equal((await g.status()).seq,before);assert.equal((await redeem(g,message,decision.hash,20n)).ok,true);
    await g.close();await refused(()=>redeem(g,message,decision.hash,20n));
  }finally{await g.close();}}finally{f.close();}
});
test("STO-1/OPR-2/LIF-2: private redemption never acknowledges a failed append or exposes storage diagnostics",async()=>{
  const f=await fixture(),original=fs.writeSync;try{const g=await f.open();try{
    const message=payment(),decision=await g.check({message,at:1000},identity("disk"));assert.equal(decision.allow,true);const before=(await g.status()).seq;
    fs.writeSync=(()=>{throw new Error("PRIVATE_SENTINEL: redemption storage unavailable");}) as typeof fs.writeSync;syncBuiltinESMExports();
    await assert.rejects(redeem(g,message,decision.hash),(error:Error)=>error.name==="OwnedGuardError"&&Reflect.get(error,"code")==="owned-guard"&&!error.message.includes("PRIVATE_SENTINEL"));
    fs.writeSync=original;syncBuiltinESMExports();assert.equal((await g.status()).seq,before);await refused(()=>redeem(g,message,decision.hash));
  }finally{fs.writeSync=original;syncBuiltinESMExports();await g.close();}}finally{fs.writeSync=original;syncBuiltinESMExports();f.close();}
});
test("OPR-2/VER-1: missing, empty and unsigned established histories refuse without creating a fresh identity",async()=>{
  const f=await fixture();try{
    for(const input of [null,{...f.options(),path:""},{...f.options(),path:1}])await refused(()=>f.open(input));
    const missing=join(f.directory,"missing.jsonl");await refused(()=>f.open({...f.options(),path:missing}));assert.equal(fs.existsSync(missing),false);
    for(const mode of ["empty","unsigned"]){const path=join(f.directory,mode+".jsonl");if(mode==="empty")fs.writeFileSync(path,"");else{const g=await createGuard({policy:f.policy,log:fileStore(path,{ownership:"kernel"})});g.close();}
      const before=fs.readFileSync(path);await refused(()=>f.open({...f.options(),path}));assert.deepEqual(fs.readFileSync(path),before);
      const store=fileStore(path,{ownership:"kernel",create:false});store.close();
    }
  }finally{f.close();}
});
test("POL-4/OPR-2: configuration cannot upgrade, roll back, substitute a guard or start on invalid signatures",async()=>{
  const f=await fixture();try{const before=fs.readFileSync(f.path);
    const foreignPolicy={...f.policy,latch:{...f.policy.latch,cluster:"mainnet-beta"}},text=preparePolicyText(foreignPolicy,1,f.issued);
    const foreignAuthorization={...f.policyTrust,cluster:"mainnet-beta",version:1,issued:f.issued,text,signature:sign(null,Buffer.from(text),f.operator.privateKey).toString("base64")};
    await refused(()=>f.open({...f.options(),policy:foreignPolicy,authorization:foreignAuthorization}));assert.deepEqual(fs.readFileSync(f.path),before);
    for(const options of [{...f.options(),authorization:f.authorization(2)},{...f.options(),authorization:{...f.authorization(),version:0}},{...f.options(),authorization:{...f.authorization(),signature:"A".repeat(88)}},{...f.options(),authorization:{...f.authorization(),guardId:"another"}},{...f.options(),policy:{...f.policy,latch:{...f.policy.latch,cluster:"mainnet-beta"}}}]){
      await refused(()=>f.open(options));assert.deepEqual(fs.readFileSync(f.path),before);
      const store=fileStore(f.path,{ownership:"kernel",create:false});store.close();
    }
  }finally{f.close();}
});
test("OWN-2/SNP-7: competing opens and corrupt index fail closed and release failed startup ownership",async()=>{
  const f=await fixture();try{const first=await f.open();try{await refused(()=>f.open());}finally{await first.close();}
    const index=fs.readFileSync(f.path+".request-index");fs.writeFileSync(f.path+".request-index","bad\n");await refused(()=>f.open());
    fs.writeFileSync(f.path+".request-index",index);const restored=await f.open();await restored.close();
  }finally{f.close();}
});
test("SNP-7/LIF-4: queued inputs, detached replies and observations share one FIFO",async()=>{
  const f=await fixture(),original=asyncFs.open;try{const g=await f.open();try{
    let release!:()=>void,reached!:()=>void,held=false;const gate=new Promise<void>(r=>release=r),reading=new Promise<void>(r=>reached=r);
    asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(!held&&String(args[0]).endsWith(".jsonl")){held=true;reached();await gate;}return handle;}) as typeof asyncFs.open;
    const first=g.beginRequest(identity("first"),"status",{},1000);await reading;
    const status=g.status(),id=identity("second"),payload={decision:"a".repeat(64)},second=g.beginRequest(id,"report",payload,1001);
    id.id="changed";payload.decision="b".repeat(64);release();const start=await first;assert.equal((await status).seq,start.seq+1);
    const next=await second;assert.equal(next.request.id,"second");assert.equal(JSON.parse(next.payload).decision,"a".repeat(64));
    const answer={nested:{ready:true}},response=g.finishRequest(identity("first"),start.hash,answer);answer.nested.ready=false;
    assert.equal(JSON.parse((await response).result).nested.ready,true);const value=await g.requestResult(identity("first"),start.hash) as {nested:{ready:boolean}};assert.ok(Object.isFrozen(value.nested));
    assert.deepEqual(value,{nested:{ready:true}});assert.deepEqual(await g.beginRequest(identity("first"),"status",{},9000),start);
  }finally{asyncFs.open=original;await g.close();}}finally{asyncFs.open=original;f.close();}
});
test("LIF-1/SNP-7: private admissions copy shared bytes and cannot mutate durable replies",async()=>{
  const f=await fixture();try{const g=await f.open();try{
    const message=new Uint8Array(new SharedArrayBuffer(1));message[0]=255;const proposal={message,at:1000},id=identity("proposal");
    const pending=g.check(proposal,id);message[0]=0;proposal.at=2000;id.id="changed";
    const decision=await pending;assert.equal(decision.message,"/w==");assert.equal(decision.at,1000);assert.equal(decision.request!.id,"proposal");assert.ok(Object.isFrozen(decision));
    assert.deepEqual(await g.check({message:Uint8Array.of(255),at:9000},identity("proposal")),decision);
    await refused(()=>g.check({message:Uint8Array.of(0),at:1000},identity("proposal")));
    await refused(()=>g.check({message:null as unknown as Uint8Array,at:1000},identity("invalid-bytes")));
  }finally{await g.close();}}finally{f.close();}
});
test("OWN-2/LIF-4: close drains preceding work, denies later calls and releases ownership once",async()=>{
  const f=await fixture();try{const g=await f.open(),pending=g.beginRequest(identity("before"),"status",{},1000),closing=g.close();
    await pending;await closing;await g.close();
    for(const call of [()=>g.status(),()=>g.check({message:Uint8Array.of(255),at:1000},identity("closed")),()=>g.beginRequest(identity("closed"),"status",{},1000),()=>g.finishRequest(identity("closed"),"a".repeat(64),{}),()=>g.requestResult(identity("closed"),"a".repeat(64))])await refused(call);
    const reopened=await f.open();assert.equal((await reopened.status()).seq,2);await reopened.close();
  }finally{f.close();}
});
test("LIF-4/OPR-2: refusal does not poison the queue and raw diagnostics never escape",async()=>{
  const f=await fixture();try{const g=await f.open();try{
    await refused(()=>g.beginRequest(identity("bad"),"status",{extra:"PRIVATE_SENTINEL"},1000));
    const start=await g.beginRequest(identity("good"),"status",{},1000);assert.equal(await g.requestResult(identity("good"),start.hash),undefined);
    await assert.rejects(g.finishRequest(identity("good"),start.hash,{value:NaN}),(error:Error)=>error.name==="OwnedGuardError"&&!error.message.includes("PRIVATE_SENTINEL"));
    await g.finishRequest(identity("good"),start.hash,null);assert.equal(await g.requestResult(identity("good"),start.hash),null);
  }finally{await g.close();}}finally{f.close();}
});
test("OPR-2/SNP-7: startup captures signed configuration before its first await",async()=>{
  const f=await fixture();try{const options=f.options(),pending=f.open(options);
    options.path=join(f.directory,"substituted.jsonl");options.authorization.guardId="changed";options.policy.latch.guardId="changed";
    const g=await pending;try{assert.equal(g.policy.latch.guardId,f.policy.latch.guardId);assert.equal((await g.status()).seq,1);assert.equal(fs.existsSync(options.path),false);}finally{await g.close();}
  }finally{f.close();}
});
test("OPR-2/STO-1/LIF-1: an unrecorded admission never exposes storage diagnostics as a decision",async()=>{
  const f=await fixture(),original=fs.writeSync;try{const g=await f.open();try{
    const before=await g.status();fs.writeSync=(()=>{throw new Error("PRIVATE_SENTINEL: storage unavailable");}) as typeof fs.writeSync;syncBuiltinESMExports();
    await assert.rejects(g.check({message:Uint8Array.of(255),at:1000},identity("failed")),(error:Error)=>error.name==="OwnedGuardError"&&!error.message.includes("PRIVATE_SENTINEL"));
    fs.writeSync=original;syncBuiltinESMExports();assert.equal((await g.status()).seq,before.seq);
    await refused(()=>g.check({message:Uint8Array.of(255),at:2000},identity("later")));
  }finally{fs.writeSync=original;syncBuiltinESMExports();await g.close();}}finally{fs.writeSync=original;syncBuiltinESMExports();f.close();}
});
