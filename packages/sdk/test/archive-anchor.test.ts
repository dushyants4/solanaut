import {strict as assert} from "node:assert";
import {after,test} from "node:test";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {verifyArchive,ArchiveError,type ArchiveOptions} from "../src/archive.ts";
import {seal,type Entry} from "../src/log.ts";
const directory=mkdtempSync(join(tmpdir(),"solanaut-anchor-")); after(()=>rmSync(directory,{recursive:true,force:true}));
let nextFile=0;
function history(count:number):Entry[] {
  const entries:Entry[]=[]; let prev="";
  for(let seq=0;seq<count;seq++) {const entry=seal({v:1,kind:"report",seq,prev,at:seq,decision:"a".repeat(64),outcome:"unknown",source:"caller"} as never); entries.push(entry); prev=entry.hash;}
  return entries;
}
function file(entries:Entry[]):string {const path=join(directory,String(nextFile++)); writeFileSync(path,entries.map(entry=>JSON.stringify(entry)+"\n").join("")); return path;}
const pinned=(seq:number,head:string)=>({expectedAnchor:{seq,head}} satisfies ArchiveOptions);
const refuses=(promise:Promise<unknown>,code:string)=>assert.rejects(promise,error=>error instanceof ArchiveError && error.code===code);
test("ANC-3: an externally pinned middle, first and last anchor verify with a valid tail",async()=> {
  const entries=history(20),path=file(entries);
  for(const seq of [0,10,19]) {
    const receipt=await verifyArchive(path,pinned(seq,entries[seq]!.hash));
    assert.deepEqual(receipt.anchor,{seq,head:entries[seq]!.hash});
    assert.equal(receipt.entries,20); assert.equal(receipt.head,entries[19]!.hash);
  }
});
test("ANC-3: a fully resealed rewrite before the anchor is refused",async()=> {
  const original=history(20),rewritten:Entry[]=[]; let prev="";
  for(const entry of original) {const altered=seal({...entry,prev,at:entry.seq===3?3.5:entry.at,hash:undefined} as never); rewritten.push(altered); prev=altered.hash;}
  const path=file(rewritten); assert.equal((await verifyArchive(path)).entries,20);
  await refuses(verifyArchive(path,pinned(10,original[10]!.hash)),"anchor");
});
test("ANC-3: matching a head at another sequence cannot substitute for the anchor",async()=> {
  const entries=history(20),path=file(entries);
  await refuses(verifyArchive(path,pinned(10,entries[9]!.hash)),"anchor");
  await refuses(verifyArchive(path,pinned(9,entries[10]!.hash)),"anchor");
});
test("ANC-3: an absent anchor in empty or truncated history is refused",async()=> {
  const entries=history(20);
  await refuses(verifyArchive(file([]),pinned(0,entries[0]!.hash)),"anchor");
  await refuses(verifyArchive(file(entries.slice(0,10)),pinned(10,entries[10]!.hash)),"anchor");
});
test("ANC-3: continuation segments must actually contain the pinned anchor",async()=> {
  const entries=history(20),path=file(entries.slice(10));
  assert.equal((await verifyArchive(path,{firstSeq:10,previousHead:entries[9]!.hash,...pinned(10,entries[10]!.hash)})).entries,10);
  await refuses(verifyArchive(path,{firstSeq:10,previousHead:entries[9]!.hash,...pinned(9,entries[9]!.hash)}),"input");
});
test("ANC-3: malformed or unsupported anchor options refuse before opening a source",async()=> {
  for(const anchor of [null,[],{}, {seq:-1,head:"a".repeat(64)},{seq:0.5,head:"a".repeat(64)},{seq:Number.MAX_SAFE_INTEGER+1,head:"a".repeat(64)},{seq:0,head:""},{seq:0,head:"A".repeat(64)},{seq:0,head:"a".repeat(64),foreign:true}]) await refuses(verifyArchive("missing",{expectedAnchor:anchor} as never),"input");
});
test("ANC-3: caller mutation cannot change the captured anchor or receipt",async()=> {
  const entries=history(20),options=pinned(0,entries[0]!.hash);
  const pending=verifyArchive(file(entries),options); options.expectedAnchor.seq=19; options.expectedAnchor.head=entries[19]!.hash;
  const receipt=await pending;
  assert.deepEqual(receipt.anchor,{seq:0,head:entries[0]!.hash});
});
test("ANC-3: a valid rewrite after the anchor is outside its integrity coverage",async()=> {
  const entries=history(20),anchor={seq:10,head:entries[10]!.hash}; let prev=anchor.head;
  const tail=entries.slice(11).map(entry=> {const altered=seal({...entry,prev,at:entry.at+0.5,hash:undefined} as never); prev=altered.hash; return altered;});
  const receipt=await verifyArchive(file([...entries.slice(0,11),...tail]),pinned(anchor.seq,anchor.head));
  assert.notEqual(receipt.head,entries[19]!.hash); assert.equal(receipt.entries,20);
});
