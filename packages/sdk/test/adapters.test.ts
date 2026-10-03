// Milestone 2a.8, the adapters (docs/SPEC.md §8). guardedWallet wraps a Solana Agent Kit wallet:
// it exposes exactly BaseWallet's members (read first-hand from solana-agent-kit 2.0.10's types),
// never the wallet it wraps, and checks every transaction before the wallet sees it. After signing,
// the signed message must be the admitted one, signed by the wallet's key; anything else is
// stripped of its signatures and thrown. guardedSigner does the same for a @solana/kit partial
// signer. Both give the same verdicts as the SDK, and a denial is a typed SolanautDenied.

import { strict as assert } from "node:assert";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createNoopSigner,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { createGuard, type Guard } from "../src/guard.ts";
import { guardedWallet, type BaseWalletLike, type RpcLike } from "../src/adapters/agent-kit.ts";
import { guardedSigner } from "../src/adapters/kit.ts";
import { jsonRpc, RpcRefused } from "../src/adapters/rpc.ts";
import { createServer } from "node:http";
import { once } from "node:events";
import { SolanautDenied } from "../src/errors.ts";
import { encodeBase58 } from "../src/base58.ts";
import type { PolicyInput } from "../src/policy.ts";
import { PROGRAMS } from "../src/classify.ts";

const agent = Keypair.generate();
const treasury = Keypair.generate().publicKey;
const attacker = Keypair.generate().publicKey;
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const LIGHTHOUSE = new PublicKey("L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95");
const operator = encodeBase58(Buffer.from(generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x!, "base64url"));

const policy = (principal = agent.publicKey.toBase58()): PolicyInput => ({
  version: 1,
  principal: [principal],
  programs: { allow: [PROGRAMS.system, PROGRAMS.memo], opaque: "deny" },
  destinations: { allow: [treasury.toBase58()] },
  sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 3_000_000_000n },
  tokens: [],
  fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 1_000_000_000n, tipAccounts: [] },
  lookupTables: [],
  windowMs: 60_000,
  intents: { maxAttempts: 3 },
  latch: { afterDenials: 100, releaseKey: operator, guardId: "adapters", cluster: "localnet" },
  messages: { allow: false },
  cosign: { allow: false },
  sensor: { expectedPerMinute: 60 },
});

/** Solana Agent Kit's KeypairWallet, as solana-agent-kit 2.0.10 builds it: it signs the caller's object in place. */
function keypairWallet(kp = agent, calls: string[] = []): BaseWalletLike {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx) => (calls.push("signTransaction"), sign(tx)),
    signAllTransactions: async (txs) => (calls.push("signAllTransactions"), txs.map(sign)),
    signAndSendTransaction: async () => { calls.push("signAndSendTransaction"); throw new Error("the guard must never ask the wallet to send"); },
    signMessage: async (m) => { calls.push("signMessage"); return m; },
  };
}

/** An RPC that records what it is sent, at a block height the test moves, and lands everything unless told otherwise. */
function fakeRpc(o: { refuse?: boolean; drop?: boolean; outcome?: "landed" | "failed" | "unknown"; statuses?: Map<string, "landed" | "failed" | "pending"> } = {}) {
  const sent: Uint8Array[] = [];
  const at = { height: 1_000n };
  const rpc: RpcLike = {
    getBlockHeight: async () => at.height,
    sendRawTransaction: async (wire) => {
      if (o.refuse) throw new RpcRefused("sendTransaction", "Transaction simulation failed: insufficient funds");
      // The request went out and no answer came back: the RPC may have forwarded the bytes.
      if (o.drop) throw new TypeError("fetch failed: other side closed");
      sent.push(wire);
      return encodeBase58(wire.subarray(1, 65));
    },
    confirm: async () => o.outcome ?? "landed",
    ...(o.statuses ? { getSignatureStatus: async (signature: string) => o.statuses!.get(signature) ?? null } : {}),
  };
  return { rpc, sent, at };
}

let blockhashSeed = 0;
const blockhash = () => encodeBase58(Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + ++blockhashSeed) % 256));
const legacy = (...ixs: TransactionInstruction[]) => new Transaction({ feePayer: agent.publicKey, recentBlockhash: blockhash() }).add(...ixs);
const versioned = (...ixs: TransactionInstruction[]) =>
  new VersionedTransaction(new TransactionMessage({ payerKey: agent.publicKey, recentBlockhash: blockhash(), instructions: ixs }).compileToV0Message());
