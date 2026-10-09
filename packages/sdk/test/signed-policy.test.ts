// POL and VER: operator signatures, immutable versions and policy-aware history.
import { strict as assert } from "node:assert";
import { generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { encodeBase58 } from "../src/base58.ts";
import { canonicalJSON } from "../src/canonical.ts";
import { createGuard, replay } from "../src/guard.ts";
import { inspectRecord } from "../src/inspect.ts";
import { seal, type Entry } from "../src/log.ts";
import { preparePolicyText, verifyPolicyAuthorization, verifyPolicyEntry, PolicyAuthorizationError, type PolicyAuthorization } from "../src/signed-policy.ts";
import { sensorV1 } from "../src/sensor.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";

const operator = generateKeyPairSync("ed25519");
const operatorKey = encodeBase58(Buffer.from(operator.publicKey.export({ format: "jwk" }).x!, "base64url"));
const policy = { ...WORKLOAD_POLICY, latch: { ...WORKLOAD_POLICY.latch, releaseKey: operatorKey } };
const issued = "2026-10-05T00:00:00.000Z";
const trust = { operatorKey, guardId: policy.latch.guardId, cluster: policy.latch.cluster };
const quiet = sensorV1;
function authorization(p: unknown = policy, version = 1): PolicyAuthorization {
  const text = preparePolicyText(p, version, issued);
  return { ...trust, version, issued, text, signature: sign(null, Buffer.from(text), operator.privateKey).toString("base64") };
}
const payment = (to = 2) => craftLegacy({ header: [1, 0, 1], keys: [key(1), key(to), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });

test("POL-1: canonical readable summary and valid operator signature load", () => {
  const auth = authorization();
  assert.match(auth.text, /^solanaut policy\nguard: workload\ncluster: localnet\nversion: 1\npolicy: [0-9a-f]{64}\nissued: 2026-10-05T/);
  assert.match(auth.text, /SOL: 1000000000 per transaction, 3000000000 per 1\/3 minutes/);
  assert.match(auth.text, /programs: 1; opaque: deny$/);
  assert.equal(verifyPolicyAuthorization(policy, auth).latch.releaseKey, operatorKey);
});
for (const [name, edit] of [
  ["missing signature", (a: PolicyAuthorization) => ({ ...a, signature: "" })],
  ["wrong operator", (a: PolicyAuthorization) => ({ ...a, operatorKey: encodeBase58(Uint8Array.from(key(9))) })],
  ["other guard", (a: PolicyAuthorization) => ({ ...a, guardId: "other" })],
  ["other cluster", (a: PolicyAuthorization) => ({ ...a, cluster: "devnet" })],
  ["different hash", (a: PolicyAuthorization) => ({ ...a, text: a.text.replace(/policy: [0-9a-f]+/, "policy: " + "0".repeat(64)) })],
  ["noncanonical base64", (a: PolicyAuthorization) => ({ ...a, signature: a.signature + "\n" })],
] as const) test(`POL-2: ${name} refuses to start`, async () => {
  await assert.rejects(createGuard({ policy, authorization: edit(authorization()), sensor: quiet }), /policy|signature|operator|guard|cluster/i);
});
test("POL-2: even a correctly signed dishonest summary is rejected", () => {
  const a = authorization();
  a.text = a.text.replace("opaque: deny", "opaque: allow");
  a.signature = sign(null, Buffer.from(a.text), operator.privateKey).toString("base64");
  assert.throws(() => verifyPolicyAuthorization(policy, a), /text|summary/);
});
test("POL-2: missing authorization and non-text signature cannot authenticate",()=> {
  assert.throws(()=>verifyPolicyAuthorization(policy,null as never),/required/);
  assert.throws(()=>verifyPolicyAuthorization(policy,{...authorization(),signature:new Uint8Array(64)} as never),/missing/);
});
test("POL-2: invalid encoded signature lengths refuse before base64 allocation",()=>{
  const original=Buffer.from;
  Buffer.from=function(value:unknown,...options:unknown[]){
    if(typeof value==="string" && options[0]==="base64" && value.length!==88)throw new Error("invalid policy signature reached decoder");
    return Reflect.apply(original,Buffer,[value,...options]);
  } as typeof Buffer.from;
  try{
    for(const length of [0,1,87,89,1_000_000])assert.throws(()=>verifyPolicyAuthorization(policy,{...authorization(),signature:"A".repeat(length)}),error=>error instanceof PolicyAuthorizationError && error.code==="policy-authorization");
  }finally{Buffer.from=original;}
});
test("POL-2: signature bytes are captured once before size and crypto verification",()=>{
  const a=authorization(),valid=a.signature;let reads=0;
  Object.defineProperty(a,"signature",{get(){reads++;return reads===1?valid:"A".repeat(1_000_000);}});
  assert.equal(verifyPolicyAuthorization(policy,a).latch.releaseKey,operatorKey);assert.equal(reads,1);
});
test("VER-2: equivalent but noncanonical recorded policy is not accepted as signed history",async()=> {
  const g=await createGuard({policy,authorization:authorization()});
  try {
    const entry=g.entries().find(e=>e.kind==="policy"); assert.ok(entry && entry.kind==="policy");
    assert.throws(()=>verifyPolicyEntry({...entry,policy:JSON.stringify(JSON.parse(entry.policy),null,2)},trust),/canonical/);
  } finally {g.close();}
});
test("POL-3: the principal cannot become the pinned operator", async () => {
  const p = { ...policy, principal: [operatorKey] };
  await assert.rejects(createGuard({ policy: p, authorization: authorization() }), /principal/);
});
test("POL-1: invalid versions and issued timestamps have no signing text", () => {
  for (const v of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => preparePolicyText(policy, v, issued), /version/);
  for (const date of ["bad", "2026-02-30T00:00:00.000Z", "2026-10-05T00:00:00+00:00"]) assert.throws(() => preparePolicyText(policy, 1, date), /issued/);
});
test("POL-1: summaries show SOL caps and count trailing destinations", () => {
  const p = { ...policy, destinations: { allow: [2, 3, 4].map((n) => encodeBase58(Uint8Array.from(key(n)))) }, windowMs: 3_600_000 };
  const text = preparePolicyText(p, 2, issued);
  assert.match(text, /destinations: 3, .+ and 1 more/);
  assert.match(text, /per 1 hours/);
});
test("POL-4/POL-5/VER-1: history verifies signed versions and replay preserves pending receipts and the latch", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "solanaut-policies-")), "guard.jsonl");
  const a = await createGuard({ policy, authorization: authorization(), sensor: quiet, log: path });
  const d = a.check({ message: payment(), at: 1000, blockHeight: 1n, lastValidBlockHeight: 100n });
  assert.equal(d.allow, true);
  assert.equal(a.redeem(payment(), d.hash, 1n).ok, true);
  for (let i = 0; i < 3; i++) a.check({ message: payment(3), at: 1001 + i });
  assert.equal(a.status().latched, true);
  a.close();
  const next = { ...policy, sol: { ...policy.sol, maxPerTx: 2_000_000_000n } };
  const b = await createGuard({ policy: next, authorization: authorization(next, 2), sensor: quiet, log: path });
  assert.equal(b.status().latched, true, "a policy change cannot release the latch");
  assert.equal(b.redeem(payment(), d.hash, 2n).ok, false, "a used receipt remains used");
  const entries = b.entries();
  assert.equal(entries.filter((e) => e.kind === "policy").length, 2);
  assert.equal((await replay(entries, undefined, quiet, trust)).ok, true);
  assert.equal(inspectRecord(entries, next, trust).latched?.seq, b.status().latchSeq);
  assert.throws(() => inspectRecord(entries, next), /externally pinned/);
  b.close();
  await assert.rejects(createGuard({ policy, authorization: authorization(), sensor: quiet, log: path }), /version|rollback/);
  await assert.rejects(createGuard({ policy: next, sensor: quiet, log: path }), /signed|authoriz/);
});
test("VER-1: equal version restarts are idempotent; changed signed content needs a higher version", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "solanaut-versions-")), "guard.jsonl");
  const first = await createGuard({ policy, authorization: authorization(), log: path });
  first.close();
  const same = await createGuard({ policy, authorization: authorization(), log: path });
  assert.equal(same.entries().length, 1);
  same.close();
  const changed = { ...policy, sol: { ...policy.sol, maxPerTx: 2n } };
  await assert.rejects(createGuard({ policy: changed, authorization: authorization(changed), log: path }), /version|content/);
  const advanced = await createGuard({ policy: changed, authorization: authorization(changed, 2), log: path });
  const entries = advanced.entries();
  advanced.close();
  const { hash: _hash, ...body } = entries[0]!;
  const rolledBack = [...entries, seal({ ...body, seq: entries.length, prev: entries.at(-1)!.hash } as never)];
  assert.equal((await replay(rolledBack, undefined, sensorV1, trust)).ok, false, "a genuinely signed old policy cannot reappear after a newer version");
  await assert.rejects(createGuard({ policy: changed, authorization: authorization(changed, 3), log: { entries: rolledBack, append() {}, close() {} } }), /version|rollback/);
});
test("VER-2/POL-4: resealed unsupported profiles and forged historical policy refuse replay and restore", async () => {
  const a = await createGuard({ policy, authorization: authorization(), sensor: quiet });
  a.check({ message: payment(), at: 1000 });
  const entries = a.entries();
  for (const mutation of [
    (e: Entry) => ({ ...e, v: 2 }),
    (e: Entry) => ({ ...e, profile: { invented: true } }),
    (e: Entry) => ({ ...e, signature: Buffer.alloc(64).toString("base64") }),
    (e: Entry) => ({ ...e, policy: canonicalJSON({ ...policy, sol: { ...policy.sol, maxPerTx: 2n } }) }),
  ]) {
    const forged: Entry[] = [];
    for (const e of entries) {
      const { hash: _hash, ...body } = e.seq === 0 ? mutation(e) : e;
      forged.push(seal({ ...body, prev: forged.at(-1)?.hash ?? "" } as never));
    }
    assert.equal((await replay(forged, undefined, quiet, trust)).ok, false);
    await assert.rejects(createGuard({ policy, authorization: authorization(), sensor: quiet, log: { entries: forged, append() {}, close() {} } }));
  }
});
test("VER-2: a caller cannot substitute another sensor under the signed profile", async () => {
  await assert.rejects(createGuard({ policy, authorization: authorization(), sensor: () => ({ intensity: 0, valence: 0, repetition: 0 }) }), /sensor/);
});
test("POL-4: a policy restart retains live reservations against the new cap", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "solanaut-reservations-")), "guard.jsonl");
  const first = { ...policy, sol: { maxPerTx: 1n, maxPerWindow: 1n } };
  const a = await createGuard({ policy: first, authorization: authorization(first), log: path });
  assert.equal(a.check({ message: payment(), at: 1000, blockHeight: 1n, lastValidBlockHeight: 100n }).allow, true);
  a.close();
  const next = { ...policy, sol: { maxPerTx: 2n, maxPerWindow: 2n } };
  const b = await createGuard({ policy: next, authorization: authorization(next, 2), log: path });
  const message = payment();
  message[message.length - 8] = 2;
  assert.equal(b.check({ message, at: 1001, blockHeight: 2n, lastValidBlockHeight: 100n }).rule, "over-window-cap");
  assert.equal((await replay(b.entries(), undefined, sensorV1, trust)).ok, true);
  b.close();
});
test("POL-4: the operator replay command uses signed history and an external public trust file", async () => {
  const folder = mkdtempSync(join(tmpdir(), "solanaut-policy-cli-"));
  const path = join(folder, "guard.jsonl");
  const trustPath = join(folder, "public-trust.json");
  writeFileSync(trustPath, JSON.stringify(trust));
  const a = await createGuard({ policy, authorization: authorization(), log: path });
  a.check({ message: payment(), at: 1000 });
  a.close();
  const good = spawnSync(process.execPath, ["packages/sdk/bin/replay.ts", path, "-", trustPath], { encoding: "utf8" });
  assert.equal(good.status, 0, good.stderr + good.stdout);
  const untrusted = spawnSync(process.execPath, ["packages/sdk/bin/replay.ts", path, "-"], { encoding: "utf8" });
  assert.equal(untrusted.status, 1);
  assert.equal(untrusted.stdout, "diverges at seq 0, field chain\n  recorded: [redacted]\n  recomputed: [redacted]\n");
  assert.equal(untrusted.stderr, "");
});
test("POL-4: extending the window reconstructs spending pruned under the old window", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "solanaut-window-change-")), "guard.jsonl");
  const first = { ...policy, windowMs: 1000, sol: { maxPerTx: 2n, maxPerWindow: 2n } };
  const a = await createGuard({ policy: first, authorization: authorization(first), log: path });
  const spent = a.check({ message: payment(), at: 1000 });
  assert.equal(spent.allow, true);
  a.report(spent.hash, "landed");
  a.check({ message: new Uint8Array(), at: 3000 });
  a.close();
  const next = { ...first, windowMs: 5000 };
  const b = await createGuard({ policy: next, authorization: authorization(next, 2), log: path });
  const message = payment(); message[message.length - 8] = 2;
  assert.equal(b.check({ message, at: 3001 }).rule, "over-window-cap");
  assert.equal((await replay(b.entries(), undefined, sensorV1, trust)).ok, true);
  assert.equal(inspectRecord(b.entries(), next, trust).window.sol.used, "1");
  b.close();
});
