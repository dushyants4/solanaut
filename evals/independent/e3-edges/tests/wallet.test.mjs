// guardedWallet with a fake BaseWalletLike and a fake RpcLike. Expectations from SPEC.md §7, §8, §10 (D13, D14).
import { test } from "node:test";
import assert from "node:assert/strict";
import { guardedWallet, SolanautDenied, RpcRefused, decodeTransaction, encodeBase58 } from "@solanaut/sdk";
import { world, makeKey, randomAddress, transferMessage, verifyBy, decisionsOf, reportsOf } from "./helpers.mjs";
import { fakeWallet, fakeRpc, versionedTx, legacyTx, hasAnySignature, sigsOf, messageOf } from "./fakes.mjs";

const T0 = Date.parse("2026-10-01T00:00:00Z");

async function setup({ overrides, mode = "honest", rpcOpts = {}, evil, otherKey, changeIndex } = {}) {
  const w = await world({ overrides });
  const fw = fakeWallet(w.agent, { mode, evil, otherKey, changeIndex });
  const rpc = fakeRpc({ refusedClass: RpcRefused, ...rpcOpts });
  let t = T0;
  const now = () => (t += 20_000);
  const gw = guardedWallet(fw.wallet, w.guard, { rpc, now });
  const at = () => (t += 20_000);
  return { ...w, ...fw, rpc, gw, at };
}

const isDenied = (rule) => (e) => e instanceof SolanautDenied && e.rule === rule;
const reportFor = (guard, d) => reportsOf(guard).filter((r) => r.decision === d.hash).map((r) => r.outcome);

test("E01 §8 guardedWallet exposes exactly six members and never the wrapped wallet", async () => {
  const s = await setup();
  const keys = Reflect.ownKeys(s.gw).map(String).sort();
  assert.deepEqual(keys, ["publicKey", "sendTransaction", "signAllTransactions", "signAndSendTransaction", "signMessage", "signTransaction"]);
  const reach = [];
  for (let o = s.gw; o && o !== Object.prototype && o !== Function.prototype; o = Object.getPrototypeOf(o)) {
    for (const k of Reflect.ownKeys(o)) {
      const d = Object.getOwnPropertyDescriptor(o, k);
      if ("value" in d) reach.push(d.value);
    }
  }
  for (const v of reach) {
    assert.notEqual(v, s.wallet, "a member is the wrapped wallet");
    for (const k of ["signTransaction", "signAllTransactions", "signAndSendTransaction", "sendTransaction", "signMessage"]) assert.notEqual(v, s.wallet[k], `a member is the wallet's own ${k}`);
  }
  assert.equal(s.gw.publicKey.toBase58(), s.agent.address);
});

test("E02 §8 signMessage is denied as message-signing-denied, with no decision, and the wallet never signs", async () => {
  const s = await setup();
  await assert.rejects(s.gw.signMessage(new Uint8Array([1, 2, 3])), (e) => e instanceof SolanautDenied && e.rule === "message-signing-denied" && e.decision === null);
  assert.equal(s.calls.signMessage, 0);
});

test("E03 §8 signAndSendTransaction: the guard sends the exact admitted bytes through its own RPC, expiry is height+150, outcome reported", async () => {
  const s = await setup({ rpcOpts: { height: 1000n, confirm: "landed" } });
  const msg = s.pay(0, 1_000n);
  const r = await s.gw.signAndSendTransaction(versionedTx(msg));
  assert.equal(s.rpc.state.sent.length, 1);
  const { message, signatures } = decodeTransaction(s.rpc.state.sent[0]);
  assert.deepEqual(Buffer.from(message), Buffer.from(msg), "sent message differs from the admitted one");
  assert.ok(verifyBy(s.agent.address, msg, signatures[0]), "sent signature does not verify");
  assert.equal(r.signature, encodeBase58(signatures[0]));
  const [d] = decisionsOf(s.guard);
  assert.equal(d.allow, true);
  assert.equal(d.expires?.lastValidBlockHeight, "1150");
  assert.ok(s.rpc.state.log.includes("confirm:1150"));
  assert.deepEqual(reportFor(s.guard, d), ["landed"]);
  assert.equal(s.calls.signAndSendTransaction + s.calls.sendTransaction, 0, "the wrapped wallet sent");
});