const pay = (to: PublicKey, lamports: number) => SystemProgram.transfer({ fromPubkey: agent.publicKey, toPubkey: to, lamports });

let clock = 1_000_000;
const now = () => (clock += 30_000);
const guard = () => createGuard({ policy: policy() });

async function rejectsWith(p: Promise<unknown>, rule: string) {
  await assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof SolanautDenied, `expected SolanautDenied, got ${(e as Error)?.name}: ${(e as Error)?.message}`);
    assert.equal(e.rule, rule, e.reason);
    return true;
  });
}

// --- the surface --------------------------------------------------------------------------------------

test("guardedWallet exposes exactly BaseWallet's members, frozen, and never the wallet it wraps", async () => {
  const inner = keypairWallet();
  const w = guardedWallet(inner, await guard(), { rpc: fakeRpc().rpc, now });
  assert.deepEqual(Object.keys(w).sort(), ["publicKey", "sendTransaction", "signAllTransactions", "signAndSendTransaction", "signMessage", "signTransaction"]);
  assert.ok(Object.isFrozen(w));
  assert.equal(w.publicKey, inner.publicKey);
  for (const v of Object.values(w)) assert.notEqual(v, inner, "no member is the wrapped wallet");
});

test("guardedWallet refuses a wallet whose key is outside the policy's principal, or no RPC to send through", async () => {
  const g = await guard();
  assert.throws(() => guardedWallet(keypairWallet(Keypair.generate()), g, { rpc: fakeRpc().rpc }), /principal/);
  assert.throws(() => guardedWallet(keypairWallet(), g, {} as never), /RPC/);
});

// --- signTransaction -----------------------------------------------------------------------------------

test("signTransaction: an allowed payment is signed by the wrapped wallet; a drain throws SolanautDenied before the wallet is asked", async () => {
  const calls: string[] = [];
  const w = guardedWallet(keypairWallet(agent, calls), await guard(), { rpc: fakeRpc().rpc, now });
  const ok = await w.signTransaction(legacy(pay(treasury, 1_000)));
  assert.ok(ok.verifySignatures(), "signed by the agent's key");
  assert.deepEqual(calls, ["signTransaction"]);
  const drain = legacy(pay(attacker, 1_000));
  await assert.rejects(w.signTransaction(drain), (e: unknown) => {
    assert.ok(e instanceof SolanautDenied);
    assert.equal(e.rule, "destination-not-allowed");
    assert.match(e.reason, /not an allowed destination/);
    assert.equal(e.decision?.allow, false);
    return true;
  });
  assert.deepEqual(calls, ["signTransaction"], "the wallet never saw the drain");
  assert.ok(drain.signatures.every((s) => s.signature === null));
});

test("the adapters give the same verdicts as the SDK, for legacy and v0 transactions", async () => {
  const nonce = Keypair.generate().publicKey;
  const cases: [string, TransactionInstruction[]][] = [
    ["a payment", [pay(treasury, 5_000)]],
    ["a drain", [pay(attacker, 5_000)]],
    ["over the cap", [pay(treasury, 2_000_000_000)]],
    ["a durable nonce", [SystemProgram.nonceAdvance({ noncePubkey: nonce, authorizedPubkey: agent.publicKey }), pay(treasury, 1)]],
    ["an unlisted program", [new TransactionInstruction({ programId: LIGHTHOUSE, keys: [], data: Buffer.from([1]) })]],
    ["a memo and a payment", [new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from("invoice") }), pay(treasury, 7)]],
  ];
  for (const build of [legacy, versioned]) {
    for (const [label, ixs] of cases) {
      const sdk = await guard();
      const at = now();
      const tx = build(...ixs);
      const message = tx instanceof VersionedTransaction ? tx.message.serialize() : tx.serializeMessage();
      const expected = sdk.check({ message: new Uint8Array(message), at, blockHeight: 1_000n, lastValidBlockHeight: 1_150n });
      const w = guardedWallet(keypairWallet(), await guard(), { rpc: fakeRpc().rpc, now: () => at });
      let got: string;
      try {
        await w.signTransaction(tx);
        got = "allow";
      } catch (e) {
        got = (e as SolanautDenied).rule;
      }
      assert.equal(got, expected.allow ? "allow" : expected.rule, `${build.name}: ${label}`);
    }
  }
});

