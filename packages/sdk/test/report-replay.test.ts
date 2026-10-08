// SNP-5/6, LIF-7, D22: recovery must not accept reports the live guard refuses.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {createGuard,replay,replayStream} from "../src/guard.ts";
import {seal,OUTCOMES,type Entry,type ReportEntry} from "../src/log.ts";
import {apply,initialState} from "../src/state.ts";
import {createPolicy} from "../src/policy.ts";
import {inspectRecord} from "../src/inspect.ts";
import {encodeBase58} from "../src/base58.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {memoryStore} from "../src/record.ts";
import {sensorV1} from "../src/sensor.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";

const message=craftLegacy({header:[1,0,1],keys:[key(1),key(2),key(0)],instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
async function history(outcome?:ReportEntry["outcome"]):Promise<Entry[]> {
  const g=await createGuard({policy:WORKLOAD_POLICY});
  try{
    const d=g.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},{clientId:"report",id:"one"});
    assert.equal(d.allow,true);
    if(outcome)g.report(d.hash,outcome);
    return structuredClone([...g.entries()]);
  }finally{g.close();}
}
function report(entries:Entry[],changes:Record<string,unknown>={}):ReportEntry {
  return seal<ReportEntry>({v:1,seq:entries.length,prev:entries.at(-1)!.hash,kind:"report",at:1000,decision:entries[0]!.hash,outcome:"unknown",source:"caller",...changes} as Omit<ReportEntry,"hash">);
}
async function refuse(entries:Entry[]):Promise<void> {
  const array=await replay(entries,WORKLOAD_POLICY);
  assert.equal(array.ok,false,"array replay accepted an impossible report");
  assert.equal(array.divergence?.seq,entries.length-1);
  const streamed=await replayStream(async function*(){yield* entries;},WORKLOAD_POLICY);
  assert.equal(streamed.ok,false,"stream replay accepted an impossible report");
  assert.equal(streamed.divergence?.seq,entries.length-1);
  await assert.rejects(createGuard({policy:WORKLOAD_POLICY,log:{entries,append(){},close(){}}}),/report|outcome|attribution/);
  assert.throws(()=>inspectRecord(entries,WORKLOAD_POLICY),/report|outcome|attribution/);
}
test("SNP-5/LIF-7/D22: repeated unknown reports followed by each final outcome remain replayable and restorable",async()=>{
  for(const outcome of OUTCOMES.filter(value=>value!=="unknown")){
    const g=await createGuard({policy:WORKLOAD_POLICY});
    try{
      const d=g.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},{clientId:"report",id:outcome});
      g.report(d.hash,"unknown");g.report(d.hash,"unknown");g.report(d.hash,outcome);
      const entries=structuredClone([...g.entries()]);
      assert.equal((await replay(entries,WORKLOAD_POLICY)).ok,true);
      assert.equal((await replayStream(async function*(){yield* entries;},WORKLOAD_POLICY)).ok,true);
      const restored=await createGuard({policy:WORKLOAD_POLICY,log:{entries,append(){},close(){}}});
      try{assert.throws(()=>restored.report(d.hash,"unknown"),/final/);}
      finally{restored.close();}
    }finally{g.close();}
  }
});
for(const [field,value] of [["outcome","unsupported-outcome"],["source","foreign-source"]] as const)
  test(`SNP-5/6/D22: resealed unsupported report ${field} refuses every recovery path`,async()=>{
    const entries=await history();await refuse([...entries,report(entries,{[field]:value})]);
  });
for(const at of [-1,null,"1000"])
  test(`SNP-5/6/D22: resealed report timestamp ${String(at)} refuses every recovery path`,async()=>{
    const entries=await history();await refuse([...entries,report(entries,{at})]);
  });
test("SNP-5/6/D22: reports naming an absent or denied decision refuse every recovery path",async()=>{
  const entries=await history();await refuse([...entries,report(entries,{decision:"0".repeat(64)})]);
  const g=await createGuard({policy:WORKLOAD_POLICY});
  try{
    const d=g.check({message:Uint8Array.of(255),at:1000});assert.equal(d.allow,false);
    const denied=structuredClone([...g.entries()]);await refuse([...denied,report(denied,{decision:d.hash})]);
  }finally{g.close();}
});
for(const final of ["landed","failed","expired"] as const)
  test(`SNP-5/6/LIF-7/D22: resealed reports after final ${final} refuse every recovery path`,async()=>{
    const entries=await history(final);
    for(const outcome of OUTCOMES)await refuse([...entries,report(entries,{outcome})]);
  });