test("E04 §8 sendTransaction: check, sign, send and report, the same as signAndSendTransaction", async () => {
  const s = await setup({ rpcOpts: { confirm: "landed" } });
  const sig = await s.gw.sendTransaction(versionedTx(s.pay(1, 2_000n)));
  assert.equal(typeof sig, "string");
  assert.equal(s.rpc.state.sent.length, 1);
  const [d] = decisionsOf(s.guard);
  assert.deepEqual(reportFor(s.guard, d), ["landed"]);
  assert.equal(s.calls.sendTransaction + s.calls.signAndSendTransaction, 0);
});

test("E05 §8 a policy denial throws SolanautDenied {rule, reason, decision}; the wallet and the RPC never see it", async () => {
  const s = await setup();
  const tx = versionedTx(transferMessage({ from: s.agent.address, to: randomAddress(), lamports: 1_000n }));
  await assert.rejects(s.gw.signAndSendTransaction(tx), (e) => {
    assert.ok(e instanceof SolanautDenied);
    assert.equal(e.rule, "destination-not-allowed");
    assert.equal(typeof e.reason, "string");
    assert.equal(e.decision?.allow, false);
    assert.equal(e.decision?.hash, decisionsOf(s.guard).at(-1).hash);
    return true;
  });
  assert.equal(s.calls.signTransaction + s.calls.signAllTransactions, 0);
  assert.equal(s.rpc.state.sent.length, 0);
  assert.equal(hasAnySignature(tx), false);
});

test("E06 §8 a wallet that changes the message before signing: wallet-changed-message, signatures removed, nothing sent, decision released", async () => {
  const attacker = randomAddress();
  let agentAddr;
  const s = await setup({
    mode: "change",
    overrides: { sol: { maxPerWindow: 1_000n } },
    evil: () => transferMessage({ from: agentAddr, to: attacker, lamports: 1_000n }),
  });
  agentAddr = s.agent.address;
  const tx = versionedTx(s.pay(0, 1_000n));
  await assert.rejects(s.gw.signAndSendTransaction(tx), isDenied("wallet-changed-message"));
  assert.equal(hasAnySignature(tx), false, "a signature was left on the caller's object");
  assert.equal(s.rpc.state.sent.length, 0, "changed bytes were sent");
  // released: the same payment, and the window it reserved, are free again
  const again = s.guard.check({ message: s.pay(0, 1_000n), at: s.at() });
  assert.equal(again.allow, true, `re-proposal: ${again.rule} ${again.reason}`);
});

test("E07 §8 a legacy Transaction whose signature does not verify by the wallet's key: wallet-changed-message, signatures removed", async () => {
  const s = await setup({ mode: "badsig", otherKey: makeKey() });
  const tx = legacyTx(s.pay(0, 1_000n));
  await assert.rejects(s.gw.signTransaction(tx), isDenied("wallet-changed-message"));
  assert.equal(hasAnySignature(tx), false);
  const again = s.guard.check({ message: s.pay(0, 1_000n), at: s.at() });
  assert.equal(again.allow, true, `re-proposal: ${again.rule} ${again.reason}`);
});

test("E08 §8 a wallet that refuses to sign: the admitted decision is reported expired, so the payment is not held", async () => {
  const s = await setup({ mode: "refuse" });
  await assert.rejects(s.gw.signTransaction(versionedTx(s.pay(0, 1_000n))));
  const [d] = decisionsOf(s.guard);
  assert.equal(d.allow, true);
  assert.deepEqual(reportFor(s.guard, d), ["expired"]);
  const again = s.guard.check({ message: s.pay(0, 1_000n), at: s.at() });
  assert.equal(again.allow, true, `re-proposal: ${again.rule} ${again.reason}`);
});