test("a re-sign of the same payment while the first could still land throws intent-in-flight", async () => {
  const w = guardedWallet(keypairWallet(), await guard(), { rpc: fakeRpc().rpc, now });
  await w.signTransaction(legacy(pay(treasury, 42)));
  await rejectsWith(w.signTransaction(legacy(pay(treasury, 42))), "intent-in-flight");
});

// --- what the wallet signed -----------------------------------------------------------------------------

test("a wallet that changes the message before signing it is caught: its signatures are stripped, and the call throws", async () => {
  const modifying: BaseWalletLike = {
    ...keypairWallet(),
    signTransaction: async (tx) => {
      // Like a wallet that appends its own assertion instruction before it signs (docs/papers/THREAT-MODEL.md, A8).
      (tx as Transaction).add(new TransactionInstruction({ programId: LIGHTHOUSE, keys: [], data: Buffer.from([9]) }));
      (tx as Transaction).partialSign(agent);
      return tx;
    },
  };
  const w = guardedWallet(modifying, await guard(), { rpc: fakeRpc().rpc, now });
  const tx = legacy(pay(treasury, 1_000));
  await rejectsWith(w.signTransaction(tx), "wallet-changed-message");
  assert.ok(tx.signatures.every((s) => s.signature === null), "nothing signed leaves the guard");
});

test("a wallet whose signature does not verify over the admitted bytes is caught", async () => {
  const wrongKey: BaseWalletLike = {
    ...keypairWallet(),
    signTransaction: async (tx) => {
      const t = tx as Transaction;
      t.signatures = t.signatures.map((s) => ({ ...s, signature: Buffer.alloc(64, 1) }));
      return tx;
    },
  };
  const w = guardedWallet(wrongKey, await guard(), { rpc: fakeRpc().rpc, now });
  await rejectsWith(w.signTransaction(legacy(pay(treasury, 1_000))), "wallet-changed-message");
});

// Found by the independent evaluator (evals/independent/, case E78).
test("a wallet that signs a whole batch in place but returns it short: every caller object is stripped, and what was signed is held, not released", async () => {
  const short: BaseWalletLike = {
    ...keypairWallet(),
    signAllTransactions: async (txs) => {
      for (const tx of txs) (tx as Transaction).partialSign(agent);
      return [txs[0]!];
    },
  };
  const g = await guard();
  const w = guardedWallet(short, g, { rpc: fakeRpc().rpc, now });
  const batch = [legacy(pay(treasury, 1)), legacy(pay(treasury, 2))];
  await rejectsWith(w.signAllTransactions(batch), "wallet-changed-message");
  assert.ok(batch.every((t) => t.signatures.every((s) => s.signature === null)), "no signed bytes are left on any caller object");
  const reports = g.entries().filter((e) => e.kind === "report").map((e) => e.kind === "report" && e.outcome);
  assert.deepEqual(reports, ["unknown", "unknown"], "each admitted message was validly signed, so neither is released as never signed");
});

// Found by the independent evaluator (evals/independent/, case E22). SPEC §8: two rules have no decision behind them.
test("wallet-changed-message carries no decision, on guardedWallet (guardedSigner: its own test)", async () => {
  const modifying: BaseWalletLike = {
    ...keypairWallet(),
    signTransaction: async (tx) => {
      (tx as Transaction).add(new TransactionInstruction({ programId: LIGHTHOUSE, keys: [], data: Buffer.from([9]) }));
      (tx as Transaction).partialSign(agent);
      return tx;
    },
  };
  const w = guardedWallet(modifying, await guard(), { rpc: fakeRpc().rpc, now });
  await assert.rejects(w.signTransaction(legacy(pay(treasury, 1_000))), (e: unknown) => e instanceof SolanautDenied && e.rule === "wallet-changed-message" && e.decision === null);
});

// --- batches, sending, messages -----------------------------------------------------------------------

