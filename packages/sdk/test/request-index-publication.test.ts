// SNP-7, OWN-2: a disk index is published only by the actual history owner.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import fs from "node:fs";
import {syncBuiltinESMExports} from "node:module";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import * as record from "../src/record.ts";
import {createGuard} from "../src/guard.ts";
import {encodeBase58} from "../src/base58.ts";
import {canonicalJSON,sha256hex} from "../src/canonical.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {prepareRequestIndex,lookupRequestIndex,type VerifiedRequestIndexRoot} from "../src/request-index.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
interface Receipt {seq:number;head:string;digest:string;directory:string;root:VerifiedRequestIndexRoot}
async function fixture(){
  const directory=fs.mkdtempSync(join(tmpdir(),"solanaut-index-publication-")),path=join(directory,"guard.jsonl");
  const operator=generateKeyPairSync("ed25519"),address=encodeBase58(Buffer.from(operator.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...structuredClone(WORKLOAD_POLICY),latch:{...WORKLOAD_POLICY.latch,releaseKey:address}},policyTrust={operatorKey:address,guardId:policy.latch.guardId,cluster:policy.latch.cluster};
  const issued="2026-10-08T00:00:00.000Z",text=preparePolicyText(policy,1,issued),store=record.fileStore(path,{ownership:"kernel"});
  const guard=await createGuard({policy,authorization:{...policyTrust,version:1,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")},log:store});
  guard.check({message:Uint8Array.of(255),at:1000},{clientId:"client",id:"denied"});
  const start=guard.beginRequest({clientId:"client",id:"status"},"status",{},1001);guard.finishRequest(start.hash,{ready:true});
  return {directory,path,store,guard,options:{policyTrust},close(){guard.close();fs.rmSync(directory,{recursive:true,force:true});}};
}
const pointer=(path:string)=>path+".request-index";
const publish=(store:record.EntryStore,options:unknown):Promise<Receipt>=>{
  const call=Reflect.get(record,"publishOwnedRequestIndex");assert.equal(typeof call,"function","owned request index capability must exist");return Reflect.apply(call,undefined,[store,options]);
};
const refused=(work:()=>Promise<unknown>)=>assert.rejects(Promise.resolve().then(work),{name:"RequestIndexPublicationError",code:"request-index-publication"});
const end=(f:Awaited<ReturnType<typeof fixture>>)=>({seq:f.store.entries.length,head:f.store.entries.at(-1)!.hash});
const identity=(id:string)=>({clientId:"client",id});
test("SNP-7: owned publication derives exact complete generation and immutable root",async()=>{
  const f=await fixture();try{const original=fs.readFileSync(f.path,"utf8"),expected=await prepareRequestIndex(f.store.entries,undefined,end(f),f.options.policyTrust),got=await publish(f.store,f.options);
    assert.deepEqual({seq:got.seq,head:got.head},end(f));assert.equal(got.digest,expected.digest);assert.equal(got.root.text,expected.root.text);assert.equal(got.directory.startsWith(f.path+".request-index."),true);
    assert.ok(Object.isFrozen(got));assert.ok(Object.isFrozen(got.root));assert.deepEqual(Object.keys(got).sort(),["digest","directory","head","root","seq"]);
    assert.deepEqual(fs.readdirSync(got.directory).sort(),[..."0123456789abcdef"].map(bucket=>bucket+".jsonl").concat("manifest.json").sort());
    assert.equal(fs.readFileSync(join(got.directory,"manifest.json"),"utf8"),expected.text);
    for(const shard of expected.shards)assert.equal(fs.readFileSync(join(got.directory,shard.bucket+".jsonl"),"utf8"),shard.text);
    const text=fs.readFileSync(pointer(f.path),"utf8"),body=JSON.parse(text);assert.equal(text,canonicalJSON(body)+"\n");
    assert.deepEqual(body,{format:1,kind:"solanaut-request-index-pointer",generation:basename(got.directory),seq:got.seq,head:got.head,digest:got.digest});
    assert.equal((await lookupRequestIndex(got.directory,got.root,identity("denied")))?.start.kind,"decision");assert.equal((await lookupRequestIndex(got.directory,got.root,identity("status")))?.response?.kind,"response");
    assert.equal(await lookupRequestIndex(got.directory,got.root,identity("absent")),null);await assert.rejects(lookupRequestIndex(got.directory,structuredClone(got.root),identity("absent")),{name:"RequestIndexError"});
    assert.equal(fs.readFileSync(f.path,"utf8"),original);
  }finally{f.close();}
});
test("SNP-7: replacement preserves earlier complete generations and prefix-bound answers",async()=>{
  const f=await fixture();try{const old=await publish(f.store,f.options),oldPointer=fs.readFileSync(pointer(f.path),"utf8"),oldManifest=fs.readFileSync(join(old.directory,"manifest.json"),"utf8");
    f.guard.beginRequest(identity("tail"),"status",{},1002);assert.equal(await lookupRequestIndex(old.directory,old.root,identity("tail")),null,"prefix absence does not claim current absence");
    const next=await publish(f.store,f.options);assert.notEqual(next.directory,old.directory);assert.notEqual(fs.readFileSync(pointer(f.path),"utf8"),oldPointer);assert.equal(fs.readFileSync(join(old.directory,"manifest.json"),"utf8"),oldManifest);
    assert.equal((await lookupRequestIndex(next.directory,next.root,identity("tail")))?.start.kind,"request");assert.equal((await lookupRequestIndex(old.directory,old.root,identity("denied")))?.start.kind,"decision");
  }finally{f.close();}
});
test("OWN-2: memory, forged, manual, closed and failed stores cannot publish",async()=>{
  const f=await fixture(),originalWrite=fs.writeSync;try{const manualPath=join(f.directory,"manual.jsonl");fs.writeFileSync(manualPath,fs.readFileSync(f.path));const manual=record.fileStore(manualPath);
    try{for(const store of [record.memoryStore(),{...f.store},manual])await refused(()=>publish(store,f.options));}finally{manual.close();}
    fs.writeSync=(()=>{throw Object.assign(new Error("injected full disk"),{code:"ENOSPC"});}) as typeof fs.writeSync;syncBuiltinESMExports();assert.throws(()=>f.store.append(f.store.entries.at(-1)!));
    fs.writeSync=originalWrite;syncBuiltinESMExports();await refused(()=>publish(f.store,f.options));f.guard.close();await refused(()=>publish(f.store,f.options));assert.equal(fs.existsSync(pointer(f.path)),false);
  }finally{fs.writeSync=originalWrite;syncBuiltinESMExports();f.close();}
});
test("SNP-7: copied external pins are authoritative before asynchronous loading",async()=>{
  const f=await fixture();try{const options=structuredClone(f.options),pending=publish(f.store,options);options.policyTrust.guardId="foreign";assert.deepEqual({seq:(await pending).seq,head:f.store.entries.at(-1)!.hash},end(f));
    const current=fs.readFileSync(pointer(f.path),"utf8");for(const options of [null,{}, {policyTrust:f.options.policyTrust,extra:true},{policyTrust:{...f.options.policyTrust,guardId:"foreign"}},{policyTrust:{...f.options.policyTrust,operatorKey:f.guard.policy.principal[0]}}])await refused(()=>publish(f.store,options));assert.equal(fs.readFileSync(pointer(f.path),"utf8"),current);
  }finally{f.close();}
});
test("OWN-2: a closed capability cannot borrow reused descriptors from a new kernel owner",async()=>{
  const f=await fixture();f.guard.close();
  const reopened=record.fileStore(f.path,{ownership:"kernel",create:false});
  try{await refused(()=>publish(f.store,f.options));assert.equal(fs.existsSync(pointer(f.path)),false);
    assert.deepEqual({seq:(await publish(reopened,f.options)).seq,head:reopened.entries.at(-1)!.hash},end(f));
  }finally{reopened.close();f.close();}
});
test("SNP-7: unsigned and malformed actual histories refuse before cache publication",async()=>{
  const f=await fixture();try{const empty=join(f.directory,"empty.jsonl"),store=record.fileStore(empty,{ownership:"kernel"});try{await refused(()=>publish(store,f.options));assert.equal(fs.existsSync(pointer(empty)),false);}finally{store.close();}
    const original=fs.readFileSync(f.path),originalOpen=fs.openSync;for(const change of ["cache","disk","torn"]){const saved=[...f.store.entries];let pointerReads=0;try{if(change==="cache")f.store.entries.length=0;else if(change==="disk")fs.writeFileSync(f.path,"corrupt\n");else fs.appendFileSync(f.path,"partial");fs.openSync=((source:fs.PathLike,...args:unknown[])=>{if(String(source)===pointer(f.path))pointerReads++;return Reflect.apply(originalOpen,fs,[source,...args]);}) as typeof fs.openSync;syncBuiltinESMExports();await refused(()=>publish(f.store,f.options));assert.equal(pointerReads,0,"invalid owned history must refuse before pointer access");assert.equal(fs.existsSync(pointer(f.path)),false);}finally{fs.openSync=originalOpen;syncBuiltinESMExports();f.store.entries.splice(0,f.store.entries.length,...saved);fs.writeFileSync(f.path,original);}}
  }finally{f.close();}
});
test("OWN-2: index, checkpoint publication and recovery share one maintenance boundary",async()=>{
  const f=await fixture();try{const pending=publish(f.store,f.options);await assert.rejects(publish(f.store,f.options),{name:"RequestIndexPublicationError",code:"request-index-publication",message:"request index maintenance already in progress"});await assert.rejects(record.publishOwnedCheckpoint(f.store,"bad",{} as never),{name:"CheckpointPublicationError"});await assert.rejects(record.recoverOwnedCheckpoint(f.store,{} as never),{name:"CheckpointRecoveryError"});await pending;
    const recovery=record.recoverOwnedCheckpoint(f.store,{maxBytes:1000} as never);await refused(()=>publish(f.store,f.options));await assert.rejects(recovery,{name:"CheckpointRecoveryError"});
    const checkpoint=record.publishOwnedCheckpoint(f.store,"bad",{} as never);await refused(()=>publish(f.store,f.options));await assert.rejects(checkpoint,{name:"CheckpointPublicationError"});
  }finally{f.close();}
});
test("OWN-2: replaced record and lock paths refuse index publication",async()=>{
  for(const target of ["record","lock"]){const f=await fixture();try{const path=f.path+(target==="lock"?".lock":""),original=fs.readFileSync(path);fs.renameSync(path,path+".moved");fs.writeFileSync(path,original);await refused(()=>publish(f.store,f.options));assert.equal(fs.existsSync(pointer(f.path)),false);}finally{f.close();}}
});
test("SNP-7: closure, append, cache mutation and aliases during validation preserve the previous generation",async()=>{
  for(const change of ["close","append","cache","record","lock","record-alias","lock-alias"]){const f=await fixture();try{const old=await publish(f.store,f.options),current=fs.readFileSync(pointer(f.path),"utf8"),pending=publish(f.store,f.options);
    if(change==="close")f.guard.close();else if(change==="append")f.guard.beginRequest(identity("changed"),"status",{},1003);else if(change==="cache")f.store.entries.length=0;
    else{const path=f.path+(change.startsWith("lock")?".lock":""),original=fs.readFileSync(path);fs.renameSync(path,path+".moved");if(change.endsWith("alias"))fs.symlinkSync(path+".moved",path);else fs.writeFileSync(path,original);}
    await refused(()=>pending);assert.equal(fs.readFileSync(pointer(f.path),"utf8"),current);assert.ok(fs.existsSync(join(old.directory,"manifest.json")));
  }finally{f.close();}}
});
test("SNP-7: current pointer corruption, substitutions and unsupported sources preserve evidence",async()=>{
  for(const kind of ["syntax","extra","digest","head","ahead","traversal","symlink","hardlink","directory","oversized"]){const f=await fixture();try{const old=await publish(f.store,f.options),path=pointer(f.path),original=fs.readFileSync(path,"utf8"),body=JSON.parse(original);fs.rmSync(path);
    if(kind==="syntax")fs.writeFileSync(path,"corrupt\n");else if(kind==="directory")fs.mkdirSync(path);else if(kind==="oversized")fs.writeFileSync(path,"x".repeat(65537));
    else if(kind==="symlink"||kind==="hardlink"){fs.writeFileSync(path+".evidence",original);if(kind==="symlink")fs.symlinkSync(path+".evidence",path);else fs.linkSync(path+".evidence",path);}
    else{if(kind==="extra")body.extra=true;if(kind==="digest")body.digest="0".repeat(64);if(kind==="head")body.head="0".repeat(64);if(kind==="ahead")body.seq+=100;if(kind==="traversal")body.generation="../evidence";fs.writeFileSync(path,canonicalJSON(body)+"\n");}
    const evidence=fs.lstatSync(path).isDirectory()?null:fs.readFileSync(path,"utf8");await refused(()=>publish(f.store,f.options));assert.ok(fs.existsSync(join(old.directory,"manifest.json")));if(evidence!==null)assert.equal(fs.readFileSync(path,"utf8"),evidence);else assert.ok(fs.lstatSync(path).isDirectory());
    if(kind==="head"){fs.writeFileSync(path,original);assert.equal((await publish(f.store,f.options)).head,old.head,"refusal must not silently repair evidence or fail a healthy writer");}
  }finally{f.close();}}
});
test("SNP-7: a valid pointer cannot hide missing, altered or aliased previous generation files",async()=>{
  for(const kind of ["missing","manifest","shard","symlink","hardlink","directory","extra"]){const f=await fixture();try{const old=await publish(f.store,f.options),current=fs.readFileSync(pointer(f.path),"utf8"),target=join(old.directory,kind==="manifest"?"manifest.json":"0.jsonl");
    if(kind==="extra")fs.writeFileSync(join(old.directory,"extra.jsonl"),"");else{const original=fs.readFileSync(target);fs.rmSync(target);if(kind==="symlink"||kind==="hardlink"){const evidence=join(f.directory,"generation-evidence");fs.writeFileSync(evidence,original);if(kind==="symlink")fs.symlinkSync(evidence,target);else fs.linkSync(evidence,target);}else if(kind==="directory")fs.mkdirSync(target);else if(kind!=="missing")fs.writeFileSync(target,"corrupt\n");}
    await refused(()=>publish(f.store,f.options));assert.equal(fs.readFileSync(pointer(f.path),"utf8"),current);
  }finally{f.close();}}
});
test("SNP-7: current pointer and generation changes during asynchronous replay refuse",async()=>{
  for(const change of ["pointer","generation"]){const f=await fixture();try{const old=await publish(f.store,f.options),pending=publish(f.store,f.options);if(change==="pointer"){const path=pointer(f.path),original=fs.readFileSync(path);fs.renameSync(path,path+".moved");fs.writeFileSync(path,original);}else{fs.renameSync(old.directory,old.directory+".moved");fs.mkdirSync(old.directory);}
    await refused(()=>pending);assert.equal(JSON.parse(fs.readFileSync(pointer(f.path),"utf8")).digest,old.digest);
  }finally{f.close();}}
});
test("SNP-7: raw disk append during asynchronous validation cannot publish a cached endpoint",async()=>{
  const f=await fixture();try{const old=await publish(f.store,f.options),current=fs.readFileSync(pointer(f.path),"utf8"),pending=publish(f.store,f.options);fs.appendFileSync(f.path,"partial");await refused(()=>pending);assert.equal(fs.readFileSync(pointer(f.path),"utf8"),current);assert.ok(fs.existsSync(join(old.directory,"manifest.json")));}finally{f.close();}
});
test("SNP-7: pointer reads finish short progress and refuse invalid progress or source changes",async()=>{
  for(const fault of ["short","zero","negative","fraction","excess","growth","replacement","rewrite","read-error"]){const f=await fixture(),originals={open:fs.openSync,read:fs.readSync};try{await publish(f.store,f.options);const path=pointer(f.path),before=fs.readFileSync(path,"utf8"),fds=new Set<number>();let changed=false;
    fs.openSync=((source:fs.PathLike,...args:unknown[])=>{const fd=Reflect.apply(originals.open,fs,[source,...args]);if(String(source)===path)fds.add(fd);return fd;}) as typeof fs.openSync;
    fs.readSync=((fd:number,buffer:Buffer,offset:number,length:number,position:number|null)=>{if(fds.has(fd)){if(fault==="zero")return 0;if(fault==="negative")return -1;if(fault==="fraction")return 0.5;if(fault==="excess")return length+1;if(fault==="read-error")throw Object.assign(new Error("injected pointer read failure"),{code:"EIO"});}
      const count=originals.read(fd,buffer,offset,fault==="short"?Math.min(length,97):length,position);if(fds.has(fd)&&!changed){changed=true;if(fault==="growth")fs.appendFileSync(path," ");if(fault==="replacement"){fs.renameSync(path,path+".moved");fs.writeFileSync(path,before);}if(fault==="rewrite"){fs.writeFileSync(path,before);fs.utimesSync(path,new Date(),new Date(Date.now()+10000));}}return count;
    }) as typeof fs.readSync;syncBuiltinESMExports();if(fault==="short")await publish(f.store,f.options);else await refused(()=>publish(f.store,f.options));
    assert.equal(JSON.parse(fs.readFileSync(path,"utf8")).kind,"solanaut-request-index-pointer");assert.doesNotThrow(()=>f.guard.beginRequest(identity("still-open"),"status",{},1004));
  }finally{fs.openSync=originals.open;fs.readSync=originals.read;syncBuiltinESMExports();f.close();}}
});
test("SNP-7: publication and validation refusals close every temporary descriptor",async()=>{
  const f=await fixture(),originals={open:fs.openSync,close:fs.closeSync,write:fs.writeSync};try{const opened=new Set<number>();fs.openSync=((...args:Parameters<typeof fs.openSync>)=>{const fd=Reflect.apply(originals.open,fs,args);opened.add(fd);return fd;}) as typeof fs.openSync;
    fs.closeSync=fd=>{opened.delete(fd);originals.close(fd);};syncBuiltinESMExports();await publish(f.store,f.options);assert.equal(opened.size,0);
    fs.writeFileSync(pointer(f.path),"corrupt\n");await refused(()=>publish(f.store,f.options));assert.equal(opened.size,0);
    fs.unlinkSync(pointer(f.path));fs.writeSync=(()=>{throw Object.assign(new Error("injected write failure"),{code:"ENOSPC"});}) as typeof fs.writeSync;syncBuiltinESMExports();await refused(()=>publish(f.store,f.options));assert.equal(opened.size,0);
  }finally{fs.openSync=originals.open;fs.closeSync=originals.close;fs.writeSync=originals.write;syncBuiltinESMExports();f.close();}
});
test("SNP-7: pointer disappearance after a successful open is not cache absence",async()=>{
  const f=await fixture(),originals={open:fs.openSync,read:fs.readSync,stat:fs.lstatSync};try{const old=await publish(f.store,f.options),path=pointer(f.path),fds=new Set<number>();let removed=false,readComplete=false;
    fs.openSync=((source:fs.PathLike,...args:unknown[])=>{const fd=Reflect.apply(originals.open,fs,[source,...args]);if(String(source)===path)fds.add(fd);return fd;}) as typeof fs.openSync;
    fs.readSync=((...args:Parameters<typeof fs.readSync>)=>{const count=Reflect.apply(originals.read,fs,args);if(fds.has(args[0])&&count===0)readComplete=true;return count;}) as typeof fs.readSync;
    fs.lstatSync=((source:fs.PathLike,...args:unknown[])=>{if(String(source)===path&&readComplete&&!removed){removed=true;fs.unlinkSync(path);}return Reflect.apply(originals.stat,fs,[source,...args]);}) as typeof fs.lstatSync;syncBuiltinESMExports();
    await refused(()=>publish(f.store,f.options));assert.ok(removed);assert.equal(fs.existsSync(path),false);assert.ok(fs.existsSync(join(old.directory,"manifest.json")));assert.doesNotThrow(()=>f.guard.beginRequest(identity("still-open"),"status",{},1004));
  }finally{fs.openSync=originals.open;fs.readSync=originals.read;fs.lstatSync=originals.stat;syncBuiltinESMExports();f.close();}
});
test("SNP-7: byte-identical previous directory replacement while its files are read refuses",async()=>{
  const f=await fixture(),original=fs.readdirSync;try{const old=await publish(f.store,f.options),current=fs.readFileSync(pointer(f.path),"utf8");let replaced=false;
    fs.readdirSync=((path:fs.PathLike,...args:unknown[])=>{if(String(path)===old.directory&&!replaced){replaced=true;fs.renameSync(old.directory,old.directory+".moved");fs.mkdirSync(old.directory);for(const name of original(old.directory+".moved"))fs.copyFileSync(join(old.directory+".moved",name),join(old.directory,name));}return Reflect.apply(original,fs,[path,...args]);}) as typeof fs.readdirSync;syncBuiltinESMExports();
    await refused(()=>publish(f.store,f.options));assert.ok(replaced);assert.equal(fs.readFileSync(pointer(f.path),"utf8"),current);
  }finally{fs.readdirSync=original;syncBuiltinESMExports();f.close();}
});
test("SNP-7: short writes finish and every file and directory is synced before acknowledgement",async()=>{
  const f=await fixture(),originalWrite=fs.writeSync,originalSync=fs.fsyncSync;try{let writes=0,files=0,directories=0;fs.writeSync=((fd:number,bytes:Buffer,offset:number,length:number)=>{writes++;return originalWrite(fd,bytes,offset,Math.min(length,97));}) as typeof fs.writeSync;
    fs.fsyncSync=fd=>{if(fs.fstatSync(fd).isDirectory())directories++;else files++;originalSync(fd);};syncBuiltinESMExports();const got=await publish(f.store,f.options);assert.ok(writes>18);assert.equal(files,18);assert.equal(directories,3);assert.equal(sha256hex(fs.readFileSync(join(got.directory,"manifest.json"),"utf8")),got.digest);
    for(const path of [pointer(f.path),...fs.readdirSync(got.directory).map(name=>join(got.directory,name))])assert.equal(fs.statSync(path).mode&0o777,0o600);assert.equal(fs.statSync(got.directory).mode&0o777,0o700);
  }finally{fs.writeSync=originalWrite;fs.fsyncSync=originalSync;syncBuiltinESMExports();f.close();}
});
test("SNP-7: storage failures preserve complete old or new evidence and fail the writer",async()=>{
  for(const fault of ["disk-full","zero-write","negative-write","fraction-write","excess-write","permission","file-sync","generation-sync","generation-rename","generation-parent-sync","pointer-write","pointer-sync","pointer-rename","final-sync"]){const f=await fixture(),originals={open:fs.openSync,write:fs.writeSync,sync:fs.fsyncSync,rename:fs.renameSync};try{const old=await publish(f.store,f.options),current=fs.readFileSync(pointer(f.path),"utf8");f.guard.beginRequest(identity("next"),"status",{},1003);let directorySyncs=0;const pointerFds=new Set<number>();
    const fail=(code:string):never=>{throw Object.assign(new Error("injected index storage failure"),{code});};
    fs.openSync=((path:fs.PathLike,flags:fs.OpenMode,mode?:fs.Mode)=>{if(fault==="permission"&&String(path).endsWith(".jsonl")&&String(path).includes(".tmp/"))return fail("EACCES");const fd=originals.open(path,flags,mode);if(String(path).includes(".request-index.")&&String(path).endsWith(".pointer.tmp"))pointerFds.add(fd);return fd;}) as typeof fs.openSync;
    fs.writeSync=((fd:number,bytes:Buffer,offset:number,length:number)=>{if(fault==="disk-full"||fault==="pointer-write"&&pointerFds.has(fd))return fail("ENOSPC");if(fault==="zero-write")return 0;if(fault==="negative-write")return -1;if(fault==="fraction-write")return 0.5;if(fault==="excess-write")return length+1;return originals.write(fd,bytes,offset,length);}) as typeof fs.writeSync;
    fs.fsyncSync=fd=>{const directory=fs.fstatSync(fd).isDirectory();if(directory)directorySyncs++;if(fault==="file-sync"&&!directory||fault==="generation-sync"&&directorySyncs===1||fault==="generation-parent-sync"&&directorySyncs===2||fault==="pointer-sync"&&pointerFds.has(fd)||fault==="final-sync"&&directorySyncs===3)return fail("EIO");originals.sync(fd);};
    fs.renameSync=(from,to)=>{if(fault==="generation-rename"&&String(from).endsWith(".tmp")||fault==="pointer-rename"&&String(to)===pointer(f.path))return fail("EIO");originals.rename(from,to);};syncBuiltinESMExports();await refused(()=>publish(f.store,f.options));
    const result=fs.readFileSync(pointer(f.path),"utf8"),body=JSON.parse(result),generation=join(f.directory,body.generation);assert.ok(fs.existsSync(join(old.directory,"manifest.json")));assert.equal(sha256hex(fs.readFileSync(join(generation,"manifest.json"),"utf8")),body.digest);
    if(fault==="final-sync")assert.notEqual(result,current);else assert.equal(result,current);assert.throws(()=>f.store.append(f.store.entries.at(-1)!),/closed or failed/);
  }finally{fs.openSync=originals.open;fs.writeSync=originals.write;fs.fsyncSync=originals.sync;fs.renameSync=originals.rename;syncBuiltinESMExports();f.close();}}
});
test("SNP-7: late record and pointer replacement after final sync refuse acknowledgement",async()=>{
  for(const change of ["record","pointer","pointer-after-parent-stat"]){const f=await fixture(),original=fs.fsyncSync,originalStat=fs.lstatSync;try{const old=await publish(f.store,f.options);f.guard.beginRequest(identity("next"),"status",{},1003);let directories=0,replaced=false;
    const replace=()=>{const path=pointer(f.path),text=fs.readFileSync(path);fs.renameSync(path,path+".moved");fs.writeFileSync(path,text);replaced=true;};
    fs.fsyncSync=fd=>{const directory=fs.fstatSync(fd).isDirectory();if(directory)directories++;original(fd);if(directories===3&&directory){if(change==="record")fs.appendFileSync(f.path,"partial");else if(change==="pointer")replace();}};
    fs.lstatSync=((path:fs.PathLike,...args:unknown[])=>{if(change==="pointer-after-parent-stat"&&directories===3&&String(path)===pointer(f.path)&&!replaced)replace();return Reflect.apply(originalStat,fs,[path,...args]);}) as typeof fs.lstatSync;syncBuiltinESMExports();
    await refused(()=>publish(f.store,f.options));assert.equal(directories,3);assert.ok(fs.existsSync(join(old.directory,"manifest.json")));assert.throws(()=>f.store.append(f.store.entries.at(-1)!),/closed or failed/);
    if(change!=="record")assert.ok(replaced,"the pointer race must reach its boundary");
  }finally{fs.fsyncSync=original;fs.lstatSync=originalStat;syncBuiltinESMExports();f.close();}}
});
test("SNP-7: actual process death at publication boundaries keeps a complete discoverable generation",async()=>{
  for(const boundary of ["write","file-sync","generation-sync","generation-rename","generation-parent-sync","pointer-sync","pointer-rename","final-sync"]){const f=await fixture();try{const old=await publish(f.store,f.options),current=fs.readFileSync(pointer(f.path),"utf8");f.guard.beginRequest(identity("next"),"status",{},1003);f.guard.close();
    const script=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const {fileStore,publishOwnedRequestIndex}=await import(process.argv[1]);const store=fileStore(process.argv[2],{ownership:'kernel',create:false}),boundary=process.argv[4],originals={open:fs.openSync,write:fs.writeSync,sync:fs.fsyncSync,rename:fs.renameSync};let directories=0;const pointerFds=new Set(),stop=()=>process.kill(process.pid,'SIGKILL');fs.openSync=(path,...args)=>{const fd=originals.open(path,...args);if(String(path).endsWith('.pointer.tmp'))pointerFds.add(fd);return fd;};fs.writeSync=(...args)=>{const result=Reflect.apply(originals.write,fs,args);if(boundary==='write')stop();return result;};fs.fsyncSync=fd=>{const directory=fs.fstatSync(fd).isDirectory();if(directory)directories++;originals.sync(fd);if(boundary==='file-sync'&&!directory||boundary==='generation-sync'&&directories===1||boundary==='generation-parent-sync'&&directories===2||boundary==='pointer-sync'&&pointerFds.has(fd)||boundary==='final-sync'&&directories===3)stop();};fs.renameSync=(from,to)=>{originals.rename(from,to);if(boundary==='generation-rename'&&String(from).endsWith('.tmp')||boundary==='pointer-rename'&&String(to)===process.argv[2]+'.request-index')stop();};syncBuiltinESMExports();await publishOwnedRequestIndex(store,JSON.parse(process.argv[3]));process.exit(9);`;
    const result=spawnSync(process.execPath,["--input-type=module","-e",script,pathToFileURL(resolve("packages/sdk/src/record.ts")).href,f.path,JSON.stringify(f.options),boundary],{encoding:"utf8",timeout:10000,killSignal:"SIGKILL"});assert.equal(result.error,undefined,result.stderr);assert.equal(result.status,null,result.stderr);assert.equal(result.signal,"SIGKILL");
    const text=fs.readFileSync(pointer(f.path),"utf8"),body=JSON.parse(text),generation=join(f.directory,body.generation);assert.equal(sha256hex(fs.readFileSync(join(generation,"manifest.json"),"utf8")),body.digest);assert.ok(fs.existsSync(join(old.directory,"manifest.json")));
    if(["pointer-rename","final-sync"].includes(boundary))assert.notEqual(text,current);else assert.equal(text,current);
    const reopened=record.fileStore(f.path,{ownership:"kernel",create:false});try{const derived=await prepareRequestIndex(reopened.entries.slice(0,body.seq),undefined,{seq:body.seq,head:body.head},f.options.policyTrust);assert.equal(derived.digest,body.digest);assert.equal((await lookupRequestIndex(generation,derived.root,identity("denied")))?.start.kind,"decision");assert.ok((await publish(reopened,f.options)).seq>old.seq);}finally{reopened.close();}
  }finally{f.close();}}
});
