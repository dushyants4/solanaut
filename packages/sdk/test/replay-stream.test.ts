// SNP-7: streaming recomputation must preserve full-history semantics.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import * as guards from "../src/guard.ts";
import {streamArchive,verifyArchive} from "../src/archive.ts";
import {sensorV1} from "../src/sensor.ts";
import {memoryStore} from "../src/record.ts";
import {encodeBase58} from "../src/base58.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import type {Entry} from "../src/log.ts";
import {seal} from "../src/log.ts";
import {WORKLOAD_POLICY,step} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";
const streamed=(open:()=>AsyncIterable<Entry>,policy:unknown,sensor:unknown=sensorV1,trust?:unknown):Promise<guards.ReplayResult>=>Promise.resolve().then(()=>Reflect.apply(Reflect.get(guards,"replayStream"),undefined,[open,policy,sensor,trust]));
const source=(entries:readonly Entry[])=>async function*(){for(const entry of entries)yield entry;};
async function history(){const guard=await guards.createGuard({policy:WORKLOAD_POLICY});try{for(let i=0;i<40;i++)step(guard,i);return [...guard.entries()];}finally{guard.close();}}
test("SNP-7: streamed mixed history matches array replay including latch resets",async()=>{
  const entries=await history();assert.ok(entries.some(entry=>entry.kind==="release"));assert.deepEqual(await streamed(source(entries),WORKLOAD_POLICY),await guards.replay(entries,WORKLOAD_POLICY));assert.deepEqual(await streamed(source([]),WORKLOAD_POLICY),{ok:true,decisions:0,divergence:null});
});
test("SNP-7: existing array recomputation does not introduce yields between records",async()=>{
  const entries=structuredClone(await history());let traversals=0;
  Object.defineProperty(entries,Symbol.iterator,{value:function*(){traversals++;for(let i=0;i<entries.length;i++){if(traversals===2 && i===0)queueMicrotask(()=>{entries[0]!.hash="0".repeat(64);});yield entries[i]!;}}});
  assert.equal((await guards.replay(entries,WORKLOAD_POLICY)).ok,true);
});
test("SNP-7: a producer cannot change replay state by mutating an already yielded record",async()=>{
  const entries=await history(),open=async function*(){for(const entry of structuredClone(entries)){yield entry;if(entry.kind==="decision")entry.posture=entry.posture==="REGROUND"?"DEFAULT":"REGROUND";}};
  assert.deepEqual(await streamed(open,WORKLOAD_POLICY),await guards.replay(entries,WORKLOAD_POLICY));
  const guard=await guards.createGuard({policy:WORKLOAD_POLICY}),request=guard.beginRequest({clientId:"client",id:"status"},"status",{},0);guard.finishRequest(request.hash,{ready:true});const controls=[...guard.entries()];guard.close();
  const changing=async function*(){for(const entry of structuredClone(controls)){yield entry;if(entry.kind==="request")entry.hash="0".repeat(64);}};
  assert.deepEqual(await streamed(changing,WORKLOAD_POLICY),await guards.replay(controls,WORKLOAD_POLICY));
});
test("SNP-7: truncated or changed second reads cannot qualify a valid prefix",async()=>{
  const entries=await history();let opens=0;
  const open=()=>source(++opens===1?entries:entries.slice(0,-1))();await assert.rejects(streamed(open,WORKLOAD_POLICY),{name:"StreamReplayError",code:"stream-replay"});assert.equal(opens,2);
  const guard=await guards.createGuard({policy:WORKLOAD_POLICY}),entry=guard.check({message:null as never,at:0});guard.close();const {hash,...body}=entry,changed=seal<typeof entry>({...body,reason:"changed explanation"});assert.equal((await guards.replay([changed],WORKLOAD_POLICY)).ok,true);
  opens=0;await assert.rejects(streamed(()=>source(++opens===1?[entry]:[changed])(),WORKLOAD_POLICY),{name:"StreamReplayError",code:"stream-replay"});
});
test("SNP-7: source errors and early divergence close their current iterator",async()=>{
  const entries=await history();let closed=0;
  const broken=async function*(){try{yield entries[0]!;throw new Error("read failed");}finally{closed++;}};await assert.rejects(streamed(broken,WORKLOAD_POLICY),{name:"StreamReplayError",code:"stream-replay"});assert.equal(closed,1);
  const changed=entries.map((entry,index)=>index===0?{...entry,hash:"0".repeat(64)}:entry);closed=0;
  const tracked=async function*(){try{yield* changed;}finally{closed++;}};const result=await streamed(tracked,WORKLOAD_POLICY);assert.equal(result.ok,false);assert.equal(result.divergence?.field,"hash");assert.equal(closed,2);
});
test("SNP-7: policy is captured before asynchronous source reads",async()=>{
  assert.equal(typeof Reflect.get(guards,"replayStream"),"function","streamed replay is not implemented");
  const entries=await history(),policy=structuredClone(WORKLOAD_POLICY);let resume!:()=>void;
  const pause=new Promise<void>(resolve=>{resume=resolve;});let opened=false;
  const open=async function*(){opened=true;await pause;yield* entries;};const pending=streamed(open,policy);await Promise.resolve();assert.equal(opened,true);policy.sol.maxPerTx=0n;resume();assert.equal((await pending).ok,true);
});
test("SNP-7: later signed window expansion preserves reservations pruned under an earlier policy",async()=>{
  const operator=generateKeyPairSync("ed25519"),operatorKey=encodeBase58(Buffer.from(operator.publicKey.export({format:"jwk"}).x!,"base64url"));
  const first={...WORKLOAD_POLICY,windowMs:1000,sol:{maxPerTx:2n,maxPerWindow:2n},latch:{...WORKLOAD_POLICY.latch,releaseKey:operatorKey}},trust={operatorKey,guardId:first.latch.guardId,cluster:first.latch.cluster};
  const authorization=(policy:unknown,version:number)=>{const issued="2026-10-07T00:00:00.000Z",text=preparePolicyText(policy,version,issued);return {...trust,issued,version,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};};
  const payment=craftLegacy({header:[1,0,1],keys:[key(1),key(2),key(0)],instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]}),store=memoryStore();
  const a=await guards.createGuard({policy:first,authorization:authorization(first,1),log:store});const spent=a.check({message:payment,at:1000});assert.equal(spent.allow,true);a.report(spent.hash,"landed");a.check({message:new Uint8Array(),at:3000});a.close();
  const next={...first,windowMs:5000},b=await guards.createGuard({policy:next,authorization:authorization(next,2),log:store});payment[payment.length-8]=2;assert.equal(b.check({message:payment,at:3001}).rule,"over-window-cap");b.close();
  assert.deepEqual(await streamed(source(store.entries),undefined,sensorV1,trust),await guards.replay(store.entries,undefined,sensorV1,trust));
});
test("SNP-7: signed replay captures external trust and refuses another sensor or authority",async()=>{
  const operator=generateKeyPairSync("ed25519"),operatorKey=encodeBase58(Buffer.from(operator.publicKey.export({format:"jwk"}).x!,"base64url")),policy={...WORKLOAD_POLICY,latch:{...WORKLOAD_POLICY.latch,releaseKey:operatorKey}},trust={operatorKey,guardId:policy.latch.guardId,cluster:policy.latch.cluster};
  const issued="2026-10-07T00:00:00.000Z",text=preparePolicyText(policy,1,issued),guard=await guards.createGuard({policy,authorization:{...trust,issued,version:1,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")}});guard.check({message:null as never,at:0});const entries=[...guard.entries()];guard.close();
  let resume!:()=>void;const pause=new Promise<void>(resolve=>{resume=resolve;}),open=async function*(){await pause;yield* entries;};
  const pending=streamed(open,undefined,sensorV1,trust);await Promise.resolve();trust.operatorKey=encodeBase58(Uint8Array.from(key(9)));resume();assert.equal((await pending).ok,true);
  assert.equal((await streamed(source(entries),undefined,sensorV1,trust)).ok,false);
  await assert.rejects(streamed(source(entries),undefined,()=>({intensity:0,valence:0,repetition:0}),{...trust,operatorKey}),{name:"StreamReplayError",code:"stream-replay"});
});
test("SNP-7: malformed source factories and noncanonical entries refuse with typed errors",async()=>{
  for(const open of [null,1,()=>null,async function*(){yield undefined;}])await assert.rejects(streamed(open as never,WORKLOAD_POLICY),{name:"StreamReplayError",code:"stream-replay"});
});
test("SNP-7: actual immutable archive segments replay through natural pinned completion",async()=>{
  const entries=await history(),directory=mkdtempSync(join(tmpdir(),"solanaut-stream-replay-")),first=join(directory,"first.jsonl"),tail=join(directory,"tail.jsonl"),split=20;
  try{
    writeFileSync(first,entries.slice(0,split).map(entry=>JSON.stringify(entry)+"\n").join(""),{mode:0o400});writeFileSync(tail,entries.slice(split).map(entry=>JSON.stringify(entry)+"\n").join(""),{mode:0o400});
    const initial=await verifyArchive(first),last=await verifyArchive(tail,{firstSeq:split,previousHead:initial.head});
    const open=async function*(){yield* streamArchive(first,{expectedHead:initial.head,expectedDigest:initial.sha256});yield* streamArchive(tail,{firstSeq:split,previousHead:initial.head,expectedHead:last.head,expectedDigest:last.sha256});};
    assert.deepEqual(await streamed(open,WORKLOAD_POLICY),await guards.replay(entries,WORKLOAD_POLICY));
    const bad=async function*(){yield* streamArchive(first,{expectedDigest:"0".repeat(64)});};await assert.rejects(streamed(bad,WORKLOAD_POLICY),{name:"StreamReplayError",code:"stream-replay"});
  }finally{rmSync(directory,{recursive:true,force:true});}
});