test("signAllTransactions is all or nothing: one denial signs none, and the admitted ones are released", async () => {
  const calls: string[] = [];
  const g = await guard();
  const w = guardedWallet(keypairWallet(agent, calls), g, { rpc: fakeRpc().rpc, now });
  const batch = [legacy(pay(treasury, 1)), legacy(pay(attacker, 2)), legacy(pay(treasury, 3))];
  await rejectsWith(w.signAllTransactions(batch), "destination-not-allowed");
  assert.deepEqual(calls, [], "the wallet was never asked");
  const reports = g.entries().filter((e) => e.kind === "report");
  assert.deepEqual(reports.map((e) => e.kind === "report" && e.outcome), ["expired"], "the one admitted before the denial was released as never sent");
  const signed = await w.signAllTransactions([legacy(pay(treasury, 1)), legacy(pay(treasury, 3))]);
  assert.ok(signed.every((t) => t.verifySignatures()));
});

test("signAndSendTransaction: checks, signs, sends exactly the admitted bytes itself, and reports the outcome", async () => {
  const { rpc, sent } = fakeRpc();
  const calls: string[] = [];
  const g = await guard();
  const w = guardedWallet(keypairWallet(agent, calls), g, { rpc, now });
  const tx = versioned(pay(treasury, 500));
  const admitted = tx.message.serialize();
  const { signature } = await w.signAndSendTransaction(tx);
  assert.equal(sent.length, 1);
  assert.deepEqual(VersionedTransaction.deserialize(sent[0]!).message.serialize(), admitted, "the bytes sent are the bytes admitted");
  assert.equal(signature, encodeBase58(sent[0]!.subarray(1, 65)));
  assert.deepEqual(calls, ["signTransaction"], "the wallet signed; the guard sent");
  const last = g.entries().at(-1)!;
  assert.deepEqual([last.kind, last.kind === "report" && last.outcome], ["report", "landed"]);
  assert.equal(await w.sendTransaction!(legacy(pay(treasury, 501))), encodeBase58(sent[1]!.subarray(1, 65)), "sendTransaction does the same, and returns the signature");
});

test("a send the RPC refuses is reported failed, and rethrown", async () => {
  const g = await guard();
  const w = guardedWallet(keypairWallet(), g, { rpc: fakeRpc({ refuse: true }).rpc, now });
  await assert.rejects(w.signAndSendTransaction(legacy(pay(treasury, 9))), /simulation failed/);
  const last = g.entries().at(-1)!;
  assert.deepEqual([last.kind, last.kind === "report" && last.outcome], ["report", "failed"]);
});

test("a send whose fate is unknown is reported unknown, not failed: the signed bytes may still land, so a re-sign is refused", async () => {
  const g = await guard();
  const w = guardedWallet(keypairWallet(), g, { rpc: fakeRpc({ drop: true }).rpc, now });
  await assert.rejects(w.signAndSendTransaction(legacy(pay(treasury, 10))), /fetch failed/);
  const last = g.entries().at(-1)!;
  assert.deepEqual([last.kind, last.kind === "report" && last.outcome], ["report", "unknown"]);
  // The same payment again, with a new blockhash, while the first could still land: the double-send intents stop.
  await rejectsWith(w.signAndSendTransaction(legacy(pay(treasury, 10))), "intent-in-flight");
});

test("D14, sign-only: before the next proposal, guardedWallet reads the outcome of what it signed and reports it", async () => {
  const statuses = new Map<string, "landed" | "failed" | "pending">();
  const { rpc, at } = fakeRpc({ statuses });
  const g = await guard();
  const w = guardedWallet(keypairWallet(), g, { rpc, now });
  const reports = () => g.entries().filter((e) => e.kind === "report").map((e) => e.kind === "report" && e.outcome);

  // Signed, and sent by the caller; it lands. The guard is told before the next proposal is checked.
  const t1 = await w.signTransaction(legacy(pay(treasury, 20)));
  statuses.set(encodeBase58(t1.signature!), "landed");
  await w.signTransaction(legacy(pay(treasury, 21)));
  assert.deepEqual(reports(), ["landed"], "the landed payment is reported");
  // Signed and never sent: no status, and once the height passes its last valid one, it is reported expired.
  at.height = 1_150n;
  await rejectsWith(w.signTransaction(legacy(pay(treasury, 21))), "intent-in-flight");
  assert.deepEqual(reports(), ["landed"], "at exactly its last valid height it can still land: nothing to report yet");
  at.height = 1_151n;
  const third = await w.signTransaction(legacy(pay(treasury, 21))).then(() => "allowed", (e: SolanautDenied) => e.rule);
  assert.deepEqual(reports(), ["landed", "expired"], "unseen and past its expiry: it can never land, and it did not");
  assert.notEqual(third, "intent-in-flight", "the expired report freed the intent; what Keel makes of the retry is Keel's");
});

