// SNP-7: private admission/control ownership; full state retention remains unchanged.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import fs from "node:fs";
import asyncFs from "node:fs/promises";
import {join} from "node:path";
import {createGuard} from "../src/guard.ts";
import {fileStore,publishOwnedRequestIndex} from "../src/record.ts";
import {encodeBase58} from "../src/base58.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
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
    assert.deepEqual(Object.keys(g).sort(),["beginRequest","check","close","finishRequest","policy","policyHash","requestResult","status"].sort());
    assert.ok(Object.isFrozen(g));assert.ok(Object.isFrozen(g.policy));assert.ok(Object.isFrozen(g.policy.latch));
    assert.equal(Reflect.get(g,"guard"),undefined);assert.equal(Reflect.get(g,"store"),undefined);assert.equal(Reflect.get(g,"entries"),undefined);
    const pending=g.status();assert.ok(pending instanceof Promise);const status=await pending;assert.equal(status.seq,1);assert.ok(Object.isFrozen(status));
  }finally{await g.close();}}finally{f.close();}
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
