// DISC-1–3: the model sees a class/reference; the operator receives the full refusal.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { createGuard, replay } from "../src/guard.ts";
import { createPolicy } from "../src/policy.ts";
import { SolanautDenied, type DeniedRule } from "../src/errors.ts";
import { preparePolicyText } from "../src/signed-policy.ts";
import { guardedWallet } from "../src/adapters/agent-kit.ts";
import { guardedSigner } from "../src/adapters/kit.ts";
import { encodeBase58 } from "../src/base58.ts";
import { memoryStore } from "../src/record.ts";
import { seal, type Decision, type Entry } from "../src/log.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";

const classes = {
  invalid: ["invalid-policy", "malformed-proposal", "unsupported-version"],
  "retry-later": ["intent-in-flight", "blockhash-expired", "rpc-unavailable"],
  refused: ["lookup-table-unpinned", "latched", "durable-nonce-denied", "other-signer", "program-not-allowed", "opaque-program", "instruction-denied", "destination-not-allowed", "mint-not-allowed", "token-mint-unknown", "over-per-tx-cap", "over-fee-cap", "intent-attempts-exhausted", "over-window-cap", "loop-reground", "inhibit-cap", "fail-closed", "message-signing-denied", "wallet-changed-message", "failure-budget"],
};
const privateText = "PRIVATE_OPERATOR_LIMIT_918374361";
const address = encodeBase58(Uint8Array.from(key(1)));
const message = craftLegacy({ header: [1, 0, 1], keys: [key(1), key(3), key(0)],
  instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
function inspect(error: unknown) {
  assert.ok(error instanceof SolanautDenied);
  const visible = [error.message, error.stack, JSON.stringify(error)].join(" ");
  assert.equal(visible.includes(privateText), false);
  assert.equal(visible.includes(address), false);
  assert.equal("decision" in error, false);
  assert.equal("cause" in error, false);
  return error as SolanautDenied & { ref: number; class: string };
}
for (const [classification, rules] of Object.entries(classes)) for (const rule of rules) {
  test(`DISC-1: ${rule} exposes only its frozen class and reference`, () => {
    const d = { seq: 1234, rule, reason: privateText + address, amounts: { sol: "918374361" } } as unknown as Decision;
    const error = new SolanautDenied(rule as DeniedRule, privateText + address, d);
    assert.equal([error.message, error.stack, JSON.stringify(error)].join(" ").includes(rule), false);
    assert.equal(inspect(error).class, classification);
    assert.equal(inspect(error).ref, 1234);
    assert.deepEqual(Object.keys(error).sort(), ["class", "name", "ref"]);
  });
}
test("DISC-1: an adapter-only refusal has a truthful unrecorded reference", () => {
  const error = inspect(new SolanautDenied("message-signing-denied", privateText, null));
  assert.equal(error.ref, -1); assert.equal(error.class, "refused");
});
test("DISC-2: callback follows persistence, is detached/frozen, and is not repeated by request retry", async () => {
  const store = memoryStore(); const observed: any[] = []; let recorded = false;
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: store, onRefusal: (detail: any) => {
    recorded = store.entries.some(e => e.kind === "decision" && e.seq === detail.decision.seq);
    observed.push(detail);
  } } as Parameters<typeof createGuard>[0]);
  try {
    const input = { message: Uint8Array.of(255), at: 1000 }, id = { clientId: "test", id: "denial" };
    const d = g.check(input, id); g.check(input, id);
    assert.equal(observed.length, 1); assert.equal(recorded, true);
    assert.equal(observed[0].rule, d.rule); assert.equal(observed[0].reason, d.reason);
    assert.notEqual(observed[0].decision, d);
    assert.equal(Object.isFrozen(observed[0]), true); assert.equal(Object.isFrozen(observed[0].decision.keel), true);
    assert.throws(() => { observed[0].decision.allow = true; });
    assert.equal(d.allow, false);
  } finally { g.close(); }
});
for (const mode of ["wallet", "kit"] as const) test(`DISC-1/2: ${mode} delivers the private policy reason only to the operator`, async () => {
  const observed: any[] = [];
  const g = await createGuard({ policy: WORKLOAD_POLICY, onRefusal: (detail: any) => { observed.push(detail); } } as Parameters<typeof createGuard>[0]);
  let calls = 0;
  try {
    const rpc = { getBlockHeight: async () => 10n, sendRawTransaction: async () => "", confirm: async () => "unknown" as const };
const wallet = { publicKey: { toBase58: () => address, toBytes: () => Uint8Array.from(key(1)) }, signTransaction: async <T>(tx: T) => { calls++; return tx; }, signAllTransactions: async <T>(txs: T[]) => txs, signAndSendTransaction: async () => ({ signature: "" }), signMessage: async (m: Uint8Array) => m };
    const work = mode === "wallet" ? guardedWallet(wallet, g, { rpc, now: () => 1000 }).signTransaction({ serializeMessage: () => message }) :
      guardedSigner({ address, signTransactions: async () => { calls++; return []; } }, g, { rpc, now: () => 1000 }).signTransactions([{ messageBytes: message, signatures: {}, lifetimeConstraint: { lastValidBlockHeight: 100n } }]);
    let caught: unknown; try { await work; } catch (error) { caught = error; }
    const error = inspect(caught);
    assert.equal(error.class, "refused"); assert.equal(calls, 0);
    assert.equal(observed.length, 1); assert.equal(observed[0].rule, "destination-not-allowed");
    assert.equal(error.ref, observed[0].decision.seq);
    assert.equal(error.message.includes("destination"), false);
  } finally { g.close(); }
});
test("DISC-2: off-chain message refusal notifies the operator once without inventing a decision", async () => {
  const observed: any[] = [];
  const g = await createGuard({ policy: WORKLOAD_POLICY, onRefusal: (d: any) => { observed.push(d); } } as Parameters<typeof createGuard>[0]);
  try {
    const wallet = { publicKey: { toBase58: () => address, toBytes: () => Uint8Array.from(key(1)) }, signTransaction: async <T>(tx: T) => tx, signAllTransactions: async <T>(txs: T[]) => txs, signAndSendTransaction: async () => ({ signature: "" }), signMessage: async (m: Uint8Array) => m };
    await assert.rejects(guardedWallet(wallet, g, { rpc: { getBlockHeight: async () => 10n, sendRawTransaction: async () => "", confirm: async () => "unknown" } }).signMessage(Uint8Array.of(1)), e => inspect(e).ref === -1);
    assert.equal(observed.length, 1); assert.equal(observed[0].rule, "message-signing-denied");
    assert.equal(observed[0].decision, null); assert.equal(g.entries().length, 0);
  } finally { g.close(); }
});
for (const asynchronous of [false, true]) test(`DISC-2: ${asynchronous ? "async" : "sync"} callback failure is fixed operator text and preserves the decision`, async () => {
  const output: string[] = [], write = process.stderr.write;
  process.stderr.write = ((data: any) => { output.push(String(data)); return true; }) as typeof write;
  const observer = () => { if (asynchronous) return Promise.reject(new Error(privateText)); throw new Error(privateText); };
  let g: Awaited<ReturnType<typeof createGuard>> | undefined;
  try {
    g = await createGuard({ policy: WORKLOAD_POLICY, onRefusal: observer } as Parameters<typeof createGuard>[0]);
    const d = g.check({ message: Uint8Array.of(255), at: 1000 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(d.allow, false); assert.equal(g.entries().length, 1);
    assert.equal(output.length, 1); assert.equal(output.join("").includes(privateText), false);
    assert.equal(JSON.parse(output[0]!).code, "refusal-observer-failed");
  } finally { process.stderr.write = write; g?.close(); }
});
function signed(disclosure: string) {
  const operator = generateKeyPairSync("ed25519");
  const operatorKey = encodeBase58(Buffer.from(operator.publicKey.export({ format: "jwk" }).x!, "base64url"));
  const policy = { ...structuredClone(WORKLOAD_POLICY), disclosure, latch: { ...WORKLOAD_POLICY.latch, releaseKey: operatorKey } };
  const issued = "2026-10-13T00:00:00.000Z", text = preparePolicyText(policy, 1, issued);
  return { policy, authorization: { operatorKey, guardId: policy.latch.guardId, cluster: policy.latch.cluster, version: 1, issued, text, signature: sign(null, Buffer.from(text), operator.privateKey).toString("base64") } };
}
test("DISC-3: unsigned full disclosure refuses and invalid disclosure values refuse", async () => {
  await assert.rejects(createGuard({ policy: { ...WORKLOAD_POLICY, disclosure: "full" } }), /signed|authoris/i);
  for (const disclosure of [null, 0, false, "verbose"]) assert.throws(() => createPolicy({ ...WORKLOAD_POLICY, disclosure }));
});
test("DISC-3: legacy policy bytes remain unchanged when disclosure is omitted", () => {
  const result = createPolicy(WORKLOAD_POLICY);
  assert.equal("disclosure" in result.policy, false);
  assert.equal(createPolicy({ ...WORKLOAD_POLICY, disclosure: "class" }).policy.disclosure, "class");
});
test("DISC-3: signed full decisions are marked and annotation removal fails semantic replay", async () => {
  const f = signed("full"), g = await createGuard(f);
  try {
    const d = g.check({ message: Uint8Array.of(255), at: 1000 });
    assert.equal((d as any).disclosure, "full");
    assert.equal((await replay(g.entries(), undefined, undefined, f.authorization)).ok, true);
    const changed: Entry[] = [];
    for (const old of g.entries()) {
      const { hash: _, ...body } = old as any;
      if (body.kind === "decision") delete body.disclosure;
      changed.push(seal({ ...body, prev: changed.at(-1)?.hash ?? "" }));
    }
    assert.equal((await replay(changed, undefined, undefined, f.authorization)).ok, false);
  } finally { g.close(); }
});

test("DISC-3: signed development mode exposes rule/reason but never the decision object", async () => {
  const f = signed("full"), g = await createGuard(f);
  try {
    const wallet = { publicKey: { toBase58: () => address, toBytes: () => Uint8Array.from(key(1)) }, signTransaction: async <T>(tx: T) => tx, signAllTransactions: async <T>(txs: T[]) => txs, signAndSendTransaction: async () => ({ signature: "" }), signMessage: async (m: Uint8Array) => m };
    await assert.rejects(guardedWallet(wallet, g, { rpc: { getBlockHeight: async () => 10n, sendRawTransaction: async () => "", confirm: async () => "unknown" } }).signTransaction({ serializeMessage: () => message }), e => {
      assert.ok(e instanceof SolanautDenied); assert.equal(e.rule, "destination-not-allowed");
      assert.equal(e.message.includes(e.reason!), true); assert.equal("decision" in e, false); return true;
    });
    assert.equal((g.entries().at(-1) as any).disclosure, "full");
  } finally { g.close(); }
});
test("DISC-3: a wrong signature cannot enable full disclosure", async () => {
  const f = signed("full");
  await assert.rejects(createGuard({ ...f, authorization: { ...f.authorization, signature: Buffer.alloc(64).toString("base64") } }), /signature/);
});
test("DISC-1: unknown/prototype rule names fail conservatively and sequence is captured once", () => {
  let reads = 0;
  const d = { get seq() { reads++; return reads === 1 ? 42 : privateText; } } as unknown as Decision;
  const e = inspect(new SolanautDenied("__proto__" as DeniedRule, privateText, d));
  assert.equal(e.class, "refused"); assert.equal(e.ref, 42); assert.equal(reads, 1);
});
test("DISC-2: the observer is captured before asynchronous guard creation", async () => {
  let original = 0, changed = 0;
  const options = { policy: WORKLOAD_POLICY, onRefusal: () => { original++; } };
  const opening = createGuard(options); options.onRefusal = () => { changed++; };
  const g = await opening;
  try { g.check({ message: Uint8Array.of(255), at: 1000 }); assert.equal(original, 1); assert.equal(changed, 0); }
  finally { g.close(); }
});
for (const mode of ["wallet", "kit"] as const) test(`DISC-1: ${mode} RPC errors cannot carry private provider text`, async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  try {
    const rpc = { getBlockHeight: async () => { throw new Error(privateText); }, sendRawTransaction: async () => "", confirm: async () => "unknown" as const };
    const wallet = { publicKey: { toBase58: () => address, toBytes: () => Uint8Array.from(key(1)) }, signTransaction: async <T>(tx: T) => tx, signAllTransactions: async <T>(txs: T[]) => txs, signAndSendTransaction: async () => ({ signature: "" }), signMessage: async (m: Uint8Array) => m };
    const work = mode === "wallet" ? guardedWallet(wallet, g, { rpc, now: () => 1000 }).signTransaction({ serializeMessage: () => message }) : guardedSigner({ address, signTransactions: async () => [] }, g, { rpc }).signTransactions([{ messageBytes: message, signatures: {} }]);
    await assert.rejects(work, e => inspect(e).class === "retry-later");
  } finally { g.close(); }
});

test("DISC-2: failed persistence produces a truthful unrecorded operator refusal", async () => {
  const store = memoryStore(), observed: any[] = [];
  store.append = () => { throw new Error(privateText); };
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: store, onRefusal: d => { observed.push(d); } });
  try {
    const d = g.check({ message: Uint8Array.of(255), at: 1000 });
    assert.equal(d.seq, -1); assert.equal(g.entries().length, 0);
    assert.equal(observed.length, 1); assert.equal(observed[0].decision.seq, -1);
  } finally { g.close(); }
});
