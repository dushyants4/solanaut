// POL-4/LIF-7: ephemeral in-memory keys, signed devnet policies and fake chain reads.
import { strict as assert } from "node:assert";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { createGuard, encodeBase58, preparePolicyText, replay, type Entry } from "@solanaut/sdk";
import { createSignerCore, type CoreOptions } from "../src/core.ts";
import { WORKLOAD_POLICY } from "../../../packages/sdk/test/support/workload.ts";
import { craftLegacy, key } from "../../../packages/sdk/test/support/craft.ts";
const agent = generateKeyPairSync("ed25519"); const operator = generateKeyPairSync("ed25519");
const publicBytes = Buffer.from(agent.publicKey.export({ format: "jwk" }).x!, "base64url");
const operatorKey = encodeBase58(Buffer.from(operator.publicKey.export({ format: "jwk" }).x!, "base64url"));
const policy = { ...WORKLOAD_POLICY, principal: [encodeBase58(publicBytes)], latch: { ...WORKLOAD_POLICY.latch, cluster: "devnet", releaseKey: operatorKey } };
const trust = { operatorKey, guardId: policy.latch.guardId, cluster: "devnet" };
const message = craftLegacy({ header: [1, 0, 1], keys: [[...publicBytes], key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
const request = { clientId: "agent", id: "one", message: Buffer.from(message).toString("base64"), deadline: 2000 };
function authorization(p: unknown, version: number) {
  const issued = "2026-10-06T00:00:00.000Z"; const text = preparePolicyText(p, version, issued);
  return { ...trust, version, issued, text, signature: sign(null, Buffer.from(text), operator.privateKey).toString("base64") };
}
for (const stage of ["admitted", "signed", "started"] as const) test(`POL-4/LIF-6: ${stage} history survives a signed policy upgrade without old-policy sends`, async () => {
  const entries: Entry[] = []; const log = { entries, append(e: Entry) { entries.push(e); }, close() {} };
  const first = await createGuard({ policy, authorization: authorization(policy, 1), log });
  const d = first.check({ message, at: 1000, blockHeight: 10n, lastValidBlockHeight: 100n }, request);
  assert.equal(d.allow, true);
  if (stage !== "admitted") {
    assert.equal(first.redeem(message, d.hash, 10n).ok, true); const sig = sign(null, message, agent.privateKey);
    first.recordSigning({ stage: "signed", decision: d.hash, wire: Buffer.concat([Buffer.from([1]), sig, message]).toString("base64"), signature: encodeBase58(sig) });
    if (stage === "started") first.recordSigning({ stage: "send-started", decision: d.hash, blockHeight: "11" });
  }
  first.close(); const nextPolicy = { ...policy, sol: { maxPerTx: 2n, maxPerWindow: 2n } };
  const guard = await createGuard({ policy: nextPolicy, authorization: authorization(nextPolicy, 2), log });
  let signs = 0; let sends = 0; let reads = 0;
  const options: CoreOptions = { guard, now: () => 1100, sign: async () => { signs++; throw new Error("must not sign"); }, rpc: {
    observe: async () => { throw new Error("must not admit again"); }, height: async () => 11n,
    send: async () => { sends++; throw new Error("must not send"); }, outcome: async () => { reads++; return null; },
  } };
  try {
    const results = await createSignerCore(options).recover();
    assert.deepEqual(results, [{ decision: d.hash, complete: stage === "started" }]);
    assert.equal(signs, 0); assert.equal(sends, 0); assert.equal(reads, stage === "admitted" ? 0 : 1);
    assert.equal(guard.entries().some((e) => e.kind === "report"), false);
    const other = Buffer.from(message); other[other.length - 8] = 2;
    assert.equal(guard.check({ message: other, at: 1101, blockHeight: 11n, lastValidBlockHeight: 100n }, { ...request, id: "two" }).rule, "over-window-cap");
    assert.equal((await replay(guard.entries(), undefined, undefined, trust)).ok, true);
  } finally { guard.close(); }
});
test("LIF-7/SIG-7: final chain evidence prevents sending restored signed unsent bytes", async () => {
  const guard = await createGuard({ policy });
  const d = guard.check({ message, at: 1000, blockHeight: 10n, lastValidBlockHeight: 100n }, request);
  guard.redeem(message, d.hash, 10n); const sig = sign(null, message, agent.privateKey);
  guard.recordSigning({ stage: "signed", decision: d.hash, wire: Buffer.concat([Buffer.from([1]), sig, message]).toString("base64"), signature: encodeBase58(sig) });
  guard.report(d.hash, "failed"); let sends = 0;
  const core = createSignerCore({ guard, now: () => 1100, sign: async () => { throw new Error("must not sign"); }, rpc: {
    observe: async () => { throw new Error("must not read admission"); }, height: async () => 11n,
    send: async () => { sends++; return encodeBase58(sig); }, outcome: async () => null,
  } });
  try {
    assert.deepEqual(await core.recover(), [{ decision: d.hash, complete: true }]);
    assert.equal(sends, 0);
    assert.equal(guard.entries().some((e) => e.kind === "signing" && e.event.stage === "send-started"), false);
    assert.equal((await core.propose(request)).status, "uncertain");
  } finally { guard.close(); }
});
