// SNP-3: authenticate stored bytes; this codec does not establish admission state.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {encodeBase58} from "../src/base58.ts";
import {canonicalJSON,sha256hex} from "../src/canonical.ts";
import {EVALUATION_PROFILE} from "../src/profile.ts";
import {prepareCheckpointText,prepareCheckpointPrefixText} from "../src/checkpoint.ts";
import * as envelope from "../src/checkpoint-envelope.ts";
function fixture(){
  const pair=()=>{const key=generateKeyPairSync("ed25519");return {key,address:encodeBase58(Buffer.from(key.publicKey.export({format:"jwk"}).x!,"base64url"))};};
  const checkpoint=pair(),principal=pair(),anchor=pair(),foreign=pair();
  const payloads={archives:"opaque archive bytes\n",state:"opaque state bytes 字\n",prefix:"opaque prefix bytes\n"};
  const binding={format:1 as const,checkpointKey:checkpoint.address,guardId:"envelope-fixture",cluster:"localnet" as const,seq:2,head:sha256hex("head"),policyVersion:1,policyHash:sha256hex("policy"),profile:EVALUATION_PROFILE,archiveDigest:sha256hex(payloads.archives),stateDigest:sha256hex(payloads.state),prefixDigest:sha256hex(payloads.prefix)};
  const signatures={snapshot:sign(null,Buffer.from(prepareCheckpointText(binding)),checkpoint.key.privateKey).toString("base64"),prefix:sign(null,Buffer.from(prepareCheckpointPrefixText(binding)),checkpoint.key.privateKey).toString("base64")};
  const trust={checkpointKey:checkpoint.address,principalKeys:[principal.address],anchorKey:anchor.address,guardId:binding.guardId,cluster:binding.cluster};
  return {input:{binding,signatures,...payloads},trust,foreign};
}
const prepare=(f:ReturnType<typeof fixture>,limit=10000)=>envelope.prepareCheckpointEnvelope(f.input,f.trust,limit);
const verify=(text:unknown,f:ReturnType<typeof fixture>,limit:unknown=10000)=>envelope.verifyCheckpointEnvelope(text,f.trust,limit);
const refused=(work:()=>unknown)=>assert.throws(work,error=>error instanceof Error && error.name==="CheckpointEnvelopeError" && Reflect.get(error,"code")==="checkpoint-envelope");
test("SNP-3: canonical envelope round trip authenticates exact opaque bytes under both domains",()=>{
  const f=fixture(),got=prepare(f),decoded=verify(got.text,f);
  assert.equal(got.text,canonicalJSON({format:1,kind:"solanaut-signed-checkpoint",...f.input})+"\n");assert.equal(got.digest,sha256hex(got.text));
  assert.deepEqual(decoded,f.input);assert.ok(Object.isFrozen(got));assert.ok(Object.isFrozen(decoded));assert.ok(Object.isFrozen(decoded.signatures));assert.ok(Object.isFrozen(decoded.binding));
});
test("SNP-3: altered opaque payload bytes cannot reuse descriptor signatures",()=>{
  const f=fixture(),got=prepare(f);
  for(const field of ["archives","state","prefix"]){const parsed=JSON.parse(got.text);parsed[field]+="altered";refused(()=>verify(canonicalJSON(parsed)+"\n",f));}
});
test("SNP-3: envelope refuses wrong pins, missing signatures and swapped signing domains",()=>{
  const f=fixture(),got=prepare(f);
  for(const trust of [{...f.trust,guardId:"foreign"},{...f.trust,cluster:"devnet" as const},{...f.trust,checkpointKey:f.foreign.address}])refused(()=>envelope.verifyCheckpointEnvelope(got.text,trust,10000));
  for(const signatures of [{snapshot:f.input.signatures.snapshot},{snapshot:f.input.signatures.prefix,prefix:f.input.signatures.snapshot}])refused(()=>prepare({...f,input:{...f.input,signatures}} as never));
});
test("SNP-3: envelope rejects noncanonical framing, unsupported fields and duplicate keys",()=>{
  const f=fixture(),got=prepare(f);
  for(const text of [got.text.trimEnd(),got.text+"\n"," "+got.text,JSON.stringify(JSON.parse(got.text),null,2)+"\n",'{"format":1,'+got.text.slice(1)])refused(()=>verify(text,f));
  for(const change of [{format:2},{kind:"foreign"},{extra:true},{state:1},{prefix:null},{archives:{}},{signatures:[]}])refused(()=>verify(canonicalJSON({...JSON.parse(got.text),...change})+"\n",f));
  for(const text of [null,1,"bad JSON","[]\n","{}\n"])refused(()=>verify(text,f));
});
test("SNP-3: envelope size ceiling uses UTF-8 bytes and accepts its exact boundary",()=>{
  const f=fixture(),got=prepare(f),bytes=Buffer.byteLength(got.text);assert.ok(bytes>got.text.length);
  assert.deepEqual(verify(got.text,f,bytes),f.input);refused(()=>verify(got.text,f,bytes-1));refused(()=>prepare(f,bytes-1));
  for(const limit of [0,-1,0.5,Number.MAX_SAFE_INTEGER+1,Number.NaN,"10000",null])refused(()=>verify(got.text,f,limit));
});
test("SNP-3: oversized envelope refuses before JSON parsing",()=>{
  const f=fixture(),original=JSON.parse;let calls=0;
  try{JSON.parse=(...args:Parameters<typeof JSON.parse>)=>{calls++;return original(...args);};refused(()=>verify("A".repeat(1000000),f,10));assert.equal(calls,0);}
  finally{JSON.parse=original;}
});
test("SNP-3: envelope preparation captures external pins before caller metadata accessors",()=>{
  const f=fixture(),expected=prepare(f),input={...f.input};
  Object.defineProperty(input,"binding",{enumerable:true,get(){f.trust.checkpointKey=f.foreign.address;return f.input.binding;}});
  assert.deepEqual(envelope.prepareCheckpointEnvelope(input,f.trust,10000),expected);
});
test("SNP-3: malformed encoder input and caller exceptions receive redacted typed refusal",()=>{
  const f=fixture();
  for(const input of [null,[],Object.assign([],f.input),{...f.input,extra:true},{...f.input,state:undefined}])refused(()=>envelope.prepareCheckpointEnvelope(input,f.trust,10000));
  const input={...f.input};Object.defineProperty(input,"state",{enumerable:true,get(){throw new Error("caller private detail");}});
  refused(()=>envelope.prepareCheckpointEnvelope(input,f.trust,10000));
});