test("D14, sign-only: a payment seen but not yet confirmed is not reported, and without a status reader the guard holds the intent", async () => {
  const statuses = new Map<string, "landed" | "failed" | "pending">();
  const { rpc, at } = fakeRpc({ statuses });
  const g = await guard();
  const w = guardedWallet(keypairWallet(), g, { rpc, now });
  const t = await w.signTransaction(legacy(pay(treasury, 30)));
  statuses.set(encodeBase58(t.signature!), "pending");
  at.height = 2_000n;
  await rejectsWith(w.signTransaction(legacy(pay(treasury, 30))), "intent-in-flight");
  assert.equal(g.entries().filter((e) => e.kind === "report").length, 0, "processed, not confirmed: no outcome yet");

  const bare = fakeRpc();
  const g2 = await guard();
  const w2 = guardedWallet(keypairWallet(), g2, { rpc: bare.rpc, now });
  await w2.signTransaction(legacy(pay(treasury, 31)));
  bare.at.height = 2_000n;
  await rejectsWith(w2.signTransaction(legacy(pay(treasury, 31))), "intent-in-flight");
});

test("signMessage is denied: a raw signature over chosen bytes can be a transaction signature", async () => {
  const calls: string[] = [];
  const w = guardedWallet(keypairWallet(agent, calls), await guard(), { rpc: fakeRpc().rpc, now });
  await rejectsWith(w.signMessage(new TextEncoder().encode("hello")), "message-signing-denied");
  assert.deepEqual(calls, []);
});

// --- @solana/kit ---------------------------------------------------------------------------------------

test("guardedSigner: checks every transaction first, all or nothing, reads expiry from the lifetime, and verifies the signatures it returns", async () => {
  const kitSigner = await createKeyPairSignerFromBytes(new Uint8Array([...agent.secretKey]));
  const g = await guard();
  const s = guardedSigner(kitSigner, g, { now });
  assert.equal(s.address, kitSigner.address);
  const tx = (to: PublicKey, amount: bigint) => {
    let m: any = createTransactionMessage({ version: 0 });
    m = setTransactionMessageFeePayerSigner(createNoopSigner(kitSigner.address), m);
    m = setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockhash() as Blockhash, lastValidBlockHeight: 2_000n }, m);
    m = appendTransactionMessageInstructions([getTransferSolInstruction({ source: createNoopSigner(kitSigner.address), destination: to.toBase58() as Address, amount })], m);
    return compileTransaction(m);
  };
  const [sig] = await s.signTransactions([tx(treasury, 10n)]);
  assert.ok(sig![kitSigner.address], "signed");
  const admitted = g.entries().find((e) => e.kind === "decision" && e.allow);
  assert.deepEqual(admitted?.kind === "decision" && admitted.expires, { lastValidBlockHeight: "2000" }, "the expiry comes from the transaction's own lifetime");
  await rejectsWith(s.signTransactions([tx(treasury, 11n), tx(attacker, 12n)]), "destination-not-allowed");

  const forger = { address: kitSigner.address, signTransactions: async (txs: readonly any[]) => txs.map(() => ({ [kitSigner.address]: new Uint8Array(64) })) };
  await rejectsWith(guardedSigner(forger as never, await guard(), { now }).signTransactions([tx(treasury, 13n)]), "wallet-changed-message");
  await assert.rejects(guardedSigner(forger as never, await guard(), { now }).signTransactions([tx(treasury, 14n)]), (e: unknown) => e instanceof SolanautDenied && e.decision === null, "SPEC §8: wallet-changed-message carries no decision (evaluator case E22)");
});

// --- the JSON-RPC client ----------------------------------------------------------------------------