test("E09 §8 D13 a send the RPC refuses (RpcRefused) is reported failed and rethrown; a retry is admitted", async () => {
  const s = await setup({ rpcOpts: { send: "refused" } });
  await assert.rejects(s.gw.signAndSendTransaction(versionedTx(s.pay(0, 1_000n))), (e) => e instanceof RpcRefused && e.refused === true);
  const [d] = decisionsOf(s.guard);
  assert.deepEqual(reportFor(s.guard, d), ["failed"]);
  const again = s.guard.check({ message: s.pay(0, 1_000n), at: s.at() });
  assert.equal(again.allow, true, `retry: ${again.rule} ${again.reason}`);
});

test("E10 §8 D13 a dropped connection on send is reported unknown and rethrown; the payment and its window reservation are held", async () => {
  const s = await setup({ rpcOpts: { send: "error", status: null }, overrides: { sol: { maxPerWindow: 1_000n } } });
  await assert.rejects(s.gw.signAndSendTransaction(versionedTx(s.pay(0, 1_000n))), (e) => e.code === "ECONNRESET");
  const [d] = decisionsOf(s.guard);
  assert.deepEqual(reportFor(s.guard, d), ["unknown"]);
  await assert.rejects(s.gw.signAndSendTransaction(versionedTx(s.pay(0, 1_000n))), isDenied("intent-in-flight"));
  const other = s.guard.check({ message: s.pay(1, 1_000n), at: s.at() });
  assert.equal(other.rule, "over-window-cap", "the unknown attempt's reservation was released");
});

test("E11 §8 D13 after a good send, a confirm that throws does not release the payment", async () => {
  const s = await setup({ rpcOpts: { confirm: "throw", status: null } });
  try { await s.gw.signAndSendTransaction(versionedTx(s.pay(0, 1_000n))); } catch { /* either is acceptable */ }
  const [d] = decisionsOf(s.guard);
  const outs = reportFor(s.guard, d);
  assert.ok(!outs.includes("failed") && !outs.includes("expired"), `reported ${outs}`);
  const again = s.guard.check({ message: s.pay(0, 1_000n), at: s.at() });
  assert.equal(again.rule, "intent-in-flight");
});

test("E12 §7 D14 sign only, then the next proposal: the follow-up sees it landed and reports it first; the same payment is a new intent", async () => {
  const s = await setup({ rpcOpts: { status: () => "landed" } });
  const tx1 = versionedTx(s.pay(0, 1_000n));
  await s.gw.signTransaction(tx1);
  const sig1 = encodeBase58(sigsOf(tx1)[0]);
  await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n)));
  const [d1, d2] = decisionsOf(s.guard);
  assert.equal(d2.allow, true);
  const landed = reportsOf(s.guard).find((r) => r.decision === d1.hash && r.outcome === "landed");
  assert.ok(landed, "no landed report for the signed-only attempt");
  assert.ok(landed.seq < d2.seq, "reported after the next decision");
  assert.ok(s.rpc.state.statusAsked.includes(sig1));
});

test("E13 §7 D14 sign only, unseen and past its last valid height: reported expired; a retry is admitted", async () => {
  const s = await setup({ rpcOpts: { height: 1000n, status: null } });
  await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n)));
  s.rpc.state.height = 1151n;
  await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n)));
  const [d1, d2] = decisionsOf(s.guard);
  assert.deepEqual(reportFor(s.guard, d1), ["expired"]);
  assert.equal(d2.allow, true);
});

test("E14 §7 D14 sign only, with an RPC that cannot search history: the attempt holds its intent at any height", async () => {
  // confirm() answers "expired" for anything it is asked: a status read without history cannot see an old landed tx
  const s = await setup({ rpcOpts: { height: 1000n, withStatus: false, confirm: "expired" } });
  await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n)));
  s.rpc.state.height = 100_000n;
  await assert.rejects(s.gw.signTransaction(versionedTx(s.pay(0, 1_000n))), isDenied("intent-in-flight"));
  const [d1] = decisionsOf(s.guard);
  assert.ok(!reportFor(s.guard, d1).includes("expired"), "an unseen attempt was called expired without a history search");
});

