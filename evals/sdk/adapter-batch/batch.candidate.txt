// ADR-009: batch membership stays tied to admissions even when a wallet edits its array.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { createGuard } from "../src/guard.ts";
import { guardedWallet, type BaseWalletLike, type RpcLike } from "../src/adapters/agent-kit.ts";
import { encodeBase58 } from "../src/base58.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";

function fixture() {
  const agent = generateKeyPairSync("ed25519");
  const bytes = Buffer.from(agent.publicKey.export({ format: "jwk" }).x!, "base64url");
  const address = encodeBase58(bytes);
  const publicKey = { toBase58: () => address, toBytes: () => new Uint8Array(bytes) };
  const transaction = (amount: number) => {
    const message = craftLegacy({ header: [1, 0, 1], keys: [[...bytes], key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, amount, 0, 0, 0, 0, 0, 0, 0] }] });
    return { serializeMessage: () => message, signatures: [{ publicKey, signature: null as Uint8Array | null }] };
  };
  type Tx = ReturnType<typeof transaction>;
  const signTx = <T extends Tx>(tx: T): T => { tx.signatures[0]!.signature = sign(null, tx.serializeMessage(), agent.privateKey); return tx; };
  const wallet: BaseWalletLike<Tx> = {
    publicKey, signTransaction: async tx => signTx(tx), signAllTransactions: async txs => txs.map(signTx),
    signAndSendTransaction: async () => { throw new Error("wallet must not send"); },
    signMessage: async () => { throw new Error("message signing must be denied"); },
  };
  const rpc: RpcLike = { getBlockHeight: async () => 10n, sendRawTransaction: async () => { throw new Error("signing must not send"); }, confirm: async () => "landed" };
  return { wallet, rpc, transaction, signTx, policy: { ...structuredClone(WORKLOAD_POLICY), principal: [address] } };
}

for (const edit of ["reverse", "remove"] as const) test(`ADP-1/ADR-009: ${edit} of wallet batch cannot release signed admissions or defeat cleanup`, async () => {
  const f = fixture(), g = await createGuard({ policy: f.policy });
  try {
    const batch = [f.transaction(1), f.transaction(2)], originals = [...batch];
    f.wallet.signAllTransactions = async txs => {
      txs.forEach(f.signTx);
      if (edit === "reverse") { txs.reverse(); return []; }
      txs.splice(0); throw new Error("wallet interrupted after signing");
    };
    await assert.rejects(guardedWallet(f.wallet, g, { rpc: f.rpc, now: () => 1000 }).signAllTransactions(batch));
    assert.deepEqual(g.entries().filter(e => e.kind === "report").map(e => e.outcome), ["unknown", "unknown"], "both validly signed messages may still land");
    assert.ok(originals.every(tx => tx.signatures[0]!.signature === null), "all original caller signatures are stripped");
    assert.deepEqual(batch, originals, "wallet membership edits cannot reach the caller's array");
    for (const tx of originals) assert.equal(g.check({ message: tx.serializeMessage(), at: 1001, blockHeight: 11n, lastValidBlockHeight: 160n }).rule, "intent-in-flight");
  } finally { g.close(); }
});

test("ADP-1/ADR-009: caller array edits during admission do not replace the requested batch", async () => {
  const f = fixture(), g = await createGuard({ policy: f.policy });
  try {
    const originals = [f.transaction(1), f.transaction(2)], batch = [...originals];
    f.rpc.getBlockHeight = async () => { batch.splice(0); return 10n; };
    const signed = await guardedWallet(f.wallet, g, { rpc: f.rpc, now: () => 1000 }).signAllTransactions(batch);
    assert.deepEqual(signed, originals);
    assert.ok(originals.every(tx => tx.signatures[0]!.signature?.length === 64));
    assert.equal(g.entries().filter(e => e.kind === "decision").length, 2);
    assert.equal(g.entries().filter(e => e.kind === "report").length, 0);
  } finally { g.close(); }
});

test("ADP-1/ADR-009: an ordinary batch returns its admitted objects without broadcasting", async () => {
  const f = fixture(), g = await createGuard({ policy: f.policy });
  try {
    const batch = [f.transaction(1), f.transaction(2)];
    const signed = await guardedWallet(f.wallet, g, { rpc: f.rpc, now: () => 1000 }).signAllTransactions(batch);
    assert.deepEqual(signed, batch);
    assert.ok(signed.every(tx => tx.signatures[0]!.signature?.length === 64));
  } finally { g.close(); }
});
