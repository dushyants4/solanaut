// SNP-7/LIF: prefix absence is not current absence; only the actual owner binds the tail.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import fs from "node:fs";
import asyncFs from "node:fs/promises";
import {syncBuiltinESMExports} from "node:module";
import {tmpdir} from "node:os";
import {join} from "node:path";
import * as record from "../src/record.ts";
import {createGuard} from "../src/guard.ts";
import {encodeBase58} from "../src/base58.ts";
import {canonicalJSON,sha256hex} from "../src/canonical.ts";
import {requestKey} from "../src/request.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {lookupRequestIndex,type RequestIndexRow} from "../src/request-index.ts";
import {seal,type ControlResponseEntry,type DecisionEntry} from "../src/log.ts";
import {lookupIndexPublication} from "../src/request-index-publication.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";
interface Answer {seq:number;head:string;indexSeq:number;indexHead:string;row:Readonly<RequestIndexRow>|null}
const identity=(id:string)=>({clientId:"client",id});
const lookup=(store:record.EntryStore,id:unknown,options:unknown):Promise<Readonly<Answer>>=>{
  const call=Reflect.get(record,"lookupOwnedRequestIndex");assert.equal(typeof call,"function","owned current-head lookup must exist");return Reflect.apply(call,undefined,[store,id,options]);
};
const refused=(work:()=>Promise<unknown>)=>assert.rejects(Promise.resolve().then(work),{name:"RequestIndexLookupError",code:"request-index-lookup"});
async function fixture(){
  const directory=fs.mkdtempSync(join(tmpdir(),"solanaut-index-lookup-")),path=join(directory,"guard.jsonl");
  const operator=generateKeyPairSync("ed25519"),agent=generateKeyPairSync("ed25519");
  const address=(pair:typeof operator)=>encodeBase58(Buffer.from(pair.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...structuredClone(WORKLOAD_POLICY),principal:[address(agent)],latch:{...WORKLOAD_POLICY.latch,releaseKey:address(operator)}};
  const policyTrust={operatorKey:address(operator),guardId:policy.latch.guardId,cluster:policy.latch.cluster},issued="2026-10-08T00:00:00.000Z";
  const authorization=(p:unknown,version:number)=>{const text=preparePolicyText(p,version,issued);return {...policyTrust,version,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};};
  const store=record.fileStore(path,{ownership:"kernel"}),guard=await createGuard({policy,authorization:authorization(policy,1),log:store});
  const message=()=>craftLegacy({header:[1,0,1],keys:[[...Buffer.from(agent.publicKey.export({format:"jwk"}).x!,"base64url")],key(2),key(0)],blockhash:key(20),instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
  return {directory,path,store,guard,policy,authorization,agent,message,options:{policyTrust},close(){guard.close();fs.rmSync(directory,{recursive:true,force:true});}};
}
const endpoint=(f:Awaited<ReturnType<typeof fixture>>)=>({seq:f.store.entries.length,head:f.store.entries.at(-1)!.hash});
test("SNP-7/LIF-1: current absence and tail starts are bound to both exact endpoints",async()=>{
  const f=await fixture();try{const prefix=await record.publishOwnedRequestIndex(f.store,f.options),start=f.guard.beginRequest(identity("tail"),"status",{},1000);
    assert.equal(await lookupRequestIndex(prefix.directory,prefix.root,identity("tail")),null);
    const original=fs.readFileSync(f.path,"utf8"),pointer=fs.readFileSync(f.path+".request-index","utf8"),inventory=fs.readdirSync(f.directory);
    const got=await lookup(f.store,identity("tail"),f.options);assert.deepEqual(got,{...endpoint(f),indexSeq:prefix.seq,indexHead:prefix.head,row:{format:1,kind:"solanaut-request-index-row",key:requestKey(start.request),start,redeem:null,signed:null,started:null,response:null,report:null,settled:null}});
    assert.ok(Object.isFrozen(got));assert.ok(Object.isFrozen(got.row));assert.ok(Object.isFrozen(got.row!.start));assert.throws(()=>{(got.row!.start as {at:number}).at=2;});
    assert.deepEqual(await lookup(f.store,identity("absent"),f.options),{...endpoint(f),indexSeq:prefix.seq,indexHead:prefix.head,row:null});
    assert.equal(fs.readFileSync(f.path,"utf8"),original);assert.equal(fs.readFileSync(f.path+".request-index","utf8"),pointer);assert.deepEqual(fs.readdirSync(f.directory),inventory);
  }finally{f.close();}
});
test("SNP-7/LIF-2: historical starts gain exact tail replies across policy changes",async()=>{
  const f=await fixture();try{const start=f.guard.beginRequest(identity("status"),"status",{},1000),prefix=await record.publishOwnedRequestIndex(f.store,f.options);
    assert.equal((await lookup(f.store,identity("status"),f.options)).row?.response,null);
    const reply=f.guard.finishRequest(start.hash,{ready:true}),next={...f.policy,windowMs:30000};f.guard.close();
    const store=record.fileStore(f.path,{ownership:"kernel",create:false});try{const guard=await createGuard({policy:next,authorization:f.authorization(next,2),log:store});
      const got=await lookup(store,identity("status"),f.options);assert.deepEqual(got.row?.start,start);assert.deepEqual(got.row?.response,reply);assert.equal(got.indexHead,prefix.head);assert.deepEqual({seq:got.seq,head:got.head},{seq:store.entries.length,head:store.entries.at(-1)!.hash});
      const other=guard.beginRequest({clientId:"other",id:"status"},"status",{},1001);assert.deepEqual((await lookup(store,{clientId:"other",id:"status"},f.options)).row?.start,other);
      assert.notEqual(other.request.digest,sha256hex("foreign payload"));
    }finally{store.close();}
  }finally{f.close();}
});
test("SNP-7/LIF-3/4/7: tail redemption, uncertain send and final outcome preserve every fact",async()=>{
  const f=await fixture();try{const bytes=f.message(),decision=f.guard.check({message:bytes,at:1000,blockHeight:10n,lastValidBlockHeight:100n},identity("payment"));assert.ok(decision.allow);
    const prefix=await record.publishOwnedRequestIndex(f.store,f.options);assert.ok(f.guard.redeem(bytes,decision.hash,10n).ok);
    const signatureBytes=sign(null,bytes,f.agent.privateKey),signature=encodeBase58(signatureBytes),signed=f.guard.recordSigning({stage:"signed",decision:decision.hash,wire:Buffer.concat([Buffer.from([1]),signatureBytes,bytes]).toString("base64"),signature});
    const started=f.guard.recordSigning({stage:"send-started",decision:decision.hash,blockHeight:"11"}),response=f.guard.recordSigning({stage:"response",decision:decision.hash,status:"uncertain",signature});f.guard.report(decision.hash,"unknown");
    const uncertain=await lookup(f.store,identity("payment"),f.options);assert.equal(uncertain.indexSeq,prefix.seq);assert.deepEqual(uncertain.row?.signed,signed);assert.deepEqual(uncertain.row?.started,started);assert.deepEqual(uncertain.row?.response,response);assert.equal(uncertain.row?.redeem?.decision,decision.hash);assert.equal(uncertain.row?.report?.outcome,"unknown");assert.equal(uncertain.row?.settled,null);
    f.guard.report(decision.hash,"landed");const final=await lookup(f.store,identity("payment"),f.options);assert.equal(final.row?.report?.outcome,"landed");assert.deepEqual(final.row?.settled,final.row?.report);assert.deepEqual(final.row?.start,decision);
    const complete=await record.publishOwnedRequestIndex(f.store,f.options),again=await lookup(f.store,identity("payment"),f.options);assert.deepEqual(again.row,final.row);assert.equal(again.indexSeq,complete.seq);
  }finally{f.close();}
});
test("SNP-7/LIF-2: denied replies and unrelated non-request decisions do not disappear or redirect lookup",async()=>{
  const f=await fixture();try{const prefix=await record.publishOwnedRequestIndex(f.store,f.options),denied=f.guard.check({message:Uint8Array.of(255),at:1000},identity("denied"));assert.equal(denied.allow,false);
    const response=f.guard.recordSigning({stage:"response",decision:denied.hash,status:"denied"});f.guard.check({message:Uint8Array.of(255),at:1001});
    const got=await lookup(f.store,identity("denied"),f.options);assert.deepEqual(got.row?.start,denied);assert.deepEqual(got.row?.response,response);assert.equal(got.row?.signed,null);assert.equal(got.indexSeq,prefix.seq);
  }finally{f.close();}
});
test("OWN-2: fake, copied, manual, closed and failed owners cannot consult current history",async()=>{
  const f=await fixture(),original=fs.writeSync;try{await record.publishOwnedRequestIndex(f.store,f.options);const manualPath=join(f.directory,"manual.jsonl");fs.writeFileSync(manualPath,fs.readFileSync(f.path));const manual=record.fileStore(manualPath);
    try{for(const store of [record.memoryStore(),{...f.store},manual])await refused(()=>lookup(store,identity("absent"),f.options));}finally{manual.close();}
    fs.writeSync=(()=>{throw Object.assign(new Error("injected full disk"),{code:"ENOSPC"});}) as typeof fs.writeSync;syncBuiltinESMExports();assert.throws(()=>f.store.append(f.store.entries.at(-1)!));fs.writeSync=original;syncBuiltinESMExports();await refused(()=>lookup(f.store,identity("absent"),f.options));
    f.guard.close();const reopened=record.fileStore(f.path,{ownership:"kernel",create:false});try{await refused(()=>lookup(f.store,identity("absent"),f.options));assert.equal((await lookup(reopened,identity("absent"),f.options)).row,null);}finally{reopened.close();}
  }finally{fs.writeSync=original;syncBuiltinESMExports();f.close();}
});
test("SNP-7: missing published index is a refusal, never an automatic write or empty answer",async()=>{
  const f=await fixture();try{const before=fs.readFileSync(f.path,"utf8");await refused(()=>lookup(f.store,identity("absent"),f.options));assert.equal(fs.existsSync(f.path+".request-index"),false);assert.equal(fs.readFileSync(f.path,"utf8"),before);
    await record.publishOwnedRequestIndex(f.store,f.options);fs.unlinkSync(f.path+".request-index");await refused(()=>lookup(f.store,identity("absent"),f.options));assert.equal(fs.existsSync(f.path+".request-index"),false);
  }finally{f.close();}
});
test("SNP-7: identity and external pins are captured before async reads and invalid containers refuse",async()=>{
  const f=await fixture();try{const start=f.guard.beginRequest(identity("one"),"status",{},1000);await record.publishOwnedRequestIndex(f.store,f.options);
    const id=identity("one"),options=structuredClone(f.options),pending=lookup(f.store,id,options);id.id="missing";options.policyTrust.guardId="foreign";assert.deepEqual((await pending).row?.start,start);
    for(const id of [null,{}, {clientId:"client",id:""},{clientId:"client",id:"space value"}])await refused(()=>lookup(f.store,id,f.options));
    for(const options of [null,{}, {policyTrust:f.options.policyTrust,extra:true},{policyTrust:{...f.options.policyTrust,cluster:"foreign"}},{policyTrust:{...f.options.policyTrust,operatorKey:f.policy.principal[0]}}])await refused(()=>lookup(f.store,identity("one"),options));
  }finally{f.close();}
});
test("OWN-2: lookup, index publication, checkpoint publication and recovery share maintenance exclusion",async()=>{
  const f=await fixture();try{await record.publishOwnedRequestIndex(f.store,f.options);const pending=lookup(f.store,identity("absent"),f.options);
    await refused(()=>lookup(f.store,identity("absent"),f.options));await assert.rejects(record.publishOwnedRequestIndex(f.store,f.options),{name:"RequestIndexPublicationError"});await assert.rejects(record.publishOwnedCheckpoint(f.store,"bad",{} as never),{name:"CheckpointPublicationError"});await assert.rejects(record.recoverOwnedCheckpoint(f.store,{} as never),{name:"CheckpointRecoveryError"});await pending;
    const publication=record.publishOwnedRequestIndex(f.store,f.options);await refused(()=>lookup(f.store,identity("absent"),f.options));await publication;
  }finally{f.close();}
});
test("SNP-7: full current replay rejects unrelated dishonest tails even when a prefix hit exists",async()=>{
  const f=await fixture();try{const start=f.guard.beginRequest(identity("one"),"status",{},1000);await record.publishOwnedRequestIndex(f.store,f.options);
    const denied=f.guard.check({message:f.message(),at:1001}),{hash,...body}=denied,lie=seal<DecisionEntry>({...body,allow:false,rule:"over-per-tx-cap",reason:"invented decision"});
    const entries=[...f.store.entries.slice(0,-1),lie];fs.writeFileSync(f.path,entries.map(entry=>canonicalJSON(entry)+"\n").join(""));f.store.entries.splice(0,f.store.entries.length,...entries);
    await refused(()=>lookup(f.store,identity("one"),f.options));assert.equal(start.kind,"request");assert.ok(fs.readFileSync(f.path,"utf8").includes("invented decision"),"refusal preserves evidence");
  }finally{f.close();}
});
test("SNP-7: fresh disk and cached history mismatch refuses without changing evidence",async()=>{
  for(const change of ["cache","disk","torn"]){const f=await fixture(),original=fs.lstatSync;try{await record.publishOwnedRequestIndex(f.store,f.options);if(change==="cache")f.store.entries.length=0;else if(change==="disk")fs.writeFileSync(f.path,"corrupt\n");else fs.appendFileSync(f.path,"partial");const before=fs.readFileSync(f.path,"utf8");let pointerReads=0;
    fs.lstatSync=((source:fs.PathLike,...args:unknown[])=>{if(String(source)===f.path+".request-index")pointerReads++;return Reflect.apply(original,fs,[source,...args]);}) as typeof fs.lstatSync;syncBuiltinESMExports();
    await refused(()=>lookup(f.store,identity("absent"),f.options));assert.equal(pointerReads,0,"invalid owned history must refuse before pointer access");assert.equal(fs.readFileSync(f.path,"utf8"),before);
  }finally{fs.lstatSync=original;syncBuiltinESMExports();f.close();}}
});
test("SNP-7/OWN-2: concurrent append, cache change, closure and inode substitution refuse current answers",async()=>{
  for(const change of ["append","cache","close","record","lock"]){const f=await fixture();try{await record.publishOwnedRequestIndex(f.store,f.options);const pending=lookup(f.store,identity("absent"),f.options);
    if(change==="append")f.guard.beginRequest(identity("new"),"status",{},1001);else if(change==="cache")f.store.entries.length=0;else if(change==="close")f.guard.close();else{const path=f.path+(change==="lock"?".lock":""),bytes=fs.readFileSync(path);fs.renameSync(path,path+".moved");fs.writeFileSync(path,bytes);}
    await refused(()=>pending);
  }finally{f.close();}}
});
test("SNP-7: corrupt pointer or any generation evidence refuses without repairing the cache",async()=>{
  for(const change of ["pointer","manifest","shard","missing","extra","directory","symlink"]){const f=await fixture();try{const prefix=await record.publishOwnedRequestIndex(f.store,f.options),target=change==="pointer"?f.path+".request-index":join(prefix.directory,change==="manifest"?"manifest.json":"0.jsonl");
    if(change==="extra")fs.writeFileSync(join(prefix.directory,"unexpected"),"");else{fs.rmSync(target);if(change==="directory")fs.mkdirSync(target);else if(change==="symlink"){fs.writeFileSync(target+".evidence","");fs.symlinkSync(target+".evidence",target);}else if(change!=="missing")fs.writeFileSync(target,"corrupt\n");}
    const pointer=fs.readFileSync(f.path+".request-index","utf8");await refused(()=>lookup(f.store,identity("absent"),f.options));assert.equal(fs.readFileSync(f.path+".request-index","utf8"),pointer);assert.doesNotThrow(()=>f.guard.beginRequest(identity("still-open"),"status",{},1001));
  }finally{f.close();}}
});
test("SNP-7: pointer disappearance or byte-identical replacement during module loading refuses",async()=>{
  for(const change of ["missing","replacement"]){const f=await fixture();try{await record.publishOwnedRequestIndex(f.store,f.options);const path=f.path+".request-index",before=fs.readFileSync(path),pending=lookup(f.store,identity("absent"),f.options);fs.unlinkSync(path);if(change==="replacement")fs.writeFileSync(path,before);await refused(()=>pending);}finally{f.close();}}
});
test("SNP-7: late pointer, record and cache changes during actual shard lookup refuse",async()=>{
  for(const change of ["pointer","record","cache"]){const f=await fixture(),original=asyncFs.open;try{const start=f.guard.beginRequest(identity("one"),"status",{},1000),prefix=await record.publishOwnedRequestIndex(f.store,f.options),bucket=sha256hex(requestKey(start.request))[0],selected=join(prefix.directory,bucket+".jsonl");let changed=false;
    asyncFs.open=(async(...args:Parameters<typeof asyncFs.open>)=>{const handle=await Reflect.apply(original,asyncFs,args);if(String(args[0])===selected&&!changed){changed=true;if(change==="pointer"){const path=f.path+".request-index",before=fs.readFileSync(path);fs.unlinkSync(path);fs.writeFileSync(path,before);}else if(change==="record")fs.appendFileSync(f.path,"partial");else f.store.entries.length=0;}return handle;}) as typeof asyncFs.open;
    await refused(()=>lookup(f.store,identity("one"),f.options));assert.ok(changed,"lookup must actually consult the disk shard");
  }finally{asyncFs.open=original;f.close();}}
});
test("SNP-7: helper captures history before awaits instead of folding unvalidated caller mutations",async()=>{
  const f=await fixture();try{await record.publishOwnedRequestIndex(f.store,f.options);const start=f.guard.beginRequest(identity("one"),"status",{},1000),history=structuredClone(f.store.entries),expected=endpoint(f);
    const pending=lookupIndexPublication(f.path,history,identity("one"),f.options);
    history.push(seal<ControlResponseEntry>({v:1,kind:"response",seq:history.length,prev:start.hash,at:1000,request:start.hash,result:canonicalJSON({unrecorded:true})}));
    const got=await pending;assert.deepEqual({seq:got.seq,head:got.head},expected);assert.equal(got.row?.response,null,"only captured validated tail evidence may be returned");
  }finally{f.close();}
});
test("OWN-2: a valid cache under a manual owner still cannot claim kernel-owned current evidence",async()=>{
  const f=await fixture();try{await record.publishOwnedRequestIndex(f.store,f.options);f.guard.close();fs.unlinkSync(f.path+".lock");const manual=record.fileStore(f.path,{ownership:"manual",create:false});
    try{await refused(()=>lookup(manual,identity("absent"),f.options));}finally{manual.close();}
  }finally{f.close();}
});
test("OWN-2: a healthy closed lookup capability cannot borrow a reopened owner's reused descriptors",async()=>{
  const f=await fixture();try{await record.publishOwnedRequestIndex(f.store,f.options);f.guard.close();const next=record.fileStore(f.path,{ownership:"kernel",create:false});
    try{await refused(()=>lookup(f.store,identity("absent"),f.options));assert.equal((await lookup(next,identity("absent"),f.options)).row,null);}finally{next.close();}
  }finally{f.close();}
});
test("SNP-7/LIF-3/4: a complete payment lifecycle wholly in the tail matches a newly published index",async()=>{
  const f=await fixture();try{await record.publishOwnedRequestIndex(f.store,f.options);const bytes=f.message(),decision=f.guard.check({message:bytes,at:1000,blockHeight:10n,lastValidBlockHeight:100n},identity("new-payment"));assert.ok(decision.allow);assert.ok(f.guard.redeem(bytes,decision.hash,10n).ok);
    const signatureBytes=sign(null,bytes,f.agent.privateKey),signature=encodeBase58(signatureBytes);f.guard.recordSigning({stage:"signed",decision:decision.hash,wire:Buffer.concat([Buffer.from([1]),signatureBytes,bytes]).toString("base64"),signature});f.guard.recordSigning({stage:"send-started",decision:decision.hash,blockHeight:"11"});f.guard.recordSigning({stage:"response",decision:decision.hash,status:"uncertain",signature});f.guard.report(decision.hash,"unknown");f.guard.report(decision.hash,"unknown");f.guard.report(decision.hash,"failed");
    const tail=await lookup(f.store,identity("new-payment"),f.options),next=await record.publishOwnedRequestIndex(f.store,f.options),indexed=await lookupRequestIndex(next.directory,next.root,identity("new-payment"));assert.deepEqual(tail.row,indexed);assert.equal(tail.row?.settled?.outcome,"failed");
    const control=f.guard.beginRequest(identity("new-status"),"status",{},1001),reply=f.guard.finishRequest(control.hash,{ready:true});assert.deepEqual((await lookup(f.store,identity("new-status"),f.options)).row?.response,reply);
  }finally{f.close();}
});