test("E15 §7 §10 D14 the follow-up reads the height before the status: a payment landing at its last valid height is never called expired", async () => {
  const s = await setup({ rpcOpts: { height: 1000n } });
  await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n)));
  // lvbh = 1150. The chain: height 1150 until the first status read; the tx lands at 1150 and is visible after it.
  let statusReads = 0;
  s.rpc.state.height = () => (statusReads === 0 ? 1150n : 1151n);
  s.rpc.getSignatureStatus = async () => { statusReads++; return statusReads === 1 ? null : "landed"; };
  let admitted = true;
  try { await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n))); } catch (e) { admitted = false; assert.ok(isDenied("intent-in-flight")(e), String(e)); }
  const [d1] = decisionsOf(s.guard);
  const outs = reportFor(s.guard, d1);
  assert.ok(!outs.includes("expired"), "a landed payment was reported expired");
  if (admitted) assert.ok(outs.includes("landed"));
});

test("E16 §7 D13+D14 a send with an unknown fate, followed up before the next proposal: seen landed, reported landed", async () => {
  let n = 0;
  const s = await setup({ rpcOpts: { send: () => { if (n++ === 0) { const e = new Error("socket hang up"); e.code = "ECONNRESET"; throw e; } }, status: () => "landed" } });
  await assert.rejects(s.gw.signAndSendTransaction(versionedTx(s.pay(0, 1_000n))));
  await s.gw.signAndSendTransaction(versionedTx(s.pay(0, 1_000n)));
  const [d1, d2] = decisionsOf(s.guard);
  assert.ok(reportFor(s.guard, d1).includes("landed"), `first attempt reported ${reportFor(s.guard, d1)}`);
  assert.equal(d2.allow, true);
});

test("E17 §8 §7 a slow RPC: two concurrent sends of the same payment, exactly one admitted and sent", async () => {
  const s = await setup({ rpcOpts: { sendDelayMs: 300, status: null } });
  const res = await Promise.allSettled([
    s.gw.signAndSendTransaction(versionedTx(s.pay(0, 1_000n))),
    s.gw.signAndSendTransaction(versionedTx(s.pay(0, 1_000n))),
  ]);
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
  const rej = res.find((r) => r.status === "rejected");
  assert.ok(rej && isDenied("intent-in-flight")(rej.reason), String(rej?.reason));
  assert.equal(s.rpc.state.sent.length, 1);
});

test("E18 §8 signAllTransactions: one refused in the middle, nothing signed, every admitted decision reported expired", async () => {
  const s = await setup();
  const txs = [versionedTx(s.pay(0, 1_000n)), versionedTx(transferMessage({ from: s.agent.address, to: randomAddress(), lamports: 1_000n })), versionedTx(s.pay(2, 3_000n))];
  await assert.rejects(s.gw.signAllTransactions(txs), isDenied("destination-not-allowed"));
  assert.equal(s.calls.signAllTransactions + s.calls.signTransaction, 0, "the wallet saw part of a refused batch");
  assert.ok(txs.every((t) => !hasAnySignature(t)));
  const allowed = decisionsOf(s.guard).filter((d) => d.allow);
  assert.ok(allowed.length >= 1);
  for (const d of allowed) assert.deepEqual(reportFor(s.guard, d), ["expired"], `decision ${d.seq} held`);
  const again = s.guard.check({ message: s.pay(0, 1_000n), at: s.at() });
  assert.equal(again.allow, true, `re-proposal: ${again.rule}`);
});

test("E19 §8 signAllTransactions: the same payment twice in one batch is refused whole (intent-in-flight); nothing held", async () => {
  const s = await setup();
  const txs = [versionedTx(s.pay(0, 1_000n)), versionedTx(s.pay(0, 1_000n))];
  await assert.rejects(s.gw.signAllTransactions(txs), isDenied("intent-in-flight"));
  assert.equal(s.calls.signAllTransactions + s.calls.signTransaction, 0);
  assert.ok(txs.every((t) => !hasAnySignature(t)));
  const [d1] = decisionsOf(s.guard);
  assert.deepEqual(reportFor(s.guard, d1), ["expired"]);
});

