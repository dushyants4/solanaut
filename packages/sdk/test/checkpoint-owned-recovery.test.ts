// SNP-5/6, OWN-2: recovery reads the actual exclusively owned record.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {mkdtempSync,writeFileSync,readFileSync,renameSync,rmSync,symlinkSync,mkdirSync} from "node:fs";
import fs from "node:fs";
import {syncBuiltinESMExports} from "node:module";
import {tmpdir} from "node:os";
import {join} from "node:path";
import * as record from "../src/record.ts";
import {createGuard} from "../src/guard.ts";
import {encodeBase58} from "../src/base58.ts";
import {canonicalJSON} from "../src/canonical.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {prepareCheckpointBundle} from "../src/checkpoint-bundle.ts";
import {prepareCheckpointEnvelope} from "../src/checkpoint-envelope.ts";
import {prepareCheckpointRecovery} from "../src/checkpoint-recovery.ts";
import {verifyArchive} from "../src/archive.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),"solanaut-owned-recovery-")),path=join(directory,"guard.jsonl");
  const pair=()=>{const key=generateKeyPairSync("ed25519");return {key,address:encodeBase58(Buffer.from(key.publicKey.export({format:"jwk"}).x!,"base64url"))};};
  const operator=pair(),checkpoint=pair(),anchor=pair(),policy={...structuredClone(WORKLOAD_POLICY),latch:{...WORKLOAD_POLICY.latch,releaseKey:operator.address}};
  const policyTrust={operatorKey:operator.address,guardId:policy.latch.guardId,cluster:policy.latch.cluster},checkpointTrust={checkpointKey:checkpoint.address,principalKeys:policy.principal,anchorKey:anchor.address,guardId:policy.latch.guardId,cluster:"localnet" as const};
  const issued="2026-10-07T00:00:00.000Z",text=preparePolicyText(policy,1,issued),store=record.fileStore(path,{ownership:"kernel"});
  const guard=await createGuard({policy,authorization:{...policyTrust,version:1,issued,text,signature:sign(null,Buffer.from(text),operator.key.privateKey).toString("base64")},log:store});
  guard.check({message:new Uint8Array([255]),at:1000},{clientId:"client",id:"denied"});
  const context={seq:store.entries.length,head:store.entries.at(-1)!.hash},archive=join(directory,"prefix.jsonl");
  writeFileSync(archive,store.entries.map(entry=>canonicalJSON(entry)+"\n").join(""),{mode:0o400});
  const receipt=await verifyArchive(archive),bundle=await prepareCheckpointBundle(store.entries,undefined,[receipt],context,policyTrust,checkpointTrust);
  const encoded=prepareCheckpointEnvelope({binding:bundle.binding,archives:bundle.archives,state:bundle.state,prefix:bundle.prefix,signatures:{snapshot:sign(null,Buffer.from(bundle.snapshotText),checkpoint.key.privateKey).toString("base64"),prefix:sign(null,Buffer.from(bundle.prefixText),checkpoint.key.privateKey).toString("base64")}},checkpointTrust,1000000);
  const options={checkpointTrust,policyTrust,archives:[archive],maxBytes:1000000};
  await record.publishOwnedCheckpoint(store,encoded.text,options);
  guard.check({message:new Uint8Array([255]),at:1001});guard.check({message:new Uint8Array([255]),at:1002});assert.ok(guard.status().latched);
  return {directory,path,store,guard,options,encoded,context,close(){guard.close();rmSync(directory,{recursive:true,force:true});}};
}
const recover=(store:record.EntryStore,options:unknown):ReturnType<typeof prepareCheckpointRecovery>=>Reflect.apply(Reflect.get(record,"recoverOwnedCheckpoint"),undefined,[store,options]);
const refused=(work:()=>Promise<unknown>)=>assert.rejects(Promise.resolve().then(work),{name:"CheckpointRecoveryError",code:"checkpoint-recovery"});
test("SNP-5: owned checkpoint and tail agree with independent preparation without writing history",async()=>{
  const f=await fixture();try{const original=readFileSync(f.path,"utf8"),got=await recover(f.store,f.options),reference=await prepareCheckpointRecovery(f.store.entries,f.encoded.text,f.options);
    assert.equal(got.mode,"checkpoint");assert.equal(got.checkpointSeq,f.context.seq);assert.equal(got.state,reference.state);assert.equal(got.head,reference.head);assert.ok(Object.isFrozen(got));assert.notEqual(JSON.parse(got.state).state.latched,null);assert.equal(readFileSync(f.path,"utf8"),original);
    for(const telemetry of [{intensity:1,valence:-1,repetition:1},{intensity:0,valence:0,repetition:0}])assert.deepEqual(got.controller.tick(telemetry),reference.controller.tick(telemetry));
  }finally{f.close();}
});
test("OWN-2: memory, forged, manual and closed stores cannot recover as kernel owners",async()=>{
  const f=await fixture();try{const path=join(f.directory,"manual.jsonl");writeFileSync(path,readFileSync(f.path));const manual=record.fileStore(path);
    try{for(const store of [record.memoryStore(),{...f.store},manual])await refused(()=>recover(store,f.options));}finally{manual.close();}
    f.guard.close();const reopened=record.fileStore(f.path,{ownership:"kernel",create:false});try{await refused(()=>recover(f.store,f.options));}finally{reopened.close();}
  }finally{f.close();}
});
test("OWN-2: replaced record or ownership inode refuses recovery",async()=>{
  for(const target of ["record","lock"]){const f=await fixture();try{const path=f.path+(target==="lock"?".lock":""),original=readFileSync(path);renameSync(path,path+".moved");writeFileSync(path,original);await refused(()=>recover(f.store,f.options));}finally{f.close();}}
});
test("SNP-6: cached history substitutions and disk corruption refuse instead of accepting a checkpoint",async()=>{
  for(const target of ["cache","disk","torn"]){const f=await fixture(),originalOpen=fs.openSync;let checkpointReads=0;
    try{if(target==="cache")f.store.entries.splice(0);else if(target==="torn")fs.appendFileSync(f.path,"partial");else writeFileSync(f.path,"corrupt\n");
      fs.openSync=((path:fs.PathLike,...args:unknown[])=>{if(String(path).endsWith(".checkpoint"))checkpointReads++;return Reflect.apply(originalOpen,fs,[path,...args]);}) as typeof fs.openSync;syncBuiltinESMExports();
      await refused(()=>recover(f.store,f.options));assert.equal(checkpointReads,0,"untrusted history must refuse before checkpoint access");assert.equal(readFileSync(f.path+".checkpoint","utf8"),f.encoded.text);
    }finally{fs.openSync=originalOpen;syncBuiltinESMExports();f.close();}}
});
test("SNP-6: missing, oversized, corrupt and unsupported checkpoint files use verified history",async()=>{
  for(const kind of ["missing","oversized","corrupt","symlink","directory"]){const f=await fixture(),originalRead=fs.readSync;let reads=0;try{const current=f.path+".checkpoint";rmSync(current);let evidence:string|undefined;
    if(kind==="oversized")writeFileSync(current,"x".repeat(f.options.maxBytes+1));
    if(kind==="corrupt")writeFileSync(current,"corrupt");
    if(kind==="symlink"){evidence=join(f.directory,"evidence");writeFileSync(evidence,f.encoded.text);symlinkSync(evidence,current);}
    if(kind==="directory")mkdirSync(current);
    fs.readSync=((...args:Parameters<typeof fs.readSync>)=>{reads++;return Reflect.apply(originalRead,fs,args);}) as typeof fs.readSync;syncBuiltinESMExports();
    const got=await recover(f.store,f.options);assert.equal(got.mode,"full-replay");assert.equal(got.reason,kind==="missing"?"missing-checkpoint":"invalid-checkpoint");assert.notEqual(JSON.parse(got.state).state.latched,null);
    if(kind!=="corrupt")assert.equal(reads,0,"unsupported checkpoint sources must refuse before reading their content");
    if(evidence)assert.equal(readFileSync(evidence,"utf8"),f.encoded.text);if(kind==="corrupt")assert.equal(readFileSync(current,"utf8"),"corrupt");
  }finally{fs.readSync=originalRead;syncBuiltinESMExports();f.close();}}
});
test("OWN-2: competing recovery and publication share one maintenance boundary",async()=>{
  const f=await fixture();try{const pending=recover(f.store,f.options);await refused(()=>recover(f.store,f.options));await assert.rejects(record.publishOwnedCheckpoint(f.store,f.encoded.text,f.options),{name:"CheckpointPublicationError"});await pending;
    const other=record.publishOwnedCheckpoint(f.store,f.encoded.text,f.options);await refused(()=>recover(f.store,f.options));await assert.rejects(other,{name:"CheckpointPublicationError"});
    assert.equal((await recover(f.store,f.options)).mode,"checkpoint");
  }finally{f.close();}
});
test("OWN-2: closure, append, cache mutation and inode replacement during replay refuse",async()=>{
  for(const change of ["close","append","cache","record","lock","record-alias","lock-alias"]){const f=await fixture();try{const pending=recover(f.store,f.options);
    if(change==="close")f.guard.close();else if(change==="append")f.guard.check({message:new Uint8Array([255]),at:1003});else if(change==="cache")f.store.entries.splice(0);
    else{const path=f.path+(change.startsWith("lock")?".lock":""),original=readFileSync(path);renameSync(path,path+".moved");if(change.endsWith("alias"))symlinkSync(path+".moved",path);else writeFileSync(path,original);}
    await refused(()=>pending);
  }finally{f.close();}}
});
test("SNP-6: short checkpoint reads finish; growth and read errors use verified fallback",async()=>{
  for(const fault of ["short","growth","read-error","negative","fraction","excess"]){const f=await fixture(),original=fs.readSync;let reads=0;
    try{fs.readSync=((fd:number,buffer:Buffer,offset:number,length:number,position:number|null)=>{reads++;if(fault==="read-error")throw Object.assign(new Error("injected read failure"),{code:"EIO"});
      if(fault==="negative")return -1;if(fault==="fraction")return 0.5;if(fault==="excess")return length+1;
      const count=original(fd,buffer,offset,Math.min(length,97),position);if(fault==="growth"&&reads===1)fs.appendFileSync(f.path+".checkpoint","changed");return count;}) as typeof fs.readSync;syncBuiltinESMExports();
      const got=await recover(f.store,f.options);assert.ok(reads>0);assert.equal(got.mode,fault==="short"?"checkpoint":"full-replay");
    }finally{fs.readSync=original;syncBuiltinESMExports();f.close();}
  }
});
test("SNP-6: captured pins and external anchor remain authoritative on fallback",async()=>{
  const f=await fixture();try{const last=f.store.entries.at(-1)!,options={...f.options,expectedAnchor:{seq:last.seq,head:last.hash}},pending=recover(f.store,options);options.policyTrust={...options.policyTrust,guardId:"foreign"};options.expectedAnchor.head="0".repeat(64);assert.equal((await pending).mode,"checkpoint");
    writeFileSync(f.path+".checkpoint","corrupt");await refused(()=>recover(f.store,{...f.options,expectedAnchor:{seq:last.seq,head:"0".repeat(64)}}));
    const originalOpen=fs.openSync;let checkpointReads=0;
    try{fs.openSync=((path:fs.PathLike,...args:unknown[])=>{if(String(path).endsWith(".checkpoint"))checkpointReads++;return Reflect.apply(originalOpen,fs,[path,...args]);}) as typeof fs.openSync;syncBuiltinESMExports();
      for(const options of [null,{}, {...f.options,maxBytes:0},{...f.options,maxBytes:1.5}])await refused(()=>recover(f.store,options));assert.equal(checkpointReads,0,"invalid ceilings must refuse before opening the checkpoint");
    }finally{fs.openSync=originalOpen;syncBuiltinESMExports();}
    writeFileSync(f.path+".checkpoint",f.encoded.text);const originalRead=fs.readSync,mutable=structuredClone(f.options);let read=false;
    try{fs.readSync=((...args:Parameters<typeof fs.readSync>)=>{const result=Reflect.apply(originalRead,fs,args);if(!read){read=true;mutable.policyTrust.guardId="foreign";}return result;}) as typeof fs.readSync;syncBuiltinESMExports();assert.equal((await recover(f.store,mutable)).mode,"checkpoint");}
    finally{fs.readSync=originalRead;syncBuiltinESMExports();}
  }finally{f.close();}
});
test("OWN-2: a failed writer refuses recovery and an established reopened owner validates the record",async()=>{
  const f=await fixture(),original=fs.writeSync;
  try{fs.writeSync=(()=>{throw Object.assign(new Error("injected disk full"),{code:"ENOSPC"});}) as typeof fs.writeSync;syncBuiltinESMExports();assert.throws(()=>f.store.append(f.store.entries.at(-1)!),/injected disk full/);
    fs.writeSync=original;syncBuiltinESMExports();await refused(()=>recover(f.store,f.options));f.guard.close();
    const reopened=record.fileStore(f.path,{ownership:"kernel",create:false});try{assert.equal((await recover(reopened,f.options)).mode,"checkpoint");}finally{reopened.close();}
  }finally{fs.writeSync=original;syncBuiltinESMExports();f.close();}
});