test("SNP-5/6/LIF-7/D22: invalid reports change no head, clock, signing, reservation or sensor state",async()=>{
  const policy=createPolicy(WORKLOAD_POLICY).policy;
  for(const changes of [{outcome:"unsupported-outcome"},{source:"foreign-source"},{at:-1},{decision:"0".repeat(64)}]){
    const entries=await history(),s=initialState();for(const e of entries)apply(s,e,policy);
    const before=structuredClone(s);
    assert.throws(()=>apply(s,report(entries,changes),policy),/report|outcome|attribution/);
    assert.deepEqual(s,before,"rejected report partly changed recovery state");
  }
  for(const final of ["landed","failed","expired"] as const){
    const entries=await history(final),s=initialState();for(const e of entries)apply(s,e,policy);
    const before=structuredClone(s);
    assert.throws(()=>apply(s,report(entries),policy),/final/);assert.deepEqual(s,before);
  }
});
test("SNP-5/6/D22: state boundary rejects non-finite report times before mutation",async()=>{
  const entries=await history(),policy=createPolicy(WORKLOAD_POLICY).policy;
  for(const at of [NaN,Infinity,-Infinity]){
    const s=initialState();for(const e of entries)apply(s,e,policy);const before=structuredClone(s);
    assert.throws(()=>apply(s,{...report(entries),at},policy),/report/);assert.deepEqual(s,before);
  }
});
test("SNP-5/LIF-7/D22: unknown repeats preserve reservation, unsettled signing and unknown count",async()=>{
  const entries=await history(),policy=createPolicy(WORKLOAD_POLICY).policy,s=initialState();
  for(const e of entries)apply(s,e,policy);
  const admitted=structuredClone(s.reservations);
  const first=report(entries);apply(s,first,policy);
  assert.deepEqual(s.reservations,admitted,"the first unknown released its reservation");
  const held=structuredClone(s.reservations),repeat=report([...entries,first]);apply(s,repeat,policy);
  assert.deepEqual(s.reservations,held);assert.equal(s.sensor.unknownStreak,1);
  assert.equal(s.signing.get(entries[0]!.hash)?.settled,undefined);
  const final=report([...entries,first,repeat],{outcome:"expired"});apply(s,final,policy);
  assert.equal(s.sensor.unknownStreak,0);assert.equal(s.signing.get(entries[0]!.hash)?.settled,true);
  assert.equal(s.reservations.get(entries[0]!.hash)?.valueReleased,true);
  assert.equal(s.reservations.get(entries[0]!.hash)?.feesReleased,true);
});
test("SNP-5/D22: both attribution enums and finite fractional timestamps remain supported",async()=>{
  for(const source of ["caller","signer"]){
    const entries=await history(),all=[...entries,report(entries,{source,at:1000.5})];
    assert.equal((await replay(all,WORKLOAD_POLICY)).ok,true);
    assert.equal((await replayStream(async function*(){yield* all;},WORKLOAD_POLICY)).ok,true);
    const g=await createGuard({policy:WORKLOAD_POLICY,log:{entries:all,append(){},close(){}}});g.close();
  }
});
test("SNP-5/6/D22: retained request and signing facts cannot resurrect a pruned final reservation",async()=>{
  const entries=await history("expired"),g=await createGuard({policy:WORKLOAD_POLICY,log:{entries,append(e){entries.push(e);},close(){}}});
  try{
    g.check({message:Uint8Array.of(255),at:40_000});
    assert.throws(()=>g.report(entries[0]!.hash,"unknown"),/no allowed/);
    const s=initialState(),policy=createPolicy(WORKLOAD_POLICY).policy;for(const e of entries)apply(s,e,policy);
    assert.equal(s.reservations.size,0);assert.equal(s.signing.size,1);assert.equal(s.requests.size,1);
    const before=structuredClone(s);assert.throws(()=>apply(s,report(entries),policy),/reservation/);assert.deepEqual(s,before);
    await refuse([...entries,report(entries)]);
  }finally{g.close();}
});
test("SNP-5/POL-4/LIF-7/D22: late unresolved reports survive signed policy changes and expiry",async()=>{
  const operator=generateKeyPairSync("ed25519"),operatorKey=encodeBase58(Buffer.from(operator.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...WORKLOAD_POLICY,latch:{...WORKLOAD_POLICY.latch,releaseKey:operatorKey}},trust={operatorKey,guardId:policy.latch.guardId,cluster:policy.latch.cluster};
  function authorization(p:unknown,version:number){const issued="2026-10-08T00:00:00.000Z",text=preparePolicyText(p,version,issued);return {...trust,version,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};}
  const store=memoryStore(),g=await createGuard({policy,authorization:authorization(policy,1),log:store});
  const d=g.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n});g.report(d.hash,"unknown");g.close();
  const next={...policy,windowMs:1000},restored=await createGuard({policy:next,authorization:authorization(next,2),log:store});
  try{
    restored.check({message:Uint8Array.of(255),at:40_000,blockHeight:101n});
    assert.doesNotThrow(()=>restored.report(d.hash,"unknown"));assert.doesNotThrow(()=>restored.report(d.hash,"landed"));
    assert.equal((await replay(store.entries,undefined,sensorV1,trust)).ok,true);
    assert.equal((await replayStream(async function*(){yield* store.entries;},undefined,sensorV1,trust)).ok,true);
    const again=await createGuard({policy:next,authorization:authorization(next,2),log:store});again.close();
  }finally{restored.close();}
});
