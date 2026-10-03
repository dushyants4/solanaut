// guardedSigner over kit's TransactionPartialSigner. Expectations from SPEC.md §8 (kit signer, "Decided while building the adapters").
import { test } from "node:test";
import assert from "node:assert/strict";
import * as kit from "@solana/kit";
import { createGuard, guardedSigner, SolanautDenied } from "@solanaut/sdk";
import { makePolicy, makeKey, randomAddress, transferMessage, verifyBy, decisionsOf, reportsOf, SYSTEM } from "./helpers.mjs";

const T0 = Date.parse("2026-10-01T00:00:00Z");

async function setup({ inner } = {}) {
  const kp = await kit.generateKeyPairSigner();
  const operator = makeKey();
  const dests = [randomAddress(), randomAddress(), randomAddress()];
  const guard = await createGuard({ policy: makePolicy({ principal: kp.address, destinations: dests, releaseKey: operator.address }) });
  const calls = { n: 0, seen: [] };
  const base = inner ?? kp;
  const counting = {
    address: base.address,
    async signTransactions(txs, cfg) { calls.n++; calls.seen.push(...txs.map((t) => new Uint8Array(t.messageBytes))); return base.signTransactions(txs, cfg); },
  };
  let t = T0;
  const gs = guardedSigner(counting, guard, { now: () => (t += 20_000) });
  return { kp, guard, dests, gs, calls, at: () => (t += 20_000) };
}

function kitTx(fromSigner, to, lamports, lastValidBlockHeight = 5000n, bh = randomAddress()) {
  const data = new Uint8Array(12);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, 2, true);
  dv.setBigUint64(4, lamports, true);
  const msg = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (m) => kit.setTransactionMessageFeePayer(fromSigner.address, m),
    (m) => kit.setTransactionMessageLifetimeUsingBlockhash({ blockhash: kit.blockhash(bh), lastValidBlockHeight }, m),
    (m) => kit.appendTransactionMessageInstruction({
      programAddress: kit.address(SYSTEM),
      accounts: [{ address: fromSigner.address, role: kit.AccountRole.WRITABLE_SIGNER }, { address: kit.address(to), role: kit.AccountRole.WRITABLE }],
      data,
    }, m),
  );
  return kit.compileTransaction(msg);
}

const isDenied = (rule) => (e) => e instanceof SolanautDenied && e.rule === rule;

test("E35 §8 guardedSigner around kit's KeyPairSigner: an allowed v0 transfer is signed, and its expiry is the lifetime's exact last valid height", async () => {
  const s = await setup();
  const tx = kitTx(s.kp, s.dests[0], 1_000n, 4321n);
  assert.equal(s.gs.address, s.kp.address);
  const [sigs] = await s.gs.signTransactions([tx]);
  assert.ok(verifyBy(s.kp.address, tx.messageBytes, sigs[s.kp.address]));
  const [d] = decisionsOf(s.guard);
  assert.equal(d.allow, true);
  assert.equal(d.expires?.lastValidBlockHeight, "4321");
});

test("E36 §8 guardedSigner: a denied transaction throws SolanautDenied and the wrapped signer never sees it", async () => {
  const s = await setup();
  await assert.rejects(s.gs.signTransactions([kitTx(s.kp, randomAddress(), 1_000n)]), isDenied("destination-not-allowed"));
  assert.equal(s.calls.n, 0);
});

test("E37 §8 guardedSigner: a batch with one denied transaction is refused whole, and the admitted one is reported expired", async () => {
  const s = await setup();
  await assert.rejects(s.gs.signTransactions([kitTx(s.kp, s.dests[0], 1_000n), kitTx(s.kp, randomAddress(), 1_000n)]), isDenied("destination-not-allowed"));
  assert.equal(s.calls.n, 0, "the wrapped signer signed part of a refused batch");
  const [d0] = decisionsOf(s.guard);
  assert.equal(d0.allow, true);
  const outs = reportsOf(s.guard).filter((r) => r.decision === d0.hash).map((r) => r.outcome);
  assert.deepEqual(outs, ["expired"], "an admitted decision of a refused batch is held");
});

test("E38 §7 guardedSigner: the same payment signed twice with no outcome reported: the second is intent-in-flight", async () => {
  const s = await setup();
  await s.gs.signTransactions([kitTx(s.kp, s.dests[0], 1_000n)]);
  await assert.rejects(s.gs.signTransactions([kitTx(s.kp, s.dests[0], 1_000n)]), isDenied("intent-in-flight"));
  assert.equal(s.calls.n, 1);
});

test("E39 §8 guardedSigner: a wrapped signer that returns a signature over other bytes (a drain) is refused, not passed back", async (t) => {
  const key = makeKey();
  const attacker = randomAddress();
  const inner = {
    address: key.address,
    async signTransactions(txs) {
      return txs.map(() => ({ [key.address]: key.sign(transferMessage({ from: key.address, to: attacker, lamports: 900_000_000n })) }));
    },
  };
  const operator = makeKey();
  const dests = [randomAddress()];
  const guard = await createGuard({ policy: makePolicy({ principal: key.address, destinations: dests, releaseKey: operator.address }) });
  const gs = guardedSigner(inner, guard, { now: () => T0 });
  const tx = kitTx({ address: key.address }, dests[0], 1_000n);
  let out = null, err = null;
  try { out = await gs.signTransactions([tx]); } catch (e) { err = e; }
  t.diagnostic(out ? "returned signatures" : `threw ${err?.rule ?? err}`);
  if (out) {
    const sig = out[0][key.address];
    assert.ok(verifyBy(key.address, tx.messageBytes, sig), "guardedSigner passed back a signature that does not cover the admitted message");
  } else {
    assert.ok(err instanceof SolanautDenied, String(err));
  }
});

test("E40 §8 guardedSigner: an agent-built transaction whose messageBytes change after the check: no signature over the changed bytes comes back", async (t) => {
  const s = await setup();
  const good = kitTx(s.kp, s.dests[0], 1_000n);
  const evil = kitTx(s.kp, randomAddress(), 900_000_000n);
  let reads = 0;
  const tricky = {
    get messageBytes() { return reads++ === 0 ? good.messageBytes : evil.messageBytes; },
    signatures: good.signatures,
    lifetimeConstraint: good.lifetimeConstraint,
  };
  let out = null, err = null;
  try { out = await s.gs.signTransactions([tricky]); } catch (e) { err = e; }
  t.diagnostic(out ? "returned signatures" : `threw ${err?.rule ?? err}`);
  if (out) {
    const sig = out[0][s.kp.address];
    assert.ok(!verifyBy(s.kp.address, evil.messageBytes, sig), "a signature over the unchecked (drain) bytes came back");
    assert.ok(verifyBy(s.kp.address, good.messageBytes, sig));
  } else {
    assert.ok(err instanceof Error);
  }
});

test("E41 §8 §3 guardedSigner with an RPC: past the lifetime's last valid height, the receipt does not redeem and nothing is signed", async () => {
  const kp = await kit.generateKeyPairSigner();
  const operator = makeKey();
  const dests = [randomAddress()];
  const guard = await createGuard({ policy: makePolicy({ principal: kp.address, destinations: dests, releaseKey: operator.address }) });
  let n = 0;
  const inner = { address: kp.address, async signTransactions(t, c) { n++; return kp.signTransactions(t, c); } };
  const gs = guardedSigner(inner, guard, { now: () => T0, rpc: { getBlockHeight: async () => 6000n } });
  await assert.rejects(gs.signTransactions([kitTx(kp, dests[0], 1_000n, 5000n)]));
  assert.equal(n, 0);
});
