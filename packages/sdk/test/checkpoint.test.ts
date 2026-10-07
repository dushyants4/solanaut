import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { encodeBase58 } from "../src/base58.ts";
import { canonicalJSON } from "../src/canonical.ts";
import { EVALUATION_PROFILE } from "../src/profile.ts";
import { CheckpointBindingError, prepareCheckpointText, prepareCheckpointPrefixText, verifyCheckpointBinding, type CheckpointBinding, type CheckpointSignatures, type CheckpointTrust } from "../src/checkpoint.ts";
function fixture() {
  const pair = () => { const key = generateKeyPairSync("ed25519"); return { key, publicKey: encodeBase58(key.publicKey.export({ type: "spki", format: "der" }).subarray(-32)) }; };
  const checkpoint = pair(), principal = pair(), anchor = pair(), foreign = pair();
  const hash = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
  const digests = { archiveDigest: hash("ordered archive catalogue bytes"), stateDigest: hash("admission-state bytes"), prefixDigest: hash("telemetry and reset bytes") };
  const binding: CheckpointBinding = { format: 1, checkpointKey: checkpoint.publicKey, guardId: "checkpoint-fixture", cluster: "localnet", seq: 42, head: hash("head"), policyVersion: 2, policyHash: hash("policy"), profile: EVALUATION_PROFILE, ...digests };
  const trust: CheckpointTrust = { checkpointKey: checkpoint.publicKey, principalKeys: [principal.publicKey], anchorKey: anchor.publicKey, guardId: binding.guardId, cluster: binding.cluster };
  const authorize = (body: CheckpointBinding = binding, key = checkpoint.key.privateKey): CheckpointSignatures => ({ snapshot: sign(null, Buffer.from(prepareCheckpointText(body)), key).toString("base64"), prefix: sign(null, Buffer.from(prepareCheckpointPrefixText(body)), key).toString("base64") });
  return { binding, trust, digests, authorize, foreign };
}
test("SNP-3: canonical checkpoint and prefix domains bind every descriptor field", () => {
  const f = fixture();
  assert.equal(prepareCheckpointText(f.binding), "solanaut checkpoint\n" + canonicalJSON(f.binding));
  assert.equal(prepareCheckpointPrefixText(f.binding), "solanaut checkpoint keel prefix\n" + canonicalJSON(f.binding));
  const reversed = Object.fromEntries(Object.entries(f.binding).reverse());
  assert.equal(prepareCheckpointText(reversed), prepareCheckpointText(f.binding));
});
test("SNP-3: pinned signatures and independently computed digests return immutable metadata", () => {
  const f = fixture(); const result = verifyCheckpointBinding(f.binding, f.authorize(), f.trust, f.digests);
  assert.deepEqual(result, f.binding); assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.profile), true);
});
test("SNP-3: a foreign checkpoint signature is denied under the external pin", () => {
  const f = fixture(); assert.throws(() => verifyCheckpointBinding(f.binding, f.authorize(f.binding, f.foreign.key.privateKey), f.trust, f.digests), CheckpointBindingError);
});
test("SNP-3: checkpoint authority cannot share a principal or anchor role", () => {
  const f = fixture(); const signatures = f.authorize();
  for (const trust of [{ ...f.trust, principalKeys: [f.trust.checkpointKey] }, { ...f.trust, anchorKey: f.trust.checkpointKey }]) assert.throws(() => verifyCheckpointBinding(f.binding, signatures, trust, f.digests), CheckpointBindingError);
});
test("SNP-3: foreign guard, cluster or checkpoint pin is denied", () => {
  const f = fixture(); const signatures = f.authorize();
  for (const trust of [{ ...f.trust, guardId: "foreign" }, { ...f.trust, cluster: "devnet" as const }, { ...f.trust, checkpointKey: f.foreign.publicKey }]) assert.throws(() => verifyCheckpointBinding(f.binding, signatures, trust, f.digests), CheckpointBindingError);
});
test("SNP-3: a trusted signature cannot authorise a false checkpoint authority descriptor", () => {
  const f = fixture(); const supplied = { ...f.binding, checkpointKey: f.foreign.publicKey };
  assert.throws(() => verifyCheckpointBinding(supplied, f.authorize(supplied), f.trust, f.digests), CheckpointBindingError);
});
test("SNP-3: independently observed payload digest mismatches deny even valid signatures", () => {
  const f = fixture(); const signatures = f.authorize();
  for (const field of ["archiveDigest", "stateDigest", "prefixDigest"] as const) assert.throws(() => verifyCheckpointBinding(f.binding, signatures, f.trust, { ...f.digests, [field]: "0".repeat(64) }), CheckpointBindingError);
});
test("SNP-3: altered policy, sequence, head or payload bindings cannot reuse signatures", () => {
  const f = fixture(); const signatures = f.authorize();
  for (const changed of [{ policyVersion: 3 }, { policyHash: "1".repeat(64) }, { seq: 43 }, { head: "2".repeat(64) }, { archiveDigest: "3".repeat(64) }, { stateDigest: "4".repeat(64) }, { prefixDigest: "5".repeat(64) }]) assert.throws(() => verifyCheckpointBinding({ ...f.binding, ...changed }, signatures, f.trust, f.digests), CheckpointBindingError);
});
test("SNP-3: snapshot and prefix signatures are not interchangeable", () => {
  const f = fixture(); const a = f.authorize();
  assert.throws(() => verifyCheckpointBinding(f.binding, { snapshot: a.prefix, prefix: a.snapshot }, f.trust, f.digests), CheckpointBindingError);
  assert.throws(() => verifyCheckpointBinding(f.binding, { snapshot: a.snapshot, prefix: a.snapshot }, f.trust, f.digests), CheckpointBindingError);
});
test("SNP-3: missing, malformed and noncanonical signatures deny", () => {
  const f = fixture(); const a = f.authorize();
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const noncanonical=a.snapshot.slice(0,85)+alphabet[alphabet.indexOf(a.snapshot[85]!)+1]+"==";
  assert.deepEqual(Buffer.from(noncanonical,"base64"),Buffer.from(a.snapshot,"base64"));
  assert.throws(()=>verifyCheckpointBinding(f.binding,{...a,snapshot:noncanonical},f.trust,f.digests),CheckpointBindingError);
  for (const bad of [undefined, null, 1, {}, [], "", "!", a.snapshot + " ", Buffer.alloc(63).toString("base64")]) for (const field of ["snapshot", "prefix"] as const) assert.throws(() => verifyCheckpointBinding(f.binding, { ...a, [field]: bad } as CheckpointSignatures, f.trust, f.digests), CheckpointBindingError);
});
test("SNP-3: unsupported formats/profiles and malformed descriptor values deny", () => {
  const f = fixture();
  for (const changed of [{ format: 2 }, { profile: { ...EVALUATION_PROFILE, sensor: "foreign" } }, { profile: { ...EVALUATION_PROFILE, module: "0".repeat(64) } }, { policyVersion: 0 }, { policyVersion: Number.MAX_SAFE_INTEGER + 1 }, { seq: -1 }, { seq: 1.5 }, { seq: Number.MAX_SAFE_INTEGER + 1 }, { guardId: "bad\nidentity" }, { cluster: "mainnet-beta" }, { head: "short" }, { stateDigest: "A".repeat(64) }, { prefixDigest: 1 }, { checkpointKey: "invalid" }, { unexpected: true }]) for (const prepare of [prepareCheckpointText, prepareCheckpointPrefixText]) assert.throws(() => prepare({ ...f.binding, ...changed }), CheckpointBindingError);
  for (const bad of [null, [], "text", {}, { ...f.binding, seq: Number.NaN }]) assert.throws(() => prepareCheckpointText(bad), CheckpointBindingError);
});
test("SNP-3: genesis and safe sequence/version boundaries are explicit", () => {
  const f = fixture();
  for (const binding of [{ ...f.binding, seq: 0, head: "" }, { ...f.binding, seq: Number.MAX_SAFE_INTEGER, policyVersion: Number.MAX_SAFE_INTEGER }]) assert.deepEqual(verifyCheckpointBinding(binding, f.authorize(binding), f.trust, f.digests), binding);
  assert.throws(() => prepareCheckpointText({ ...f.binding, seq: 0 }), CheckpointBindingError);
  assert.throws(() => prepareCheckpointText({ ...f.binding, head: "" }), CheckpointBindingError);
});
test("SNP-3: malformed trust and observed digest records cannot authorise bindings", () => {
  const f = fixture(); const a = f.authorize();
  for (const trust of [null, { ...f.trust, principalKeys: [] }, { ...f.trust, principalKeys: ["invalid"] }, { ...f.trust, anchorKey: "invalid" }, { ...f.trust, checkpointKey: 1 }, { ...f.trust, cluster: "mainnet-beta" }, { ...f.trust, extra: true }]) assert.throws(() => verifyCheckpointBinding(f.binding, a, trust as unknown as CheckpointTrust, f.digests), CheckpointBindingError);
  for (const digests of [null, {}, { ...f.digests, stateDigest: "bad" }, { ...f.digests, extra: true }]) assert.throws(() => verifyCheckpointBinding(f.binding, a, f.trust, digests as typeof f.digests), CheckpointBindingError);
});
test("SNP-3: caller metadata cannot mutate captured external pins or observed digests", () => {
  for (const field of ["guardId", "stateDigest"] as const) {
    const f = fixture(); const supplied = { ...f.binding, [field]: field === "guardId" ? "foreign" : "9".repeat(64) };
    const a = f.authorize(supplied);
    Object.defineProperty(supplied, "format", { enumerable: true, get() {
      if (field === "guardId") f.trust.guardId = supplied.guardId;
      else f.digests.stateDigest = supplied.stateDigest;
      return 1;
    } });
    assert.throws(() => verifyCheckpointBinding(supplied, a, f.trust, f.digests), CheckpointBindingError);
  }
});
test("SNP-3: malformed JSON and throwing accessors produce typed refusal", () => {
  const f = fixture(); const cyclic = { ...f.binding, profile: {} as unknown }; cyclic.profile = cyclic;
  const accessor = { ...f.binding }; Object.defineProperty(accessor, "seq", { enumerable: true, get() { throw new Error("untrusted accessor"); } });
  for (const bad of [cyclic, accessor, { ...f.binding, seq: undefined }, { ...f.binding, profile: new Uint8Array(1) }]) assert.throws(() => prepareCheckpointText(bad), CheckpointBindingError);
  assert.throws(() => verifyCheckpointBinding(f.binding, { ...f.authorize(), extra: true } as CheckpointSignatures, f.trust, f.digests), CheckpointBindingError);
});
test("SNP-3: returned metadata does not retain mutable caller references", () => {
  const f = fixture(); const supplied = { ...f.binding, profile: { ...EVALUATION_PROFILE } };
  const result = verifyCheckpointBinding(supplied, f.authorize(supplied), f.trust, f.digests);
  supplied.guardId = "changed"; supplied.profile.sensor = "changed" as typeof supplied.profile.sensor;
  assert.equal(result.guardId, f.binding.guardId); assert.deepEqual(result.profile, EVALUATION_PROFILE);
});
test("SNP-3: candidate SDK entry exports the binding API and typed refusal", async () => {
  const sdk = await import("../src/index.ts");
  assert.equal("prepareCheckpointText" in sdk, true); assert.equal("prepareCheckpointPrefixText" in sdk, true);
  assert.equal("verifyCheckpointBinding" in sdk, true); assert.equal("CheckpointBindingError" in sdk, true);
});
test("SNP-3: excessive public keys refuse before unbounded base58 decoding", () => {
  const f = fixture();
  const script = `
    import {prepareCheckpointText,verifyCheckpointBinding,CheckpointBindingError} from './packages/sdk/src/checkpoint.ts';
    const f=JSON.parse(process.argv[1]), oversized='2'.repeat(100000); let refused=0;
    const calls=[
      ()=>prepareCheckpointText({...f.binding,checkpointKey:oversized}),
      ()=>verifyCheckpointBinding(f.binding,{snapshot:'',prefix:''},{...f.trust,checkpointKey:oversized},f.digests),
      ()=>verifyCheckpointBinding(f.binding,{snapshot:'',prefix:''},{...f.trust,anchorKey:oversized},f.digests),
      ()=>verifyCheckpointBinding(f.binding,{snapshot:'',prefix:''},{...f.trust,principalKeys:[oversized]},f.digests)
    ];
    for(const call of calls){try{call();}catch(error){if(error instanceof CheckpointBindingError)refused++;else throw error;}}
    console.log(JSON.stringify({refused}));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, JSON.stringify({binding:f.binding,trust:f.trust,digests:f.digests})], { encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 0, JSON.stringify({status:result.status,signal:result.signal,error:result.error?.message}) + result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {refused:4});
});
test("SNP-3: invalid signature lengths refuse before base64 decoding",()=>{
  const f=fixture(),a=f.authorize();
  const script=`
    import {verifyCheckpointBinding,CheckpointBindingError} from './packages/sdk/src/checkpoint.ts';
    const f=JSON.parse(process.argv[1]),original=Buffer.from;let refused=0;
    Buffer.from=function(value,...options){
      if(typeof value==='string' && options[0]==='base64' && value.length!==88)throw new Error('invalid length reached decoder');
      return Reflect.apply(original,Buffer,[value,...options]);
    };
    for(const size of [0,4,84,87,89,1000000])for(const field of ['snapshot','prefix']){
      try{verifyCheckpointBinding(f.binding,{...f.a,[field]:'A'.repeat(size)},f.trust,f.digests);}
      catch(error){if(error instanceof CheckpointBindingError)refused++;else throw error;}
    }
    console.log(JSON.stringify({refused}));`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,JSON.stringify({binding:f.binding,trust:f.trust,digests:f.digests,a})],{encoding:"utf8",timeout:3000});
  assert.equal(result.status,0,JSON.stringify({status:result.status,signal:result.signal,error:result.error?.message})+result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{refused:12});
});
