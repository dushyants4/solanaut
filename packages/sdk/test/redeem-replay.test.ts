// SNP-5/6, LIF-2/7, D23: a recovered receipt obeys the live redemption contract.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {createGuard,replay,replayStream} from "../src/guard.ts";
import {seal,type Entry,type DecisionEntry,type RedeemEntry} from "../src/log.ts";
import {apply,initialState} from "../src/state.ts";
import {createPolicy} from "../src/policy.ts";
import {inspectRecord} from "../src/inspect.ts";
import {memoryStore} from "../src/record.ts";
import {sensorV1} from "../src/sensor.ts";
import {prepareCheckpointState} from "../src/checkpoint-state.ts";
import {preparePolicyText,type PolicyTrust} from "../src/signed-policy.ts";
import {encodeBase58} from "../src/base58.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";

const message=craftLegacy({header:[1,0,1],keys:[key(1),key(2),key(0)],instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
const caller={clientId:"receipt",id:"one"};
const endpoint=(entries:readonly Entry[])=>({seq:entries.length,head:entries.at(-1)?.hash??""});
async function history(mode:"pending"|"redeemed"|"denied"|"landed"|"failed"|"expired"="pending"):Promise<Entry[]> {
  const g=await createGuard({policy:WORKLOAD_POLICY});
  try{
    const d=g.check({message:mode==="denied"?Uint8Array.of(255):message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},caller);
    assert.equal(d.allow,mode!=="denied");
    if(mode==="redeemed")assert.equal(g.redeem(message,d.hash,10n).ok,true);
    else if(mode==="landed" || mode==="failed" || mode==="expired")g.report(d.hash,mode);
    return structuredClone([...g.entries()]);
  }finally{g.close();}
}
function redeem(entries:readonly Entry[],changes:Record<string,unknown>={}):RedeemEntry {
  return seal<RedeemEntry>({v:1,kind:"redeem",seq:entries.length,prev:entries.at(-1)?.hash??"",at:1000,
    decision:entries.find((entry):entry is DecisionEntry=>entry.kind==="decision")?.hash??"0".repeat(64),blockHeight:"10",...changes} as Omit<RedeemEntry,"hash">);
}
async function refuses(entries:Entry[],policy:unknown=WORKLOAD_POLICY,trust?:PolicyTrust):Promise<void> {
  const array=await replay(entries,policy,sensorV1,trust);
  assert.equal(array.ok,false,"array replay accepted an impossible redemption");assert.equal(array.divergence?.seq,entries.length-1);
  const streamed=await replayStream(async function*(){yield* entries;},policy,sensorV1,trust);
  assert.equal(streamed.ok,false,"stream replay accepted an impossible redemption");assert.equal(streamed.divergence?.seq,entries.length-1);
  let closed=0;
  await assert.rejects(createGuard({policy,log:{entries,append(){assert.fail("restore cannot append to invalid history");},close(){closed++;}}}),/receipt|redeem|redemption|reservation|outcome|policy|height|time/);
  assert.equal(closed,1,"failed restore must close its store");
  assert.throws(()=>inspectRecord(entries,policy,trust),/receipt|redeem|redemption|reservation|outcome|policy|height|time/);
}
async function accepts(entries:Entry[],policy:unknown=WORKLOAD_POLICY):Promise<void> {
  assert.equal((await replay(entries,policy)).ok,true);
  assert.equal((await replayStream(async function*(){yield* entries;},policy)).ok,true);
  assert.equal(inspectRecord(entries,policy).entries,entries.length);
  const g=await createGuard({policy,log:{entries,append(){},close(){}}});g.close();
}
test("SNP-5/6/LIF-2/D23: inclusive expiry and canonical negative bigint heights preserve live receipt semantics",async()=>{
  for(const height of [100n,-1n]){
    const g=await createGuard({policy:WORKLOAD_POLICY});
    try{
      const d=g.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},caller);assert.equal(d.allow,true);
      if(height<0n)g.report(d.hash,"unknown");
      assert.equal(g.redeem(message,d.hash,height).ok,true);
      assert.equal((g.entries().at(-1) as RedeemEntry).blockHeight,height.toString());
      await accepts(structuredClone([...g.entries()]));
      const s=initialState(),policy=createPolicy(WORKLOAD_POLICY).policy;for(const entry of g.entries())apply(s,entry,policy);
      assert.equal(s.redeemed.has(d.hash),true);assert.equal(s.signing.get(d.hash)?.redeemed,true);
    }finally{g.close();}
  }
});
test("SNP-5/6/LIF-2/D23: a receipt without expiry accepts its recorded null height",async()=>{
  const g=await createGuard({policy:WORKLOAD_POLICY});
  try{
    const d=g.check({message,at:1000},caller);assert.equal(d.allow,true);assert.equal(d.expires,undefined);
    assert.equal(g.redeem(message,d.hash).ok,true);assert.equal((g.entries().at(-1) as RedeemEntry).blockHeight,null);
    await accepts(structuredClone([...g.entries()]));
  }finally{g.close();}
});
test("SNP-5/6/D23: legitimate unsigned redeemed history reopens under a changed advisory policy",async()=>{
  const store=memoryStore(),g=await createGuard({policy:WORKLOAD_POLICY,log:store});
  const d=g.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},caller);assert.equal(d.allow,true);
  assert.equal(g.redeem(message,d.hash,10n).ok,true);g.close();
  const changed={...structuredClone(WORKLOAD_POLICY),windowMs:WORKLOAD_POLICY.windowMs+1000};
  await accepts(structuredClone(store.entries),changed);
  const restored=await createGuard({policy:changed,log:store});
  try{assert.equal(restored.redeem(message,d.hash,10n).ok,false);}
  finally{restored.close();}
});
test("SNP-5/6/LIF-2/D23: absent and denied decisions cannot mint recovered receipts",async()=>{
  await refuses([redeem([])]);
  const entries=await history("denied");await refuses([...entries,redeem(entries)]);
});
test("SNP-5/6/LIF-2/D23: a resealed duplicate redemption is refused",async()=>{
  const entries=await history("redeemed");await refuses([...entries,redeem(entries)]);
});
for(const final of ["landed","failed","expired"] as const)
  test(`SNP-5/6/LIF-7/D23: final ${final} evidence forbids recovered redemption`,async()=>{
    const entries=await history(final);await refuses([...entries,redeem(entries)]);
  });
