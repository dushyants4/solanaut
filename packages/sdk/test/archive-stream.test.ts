// SNP-1: streaming yields do not establish integrity before natural completion.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import fs from "node:fs/promises";
import {mkdtempSync,writeFileSync,appendFileSync,renameSync,rmSync,symlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import * as archive from "../src/archive.ts";
import {seal,type Entry} from "../src/log.ts";
function fixture(count=200){
  const directory=mkdtempSync(join(tmpdir(),"solanaut-archive-stream-")),path=join(directory,"archive.jsonl"),entries:Entry[]=[];
  for(let seq=0;seq<count;seq++)entries.push(seal({v:1,kind:"report",seq,prev:entries.at(-1)?.hash??"",at:seq,decision:"a".repeat(64),outcome:"unknown",source:"caller",extra:{nested:[{value:seq}]}} as never));
  const text=entries.map(entry=>JSON.stringify(entry)+"\n").join("");writeFileSync(path,text);
  return {directory,path,entries,text,close(){rmSync(directory,{recursive:true,force:true});}};
}
const stream=(path:string,options:unknown={}):AsyncGenerator<Readonly<Entry>,Readonly<archive.ArchiveReceipt>,void>=>Reflect.apply(Reflect.get(archive,"streamArchive"),undefined,[path,options]);
const refused=(work:Promise<unknown>,code:archive.ArchiveErrorCode)=>assert.rejects(work,error=>error instanceof archive.ArchiveError && error.code===code);
async function consume(iterator:ReturnType<typeof stream>){const entries:Readonly<Entry>[]=[];for(;;){const next=await iterator.next();if(next.done)return {entries,receipt:next.value};entries.push(next.value);}}
test("SNP-1: natural streamed completion matches the full verifier and deeply freezes entries",async()=>{
  const f=fixture();try{const got=await consume(stream(f.path));assert.deepEqual(got.entries,f.entries);assert.deepEqual(got.receipt,await archive.verifyArchive(f.path));assert.ok(Object.isFrozen(got.receipt));
    assert.deepEqual(got.receipt,{entries:f.entries.length,firstSeq:0,nextSeq:f.entries.length,head:f.entries.at(-1)!.hash,bytes:Buffer.byteLength(f.text),sha256:createHash("sha256").update(f.text).digest("hex")});
    const entry=got.entries[0]!,extra=Reflect.get(entry,"extra");assert.ok(Object.isFrozen(entry));assert.ok(Object.isFrozen(extra));assert.ok(Object.isFrozen(extra.nested));assert.ok(Object.isFrozen(extra.nested[0]));assert.throws(()=>{extra.nested[0].value=99;},TypeError);
  }finally{f.close();}
});
test("SNP-1: streamed empty and continuation boundaries retain sequence and predecessor pins",async()=>{
  const f=fixture(0),other=fixture(2);try{assert.deepEqual((await consume(stream(f.path))).receipt,await archive.verifyArchive(f.path));writeFileSync(other.path,JSON.stringify(other.entries[1])+"\n");
    const options={firstSeq:1,previousHead:other.entries[0]!.hash,expectedHead:other.entries[1]!.hash,expectedAnchor:{seq:1,head:other.entries[1]!.hash}};
    const got=await consume(stream(other.path,options));assert.deepEqual(got.entries,[other.entries[1]]);assert.deepEqual(got.receipt,await archive.verifyArchive(other.path,options));await refused(consume(stream(other.path)),"chain");
  }finally{f.close();other.close();}
});
test("SNP-1: consumer backpressure suspends reads after the first bounded chunk",async(t)=>{
  const f=fixture(1000),original=fs.open;let reads=0,closed=0;
  try{t.mock.method(fs,"open",async(...args:Parameters<typeof fs.open>)=>{const handle=await original(...args),read=handle.read.bind(handle),close=handle.close.bind(handle);
      t.mock.method(handle,"read",async(...args:Parameters<typeof read>)=>{reads++;return read(...args);});t.mock.method(handle,"close",async()=>{closed++;await close();});return handle;});
    const iterator=stream(f.path),first=await iterator.next();assert.equal(first.done,false);assert.deepEqual(first.value,f.entries[0]);assert.equal(reads,1);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(reads,1);assert.equal(closed,0);
    await iterator.return(undefined as never);assert.equal(closed,1);
  }finally{f.close();}
});
test("SNP-1: cancellation and consumer failure close the source without a completion receipt",async(t)=>{
  const f=fixture(2),original=fs.open;let closed=0;
  try{t.mock.method(fs,"open",async(...args:Parameters<typeof fs.open>)=>{const handle=await original(...args),close=handle.close.bind(handle);t.mock.method(handle,"close",async()=>{closed++;await close();});return handle;});
    const iterator=stream(f.path);await iterator.next();const cancelled=await iterator.return(undefined as never);assert.equal(cancelled.done,true);assert.equal(cancelled.value,undefined);assert.equal(closed,1);
    await assert.rejects(async()=>{for await(const _entry of stream(f.path))throw new Error("consumer stopped");},/consumer stopped/);assert.equal(closed,2);
  }finally{f.close();}
});
test("SNP-1: damaged later entries and conflicting final pins cannot produce natural completion",async()=>{
  const f=fixture(2);try{const bad={...f.entries[1],at:99};writeFileSync(f.path,JSON.stringify(f.entries[0])+"\n"+JSON.stringify(bad)+"\n");const iterator=stream(f.path);assert.deepEqual((await iterator.next()).value,f.entries[0]);await refused(iterator.next(),"chain");
    writeFileSync(f.path,f.text);for(const options of [{expectedHead:"0".repeat(64)},{expectedDigest:"0".repeat(64)},{expectedAnchor:{seq:1,head:"0".repeat(64)}}])await refused(consume(stream(f.path,options)),"expectedHead" in options?"head":"expectedDigest" in options?"digest":"anchor");
  }finally{f.close();}
});
test("SNP-1: appending, truncating or replacing a source after a yield invalidates completion",async()=>{
  for(const change of ["append","truncate","replace"]){const f=fixture(2);try{const iterator=stream(f.path);await iterator.next();
    if(change==="append")appendFileSync(f.path,"extra");else if(change==="truncate")writeFileSync(f.path,"");else{renameSync(f.path,f.path+".old");writeFileSync(f.path,f.text);}
    await refused(consume(iterator),"changed-source");
  }finally{f.close();}}
});
test("SNP-1: option pins are captured when the iterator is created, before asynchronous reading",async()=>{
  const f=fixture(2);try{const options={expectedHead:"0".repeat(64),expectedAnchor:{seq:1,head:f.entries[1]!.hash}},iterator=stream(f.path,options);options.expectedHead=f.entries[1]!.hash;options.expectedAnchor.head="0".repeat(64);await refused(consume(iterator),"head");
    for(const options of [null,[],1,{unknown:true},{maxLineBytes:0},{firstSeq:1}])assert.throws(()=>stream(f.path,options),error=>error instanceof archive.ArchiveError && error.code==="input");
  }finally{f.close();}
});
test("SNP-1: streamed unsupported sources and malformed or oversized frames refuse before yielding",async()=>{
  const f=fixture(1);try{symlinkSync(f.path,f.path+".alias");for(const path of [f.path+".alias",f.directory,join(f.directory,"missing")])await refused(stream(path).next(),"source");
    for(const content of ["{\n",Buffer.from([255,10]),"x".repeat(140000),JSON.stringify(f.entries[0])]){writeFileSync(f.path,content);await refused(stream(f.path,{maxLineBytes:1024}).next(),typeof content==="string"&&content==="{\n"?"record":"framing");}
  }finally{f.close();}
});
