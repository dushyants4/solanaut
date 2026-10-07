// SNP-5/6: validated checkpoint plus tail, or verified full replay; never empty recovery.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Governor} from "@gubernaut/core";
import * as recovery from "../src/checkpoint-recovery.ts";
import {createGuard} from "../src/guard.ts";
import {memoryStore} from "../src/record.ts";
import {encodeBase58} from "../src/base58.ts";
import {canonicalJSON,sha256hex} from "../src/canonical.ts";
import {seal,type Entry,type DecisionEntry} from "../src/log.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {prepareCheckpointBundle} from "../src/checkpoint-bundle.ts";
import {prepareCheckpointState} from "../src/checkpoint-state.ts";
import {prepareCheckpointEnvelope} from "../src/checkpoint-envelope.ts";
import {prepareCheckpointText,prepareCheckpointPrefixText} from "../src/checkpoint.ts";
import {verifyArchive} from "../src/archive.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";
const end=(entries:readonly Entry[])=>({seq:entries.length,head:entries.at(-1)?.hash??""});
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),"solanaut-recovery-")),pair=()=>generateKeyPairSync("ed25519"),operator=pair(),agent=pair(),checkpoint=pair(),anchor=pair();
  const address=(p:typeof operator)=>encodeBase58(Buffer.from(p.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...structuredClone(WORKLOAD_POLICY),principal:[address(agent)],latch:{...WORKLOAD_POLICY.latch,releaseKey:address(operator)}};
  const policyTrust={operatorKey:address(operator),guardId:policy.latch.guardId,cluster:policy.latch.cluster},issued="2026-10-07T00:00:00.000Z";
  const authorization=(p:unknown,version:number)=>{const text=preparePolicyText(p,version,issued);return {...policyTrust,version,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};};
  const store=memoryStore(),guard=await createGuard({policy,authorization:authorization(policy,1),log:store});
  const message=craftLegacy({header:[1,0,1],keys:[[...Buffer.from(agent.publicKey.export({format:"jwk"}).x!,"base64url")],key(2),key(0)],blockhash:key(20),instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
  const decision=guard.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},{clientId:"client",id:"payment"});assert.ok(decision.allow);assert.ok(guard.redeem(message,decision.hash,10n).ok);
  const sig=sign(null,message,agent.privateKey),signature=encodeBase58(sig);
  guard.recordSigning({stage:"signed",decision:decision.hash,wire:Buffer.concat([Buffer.from([1]),sig,message]).toString("base64"),signature});
  guard.recordSigning({stage:"send-started",decision:decision.hash,blockHeight:"11"});guard.recordSigning({stage:"response",decision:decision.hash,status:"uncertain",signature});
  for(let i=0;i<4;i++)guard.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n});
  const checkpointTrust={checkpointKey:address(checkpoint),anchorKey:address(anchor),principalKeys:policy.principal,guardId:policy.latch.guardId,cluster:"localnet" as const},context=end(store.entries),archive=join(directory,"prefix.jsonl");
  writeFileSync(archive,store.entries.map(entry=>canonicalJSON(entry)+"\n").join(""),{mode:0o400});
  const receipt=await verifyArchive(archive),bundle=await prepareCheckpointBundle(store.entries,undefined,[receipt],context,policyTrust,checkpointTrust);
  const encode=(body:{binding:typeof bundle.binding;archives:string;state:string;prefix:string})=>prepareCheckpointEnvelope({binding:body.binding,archives:body.archives,state:body.state,prefix:body.prefix,signatures:{snapshot:sign(null,Buffer.from(prepareCheckpointText(body.binding)),checkpoint.privateKey).toString("base64"),prefix:sign(null,Buffer.from(prepareCheckpointPrefixText(body.binding)),checkpoint.privateKey).toString("base64")}},checkpointTrust,1000000).text;
  const text=encode(bundle),options={checkpointTrust,policyTrust,archives:[archive],maxBytes:1000000};
  for(let i=0;i<3;i++)guard.check({message:new Uint8Array([255]),at:1001+i});assert.ok(guard.status().latched);
  const release=guard.releaseText("2026-10-07T00:00:00.000Z");assert.ok(guard.release(release,new Uint8Array(sign(null,Buffer.from(release),operator.privateKey)),1004).released);
  const request=guard.beginRequest({clientId:"client",id:"status"},"status",{},1005);guard.finishRequest(request.hash,{ready:true});guard.close();
  const next={...policy,sol:{...policy.sol,maxPerTx:2_000_000_000n}},updated=await createGuard({policy:next,authorization:authorization(next,2),log:store});updated.check({message:new Uint8Array([255]),at:1006});
  const nextMessage=message.slice();nextMessage.set(key(21),100);const tailDecision=updated.check({message:nextMessage,at:1007,blockHeight:12n,lastValidBlockHeight:110n});assert.notEqual(tailDecision.telemetry,null);
  updated.check({message:new Uint8Array([255]),at:1008});assert.ok(updated.status().latched);updated.close();
  return {directory,store,options,text,bundle,encode,context,decision,close(){rmSync(directory,{recursive:true,force:true});}};
}
const prepare=(history:unknown,text:unknown,options:unknown):Promise<{mode:string;reason:string|null;checkpointSeq:number|null;state:string;controller:Governor;seq:number;head:string}>=>Reflect.apply(Reflect.get(recovery,"prepareCheckpointRecovery"),undefined,[history,text,options]);
const refused=(work:()=>Promise<unknown>)=>assert.rejects(Promise.resolve().then(work),{name:"CheckpointRecoveryError",code:"checkpoint-recovery"});
test("SNP-5: checkpoint prefix plus mixed tail equals full-state and next-controller replay",async()=>{
  const f=await fixture();try{const got=await prepare(f.store.entries,f.text,f.options),context=end(f.store.entries),state=await prepareCheckpointState(f.store.entries,undefined,context,f.options.policyTrust),reference=await Governor.create();
    for(const entry of f.store.entries){if(entry.kind==="release")reference.reset();else if(entry.kind==="decision"&&entry.telemetry!==null&&entry.posture!==null)reference.tick(entry.telemetry);}
    assert.equal(got.mode,"checkpoint");assert.equal(got.reason,null);assert.equal(got.checkpointSeq,f.context.seq);assert.equal(got.state,state.text);assert.deepEqual({seq:got.seq,head:got.head},context);assert.ok(Object.isFrozen(got));
    for(const telemetry of [{intensity:1,valence:-1,repetition:1},{intensity:0,valence:0,repetition:0}])assert.deepEqual(got.controller.tick(telemetry),reference.tick(telemetry));
    const facts=JSON.parse(got.state);assert.equal(facts.policy.version,2);assert.equal(facts.state.signing[0][1].response.status,"uncertain");assert.equal(facts.state.reservations[0][1].sol,"1");assert.equal(facts.state.responses.length,1);assert.notEqual(facts.state.latched,null);
  }finally{f.close();}
});
test("SNP-6: missing or corrupt checkpoints fall back to verified history with unresolved facts",async()=>{
  const f=await fixture();try{for(const text of [undefined,"corrupt",f.text+" "]){const got=await prepare(f.store.entries,text,f.options);assert.equal(got.mode,"full-replay");assert.equal(got.reason,text===undefined?"missing-checkpoint":"invalid-checkpoint");assert.equal(got.checkpointSeq,null);const state=JSON.parse(got.state);assert.equal(state.state.reservations[0][1].sol,"1");assert.equal(state.state.signing[0][1].started.stage,"send-started");}}finally{f.close();}
});
test("SNP-6: correctly signed dishonest checkpoint state falls back rather than loading it",async()=>{
  const f=await fixture();try{const changed=JSON.parse(f.bundle.state);changed.state.consecutiveDenials=99;const state=canonicalJSON(changed)+"\n";assert.notEqual(state,f.bundle.state);const text=f.encode({...f.bundle,state,binding:{...f.bundle.binding,stateDigest:sha256hex(state)}});
    const got=await prepare(f.store.entries,text,f.options);assert.equal(got.mode,"full-replay");assert.notEqual(JSON.parse(got.state).state.consecutiveDenials,99);
  }finally{f.close();}
});
test("SNP-6: a valid checkpoint cannot hide invalid, foreign or missing full history",async()=>{
  const f=await fixture();try{const entries=[...f.store.entries],last=entries.at(-1)! as DecisionEntry,{hash,...body}=last;entries[entries.length-1]=seal<DecisionEntry>({...body,posture:"DEFAULT",telemetry:{intensity:1,valence:1,repetition:1},temperatureMax:0});
    for(const history of [entries,[],f.store.entries.slice(1)])await refused(()=>prepare(history,f.text,f.options));
    await refused(()=>prepare(f.store.entries,undefined,{...f.options,policyTrust:{...f.options.policyTrust,guardId:"foreign"}}));
  }finally{f.close();}
});
test("SNP-6: external anchor disagreement or missing anchored history cannot be bypassed by fallback",async()=>{
  const f=await fixture();try{const last=f.store.entries.at(-1)!,options={...f.options,expectedAnchor:{seq:last.seq,head:last.hash}};
    assert.equal((await prepare(f.store.entries,f.text,options)).mode,"checkpoint");assert.equal((await prepare(f.store.entries,"corrupt",options)).mode,"full-replay");
    for(const text of [f.text,"corrupt",undefined]){await refused(()=>prepare(f.store.entries.slice(0,-1),text,options));await refused(()=>prepare(f.store.entries,text,{...options,expectedAnchor:{seq:last.seq,head:"0".repeat(64)}}));}
  }finally{f.close();}
});
test("SNP-6: missing archives allow only verified full history; invalid authority configuration refuses",async()=>{
  const f=await fixture();try{const got=await prepare(f.store.entries,f.text,{...f.options,archives:[join(f.directory,"missing.jsonl")]});assert.equal(got.mode,"full-replay");assert.equal(got.reason,"invalid-checkpoint");
    const principalKeys=[...f.options.checkpointTrust.principalKeys];principalKeys.length++;
    for(const options of [{...f.options,maxBytes:0},{...f.options,extra:true},{...f.options,checkpointTrust:{...f.options.checkpointTrust,principalKeys}},{...f.options,checkpointTrust:{...f.options.checkpointTrust,guardId:"foreign"}},{...f.options,checkpointTrust:{...f.options.checkpointTrust,checkpointKey:f.options.checkpointTrust.anchorKey}}])await refused(()=>prepare(f.store.entries,undefined,options));
    const badArchives=Object.assign(Array(1),{named:f.options.archives[0]}),badPrincipals=[...f.options.checkpointTrust.principalKeys];badPrincipals.length++;Object.assign(badPrincipals,{named:f.options.checkpointTrust.principalKeys[0]});
    for(const options of [null,[],{...f.options,maxBytes:1.5},{...f.options,archives:null},{...f.options,archives:[""]},{...f.options,archives:badArchives},
      ...[null,[],{...f.options.checkpointTrust,extra:true},{...f.options.checkpointTrust,checkpointKey:"invalid"},{...f.options.checkpointTrust,anchorKey:"invalid"},{...f.options.checkpointTrust,principalKeys:null},{...f.options.checkpointTrust,principalKeys:[]},{...f.options.checkpointTrust,principalKeys:["invalid"]},{...f.options.checkpointTrust,principalKeys:badPrincipals},{...f.options.checkpointTrust,principalKeys:[f.options.checkpointTrust.checkpointKey]},{...f.options.checkpointTrust,principalKeys:[f.options.checkpointTrust.anchorKey]},{...f.options.checkpointTrust,cluster:"devnet"}].map(checkpointTrust=>({...f.options,checkpointTrust})),
      ...[null,[],{seq:0,head:"x"},{seq:-1,head:"0".repeat(64)},{seq:0.5,head:"0".repeat(64)},{seq:0,head:4},{seq:0,head:"0".repeat(64),extra:true}].map(expectedAnchor=>({...f.options,expectedAnchor}))])await refused(()=>prepare(f.store.entries,undefined,options));
  }finally{f.close();}
});
test("SNP-5/6: recovery captures caller history and external pins before asynchronous verification",async()=>{
  const f=await fixture();try{const context=end(f.store.entries),work=prepare(f.store.entries,f.text,f.options);f.store.entries.splice(0);f.options.policyTrust.guardId="foreign";f.options.archives.splice(0);
    const got=await work;assert.equal(got.mode,"checkpoint");assert.deepEqual({seq:got.seq,head:got.head},context);
  }finally{f.close();}
});
test("SNP-5: divergent fresh-controller tail refuses recovery after full history validates",async()=>{
  const f=await fixture(),original=Governor.create;let calls=0;
  try{const prefixEvents=JSON.parse(f.bundle.prefix).events.length;
    Governor.create=async()=>{const controller=await Reflect.apply(original,Governor,[]);calls++;
      if(calls===5){const tick=controller.tick.bind(controller);let ticks=0;controller.tick=telemetry=>{const result=tick(telemetry);ticks++;return ticks>prefixEvents?{...result,posture:result.posture==="DEFAULT"?"REGROUND":"DEFAULT"}:result;};}
      return controller;};
    await refused(()=>prepare(f.store.entries,f.text,f.options));assert.equal(calls,5);
  }finally{Governor.create=original;f.close();}
});
