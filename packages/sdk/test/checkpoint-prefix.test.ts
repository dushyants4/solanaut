// SNP-3/5: derive only controller events from full, validated history.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { Governor } from "@gubernaut/core";
import { encodeBase58 } from "../src/base58.ts";
import { memoryStore } from "../src/record.ts";
import { preparePolicyText } from "../src/signed-policy.ts";
import { prepareCheckpointPrefix } from "../src/checkpoint-prefix.ts";
import { createGuard } from "../src/guard.ts";
import { canonicalJSON, sha256hex } from "../src/canonical.ts";
import { EVALUATION_PROFILE } from "../src/profile.ts";
import { seal, type Entry, type DecisionEntry } from "../src/log.ts";
import { WORKLOAD_POLICY, step } from "./support/workload.ts";
async function history():Promise<Entry[]> {
  const g=await createGuard({policy:WORKLOAD_POLICY});
  try{for(let i=0;i<40;i++)step(g,i);return [...g.entries()];}finally{g.close();}
}
const endpoint=(entries:readonly Entry[])=>({seq:entries.length,head:entries.at(-1)?.hash??""});
const refused=(work:Promise<unknown>)=>assert.rejects(work,{name:"CheckpointPrefixError",code:"checkpoint-prefix"});
test("SNP-3/5: genesis has canonical empty events and a payload digest",async()=>{
  const got=await prepareCheckpointPrefix([],WORKLOAD_POLICY,{seq:0,head:""});
  assert.equal(got.text,canonicalJSON({format:1,kind:"solanaut-checkpoint-keel-prefix",profile:EVALUATION_PROFILE,seq:0,head:"",events:[]})+"\n");
  assert.equal(got.digest,sha256hex(got.text));assert.ok(Object.isFrozen(got));
});
test("SNP-3/5: mixed history retains every tick and reset, with source sequence/hash",async()=>{
  const entries=await history(),got=await prepareCheckpointPrefix(entries,WORKLOAD_POLICY,endpoint(entries));
  const events=entries.flatMap(e=>e.kind==="release"?[{kind:"reset",seq:e.seq,hash:e.hash}]:e.kind==="decision" && e.posture!==null && e.telemetry!==null?[{kind:"tick",seq:e.seq,hash:e.hash,telemetry:e.telemetry,posture:e.posture}]:[]);
  assert.ok(events.some(e=>e.kind==="reset"));assert.ok(events.some(e=>e.kind==="tick"));assert.ok(events.length<entries.length);
  assert.equal(got.text,canonicalJSON({format:1,kind:"solanaut-checkpoint-keel-prefix",profile:EVALUATION_PROFILE,...endpoint(entries),events})+"\n");
  assert.equal(got.digest,sha256hex(got.text));assert.ok(!got.text.includes("temperatureMax"));
});
test("SNP-3/5: stale, missing, reordered and tampered history cannot produce a prefix",async()=>{
  const entries=await history(),end=endpoint(entries);
  for(const changed of [entries.slice(1),entries.slice(0,-1),[entries[1]!,entries[0]!,...entries.slice(2)],entries.map((e,i)=>i===0?{...e,hash:"0".repeat(64)}:e)])await refused(prepareCheckpointPrefix(changed,WORKLOAD_POLICY,end));
  for(const context of [{seq:-1,head:""},{seq:1.5,head:end.head},{seq:end.seq+1,head:end.head},{seq:end.seq,head:"0".repeat(64)},{...end,extra:true}])await refused(prepareCheckpointPrefix(entries,WORKLOAD_POLICY,context));
});
test("SNP-3/5: resealed dishonest telemetry still requires full decision replay",async()=>{
  const g=await createGuard({policy:WORKLOAD_POLICY});step(g,0);const first=g.entries()[0]!;g.close();assert.equal(first.kind,"decision");
  const {hash,...body}=first;const changed=seal({...body,telemetry:{intensity:1,valence:-1,repetition:1}} as never);
  await refused(prepareCheckpointPrefix([changed],WORKLOAD_POLICY,endpoint([changed])));
});
test("SNP-3/5: malformed inputs cannot inject controller events",async()=>{
  const g=await createGuard({policy:WORKLOAD_POLICY});const d=g.check({message:null as never,at:0});g.close();
  assert.deepEqual(JSON.parse((await prepareCheckpointPrefix([d],WORKLOAD_POLICY,endpoint([d]))).text).events,[]);
  const {hash,...body}=d,changed=seal<DecisionEntry>({...body,posture:"DEFAULT",telemetry:{intensity:0,valence:0,repetition:0},temperatureMax:0});
  await refused(prepareCheckpointPrefix([changed],WORKLOAD_POLICY,endpoint([changed])));
});
test("SNP-3/5: wrong policy and caller serialization methods cannot bypass validation",async()=>{
  const entries=await history(),context=endpoint(entries);
  await refused(prepareCheckpointPrefix(entries,{...WORKLOAD_POLICY,sol:{...WORKLOAD_POLICY.sol,maxPerTx:0n}},context));
  const replaced=Object.assign([...entries],{map:()=>[]});await refused(prepareCheckpointPrefix(replaced,WORKLOAD_POLICY,context));
  const sparse=Array<Entry>(entries.length);sparse[0]=entries[0]!;await refused(prepareCheckpointPrefix(sparse,WORKLOAD_POLICY,context));
});
test("SNP-3/5: async replay uses a captured history and endpoint",async()=>{
  const entries=await history(),context=endpoint(entries),expected=await prepareCheckpointPrefix(entries,WORKLOAD_POLICY,context);
  const pending=prepareCheckpointPrefix(entries,WORKLOAD_POLICY,context);entries.length=0;context.seq=0;context.head="";
  assert.deepEqual(await pending,expected);
});
test("SNP-3/5: fresh Keel reproduces prefix postures across reset boundaries",async()=>{
  const entries=await history(),got=await prepareCheckpointPrefix(entries,WORKLOAD_POLICY,endpoint(entries)),gov=await Governor.create();
  for(const event of JSON.parse(got.text).events){
    if(event.kind==="reset")gov.reset();else assert.equal(gov.tick(event.telemetry).posture,event.posture);
  }
});
test("SNP-3/5: signed policy changes require externally pinned policy trust",async()=>{
  const key=generateKeyPairSync("ed25519"),operatorKey=encodeBase58(Buffer.from(key.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...WORKLOAD_POLICY,latch:{...WORKLOAD_POLICY.latch,releaseKey:operatorKey}},trust={operatorKey,guardId:policy.latch.guardId,cluster:policy.latch.cluster},issued="2026-10-07T00:00:00.000Z";
  const auth=(p:unknown,version:number)=>{const text=preparePolicyText(p,version,issued);return {...trust,version,issued,text,signature:sign(null,Buffer.from(text),key.privateKey).toString("base64")};};
  const store=memoryStore(),g=await createGuard({policy,authorization:auth(policy,1),log:store});step(g,0);g.close();
  const next={...policy,sol:{...policy.sol,maxPerTx:2_000_000_000n}},restored=await createGuard({policy:next,authorization:auth(next,2),log:store});step(restored,1);restored.close();
  const got=await prepareCheckpointPrefix(store.entries,undefined,endpoint(store.entries),trust);assert.equal(JSON.parse(got.text).events.length,2);
  await refused(prepareCheckpointPrefix(store.entries,undefined,endpoint(store.entries)));
  await refused(prepareCheckpointPrefix(store.entries,undefined,endpoint(store.entries),{...trust,guardId:"foreign"}));
});
