// SNP-4: publish under the actual record owner and preserve authenticated predecessors.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {mkdtempSync,writeFileSync,readFileSync,existsSync,renameSync,rmSync} from "node:fs";
import fs from "node:fs";
import {syncBuiltinESMExports} from "node:module";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import * as record from "../src/record.ts";
import {createGuard} from "../src/guard.ts";
import {encodeBase58} from "../src/base58.ts";
import {canonicalJSON,sha256hex} from "../src/canonical.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {prepareCheckpointBundle} from "../src/checkpoint-bundle.ts";
import {prepareCheckpointEnvelope,verifyCheckpointEnvelope} from "../src/checkpoint-envelope.ts";
import {prepareCheckpointText,prepareCheckpointPrefixText} from "../src/checkpoint.ts";
import {verifyArchive} from "../src/archive.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),"solanaut-publication-")),path=join(directory,"guard.jsonl");
  const pair=()=>{const key=generateKeyPairSync("ed25519");return {key,address:encodeBase58(Buffer.from(key.publicKey.export({format:"jwk"}).x!,"base64url"))};};
  const operator=pair(),checkpoint=pair(),anchor=pair(),policy={...structuredClone(WORKLOAD_POLICY),latch:{...WORKLOAD_POLICY.latch,releaseKey:operator.address}};
  const policyTrust={operatorKey:operator.address,guardId:policy.latch.guardId,cluster:policy.latch.cluster};
  const checkpointTrust={checkpointKey:checkpoint.address,principalKeys:[...policy.principal],anchorKey:anchor.address,guardId:policy.latch.guardId,cluster:"localnet" as const};
  const issued="2026-10-07T00:00:00.000Z",text=preparePolicyText(policy,1,issued),store=record.fileStore(path,{ownership:"kernel"});
  const guard=await createGuard({policy,authorization:{...policyTrust,version:1,issued,text,signature:sign(null,Buffer.from(text),operator.key.privateKey).toString("base64")},log:store});
  guard.check({message:new Uint8Array([255]),at:1000},{clientId:"client",id:"denied"});
  assert.equal(store.entries.length,2,"fixture must retain its denial");
  return {directory,path,store,guard,policyTrust,checkpointTrust,checkpoint,close(){guard.close();rmSync(directory,{recursive:true,force:true});}};
}
async function snapshot(f:Awaited<ReturnType<typeof fixture>>,name="archive.jsonl"){
  const entries=[...f.store.entries],context={seq:entries.length,head:entries.at(-1)!.hash},archive=join(f.directory,name);
  writeFileSync(archive,entries.map(entry=>canonicalJSON(entry)+"\n").join(""),{mode:0o400});
  const receipt=await verifyArchive(archive,{expectedHead:context.head});
  const bundle=await prepareCheckpointBundle(entries,undefined,[receipt],context,f.policyTrust,f.checkpointTrust);
  const signatures={snapshot:sign(null,Buffer.from(bundle.snapshotText),f.checkpoint.key.privateKey).toString("base64"),prefix:sign(null,Buffer.from(bundle.prefixText),f.checkpoint.key.privateKey).toString("base64")};
  const encoded=prepareCheckpointEnvelope({binding:bundle.binding,signatures,archives:bundle.archives,state:bundle.state,prefix:bundle.prefix},f.checkpointTrust,1000000);
  return {encoded,context,options:{checkpointTrust:f.checkpointTrust,policyTrust:f.policyTrust,archives:[archive],maxBytes:1000000},archive};
}
const publish=(store:record.EntryStore,text:unknown,options:unknown):Promise<{seq:number;head:string;digest:string;bytes:number}>=>Reflect.apply(Reflect.get(record,"publishOwnedCheckpoint"),undefined,[store,text,options]);
const refused=(work:()=>Promise<unknown>)=>assert.rejects(Promise.resolve().then(work),error=>error instanceof Error && error.name==="CheckpointPublicationError" && Reflect.get(error,"code")==="checkpoint-publication");
test("SNP-4: actual owned publication preserves the previous authenticated envelope on replacement",async()=>{
  const f=await fixture();try{
    const first=await snapshot(f),got=await publish(f.store,first.encoded.text,first.options);
    assert.deepEqual(got,{...first.context,digest:first.encoded.digest,bytes:Buffer.byteLength(first.encoded.text)});
    assert.equal(readFileSync(f.path+".checkpoint","utf8"),first.encoded.text);
    f.guard.check({message:new Uint8Array([255]),at:1001},{clientId:"client",id:"next"});
    const next=await snapshot(f,"next-archive.jsonl");await publish(f.store,next.encoded.text,next.options);
    assert.equal(readFileSync(f.path+".checkpoint","utf8"),next.encoded.text);assert.equal(readFileSync(f.path+".checkpoint.previous","utf8"),first.encoded.text);
    verifyCheckpointEnvelope(readFileSync(f.path+".checkpoint.previous","utf8"),f.checkpointTrust,1000000);
  }finally{f.close();}
});
test("SNP-4: a memory or forged store cannot claim record ownership",async()=>{
  const f=await fixture();try{const s=await snapshot(f);for(const store of [record.memoryStore(),{...f.store}])await refused(()=>publish(store,s.encoded.text,s.options));assert.equal(existsSync(f.path+".checkpoint"),false);}finally{f.close();}
});
test("SNP-4: closed or replaced actual ownership cannot replace a checkpoint",async()=>{
  for(const replaced of [false,true]){
    const f=await fixture();try{const s=await snapshot(f);await publish(f.store,s.encoded.text,s.options);
      if(replaced){renameSync(f.path,f.path+".moved");writeFileSync(f.path,"");}else f.guard.close();
      if(!replaced)await assert.rejects(publish(f.store,s.encoded.text,s.options),/owner is closed, failed or unsupported/);
      else await refused(()=>publish(f.store,s.encoded.text,s.options));assert.equal(readFileSync(f.path+".checkpoint","utf8"),s.encoded.text);
    }finally{f.close();}
  }
});
test("SNP-4: tampered signatures or payloads preserve the current checkpoint",async()=>{
  const f=await fixture();try{const s=await snapshot(f);await publish(f.store,s.encoded.text,s.options);
    for(const text of [s.encoded.text+" ",s.encoded.text.replace('"state":','"extra":'),"not JSON"])await refused(()=>publish(f.store,text,s.options));
    assert.equal(readFileSync(f.path+".checkpoint","utf8"),s.encoded.text);
  }finally{f.close();}
});
test("SNP-4: valid host signatures and a matching head cannot substitute dishonest admission state",async()=>{
  const f=await fixture();try{const s=await snapshot(f);await publish(f.store,s.encoded.text,s.options);
    const body=JSON.parse(s.encoded.text);body.state=body.state.replace('"consecutiveDenials":1','"consecutiveDenials":0');assert.notEqual(body.state,JSON.parse(s.encoded.text).state);
    body.binding.stateDigest=sha256hex(body.state);body.signatures={snapshot:sign(null,Buffer.from(prepareCheckpointText(body.binding)),f.checkpoint.key.privateKey).toString("base64"),prefix:sign(null,Buffer.from(prepareCheckpointPrefixText(body.binding)),f.checkpoint.key.privateKey).toString("base64")};
    const text=canonicalJSON(body)+"\n";verifyCheckpointEnvelope(text,f.checkpointTrust,1000000);
    await refused(()=>publish(f.store,text,s.options));assert.equal(readFileSync(f.path+".checkpoint","utf8"),s.encoded.text);
  }finally{f.close();}
});
test("SNP-4: stale endpoints and missing retained archives cannot publish over the last checkpoint",async()=>{
  const f=await fixture();try{const s=await snapshot(f);await publish(f.store,s.encoded.text,s.options);
    await refused(()=>publish(f.store,s.encoded.text,{...s.options,archives:[join(f.directory,"missing.jsonl")]}));
    f.guard.check({message:new Uint8Array([255]),at:1001},{clientId:"client",id:"new"});
    await refused(()=>publish(f.store,s.encoded.text,s.options));assert.equal(readFileSync(f.path+".checkpoint","utf8"),s.encoded.text);
  }finally{f.close();}
});
test("SNP-4: competing publications share the actual owner and only one proceeds",async()=>{
  const f=await fixture();try{const s=await snapshot(f),first=publish(f.store,s.encoded.text,s.options);
    await refused(()=>publish(f.store,s.encoded.text,s.options));await first;assert.equal(readFileSync(f.path+".checkpoint","utf8"),s.encoded.text);
  }finally{f.close();}
});
test("SNP-4: losing ownership during asynchronous validation preserves the previous checkpoint",async()=>{
  const f=await fixture();try{const s=await snapshot(f);await publish(f.store,s.encoded.text,s.options);
    const pending=publish(f.store,s.encoded.text,s.options);f.guard.close();await refused(()=>pending);assert.equal(readFileSync(f.path+".checkpoint","utf8"),s.encoded.text);
  }finally{f.close();}
});
test("SNP-4: record changes during replay refuse the stale candidate",async()=>{
  const f=await fixture();try{const s=await snapshot(f);await publish(f.store,s.encoded.text,s.options);
    const pending=publish(f.store,s.encoded.text,s.options);f.guard.check({message:new Uint8Array([255]),at:1002});
    await refused(()=>pending);assert.equal(readFileSync(f.path+".checkpoint","utf8"),s.encoded.text);
  }finally{f.close();}
});
test("SNP-4: corrupt cached history and manual ownership cannot publish",async()=>{
  const f=await fixture();try{const s=await snapshot(f);const saved=f.store.entries[0]!;f.store.entries[0]={...saved,at:42};await refused(()=>publish(f.store,s.encoded.text,s.options));f.store.entries[0]=saved;
    const path=join(f.directory,"manual.jsonl");writeFileSync(path,readFileSync(f.path));
    const manual=record.fileStore(path);try{await refused(()=>publish(manual,s.encoded.text,s.options));}finally{manual.close();}
    assert.equal(existsSync(f.path+".checkpoint"),false);
  }finally{f.close();}
});
test("SNP-4: corrupt or symlink current checkpoints preserve evidence and refuse writes",async()=>{
  for(const kind of ["corrupt","symlink"]){const f=await fixture();try{const s=await snapshot(f),current=f.path+".checkpoint";
    const evidence=join(f.directory,"evidence"),original=kind==="symlink"?s.encoded.text:"corrupt evidence";writeFileSync(evidence,original);
    if(kind==="symlink")fs.symlinkSync(evidence,current);else writeFileSync(current,original);
    await refused(()=>publish(f.store,s.encoded.text,s.options));assert.equal(readFileSync(current,"utf8"),original);assert.equal(readFileSync(evidence,"utf8"),original);
    if(kind==="symlink")assert.ok(fs.lstatSync(current).isSymbolicLink());
  }finally{f.close();}}
});
test("SNP-4: short writes finish completely and sync before acknowledging replacement",async()=>{
  const f=await fixture();const originalWrite=fs.writeSync,originalSync=fs.fsyncSync;
  try{const s=await snapshot(f);await publish(f.store,s.encoded.text,s.options);let writes=0,files=0,directories=0;
    fs.writeSync=((fd:number,bytes:Buffer,offset:number,length:number)=>{writes++;return originalWrite(fd,bytes,offset,Math.min(length,97));}) as typeof fs.writeSync;
    fs.fsyncSync=(fd:number)=>{if(fs.fstatSync(fd).isDirectory())directories++;else files++;originalSync(fd);};syncBuiltinESMExports();
    await publish(f.store,s.encoded.text,s.options);assert.ok(writes>1);assert.equal(files,1);assert.equal(directories,2);
    assert.equal(readFileSync(f.path+".checkpoint","utf8"),s.encoded.text);assert.equal(readFileSync(f.path+".checkpoint.previous","utf8"),s.encoded.text);
  }finally{fs.writeSync=originalWrite;fs.fsyncSync=originalSync;syncBuiltinESMExports();f.close();}
});
test("SNP-4: write, permission, sync and rename failures preserve an authenticated checkpoint and fail the writer",async()=>{
  for(const fault of ["disk-full","zero-write","permission","file-sync","prior-sync","rename","final-sync"]){
    const f=await fixture(),originals={open:fs.openSync,write:fs.writeSync,sync:fs.fsyncSync,rename:fs.renameSync};
    try{const old=await snapshot(f);await publish(f.store,old.encoded.text,old.options);
      f.guard.check({message:new Uint8Array([255]),at:1001});const next=await snapshot(f,"new.jsonl");let directories=0;
      const fail=(code:string):never=>{throw Object.assign(new Error("injected storage failure"),{code});};
      fs.openSync=((path:fs.PathLike,flags:fs.OpenMode,mode?:fs.Mode)=>{if(fault==="permission" && String(path).endsWith(".tmp"))return fail("EACCES");return originals.open(path,flags,mode);}) as typeof fs.openSync;
      fs.writeSync=((...args:Parameters<typeof fs.writeSync>)=>fault==="disk-full"?fail("ENOSPC"):fault==="zero-write"?0:Reflect.apply(originals.write,fs,args)) as typeof fs.writeSync;
      fs.fsyncSync=(fd:number)=>{const directory=fs.fstatSync(fd).isDirectory();if(directory)directories++;
        if((fault==="file-sync"&&!directory)||(fault==="prior-sync"&&directory)||(fault==="final-sync"&&directories===2))return fail("EIO");originals.sync(fd);};
      fs.renameSync=(from,to)=>{if(fault==="rename"&&String(to).endsWith(".checkpoint"))return fail("EIO");originals.rename(from,to);};syncBuiltinESMExports();
      await refused(()=>publish(f.store,next.encoded.text,next.options));
      const current=readFileSync(f.path+".checkpoint","utf8");verifyCheckpointEnvelope(current,f.checkpointTrust,1000000);
      if(fault==="final-sync"){assert.equal(current,next.encoded.text);assert.equal(readFileSync(f.path+".checkpoint.previous","utf8"),old.encoded.text);}else assert.equal(current,old.encoded.text);
      assert.throws(()=>f.store.append(f.store.entries.at(-1)!),/closed or failed/);
    }finally{fs.openSync=originals.open;fs.writeSync=originals.write;fs.fsyncSync=originals.sync;fs.renameSync=originals.rename;syncBuiltinESMExports();f.close();}
  }
});
test("SNP-4: actual process death at publication boundaries preserves complete authenticated files",async()=>{
  for(const boundary of ["write","file-sync","prior-rename","current-rename","final-sync"]){
    const f=await fixture();try{const old=await snapshot(f);await publish(f.store,old.encoded.text,old.options);
      f.guard.check({message:new Uint8Array([255]),at:1001});const next=await snapshot(f,"next.jsonl");f.guard.close();
      const script=`
        import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
        const {fileStore,publishOwnedCheckpoint}=await import(process.argv[1]);
        const store=fileStore(process.argv[2],{ownership:'kernel',create:false}),boundary=process.argv[5];
        const originals={write:fs.writeSync,sync:fs.fsyncSync,rename:fs.renameSync};let directories=0;
        const stop=()=>process.kill(process.pid,'SIGKILL');
        fs.writeSync=(...args)=>{const result=Reflect.apply(originals.write,fs,args);if(boundary==='write')stop();return result;};
        fs.fsyncSync=fd=>{const directory=fs.fstatSync(fd).isDirectory();if(directory)directories++;originals.sync(fd);if((boundary==='file-sync'&&!directory)||(boundary==='final-sync'&&directories===2))stop();};
        fs.renameSync=(from,to)=>{originals.rename(from,to);if((boundary==='prior-rename'&&String(to).endsWith('.previous'))||(boundary==='current-rename'&&String(to).endsWith('.checkpoint')))stop();};
        syncBuiltinESMExports();await publishOwnedCheckpoint(store,process.argv[3],JSON.parse(process.argv[4]));process.exit(9);`;
      const result=spawnSync(process.execPath,["--input-type=module","-e",script,pathToFileURL(resolve("packages/sdk/src/record.ts")).href,f.path,next.encoded.text,JSON.stringify(next.options),boundary],{encoding:"utf8",timeout:10000,killSignal:"SIGKILL"});
      assert.equal(result.error,undefined,result.stderr);assert.equal(result.status,null,result.stderr);assert.equal(result.signal,"SIGKILL");
      const current=readFileSync(f.path+".checkpoint","utf8");verifyCheckpointEnvelope(current,f.checkpointTrust,1000000);
      if(["current-rename","final-sync"].includes(boundary)){assert.equal(current,next.encoded.text);assert.equal(readFileSync(f.path+".checkpoint.previous","utf8"),old.encoded.text);}else assert.equal(current,old.encoded.text);
      const restored=record.fileStore(f.path,{ownership:"kernel",create:false});try{assert.deepEqual(restored.entries,f.store.entries);}finally{restored.close();}
    }finally{f.close();}
  }
});