test("E20 §8 signAllTransactions: the wallet changes one message; no signature survives on any caller object, every decision released", async () => {
  const attacker = randomAddress();
  let agentAddr;
  const s = await setup({ changeIndex: 1, evil: () => transferMessage({ from: agentAddr, to: attacker, lamports: 2_000n }) });
  agentAddr = s.agent.address;
  const txs = [versionedTx(s.pay(0, 1_000n)), versionedTx(s.pay(1, 2_000n)), versionedTx(s.pay(2, 3_000n))];
  await assert.rejects(s.gw.signAllTransactions(txs), isDenied("wallet-changed-message"));
  const left = txs.map((t, i) => (hasAnySignature(t) ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(left, [], `signatures left on caller objects ${left}`);
  // released: each admitted decision of the batch is reported expired (or failed), none left holding its intent
  const allowed = decisionsOf(s.guard).filter((d) => d.allow);
  assert.equal(allowed.length, 3);
  for (const d of allowed) {
    const outs = reportFor(s.guard, d);
    assert.ok(outs.includes("expired") || outs.includes("failed"), `decision ${d.seq} held: ${outs}`);
  }
  const again = s.guard.check({ message: s.pay(2, 3_000n), at: s.at() });
  assert.notEqual(again.rule, "intent-in-flight");
});

test("E21 §8 an RPC is required: guardedWallet without one throws", async () => {
  const w = await world();
  const { wallet } = fakeWallet(w.agent);
  assert.throws(() => guardedWallet(wallet, w.guard, {}));
});

test("E22 §8 wallet-changed-message has no decision behind it: SolanautDenied.decision is null", async () => {
  let agentAddr;
  const s = await setup({ mode: "change", evil: () => transferMessage({ from: agentAddr, to: randomAddress(), lamports: 1_000n }) });
  agentAddr = s.agent.address;
  await assert.rejects(s.gw.signTransaction(versionedTx(s.pay(0, 1_000n))), (e) => {
    assert.ok(isDenied("wallet-changed-message")(e));
    assert.equal(e.decision, null, `decision carried: allow=${e.decision?.allow} seq=${e.decision?.seq}`);
    return true;
  });
});

test("E23 §8 a wallet that returns a new, changed transaction object (input untouched): wallet-changed-message, nothing sent", async () => {
  const s = await setup({ rpcOpts: { confirm: "landed" } });
  const attacker = randomAddress();
  s.wallet.signTransaction = async () => {
    const evil = transferMessage({ from: s.agent.address, to: attacker, lamports: 900_000_000n });
    const copy = versionedTx(evil);
    copy.signatures = [s.agent.sign(evil)];
    return copy;
  };
  s.wallet.signAllTransactions = async (txs) => Promise.all(txs.map((t) => s.wallet.signTransaction(t)));
  await assert.rejects(s.gw.signAndSendTransaction(versionedTx(s.pay(0, 1_000n))), isDenied("wallet-changed-message"));
  assert.equal(s.rpc.state.sent.length, 0, "the wallet's changed bytes were sent");
});

test("E24 §8 an agent-built transaction whose message bytes change between reads: the changed bytes are never sent, nothing signed is left", async (t) => {
  const s = await setup({ rpcOpts: { confirm: "landed" } });
  const benign = s.pay(0, 1_000n);
  const evil = transferMessage({ from: s.agent.address, to: randomAddress(), lamports: 900_000_000n });
  const tx = versionedTx(benign);
  let reads = 0;
  const msgObj = tx.message;
  const orig = msgObj.serialize.bind(msgObj);
  msgObj.serialize = () => (reads++ === 0 ? orig() : evil);
  let threw = null;
  try { await s.gw.signAndSendTransaction(tx); } catch (e) { threw = e; }
  t.diagnostic(`threw=${threw?.rule ?? threw} sent=${s.rpc.state.sent.length}`);
  for (const w of s.rpc.state.sent) {
    const { message } = decodeTransaction(w);
    assert.deepEqual(Buffer.from(message), Buffer.from(benign), "bytes other than the admitted ones were sent");
  }
  if (threw) {
    assert.ok(threw instanceof SolanautDenied, String(threw));
    assert.equal(hasAnySignature(tx), false, "a signature over the changed bytes was left on the caller's object");
  }
});

test("E71 §7 D14 a signed-only batch is followed up whole: both attempts seen landed are reported before the next proposal", async () => {
  const s = await setup({ rpcOpts: { status: () => "landed" } });
  await s.gw.signAllTransactions([versionedTx(s.pay(0, 1_000n)), versionedTx(s.pay(1, 2_000n))]);
  await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n)));
  const [d0, d1, d2] = decisionsOf(s.guard);
  assert.equal(d2.allow, true, `${d2.rule}`);
  for (const d of [d0, d1]) {
    const r = reportsOf(s.guard).find((x) => x.decision === d.hash && x.outcome === "landed");
    assert.ok(r && r.seq < d2.seq, `decision ${d.seq} not followed up before the next proposal`);
  }
});

