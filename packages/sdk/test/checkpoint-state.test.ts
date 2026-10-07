// SNP-3/5: preserve admission and request lifecycle facts; never load controller state.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { prepareCheckpointState } from "../src/checkpoint-state.ts";
import { createGuard } from "../src/guard.ts";
import { encodeBase58 } from "../src/base58.ts";
import { canonicalJSON, sha256hex } from "../src/canonical.ts";
import { EVALUATION_PROFILE } from "../src/profile.ts";
import { memoryStore } from "../src/record.ts";
import { preparePolicyText } from "../src/signed-policy.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";
import { seal, type Entry, type DecisionEntry } from "../src/log.ts";
const endpoint=(entries:readonly Entry[])=>({seq:entries.length,head:entries.at(-1)?.hash??""});
async function setup(){
  const operator=generateKeyPairSync("ed25519"),agent=generateKeyPairSync("ed25519");
  const address=(pair:typeof operator)=>encodeBase58(Buffer.from(pair.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...structuredClone(WORKLOAD_POLICY),principal:[address(agent)],latch:{...WORKLOAD_POLICY.latch,releaseKey:address(operator)}};
  const trust={operatorKey:address(operator),guardId:policy.latch.guardId,cluster:policy.latch.cluster},issued="2026-10-07T00:00:00.000Z";
  const authorization=(p:unknown,version:number)=>{const text=preparePolicyText(p,version,issued);return {...trust,version,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};};
  const store=memoryStore(),guard=await createGuard({policy,authorization:authorization(policy,1),log:store});
  const message=(to=2,seed=20)=>craftLegacy({header:[1,0,1],keys:[[...Buffer.from(agent.publicKey.export({format:"jwk"}).x!,"base64url")],key(to),key(0)],blockhash:key(seed),instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
  return {guard,store,policy,trust,authorization,operator,agent,message,issued};
}
const refused=(work:Promise<unknown>)=>assert.rejects(work,{name:"CheckpointStateError",code:"checkpoint-state"});
test("SNP-3/5: signed initial state carries policy, endpoint and every state field",async()=>{
  const x=await setup();try{
    const got=await prepareCheckpointState(x.store.entries,undefined,endpoint(x.store.entries),x.trust),p=JSON.parse(got.text);
    assert.equal(p.kind,"solanaut-checkpoint-admission-state");assert.equal(p.format,1);assert.equal(p.guardId,x.policy.latch.guardId);assert.equal(p.cluster,x.policy.latch.cluster);
    assert.deepEqual(p.profile,EVALUATION_PROFILE);
    assert.deepEqual(Object.keys(p).sort(),["format","kind","profile","guardId","cluster","policy","state","previousDecision"].sort());
    assert.equal(p.policy.version,1);assert.equal(p.policy.entry.hash,x.store.entries[0]!.hash);assert.equal(p.policy.hash,x.guard.policyHash);
    assert.equal(p.policy.canonical,p.policy.entry.policy);
    assert.equal(p.previousDecision,null);assert.equal(p.state.seq,1);assert.equal(p.state.head,x.store.entries[0]!.hash);
    assert.deepEqual(Object.keys(p.state).sort(),["signing","requests","responses","retentionMs","seq","head","maxAt","consecutiveDenials","latched","allowed","reservations","intents","redeemed","sensor"].sort());
    for(const field of ["signing","requests","responses","allowed","reservations","intents","redeemed"])assert.deepEqual(p.state[field],[]);
    assert.equal(got.text,canonicalJSON(p)+"\n");assert.equal(got.digest,sha256hex(got.text));assert.ok(Object.isFrozen(got));
  }finally{x.guard.close();}
});
test("SNP-3/5: unresolved send, reservation, redemption and latch remain in the payload",async()=>{
  const x=await setup();try{
    const message=x.message(),d=x.guard.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},{clientId:"client",id:"payment"});assert.ok(d.allow);
    assert.ok(x.guard.redeem(message,d.hash,10n).ok);
    const sig=sign(null,message,x.agent.privateKey),signature=encodeBase58(sig),record=(event:object)=>(x.guard as unknown as {recordSigning(event:object):void}).recordSigning(event);
    record({stage:"signed",decision:d.hash,wire:Buffer.concat([Buffer.from([1]),sig,message]).toString("base64"),signature});
    record({stage:"send-started",decision:d.hash,blockHeight:"11"});record({stage:"response",decision:d.hash,status:"uncertain",signature});x.guard.report(d.hash,"unknown");
    for(let i=0;i<3;i++)x.guard.check({message:x.message(3,30+i),at:2000+i},{clientId:"client",id:"deny"+i});
    const p=JSON.parse((await prepareCheckpointState(x.store.entries,undefined,endpoint(x.store.entries),x.trust)).text),state=p.state;
    assert.ok(state.latched);assert.equal(state.consecutiveDenials,3);assert.equal(state.signing.length,4);assert.equal(state.requests.length,4);
    const signing=state.signing.find(([hash]:[string])=>hash===d.hash)[1];assert.equal(signing.started.stage,"send-started");assert.equal(signing.response.status,"uncertain");assert.equal(signing.redeemed,true);
    assert.ok(state.redeemed.includes(d.hash));assert.equal(state.reservations[0][0],d.hash);assert.equal(state.reservations[0][1].sol,"1");assert.equal(state.reservations[0][1].valueReleased,false);assert.deepEqual(state.reservations[0][1].tokens,[]);
    assert.equal(state.intents[0][1].attempts[0].status,"unknown");assert.equal(state.intents[0][1].attempts[0].lastValidBlockHeight,"100");
    assert.equal(p.previousDecision.hash,x.store.entries.at(-1)!.hash);assert.ok(state.sensor.recent.length>0);
    assert.equal(typeof state.sensor.recent[0].fees,"string");
  }finally{x.guard.close();}
});
test("SNP-3/5: release resets sensor/latch without erasing pending admission or predecessor",async()=>{
  const x=await setup();try{
    x.guard.check({message:x.message(),at:1000,blockHeight:10n,lastValidBlockHeight:100n});
    for(let i=0;i<3;i++)x.guard.check({message:x.message(3,30+i),at:2000+i});
    const previous=x.store.entries.at(-1)!,at=Date.parse(x.issued)+1000,text=x.guard.releaseText(new Date(at+60_000).toISOString());
    assert.ok(x.guard.release(text,new Uint8Array(sign(null,Buffer.from(text),x.operator.privateKey)),at).released);
    const p=JSON.parse((await prepareCheckpointState(x.store.entries,undefined,endpoint(x.store.entries),x.trust)).text);
    assert.equal(p.state.latched,null);assert.equal(p.state.consecutiveDenials,0);assert.deepEqual(p.state.sensor.recent,[]);assert.equal(p.previousDecision.hash,previous.hash);assert.equal(p.state.reservations.length,1);
  }finally{x.guard.close();}
});
test("SNP-3/5: signed policy changes retain current version and maximum history window",async()=>{
  const x=await setup();x.guard.close();const larger={...x.policy,windowMs:60_000};
  const expanded=await createGuard({policy:larger,authorization:x.authorization(larger,2),log:x.store});expanded.close();
  const next={...x.policy,windowMs:1000},g=await createGuard({policy:next,authorization:x.authorization(next,3),log:x.store});try{
    const p=JSON.parse((await prepareCheckpointState(x.store.entries,undefined,endpoint(x.store.entries),x.trust)).text);
    assert.equal(p.policy.version,3);assert.equal(p.policy.hash,g.policyHash);assert.equal(p.policy.entry.hash,x.store.entries.at(-1)!.hash);assert.equal(p.state.retentionMs,larger.windowMs);
  }finally{g.close();}
});
test("SNP-3/5: missing trust, unsupported history and asynchronous caller changes cannot alter state",async()=>{
  const x=await setup();try{
    await refused(prepareCheckpointState(x.store.entries,undefined,endpoint(x.store.entries)));
    await refused(prepareCheckpointState([],WORKLOAD_POLICY,{seq:0,head:""}));
    await refused(prepareCheckpointState(x.store.entries,undefined,{seq:0,head:""},x.trust));
    const d=x.guard.check({message:x.message(),at:1000}),{hash,...body}=d,changed=seal<DecisionEntry>({...body,telemetry:{intensity:1,valence:-1,repetition:1}});
    await refused(prepareCheckpointState([x.store.entries[0]!,changed],undefined,endpoint([x.store.entries[0]!,changed]),x.trust));
    const entries=[...x.store.entries],context=endpoint(entries),trust={...x.trust},expected=await prepareCheckpointState(entries,x.policy,context,trust);
    const pending=prepareCheckpointState(entries,x.policy,context,trust);entries.length=0;context.seq=0;context.head="";trust.guardId="foreign";x.policy.sol.maxPerTx=0n;x.policy.windowMs=80_000;assert.deepEqual(await pending,expected);
    assert.equal(WORKLOAD_POLICY.sol.maxPerTx,1_000_000_000n);
  }finally{x.guard.close();}
});
test("SNP-3/5: pending control identities and completed answers remain distinct",async()=>{
  const x=await setup();try{
    const control=x.guard as typeof x.guard & {beginRequest(id:{clientId:string;id:string},method:"status"|"report",payload:unknown,at:number):Entry;finishRequest(hash:string,result:unknown):Entry};
    const pending=control.beginRequest({clientId:"client",id:"pending"},"report",{decision:"a".repeat(64)},1000);
    const done=control.beginRequest({clientId:"client",id:"done"},"status",{},1001);const response=control.finishRequest(done.hash,{ready:true});
    const p=JSON.parse((await prepareCheckpointState(x.store.entries,undefined,endpoint(x.store.entries),x.trust)).text);
    assert.equal(p.state.requests.length,2);assert.ok(p.state.requests.some(([,e]:[string,Entry])=>e.hash===pending.hash));
    assert.deepEqual(p.state.responses,[[done.hash,response]]);assert.equal(p.previousDecision,null);
  }finally{x.guard.close();}
});
