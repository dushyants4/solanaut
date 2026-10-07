import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CheckpointArchiveError, prepareCheckpointArchives } from "../src/checkpoint-archives.ts";
import { verifyArchive } from "../src/archive.ts";
import { canonicalJSON } from "../src/canonical.ts";
import { createGuard } from "../src/guard.ts";
import { memoryStore } from "../src/record.ts";
import { WORKLOAD_POLICY, step } from "./support/workload.ts";
const hash=(text:string)=>createHash("sha256").update(text).digest("hex"),hex=(n:number)=>String(n).repeat(64);
const fixture=()=>({segments:[{bytes:10,entries:2,firstSeq:0,head:hex(1),nextSeq:2,sha256:hex(2)},{bytes:12,entries:2,firstSeq:2,head:hex(3),nextSeq:4,sha256:hex(4)}],context:{seq:4,head:hex(3)}});
test("SNP-3: archive catalogue bytes and digest have an independent canonical oracle",()=>{
  const f=fixture(),r=prepareCheckpointArchives(f.segments,f.context);
  const expected=`{"format":1,"kind":"solanaut-checkpoint-archives","segments":[{"bytes":10,"entries":2,"firstSeq":0,"head":"${hex(1)}","nextSeq":2,"sha256":"${hex(2)}"},{"bytes":12,"entries":2,"firstSeq":2,"head":"${hex(3)}","nextSeq":4,"sha256":"${hex(4)}"}]}\n`;
  assert.deepEqual(r,{text:expected,digest:hash(expected)});assert.equal(Object.isFrozen(r),true);
});
test("SNP-3: receipt field insertion order cannot change catalogue bytes",()=>{
  const f=fixture(),reversed=f.segments.map(x=>Object.fromEntries(Object.entries(x).reverse()));
  assert.deepEqual(prepareCheckpointArchives(reversed,f.context),prepareCheckpointArchives(f.segments,f.context));
});
test("SNP-3: caller array methods cannot substitute unvalidated receipts",()=>{
  const f=fixture(),array=[...f.segments];
  Object.setPrototypeOf(array,Object.assign(Object.create(Array.prototype),{map:()=>[{...f.segments[0],unexpected:true},f.segments[1]]}));
  assert.deepEqual(prepareCheckpointArchives(array,f.context),prepareCheckpointArchives(f.segments,f.context));
});
test("SNP-3: only genesis may have an empty archive catalogue",()=>{
  const r=prepareCheckpointArchives([],{seq:0,head:""});assert.equal(r.digest,hash(r.text));
  const f=fixture();assert.throws(()=>prepareCheckpointArchives([],f.context),CheckpointArchiveError);
  assert.throws(()=>prepareCheckpointArchives(f.segments,{seq:0,head:""}),CheckpointArchiveError);
});
test("SNP-3: malformed checkpoint context never binds an archive catalogue",()=>{
  const f=fixture();
  for(const context of [null,[],{}, {...f.context,seq:-1},{...f.context,seq:1.5},{...f.context,seq:NaN},{...f.context,seq:Number.MAX_SAFE_INTEGER+1},{...f.context,seq:"4"},{...f.context,head:""},{...f.context,head:hex(3).toUpperCase().replace(/3/,"A")},{seq:0,head:hex(1)},{...f.context,extra:true}])assert.throws(()=>prepareCheckpointArchives(f.segments,context as typeof f.context),CheckpointArchiveError);
});
test("SNP-3: malformed receipt fields and unsupported data refuse",()=>{
  const f=fixture();
  for(const input of [null,{},"text",[null],[[]]])assert.throws(()=>prepareCheckpointArchives(input,f.context),CheckpointArchiveError);
  const extended=Object.assign([...f.segments],{unexpected:true});assert.throws(()=>prepareCheckpointArchives(extended,f.context),CheckpointArchiveError);
  assert.throws(()=>prepareCheckpointArchives([{...f.segments[0],extra:undefined},f.segments[1]],f.context),CheckpointArchiveError);
  for(const changed of [{bytes:0},{bytes:-1},{bytes:1.5},{bytes:Number.MAX_SAFE_INTEGER+1},{bytes:1},{entries:0},{entries:-1},{entries:1.5},{entries:Number.MAX_SAFE_INTEGER+1},{entries:1},{firstSeq:-1},{firstSeq:0.5},{firstSeq:"0"},{firstSeq:Number.MAX_SAFE_INTEGER+1},{nextSeq:0},{nextSeq:1.5},{nextSeq:Number.MAX_SAFE_INTEGER+1},{head:""},{head:1},{sha256:"bad"},{sha256:hex(2)+" "},{extra:true}])assert.throws(()=>prepareCheckpointArchives([{...f.segments[0],...changed},f.segments[1]],f.context),CheckpointArchiveError);
  for(const key of Object.keys(f.segments[0]!)){const first={...f.segments[0]} as Record<string,unknown>;delete first[key];assert.throws(()=>prepareCheckpointArchives([first,f.segments[1]],f.context),CheckpointArchiveError);}
});
test("SNP-3: gaps, omitted segments, duplicate segments and reordered segments refuse",()=>{
  const f=fixture();for(const segments of [[f.segments[1]],[f.segments[0]],f.segments.toReversed(),[f.segments[0],f.segments[0]],[f.segments[0],{...f.segments[1],firstSeq:3,entries:1}]])assert.throws(()=>prepareCheckpointArchives(segments,f.context),CheckpointArchiveError);
});
test("SNP-3: catalogue endpoint must match both next sequence and preceding head",()=>{
  const f=fixture();for(const context of [{...f.context,seq:5},{...f.context,seq:3},{...f.context,head:hex(5)}])assert.throws(()=>prepareCheckpointArchives(f.segments,context),CheckpointArchiveError);
});
test("SNP-3: observed anchor metadata is retained and bounded by its segment",()=>{
  const f=fixture(),first={...f.segments[0],anchor:{seq:1,head:hex(1)}};
  assert.deepEqual(JSON.parse(prepareCheckpointArchives([first,f.segments[1]],f.context).text).segments[0].anchor,first.anchor);
  for(const anchor of [null,[],{}, {seq:-1,head:hex(1)},{seq:0.5,head:hex(1)},{seq:2,head:hex(1)},{seq:1,head:hex(5)},{seq:0,head:"bad"},{seq:0,head:hex(5),extra:true}])assert.throws(()=>prepareCheckpointArchives([{...first,anchor},f.segments[1]],f.context),CheckpointArchiveError);
  assert.throws(()=>prepareCheckpointArchives([f.segments[0],{...f.segments[1],anchor:{seq:1,head:hex(1)}}],f.context),CheckpointArchiveError);
});
test("SNP-3: caller receipts cannot mutate the captured endpoint",()=>{
  const f=fixture(),changed={...f.segments[1],head:hex(5)};
  Object.defineProperty(changed,"bytes",{enumerable:true,get(){f.context.head=hex(5);return 12;}});
  assert.throws(()=>prepareCheckpointArchives([f.segments[0],changed],f.context),CheckpointArchiveError);
});
test("SNP-3: throwing accessors, cycles and unsupported JSON produce typed refusal",()=>{
  const f=fixture(),cyclic:unknown[]=[];cyclic.push(cyclic);
  const changed={...f.segments[0]};Object.defineProperty(changed,"head",{enumerable:true,get(){throw new Error("caller accessor");}});
  for(const input of [cyclic,[changed],new Uint8Array(1),[{...f.segments[0],bytes:2n},f.segments[1]]])assert.throws(()=>prepareCheckpointArchives(input,f.context),CheckpointArchiveError);
});
test("SNP-3: prepared catalogue does not retain caller-owned mutable values",()=>{
  const f=fixture(),r=prepareCheckpointArchives(f.segments,f.context),text=r.text;
  f.segments[0]!.head=hex(5);f.context.head=hex(6);assert.equal(r.text,text);assert.equal(r.digest,hash(text));
});
test("SNP-3: safe integer endpoints do not overflow catalogue arithmetic",()=>{
  const seq=Number.MAX_SAFE_INTEGER;
  const r=prepareCheckpointArchives([{bytes:seq,entries:seq,firstSeq:0,nextSeq:seq,head:hex(1),sha256:hex(2)}],{seq,head:hex(1)});
  assert.equal(JSON.parse(r.text).segments[0].nextSeq,seq);
});
test("SNP-3: actual verified immutable segments prepare a complete catalogue",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"solanaut-checkpoint-archives-")),store=memoryStore();
  const guard=await createGuard({policy:WORKLOAD_POLICY,log:store});
  try{
    for(let i=0;i<2;i++)step(guard,i);
    const midpoint=Math.floor(store.entries.length/2),first=join(directory,"first.jsonl"),second=join(directory,"second.jsonl");
    writeFileSync(first,store.entries.slice(0,midpoint).map(canonicalJSON).join("\n")+"\n");
    writeFileSync(second,store.entries.slice(midpoint).map(canonicalJSON).join("\n")+"\n");
    const a=await verifyArchive(first),b=await verifyArchive(second,{firstSeq:a.nextSeq,previousHead:a.head});
    const r=prepareCheckpointArchives([a,b],{seq:b.nextSeq,head:b.head});assert.equal(r.digest,hash(r.text));assert.deepEqual(JSON.parse(r.text).segments,[a,b]);
  }finally{guard.close();rmSync(directory,{recursive:true,force:true});}
});
test("SNP-3: SDK exports archive catalogue preparation and typed refusal",async()=>{
  const sdk=await import("../src/index.ts");assert.equal("prepareCheckpointArchives" in sdk,true);assert.equal("CheckpointArchiveError" in sdk,true);
});