test("SNP-5/6/LIF-2/D23: receipt height above its admitted expiry refuses recovery",async()=>{
  const entries=await history();await refuses([...entries,redeem(entries,{blockHeight:"101"})]);
});
test("SNP-5/6/LIF-2/D23: expiring receipts require recorded height evidence",async()=>{
  const entries=await history();await refuses([...entries,redeem(entries,{blockHeight:null})]);
});
test("SNP-5/6/LIF-2/D23: malformed and noncanonical recorded bigint heights refuse recovery",async()=>{
  const entries=await history();
  for(const blockHeight of ["x",1,"01","+1","-0"," 1","1.0","0x1","",true])await refuses([...entries,redeem(entries,{blockHeight})]);
});
test("SNP-5/6/D23: invalid redemption timestamps refuse recovery",async()=>{
  const entries=await history();for(const at of [-1,null,"1000"])await refuses([...entries,redeem(entries,{at})]);
});
test("SNP-5/6/LIF-2/7/D23: rejected redemption leaves the complete state unchanged",async()=>{
  const policy=createPolicy(WORKLOAD_POLICY).policy;
  const cases:readonly [Entry[],Record<string,unknown>][]=[
    [[],{}],[await history("denied"),{}],[await history("redeemed"),{}],
    [await history("landed"),{}],[await history("failed"),{}],[await history("expired"),{}],
    [await history(),{blockHeight:"101"}],[await history(),{blockHeight:null}],
    [await history(),{blockHeight:"01"}],[await history(),{at:-1}],
  ];
  for(const [entries,changes] of cases){
    const s=initialState();for(const entry of entries)apply(s,entry,policy);const before=structuredClone(s);
    assert.throws(()=>apply(s,redeem(entries,changes),policy),/receipt|redeem|redemption|reservation|outcome|height|time/);
    assert.deepEqual(s,before,"rejected redemption partly changed state");
  }
  for(const at of [NaN,Infinity,-Infinity]){
    const entries=await history(),s=initialState();for(const entry of entries)apply(s,entry,policy);const before=structuredClone(s);
    assert.throws(()=>apply(s,{...redeem(entries),at},policy),/time|redeem|redemption/);assert.deepEqual(s,before);
  }
});
async function signedHistory(oldRedeemed:boolean){
  const operator=generateKeyPairSync("ed25519"),operatorKey=encodeBase58(Buffer.from(operator.publicKey.export({format:"jwk"}).x!,"base64url"));
  const first={...structuredClone(WORKLOAD_POLICY),latch:{...WORKLOAD_POLICY.latch,releaseKey:operatorKey}},trust={operatorKey,guardId:first.latch.guardId,cluster:first.latch.cluster};
  const authorization=(policy:unknown,version:number)=>{const issued="2026-10-08T00:00:00.000Z",text=preparePolicyText(policy,version,issued);return {...trust,issued,version,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};};
  const store=memoryStore(),g=await createGuard({policy:first,authorization:authorization(first,1),log:store});
  const d=g.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},caller);assert.equal(d.allow,true);
  if(oldRedeemed)assert.equal(g.redeem(message,d.hash,10n).ok,true);g.close();
  const next={...first,windowMs:first.windowMs+1000},current=await createGuard({policy:next,authorization:authorization(next,2),log:store});
  return {entries:structuredClone(store.entries),first,next,trust,authorization,current,decision:d};
}
test("SNP-5/6/POL-4/LIF-2/D23: chronological signed policy rejects a forged prior-policy redemption",async()=>{
  const x=await signedHistory(false);
  try{
    assert.equal(x.current.redeem(message,x.decision.hash,10n).ok,false);
    const entries=[...x.entries,redeem(x.entries)];
    const array=await replay(entries,undefined,sensorV1,x.trust);assert.equal(array.ok,false,"signed array replay ignored the receipt policy");
    assert.equal(array.divergence?.seq,entries.length-1);
    assert.equal((await replayStream(async function*(){yield* entries;},undefined,sensorV1,x.trust)).ok,false);
    assert.throws(()=>inspectRecord(entries,x.next,x.trust),/policy|receipt|redeem|redemption/);
    let closed=0;
    await assert.rejects(createGuard({policy:x.next,authorization:x.authorization(x.next,2),log:{entries,append(){assert.fail("invalid signed restore cannot append");},close(){closed++;}}}),/policy|receipt|redeem|redemption/);
    assert.equal(closed,1);
    await assert.rejects(prepareCheckpointState(entries,undefined,endpoint(entries),x.trust),{name:"CheckpointStateError",code:"checkpoint-state"});
    const s=initialState();let policy=createPolicy(x.first).policy,hash:string|undefined;
    for(const entry of x.entries){if(entry.kind==="policy"){const selected=createPolicy(JSON.parse(entry.policy));policy=selected.policy;hash=selected.hash;}Reflect.apply(apply,undefined,[s,entry,policy,hash]);}
    const before=structuredClone(s);
    assert.throws(()=>Reflect.apply(apply,undefined,[s,entries.at(-1)!,policy,hash]),/policy|receipt|redeem|redemption/);
    assert.deepEqual(s,before,"rejected signed receipt partly changed state");
  }finally{x.current.close();}
});
test("SNP-5/6/POL-4/LIF-2/D23: signed redemption before a later policy change remains valid history",async()=>{
  const x=await signedHistory(true);
  try{
    assert.equal((await replay(x.entries,undefined,sensorV1,x.trust)).ok,true);
    assert.equal((await replayStream(async function*(){yield* x.entries;},undefined,sensorV1,x.trust)).ok,true);
    assert.equal(inspectRecord(x.entries,x.next,x.trust).entries,x.entries.length);
    const restored=await createGuard({policy:x.next,authorization:x.authorization(x.next,2),log:{entries:x.entries,append(){},close(){}}});restored.close();
    const prepared=await prepareCheckpointState(x.entries,undefined,endpoint(x.entries),x.trust),state=JSON.parse(prepared.text);
    assert.equal(state.policy.version,2);assert.ok(state.state.redeemed.includes(x.decision.hash));
  }finally{x.current.close();}
});
test("SNP-5/6/LIF-7/D23: retained request and signing facts cannot redeem a pruned final reservation",async()=>{
  const entries=await history("expired"),g=await createGuard({policy:WORKLOAD_POLICY,log:{entries,append(entry){entries.push(entry);},close(){}}});
  try{
    g.check({message:Uint8Array.of(255),at:40_000});
    const policy=createPolicy(WORKLOAD_POLICY).policy,s=initialState();for(const entry of entries)apply(s,entry,policy);
    assert.equal(s.allowed.size,0);assert.equal(s.reservations.size,0);assert.equal(s.signing.size,1);assert.equal(s.requests.size,1);
    const before=structuredClone(s);assert.throws(()=>apply(s,redeem(entries),policy),/receipt|redeem|redemption|reservation/);assert.deepEqual(s,before);
    await refuses([...entries,redeem(entries)]);
  }finally{g.close();}
});