test("jsonRpc: sends base64 bytes, reads the height, and turns signature statuses into outcomes", async () => {
  const calls: { method: string; params: unknown[] }[] = [];
  let height = 100;
  const statuses: Record<string, unknown> = { landed: { err: null, confirmationStatus: "confirmed" }, failed: { err: { InstructionError: [0, "Custom"] }, confirmationStatus: "finalized" }, "rate-limited": { err: null, confirmationStatus: "confirmed" } };
  // Processed at its last valid height: the first read sees it processed, while the height has already moved past.
  let lateReads = 0;
  const late = () => (lateReads++ === 0 ? { err: null, confirmationStatus: "processed" } : { err: null, confirmationStatus: "confirmed" });
  let limited = 0;
  let heightLimited = 0;
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const { id, method, params } = JSON.parse(raw);
    calls.push({ method, params });
    // A public RPC's rate limit: HTTP 429, the request not served. Three times for one signature, for
    // one send, and for the first two height reads.
    const rateLimited =
      (method === "getSignatureStatuses" && (params as string[][])[0]![0] === "rate-limited" && limited++ < 3) ||
      (method === "sendTransaction" && (params as unknown[])[0] === "Ag==") ||
      (method === "getBlockHeight" && heightLimited++ < 2);
    if (rateLimited) {
      res.statusCode = 429;
      return res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: 429, message: "Too many requests for a specific RPC call" } }));
    }
    const result =
      method === "getBlockHeight" ? height++ :
      method === "sendTransaction" ? "sig-from-rpc" :
      method === "getSignatureStatuses" ? { context: { slot: 1 }, value: [(params as string[][])[0]![0] === "late" ? late() : statuses[(params as string[][])[0]![0]!] ?? null] } : null;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(method === "sendTransaction" && (params as unknown[])[0] === "AA==" ? { jsonrpc: "2.0", id, error: { message: "Transaction simulation failed" } } : { jsonrpc: "2.0", id, result }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const rpc = jsonRpc(`http://127.0.0.1:${(server.address() as { port: number }).port}`, { pollMs: 1, timeoutMs: 2_000 });
    assert.equal(await rpc.getBlockHeight(), 100n, "a read is tried again through a rate limit");
    assert.equal(calls.filter((c) => c.method === "getBlockHeight").length, 3);
    assert.equal(await rpc.sendRawTransaction(Uint8Array.of(1, 2, 3)), "sig-from-rpc");
    assert.deepEqual(calls.at(-1)?.params, ["AQID", { encoding: "base64", preflightCommitment: "confirmed" }]);
    await assert.rejects(rpc.sendRawTransaction(Uint8Array.of(0)), (e: unknown) => e instanceof RpcRefused && /simulation failed/.test(e.message), "the RPC refused the bytes: they were not forwarded");
    await assert.rejects(rpc.sendRawTransaction(Uint8Array.of(2)), (e: unknown) => !(e instanceof RpcRefused) && /429/.test(String(e)), "an HTTP failure is no refusal: the fate of the bytes is not known");
    assert.equal(calls.filter((c) => c.method === "sendTransaction" && c.params[0] === "Ag==").length, 1, "a send is never tried again by the client");
    assert.equal(await rpc.confirm("rate-limited", 1_000n), "landed", "a rate limit on status reads is waited out");
    assert.equal(await rpc.confirm("landed", 1_000n), "landed");
    assert.equal(await rpc.confirm("failed", 1_000n), "failed");
    assert.equal(await rpc.confirm("never-seen", BigInt(height + 2)), "expired", "unseen until its last valid height passed");
    assert.equal(await rpc.confirm("late", 1n), "landed", "seen processed with the height already past: not expired, it lands");
    assert.equal(await rpc.getSignatureStatus!("landed"), "landed");
    assert.equal(await rpc.getSignatureStatus!("failed"), "failed");
    assert.equal(await rpc.getSignatureStatus!("never-seen"), null);
    const lookups = calls.filter((c) => c.method === "getSignatureStatuses").slice(-3);
    for (const c of lookups) assert.deepEqual((c.params as unknown[])[1], { searchTransactionHistory: true }, "an outcome after the fact searches history");
  } finally {
    server.close();
  }
});
