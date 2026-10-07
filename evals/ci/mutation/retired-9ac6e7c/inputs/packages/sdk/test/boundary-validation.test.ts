// Security input boundaries identified by AST coverage, not changes to rule definitions.
import { strict as assert } from "node:assert";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { canonicalJSON } from "../src/canonical.ts";
import { parseReleaseText, releaseText, verifyEd25519 } from "../src/latch.ts";
import { encodeBase58 } from "../src/base58.ts";
import { bindRequest, verifyRequest } from "../src/request.ts";
import { controlPayload, verifyControlStart, verifyControlResponse } from "../src/control-request.ts";
import { createGuard, replay } from "../src/guard.ts";
import { memoryStore } from "../src/record.ts";
import { verifySigning } from "../src/signing.ts";
import { classifyInstruction, PROGRAMS } from "../src/classify.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";
const message=craftLegacy({header:[1,0,1],keys:[key(1),key(2),key(0)],instructions:[]});
test("LAT/POL-2: malformed release text and public signature inputs cannot authenticate",()=> {
  assert.equal(parseReleaseText(7 as never),null);
  const text=releaseText({guardId:"fixture",cluster:"devnet",policyHash:"a".repeat(64),seq:0,expires:"2026-10-06T00:00:00.000Z"});
  assert.equal(parseReleaseText({toString:()=>text} as never),null);
  assert.equal(parseReleaseText({toString:()=>{throw new Error("coercion must not run");}} as never),null);
  const pair=generateKeyPairSync("ed25519"), publicKey=encodeBase58(Buffer.from(pair.publicKey.export({format:"jwk"}).x!,"base64url"));
  const bytes=Uint8Array.of(1,2), signature=sign(null,bytes,pair.privateKey);
  assert.equal(verifyEd25519(publicKey,bytes,signature),true);
  assert.equal(verifyEd25519("not-base58!",bytes,signature),false);
  assert.equal(verifyEd25519(publicKey,bytes,"not-bytes" as never),false);
  assert.equal(verifyEd25519(publicKey,bytes,new Uint8Array(63)),false);
});
test("LIF-1/4: unsupported canonical values and malformed payload types refuse binding",()=> {
  for(const value of [new Uint8Array([1]),undefined,()=>{},Symbol("fixture")]) assert.throws(()=>canonicalJSON(value),/canonical/);
  for(const payload of [null,[],"text",7]) assert.throws(()=>controlPayload("status",payload),/payload/);
  assert.throws(()=>bindRequest("guard",{clientId:"agent",id:"one"},"text" as never),/payload/);
  assert.throws(()=>bindRequest("guard",{clientId:"agent",id:"one"},message,7 as never),/payload/);
  assert.doesNotThrow(()=>verifyRequest({request:undefined} as never,"guard"));
});
test("LIF-4: malformed recorded request/response time and noncanonical content cannot restore",async()=> {
  const g=await createGuard({policy:WORKLOAD_POLICY});
  try {
    const start=g.beginRequest({clientId:"agent",id:"one"},"status",{},1000);
    const end=g.finishRequest(start.hash,{ready:true});
    assert.equal(start.kind,"request"); assert.equal(end.kind,"response");
    if(start.kind!=="request" || end.kind!=="response") throw new Error("fixture kind");
    const requests=new Map([["fixture",start]]);
    for(const at of [-1,NaN]) {
      assert.throws(()=>verifyControlStart({...start,at},WORKLOAD_POLICY.latch.guardId,new Map()),/time/);
      assert.throws(()=>verifyControlResponse({...end,at},requests,new Map()),/response/);
    }
    assert.throws(()=>verifyControlStart({...start,payload:"{ }"},WORKLOAD_POLICY.latch.guardId,new Map()),/payload/);
    assert.throws(()=>verifyControlResponse({...end,result:'{ "ready": true }'},requests,new Map()),/response/);
  } finally {g.close();}
});
test("LIF-2: unknown requests, cross-policy signing and unsupported stages cannot journal",async()=> {
  const g=await createGuard({policy:WORKLOAD_POLICY});
  try {
    const d=g.check({message,at:1000,blockHeight:1n,lastValidBlockHeight:100n},{clientId:"agent",id:"one"});
    assert.equal(d.allow,true);
    const entry=g.entries().find(e=>e.kind==="decision"); assert.ok(entry && entry.kind==="decision");
    const history={decision:entry};
    assert.throws(()=>verifySigning({stage:"signed",decision:d.hash,wire:"",signature:""},undefined,true,d.policyHash),/no recorded/);
    assert.throws(()=>verifySigning({stage:"signed",decision:d.hash,wire:"",signature:""},history,true,"different"),/another policy/);
    assert.throws(()=>verifySigning({stage:"signed",decision:d.hash,wire:undefined,signature:""} as never,history,true,d.policyHash),/wire/);
    assert.throws(()=>verifySigning({stage:"unsupported",decision:d.hash} as never,history,true,d.policyHash),/stage/);
    assert.throws(()=>verifySigning({stage:"response",decision:d.hash,status:"unsupported"} as never,history,true,d.policyHash),/status/);
    assert.throws(()=>verifySigning({stage:"response",decision:d.hash,status:"denied"},history,true,d.policyHash),/denied/);
    assert.throws(()=>verifySigning({stage:"response",decision:d.hash,status:"sent"},history,true,d.policyHash),/send-started/);
    assert.equal(g.entries().length,1);
  } finally {g.close();}
});
test("SIG-8: corrupted decision hashes refuse restore and deterministically diverge in replay",async()=> {
  const store=memoryStore(), g=await createGuard({policy:WORKLOAD_POLICY,log:store});
  g.check({message,at:1000}); g.close();
  const entries=store.entries.map(e=>({...e,hash:"0".repeat(64)}));
  await assert.rejects(createGuard({policy:WORKLOAD_POLICY,log:{entries,append(){},close(){}}}),/hash|damaged/);
  const result=await replay(entries,WORKLOAD_POLICY); assert.equal(result.ok,false); assert.equal(result.divergence?.field,"hash");
});
test("T2/T15: empty token-program instruction data is denied under both programs",()=> {
  for(const program of [PROGRAMS.token,PROGRAMS.token2022]) assert.equal(classifyInstruction(program,new Uint8Array()).class,"denied");
});
