// SNP-3: one captured endpoint and history supply every signed payload.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { encodeBase58 } from "../src/base58.ts";
import { sha256hex } from "../src/canonical.ts";
import { createGuard } from "../src/guard.ts";
import { preparePolicyText } from "../src/signed-policy.ts";
import { verifyCheckpointBinding, prepareCheckpointText, prepareCheckpointPrefixText } from "../src/checkpoint.ts";
import * as bundle from "../src/checkpoint-bundle.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { seal } from "../src/log.ts";
async function fixture(){
  const pair=()=>{const key=generateKeyPairSync("ed25519");return {key,address:encodeBase58(Buffer.from(key.publicKey.export({format:"jwk"}).x!,"base64url"))};};
  const operator=pair(),checkpoint=pair(),anchor=pair();
  const policy={...structuredClone(WORKLOAD_POLICY),latch:{...WORKLOAD_POLICY.latch,releaseKey:operator.address}};
  const policyTrust={operatorKey:operator.address,guardId:policy.latch.guardId,cluster:policy.latch.cluster};
  const issued="2026-10-07T00:00:00.000Z",text=preparePolicyText(policy,1,issued);
  const guard=await createGuard({policy,authorization:{...policyTrust,version:1,issued,text,signature:sign(null,Buffer.from(text),operator.key.privateKey).toString("base64")}});
  guard.check({message:null as never,at:1000});const entries=[...guard.entries()];guard.close();
  const context={seq:entries.length,head:entries.at(-1)!.hash};
  const receipts=[{bytes:2000,entries:entries.length,firstSeq:0,nextSeq:context.seq,head:context.head,sha256:sha256hex("fixture archive metadata")}];
  const trust={checkpointKey:checkpoint.address,principalKeys:[...policy.principal],anchorKey:anchor.address,guardId:policy.latch.guardId,cluster:"localnet" as const};
  return {policy,policyTrust,checkpoint,trust,entries,context,receipts};
}
const prepare=(f:Awaited<ReturnType<typeof fixture>>)=>bundle.prepareCheckpointBundle(f.entries,undefined,f.receipts,f.context,f.policyTrust,f.trust);
const refused=(work:Promise<unknown>)=>assert.rejects(work,error=>error instanceof Error && error.name==="CheckpointBundleError" && Reflect.get(error,"code")==="checkpoint-bundle");
test("SNP-3: bundle binds all derived payload bytes and supplies both signing domains",async()=>{
  const f=await fixture(),got=await prepare(f);
  assert.deepEqual(Object.keys(got).sort(),["binding","archives","state","prefix","snapshotText","prefixText"].sort());
  const digests={archiveDigest:sha256hex(got.archives),stateDigest:sha256hex(got.state),prefixDigest:sha256hex(got.prefix)};
  assert.equal(got.binding.seq,f.context.seq);assert.equal(got.binding.head,f.context.head);assert.equal(got.binding.policyVersion,1);
  assert.equal(got.binding.policyHash,JSON.parse(got.state).policy.hash);
  assert.equal(got.snapshotText,prepareCheckpointText(got.binding));assert.equal(got.prefixText,prepareCheckpointPrefixText(got.binding));
  const signatures={snapshot:sign(null,Buffer.from(got.snapshotText),f.checkpoint.key.privateKey).toString("base64"),prefix:sign(null,Buffer.from(got.prefixText),f.checkpoint.key.privateKey).toString("base64")};
  assert.deepEqual(verifyCheckpointBinding(got.binding,signatures,f.trust,digests),got.binding);
  assert.ok(Object.isFrozen(got));assert.ok(Object.isFrozen(got.binding));assert.ok(Object.isFrozen(got.binding.profile));
});
test("SNP-3: bundle refuses missing or foreign policy and checkpoint pins",async()=>{
  const f=await fixture();
  for(const trust of [undefined,{...f.policyTrust,operatorKey:f.checkpoint.address},{...f.policyTrust,guardId:"foreign"}])await refused(bundle.prepareCheckpointBundle(f.entries,undefined,f.receipts,f.context,trust,f.trust));
  for(const trust of [null,{...f.trust,guardId:"foreign"},{...f.trust,cluster:"devnet"},{...f.trust,checkpointKey:f.policy.principal[0]},{...f.trust,checkpointKey:"bad"},{...f.trust,anchorKey:f.checkpoint.address},{...f.trust,anchorKey:"bad"},{...f.trust,principalKeys:[]},{...f.trust,principalKeys:[f.checkpoint.address]},{...f.trust,principalKeys:[f.trust.anchorKey]},{...f.trust,principalKeys:["bad"]},{...f.trust,principalKeys:null},{...f.trust,extra:true}])await refused(bundle.prepareCheckpointBundle(f.entries,undefined,f.receipts,f.context,f.policyTrust,trust));
});
test("SNP-3: bundle refuses stale history and incomplete archive catalogue",async()=>{
  const f=await fixture();
  for(const context of [{...f.context,seq:f.context.seq-1},{...f.context,head:"0".repeat(64)}])await refused(bundle.prepareCheckpointBundle(f.entries,undefined,f.receipts,context,f.policyTrust,f.trust));
  for(const receipts of [[],f.receipts.toReversed().concat(f.receipts),[{...f.receipts[0],head:"0".repeat(64)}]])await refused(bundle.prepareCheckpointBundle(f.entries,undefined,receipts,f.context,f.policyTrust,f.trust));
});
test("SNP-3: bundle rejects resealed dishonest history and unsigned state",async()=>{
  const f=await fixture(),first=f.entries[1]!,{hash,...body}=first;
  const forged=seal({...body,posture:"DEFAULT",telemetry:{intensity:0,valence:0,repetition:0},temperatureMax:0} as never);
  const entries=[f.entries[0]!,forged],context={seq:2,head:forged.hash},receipts=[{...f.receipts[0],head:forged.hash}];
  await refused(bundle.prepareCheckpointBundle(entries,undefined,receipts,context,f.policyTrust,f.trust));
  await refused(bundle.prepareCheckpointBundle([],f.policy,[],{seq:0,head:""},f.policyTrust,f.trust));
});
test("SNP-3: bundle captures caller history, archive metadata, endpoint and pins before awaiting",async()=>{
  const f=await fixture(),expected=await prepare(f),pending=prepare(f);
  f.entries.length=0;f.receipts[0]!.head="0".repeat(64);f.context.seq=0;f.context.head="";f.policyTrust.guardId="foreign";f.trust.checkpointKey=f.trust.anchorKey;f.trust.principalKeys.length=0;
  assert.deepEqual(await pending,expected);
});
test("SNP-3: bundle normalises malformed caller input to typed refusal",async()=>{
  const f=await fixture();
  await refused(bundle.prepareCheckpointBundle(f.entries,undefined,f.receipts,f.context,f.policyTrust,Object.assign([],f.trust)));
  for(const input of [null,{},[null],new Uint8Array(1)])await refused(bundle.prepareCheckpointBundle(input,undefined,f.receipts,f.context,f.policyTrust,f.trust));
  const cyclic:unknown[]=[];cyclic.push(cyclic);await refused(bundle.prepareCheckpointBundle(cyclic,undefined,f.receipts,f.context,f.policyTrust,f.trust));
});