test("E72 §7 D14 a follow-up whose status read throws, past the last valid height: the attempt is held, never called expired", async () => {
  const s = await setup({ rpcOpts: { height: 1000n, status: () => { throw new Error("getSignatureStatuses: fetch failed"); } } });
  await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n)));
  s.rpc.state.height = 5000n;
  let admitted = true;
  try { await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n))); } catch { admitted = false; }
  const [d1] = decisionsOf(s.guard);
  assert.ok(!reportFor(s.guard, d1).includes("expired"), "an unread attempt was called expired");
  assert.equal(admitted, false, "a re-sign was admitted while the first attempt's fate was unread");
});

test("E73 §7 D14 a follow-up at exactly the last valid height, unseen: it can still land, so it is held", async () => {
  const s = await setup({ rpcOpts: { height: 1000n, status: null } });
  await s.gw.signTransaction(versionedTx(s.pay(0, 1_000n)));
  s.rpc.state.height = 1150n;
  await assert.rejects(s.gw.signTransaction(versionedTx(s.pay(0, 1_000n))), isDenied("intent-in-flight"));
  const [d1] = decisionsOf(s.guard);
  assert.ok(!reportFor(s.guard, d1).includes("expired"));
});

test("E78 §8 signAllTransactions: a wallet that signs both in place but returns only one: all or nothing, no signed bytes left with the caller", async (t) => {
  const s = await setup();
  const inner = s.wallet.signAllTransactions.bind(s.wallet);
  s.wallet.signAllTransactions = async (txs) => (await inner(txs)).slice(0, 1);
  const txs = [versionedTx(s.pay(0, 1_000n)), versionedTx(s.pay(1, 2_000n))];
  let out = null, err = null;
  try { out = await s.gw.signAllTransactions(txs); } catch (e) { err = e; }
  const left = txs.map((tx, i) => (hasAnySignature(tx) ? i : -1)).filter((i) => i >= 0);
  const validLeft = left.filter((i) => verifyBy(s.agent.address, messageOf(txs[i]), sigsOf(txs[i])[0]));
  const decided = decisionsOf(s.guard).filter((d) => d.allow).map((d) => `seq ${d.seq}: ${reportFor(s.guard, d).join(",") || "no report"}`);
  t.diagnostic(`returned=${out ? out.length : "threw " + (err?.rule ?? err)}; signed objects left=${left}; of them valid signatures over their message=${validLeft}; decisions: ${decided.join("; ")}`);
  assert.equal(out, null, `returned ${out?.length} transactions for a batch of 2`);
  assert.ok(err instanceof SolanautDenied, String(err));
  assert.deepEqual(left, [], `signed bytes left on caller objects ${left} (valid: ${validLeft}); decisions: ${decided.join("; ")}`);
});

test("E79 §8 signAllTransactions: a wallet that appends an extra signed transaction: it never reaches the caller", async (t) => {
  const s = await setup();
  const inner = s.wallet.signAllTransactions.bind(s.wallet);
  const evilMsg = transferMessage({ from: s.agent.address, to: randomAddress(), lamports: 900_000_000n });
  s.wallet.signAllTransactions = async (txs) => {
    const out = await inner(txs);
    const extra = versionedTx(evilMsg);
    extra.signatures = [s.agent.sign(evilMsg)];
    return [...out, extra];
  };
  let out = null, err = null;
  try { out = await s.gw.signAllTransactions([versionedTx(s.pay(0, 1_000n))]); } catch (e) { err = e; }
  t.diagnostic(`returned=${out ? out.length : "threw " + (err?.rule ?? err)}`);
  if (out) assert.equal(out.length, 1, `returned ${out.length} transactions for a batch of 1`);
});
