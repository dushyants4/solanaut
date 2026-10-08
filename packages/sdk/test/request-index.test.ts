// SNP-7 component: a derived root, rather than cache metadata, authenticates absence.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {mkdtempSync,mkdirSync,writeFileSync,appendFileSync,rmSync,symlinkSync,linkSync,renameSync} from "node:fs";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import fs from "node:fs/promises";
import {createGuard} from "../src/guard.ts";
import {memoryStore} from "../src/record.ts";
import {encodeBase58} from "../src/base58.ts";
import {canonicalJSON,sha256hex} from "../src/canonical.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {EVALUATION_PROFILE} from "../src/profile.ts";
import {requestKey} from "../src/request.ts";
import {seal,type Entry,type ControlRequestEntry,type ControlResponseEntry,type DecisionEntry,type ReportEntry} from "../src/log.ts";
import type {PreparedRequestIndex} from "../src/request-index.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";
const module=await import("../src/request-index.ts").catch(()=>null);
function api(){assert.ok(module,"request-index component must exist");return module;}
const endpoint=(entries:readonly Entry[])=>({seq:entries.length,head:entries.at(-1)?.hash??""});
async function setup(){
  const operator=generateKeyPairSync("ed25519"),agent=generateKeyPairSync("ed25519");
  const address=(pair:typeof operator)=>encodeBase58(Buffer.from(pair.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...structuredClone(WORKLOAD_POLICY),principal:[address(agent)],latch:{...WORKLOAD_POLICY.latch,releaseKey:address(operator)}};
  const trust={operatorKey:address(operator),guardId:policy.latch.guardId,cluster:policy.latch.cluster},issued="2026-10-08T00:00:00.000Z";
  const authorization=(p:unknown,version:number)=>{const text=preparePolicyText(p,version,issued);return {...trust,version,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};};
  const store=memoryStore(),guard=await createGuard({policy,authorization:authorization(policy,1),log:store});
  const message=(to=2,seed=20)=>craftLegacy({header:[1,0,1],keys:[[...Buffer.from(agent.publicKey.export({format:"jwk"}).x!,"base64url")],key(to),key(0)],blockhash:key(seed),instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
  return {guard,store,policy,trust,authorization,operator,agent,message};
}
const refused=(work:Promise<unknown>)=>assert.rejects(work,{name:"RequestIndexError",code:"request-index"});
const identity=(id:string)=>({clientId:"client",id});
function directory(prepared:PreparedRequestIndex){
  mkdirSync(".sandbox",{recursive:true});const path=mkdtempSync(".sandbox/request-index-");
  writeFileSync(join(path,"manifest.json"),prepared.text);
  for(const shard of prepared.shards)writeFileSync(join(path,shard.bucket+".jsonl"),shard.text);
  return path;
}
test("SNP-7: manifest binds verified signed endpoint and every empty shard",async()=>{
  const {prepareRequestIndex}=api(),x=await setup();try{
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),manifest=JSON.parse(prepared.text);
    assert.equal(manifest.format,1);assert.equal(manifest.kind,"solanaut-request-index");assert.deepEqual(manifest.profile,EVALUATION_PROFILE);
    assert.equal(manifest.guardId,x.trust.guardId);assert.equal(manifest.cluster,x.trust.cluster);assert.equal(manifest.operatorKey,x.trust.operatorKey);
    assert.equal(manifest.policyVersion,1);assert.equal(manifest.policyHash,x.guard.policyHash);assert.deepEqual({seq:manifest.seq,head:manifest.head},endpoint(x.store.entries));
    assert.deepEqual(manifest.shards.map((s:{bucket:string})=>s.bucket),"0123456789abcdef".split(""));
    assert.equal(prepared.text,canonicalJSON(manifest)+"\n");assert.equal(prepared.digest,sha256hex(prepared.text));
    assert.ok(Object.isFrozen(prepared));assert.ok(Object.isFrozen(prepared.shards));assert.ok(Object.isFrozen(prepared.root));
    assert.deepEqual(Object.keys(prepared.root).sort(),["digest","text"]);
    for(const shard of prepared.shards){assert.ok(Object.isFrozen(shard));assert.equal(shard.text,"");assert.equal(shard.rows,0);assert.equal(shard.bytes,0);assert.equal(shard.sha256,sha256hex(""));}
    const path=directory(prepared);try{
      assert.equal(await api().lookupRequestIndex(path,prepared.root,identity("missing")),null);
      await refused(api().lookupRequestIndex(path,structuredClone(prepared.root),identity("missing")));
    }finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7/LIF-1/2/7: denied, pending, sent and final facts keep exact payload and reply bindings",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    const bytes=x.message(),d=x.guard.check({message:bytes,at:1000,blockHeight:10n,lastValidBlockHeight:100n},identity("payment"));assert.ok(d.allow);
    assert.ok(x.guard.redeem(bytes,d.hash,10n).ok);const sig=sign(null,bytes,x.agent.privateKey),signature=encodeBase58(sig);
    const signed=x.guard.recordSigning({stage:"signed",decision:d.hash,wire:Buffer.concat([Buffer.from([1]),sig,bytes]).toString("base64"),signature});
    const started=x.guard.recordSigning({stage:"send-started",decision:d.hash,blockHeight:"11"});
    const answer=x.guard.recordSigning({stage:"response",decision:d.hash,status:"uncertain",signature});x.guard.report(d.hash,"unknown");x.guard.report(d.hash,"landed");
    const denied=x.guard.check({message:x.message(3),at:1100},identity("denied"));assert.equal(denied.allow,false);const denial=x.guard.recordSigning({stage:"response",decision:denied.hash,status:"denied"});
    const pending=x.guard.beginRequest(identity("pending"),"report",{decision:d.hash},1200);
    const control=x.guard.beginRequest(identity("status"),"status",{},1201),response=x.guard.finishRequest(control.hash,{ready:true});
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared);
    try{
      const row=await lookupRequestIndex(path,prepared.root,identity("payment"));assert.ok(row);assert.deepEqual(row.start,d);assert.equal(row.key,requestKey(d.request!));
      assert.deepEqual(row.signed,signed);assert.deepEqual(row.started,started);assert.deepEqual(row.response,answer);assert.equal(row.redeem?.kind,"redeem");assert.equal(row.report?.outcome,"landed");assert.equal(row.settled?.outcome,"landed");
      assert.ok(Object.isFrozen(row));assert.ok(Object.isFrozen(row.start));assert.ok(Object.isFrozen(row.signed!.event));assert.throws(()=>{(row.signed!.event as {wire:string}).wire="changed";});
      const no=await lookupRequestIndex(path,prepared.root,identity("denied"));assert.deepEqual(no?.response,denial);assert.equal(no?.signed,null);
      const wait=await lookupRequestIndex(path,prepared.root,identity("pending"));assert.deepEqual(wait?.start,pending);assert.equal(wait?.response,null);
      const status=await lookupRequestIndex(path,prepared.root,identity("status"));assert.deepEqual(status?.start,control);assert.deepEqual(status?.response,response);
    }finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: source, endpoint, policy and external trust are captured before asynchronous replay",async()=>{
  const {prepareRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("status"),"status",{},1000);
    const entries=structuredClone(x.store.entries),policy=structuredClone(x.policy),context=endpoint(entries),trust={...x.trust};
    const expected=await prepareRequestIndex(entries,policy,context,trust),pending=prepareRequestIndex(entries,policy,context,trust);
    entries.length=0;context.seq=0;context.head="";trust.guardId="foreign";policy.windowMs=99_000;
    const got=await pending;assert.equal(got.text,expected.text);assert.deepEqual(got.shards,expected.shards);
  }finally{x.guard.close();}
});
test("SNP-7/VER-2: unsigned, malformed, dishonest and foreign history cannot mint an expected root",async()=>{
  const {prepareRequestIndex}=api(),x=await setup();try{
    await refused(prepareRequestIndex([],x.policy,{seq:0,head:""},x.trust));await refused(prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries)));
    await refused(prepareRequestIndex(x.store.entries,undefined,{seq:0,head:""},x.trust));
    const foreign={...x.trust,operatorKey:encodeBase58(new Uint8Array(key(99)))};await refused(prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),foreign));
    const bad=structuredClone(x.store.entries);(bad[0] as unknown as {signature:string}).signature="a".repeat(88);bad[0]=seal({...bad[0]!,hash:undefined} as never);
    await refused(prepareRequestIndex(bad,undefined,endpoint(bad),x.trust));
    const d=x.guard.check({message:x.message(),at:1000},identity("decision")),{hash,...body}=d;
    const lie=seal<DecisionEntry>({...body,allow:false,rule:"over-per-tx-cap"});const dishonest=[x.store.entries[0]!,lie];await refused(prepareRequestIndex(dishonest,undefined,endpoint(dishonest),x.trust));
    const hole=new Array(1);await refused(prepareRequestIndex(hole,undefined,{seq:1,head:x.store.entries[0]!.hash},x.trust));
  }finally{x.guard.close();}
});
test("SNP-7/LIF-1: cross-method duplicate identity and changed payload are rejected during projection",async()=>{
  const {prepareRequestIndex}=api(),x=await setup();try{
    const d=x.guard.check({message:x.message(),at:1000},identity("shared"));
    const extra=x.guard.beginRequest(identity("other"),"status",{},1001),{hash,...body}=extra;
    const changed=seal<ControlRequestEntry>({...body,request:{...extra.request,id:"shared"}}),duplicate=[x.store.entries[0]!,d,changed];
    await refused(prepareRequestIndex(duplicate,undefined,endpoint(duplicate),x.trust));
    const forged=seal<DecisionEntry>({...d,hash:undefined,request:{...d.request!,digest:"0".repeat(64)}} as never),bad=[x.store.entries[0]!,forged];
    await refused(prepareRequestIndex(bad,undefined,endpoint(bad),x.trust));
  }finally{x.guard.close();}
});
test("SNP-7: cross-request response target and repeated immutable answers cannot pass signed replay",async()=>{
  const {prepareRequestIndex}=api(),x=await setup();try{
    const start=x.guard.beginRequest(identity("one"),"status",{},1000),reply=x.guard.finishRequest(start.hash,{one:true});
    const {hash,...body}=reply,foreign=seal<ControlResponseEntry>({...body,request:"f".repeat(64)}),bad=[x.store.entries[0]!,start,foreign];
    await refused(prepareRequestIndex(bad,undefined,endpoint(bad),x.trust));
    const repeated=seal<ControlResponseEntry>({...body,seq:reply.seq+1,prev:reply.hash,result:canonicalJSON({one:false})}),duplicate=[...x.store.entries,repeated];
    await refused(prepareRequestIndex(duplicate,undefined,endpoint(duplicate),x.trust));
  }finally{x.guard.close();}
});
test("SNP-7/LIF-7: unsupported report outcomes cannot become settled index evidence",async()=>{
  const {prepareRequestIndex}=api(),x=await setup();try{
    const d=x.guard.check({message:x.message(),at:1000},identity("outcome"));assert.ok(d.allow);x.guard.report(d.hash,"unknown");
    const report=x.store.entries.at(-1)! as ReportEntry,{hash,...body}=report,invalid=seal<ReportEntry>({...body,outcome:"unsupported-outcome" as never});
    const entries=[...x.store.entries.slice(0,-1),invalid];await refused(prepareRequestIndex(entries,undefined,endpoint(entries),x.trust));
  }finally{x.guard.close();}
});
test("SNP-7: unsupported report attribution cannot mint a trusted index root",async()=>{
  const {prepareRequestIndex}=api(),x=await setup();try{
    const d=x.guard.check({message:x.message(),at:1000},identity("source"));assert.ok(d.allow);x.guard.report(d.hash,"unknown");
    const report=x.store.entries.at(-1)! as ReportEntry,{hash,...body}=report,invalid=seal<ReportEntry>({...body,source:"foreign" as never});
    const entries=[...x.store.entries.slice(0,-1),invalid];await refused(prepareRequestIndex(entries,undefined,endpoint(entries),x.trust));
  }finally{x.guard.close();}
});
test("SNP-7/LIF-7: a final report cannot be followed by another unknown or final report",async()=>{
  const {prepareRequestIndex}=api(),x=await setup();try{
    const d=x.guard.check({message:x.message(),at:1000},identity("final"));assert.ok(d.allow);x.guard.report(d.hash,"landed");
    for(const outcome of ["unknown","landed","failed","expired"] as const){
      const extra=seal<ReportEntry>({v:1,kind:"report",seq:x.store.entries.length,prev:x.store.entries.at(-1)!.hash,at:1000,decision:d.hash,outcome,source:"caller"});
      const entries=[...x.store.entries,extra];await refused(prepareRequestIndex(entries,undefined,endpoint(entries),x.trust));
    }
  }finally{x.guard.close();}
});
test("SNP-7: local report validation remains effective at the controlled replay dependency seam",async()=>{
  api();const x=await setup();try{
    const d=x.guard.check({message:x.message(),at:1000},identity("boundary"));assert.ok(d.allow);x.guard.report(d.hash,"landed");
    const final=x.store.entries.at(-1)! as ReportEntry,{hash,...body}=final;
    const badOutcome=seal<ReportEntry>({...body,outcome:"unsupported-outcome" as never}),badSource=seal<ReportEntry>({...body,source:"foreign" as never});
    const later=seal<ReportEntry>({...body,seq:final.seq+1,prev:final.hash,outcome:"unknown"});
    const histories=[[...x.store.entries.slice(0,-1),badOutcome],[...x.store.entries.slice(0,-1),badSource],[...x.store.entries,later]];
    const script=`import{strict as assert}from"node:assert";import{readFileSync}from"node:fs";import{registerHooks}from"node:module";
      const input=JSON.parse(readFileSync(0,"utf8"));let redirected=0;
      const hook=registerHooks({resolve(specifier,context,next){if(specifier==="./guard.ts"&&context.parentURL===input.moduleURL){redirected++;return{url:"data:text/javascript,export async function replay(){return {ok:true};}",shortCircuit:true};}return next(specifier,context);}});
      const index=await import(input.moduleURL);hook.deregister();assert.equal(redirected,1);
      await index.prepareRequestIndex(input.valid,undefined,{seq:input.valid.length,head:input.valid.at(-1).hash},input.trust);
      for(const entries of input.invalid)await assert.rejects(index.prepareRequestIndex(entries,undefined,{seq:entries.length,head:entries.at(-1).hash},input.trust),{name:"RequestIndexError",code:"request-index"});`;
    const result=spawnSync(process.execPath,["--input-type=module","-e",script],{encoding:"utf8",timeout:5000,killSignal:"SIGKILL",
      input:JSON.stringify({moduleURL:new URL("../src/request-index.ts",import.meta.url).href,trust:x.trust,valid:x.store.entries,invalid:histories})});
    assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);
  }finally{x.guard.close();}
});
test("SNP-7: omission plus recomputed disk checksums cannot prove historical absence",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("historical"),"status",{},1000);
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared);
    try{
      const bucket=sha256hex(requestKey({...identity("historical"),guardId:x.trust.guardId,digest:""}))[0]!,manifest=JSON.parse(prepared.text),entry=manifest.shards.find((s:{bucket:string})=>s.bucket===bucket);
      writeFileSync(join(path,bucket+".jsonl"),"");entry.bytes=0;entry.rows=0;entry.sha256=sha256hex("");writeFileSync(join(path,"manifest.json"),canonicalJSON(manifest)+"\n");
      await refused(lookupRequestIndex(path,prepared.root,identity("historical")));
      writeFileSync(join(path,"manifest.json"),prepared.text);await refused(lookupRequestIndex(path,prepared.root,identity("historical")));
      await refused(lookupRequestIndex(path,structuredClone(prepared.root),identity("historical")));
    }finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: a found request cannot return before later bytes and complete shard digest verify",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("hit"),"status",{},1000);
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared),shard=prepared.shards.find(s=>s.rows>0)!;
    try{writeFileSync(join(path,shard.bucket+".jsonl"),shard.text+"{}\n");await refused(lookupRequestIndex(path,prepared.root,identity("hit")));}
    finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: same-size changed reply bytes cannot replace independently derived evidence",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    const start=x.guard.beginRequest(identity("reply"),"status",{},1000);x.guard.finishRequest(start.hash,{answer:1});
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared),shard=prepared.shards.find(s=>s.rows>0)!;
    try{
      const parsed=JSON.parse(shard.text);parsed.response.result=canonicalJSON({answer:2});const changed=canonicalJSON(parsed)+"\n";
      assert.equal(Buffer.byteLength(changed),shard.bytes);writeFileSync(join(path,shard.bucket+".jsonl"),changed);
      await refused(lookupRequestIndex(path,prepared.root,identity("reply")));
    }finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: source changes during a lookup refuse even when bytes still equal the root",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("hit"),"status",{},1000);
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared),shard=prepared.shards.find(s=>s.rows>0)!,file=join(path,shard.bucket+".jsonl");
    const original=fs.open;let changed=false;
    fs.open=async function(...args:Parameters<typeof fs.open>){
      const handle=await original(...args);if(args[0]===file){const read=handle.read.bind(handle);handle.read=(async(...values:Parameters<typeof handle.read>)=>{
        const got=await read(...values);if(!changed){changed=true;writeFileSync(file,shard.text);}return got;
      }) as typeof handle.read;}return handle;
    };
    try{await refused(lookupRequestIndex(path,prepared.root,identity("hit")));assert.equal(changed,true);}
    finally{fs.open=original;rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: lookup identity and line ceiling are captured before file awaits",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    const start=x.guard.beginRequest(identity("hit"),"status",{},1000),prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared);
    try{const id=identity("hit"),options={maxLineBytes:1_048_576},pending=lookupRequestIndex(path,prepared.root,id,options);id.id="missing";options.maxLineBytes=1;assert.deepEqual((await pending)?.start,start);}
    finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: a late source mutation after descriptor stat cannot evade named metadata checks",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("hit"),"status",{},1000);
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared),shard=prepared.shards.find(s=>s.rows>0)!,file=join(path,shard.bucket+".jsonl");
    const original=fs.lstat;let changed=false;
    fs.lstat=(async(...args:Parameters<typeof fs.lstat>)=>{
      if(args[0]===file && !changed){changed=true;appendFileSync(file,"\n");}return original(...args);
    }) as typeof fs.lstat;
    try{await refused(lookupRequestIndex(path,prepared.root,identity("hit")));assert.equal(changed,true);}
    finally{fs.lstat=original;rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: small provenance root works after generated artefacts leave scope; parsed roots refuse",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    const start=x.guard.beginRequest(identity("historical"),"status",{},1000);
    const {root,path}=await (async()=>{const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust);return {root:prepared.root,path:directory(prepared)};})();
    try{
      assert.deepEqual(Object.keys(root).sort(),["digest","text"]);assert.deepEqual((await lookupRequestIndex(path,root,identity("historical")))?.start,start);
      const parsed=JSON.parse(root.text);await refused(lookupRequestIndex(path,{text:canonicalJSON(parsed)+"\n",digest:sha256hex(canonicalJSON(parsed)+"\n")},identity("historical")));
    }finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: complete shards distinguish exact identities, neighbouring hits and absent keys",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    const ids:string[]=[];let selected:string|undefined;
    for(let i=0;ids.length<3;i++){
      assert.ok(i<4096);const id="neighbour-"+i,bucket=sha256hex(requestKey({...identity(id),guardId:x.trust.guardId,digest:""}))[0]!;
      selected??=bucket;if(bucket===selected)ids.push(id);
    }
    const one=x.guard.beginRequest(identity(ids[0]!),"status",{},1000),two=x.guard.beginRequest(identity(ids[1]!),"status",{},1001);
    const reply=x.guard.finishRequest(two.hash,{second:true});
    x.guard.check({message:x.message(),at:1200}); // Non-request SDK decisions are retained outside this projection.
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared);
    try{
      assert.deepEqual((await lookupRequestIndex(path,prepared.root,identity(ids[0]!)))?.start,one);
      const second=await lookupRequestIndex(path,prepared.root,identity(ids[1]!));assert.deepEqual(second?.start,two);assert.deepEqual(second?.response,reply);
      assert.equal(await lookupRequestIndex(path,prepared.root,identity(ids[2]!)),null);
    }finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: altered row schema, route and cross-request reply targets refuse",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    const start=x.guard.beginRequest(identity("one"),"status",{},1000);x.guard.finishRequest(start.hash,{one:true});
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared),shard=prepared.shards.find(s=>s.rows>0)!;
    try{
      for(const mutate of [(row:Record<string,unknown>)=>{row.format=2;},(row:Record<string,unknown>)=>{row.extra=true;},
        (row:Record<string,unknown>)=>{(row.response as {request:string}).request="0".repeat(64);},(row:Record<string,unknown>)=>{row.key="foreign";}]){
        const parsed=JSON.parse(shard.text);mutate(parsed);writeFileSync(join(path,shard.bucket+".jsonl"),canonicalJSON(parsed)+"\n");
        await refused(lookupRequestIndex(path,prepared.root,identity("one")));
      }
    }finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: another existing request's reply cannot answer this identity",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    const one=x.guard.beginRequest(identity("one"),"status",{},1000);x.guard.finishRequest(one.hash,{value:1});
    const two=x.guard.beginRequest(identity("two"),"status",{},1001),foreign=x.guard.finishRequest(two.hash,{value:2});
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared);
    const bucket=sha256hex(requestKey(one.request))[0]!,shard=prepared.shards.find(s=>s.bucket===bucket)!;
    try{
      const rows=shard.text.trimEnd().split("\n").map(text=>JSON.parse(text)),row=rows.find(item=>item.start.hash===one.hash);row.response=foreign;
      const changed=rows.map(item=>canonicalJSON(item)+"\n").join("");assert.equal(Buffer.byteLength(changed),shard.bytes);
      writeFileSync(join(path,bucket+".jsonl"),changed);await refused(lookupRequestIndex(path,prepared.root,identity("one")));
    }finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: cache source errors, symlinks, directories, missing and oversized rows refuse",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("hit"),"status",{},1000);
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared),shard=prepared.shards.find(s=>s.rows>0)!,file=join(path,shard.bucket+".jsonl");
    try{
      await refused(lookupRequestIndex(path,prepared.root,identity("hit"),{maxLineBytes:1}));
      await refused(lookupRequestIndex(path,prepared.root,identity("hit"),{maxLineBytes:0}));
      await refused(lookupRequestIndex(path,prepared.root,{clientId:"client",id:"../bad"}));
      rmSync(file);await refused(lookupRequestIndex(path,prepared.root,identity("hit")));
      const other=join(path,"other");writeFileSync(other,shard.text);symlinkSync("other",file);await refused(lookupRequestIndex(path,prepared.root,identity("hit")));
      rmSync(file);mkdirSync(file);await refused(lookupRequestIndex(path,prepared.root,identity("hit")));rmSync(file,{recursive:true});
      const fifo=spawnSync("mkfifo",[file]);assert.equal(fifo.status,0);await refused(lookupRequestIndex(path,prepared.root,identity("hit")));
    }finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: runtime loader options must be an object with a valid explicit line ceiling",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("hit"),"status",{},1000);
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared);
    try{for(const options of [42,()=>{},null,[],{other:true},{maxLineBytes:null}])await refused(lookupRequestIndex(path,prepared.root,identity("hit"),options as never));}
    finally{rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: hardlinked shards and symlinked generation directories refuse",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("hit"),"status",{},1000);
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared),shard=prepared.shards.find(s=>s.rows>0)!,alias=path+"-alias";
    try{
      linkSync(join(path,shard.bucket+".jsonl"),join(path,"hardlink"));await refused(lookupRequestIndex(path,prepared.root,identity("hit")));rmSync(join(path,"hardlink"));
      symlinkSync(join(process.cwd(),path),alias);await refused(lookupRequestIndex(alias,prepared.root,identity("hit")));
      assert.ok(await lookupRequestIndex(path,prepared.root,identity("hit")));
    }finally{rmSync(alias,{force:true});rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: replacing the generation directory after file checks cannot return evidence",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("hit"),"status",{},1000);
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared),moved=path+"-moved";
    const original=fs.lstat;let calls=0;
    fs.lstat=(async(...args:Parameters<typeof fs.lstat>)=>{
      if(args[0]===path && ++calls===2){renameSync(path,moved);mkdirSync(path);}return original(...args);
    }) as typeof fs.lstat;
    try{await refused(lookupRequestIndex(path,prepared.root,identity("hit")));assert.equal(calls,2);}
    finally{fs.lstat=original;rmSync(path,{recursive:true,force:true});rmSync(moved,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: deterministic permission/read errors refuse and close every acquired descriptor",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();try{
    x.guard.beginRequest(identity("hit"),"status",{},1000);
    const prepared=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),path=directory(prepared),shard=prepared.shards.find(s=>s.rows>0)!,file=join(path,shard.bucket+".jsonl");
    const original=fs.open,active=new Set<Awaited<ReturnType<typeof fs.open>>>();let mode:"permission"|"read"="permission";
    fs.open=async function(...args:Parameters<typeof fs.open>){
      if(args[0]===file && mode==="permission")throw Object.assign(new Error("fixture permission loss"),{code:"EACCES"});
      const handle=await original(...args);active.add(handle);const close=handle.close.bind(handle);
      handle.close=async()=>{try{return await close();}finally{active.delete(handle);}};
      if(args[0]===file)handle.read=(async()=>{throw Object.assign(new Error("fixture read loss"),{code:"EIO"});}) as typeof handle.read;
      return handle;
    };
    try{
      await refused(lookupRequestIndex(path,prepared.root,identity("hit")));assert.equal(active.size,0);mode="read";
      await refused(lookupRequestIndex(path,prepared.root,identity("hit")));assert.equal(active.size,0);
    }finally{fs.open=original;for(const handle of active)await handle.close();rmSync(path,{recursive:true,force:true});}
  }finally{x.guard.close();}
});
test("SNP-7: completed replies and roots remain distinct across policy changes and restart",async()=>{
  const {prepareRequestIndex,lookupRequestIndex}=api(),x=await setup();
  const start=x.guard.beginRequest(identity("durable"),"status",{},1000),reply=x.guard.finishRequest(start.hash,{original:true});
  const old=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust);x.guard.close();
  const next={...x.policy,windowMs:60_000},g=await createGuard({policy:next,authorization:x.authorization(next,2),log:x.store});try{
    const fresh=await prepareRequestIndex(x.store.entries,undefined,endpoint(x.store.entries),x.trust),manifest=JSON.parse(fresh.text),path=directory(fresh);
    try{assert.equal(manifest.policyVersion,2);assert.notEqual(fresh.digest,old.digest);assert.deepEqual((await lookupRequestIndex(path,fresh.root,identity("durable")))?.response,reply);await refused(lookupRequestIndex(path,old.root,identity("durable")));}
    finally{rmSync(path,{recursive:true,force:true});}
  }finally{g.close();}
});
