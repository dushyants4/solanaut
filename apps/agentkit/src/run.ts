// Milestone 2b.3, the Solana Agent Kit half: a scripted agent built on solana-agent-kit 2.0.10's own
// classes (SolanaAgentKit, KeypairWallet, signOrSendTX), with Solanaut adopted by one changed line:
//
//   - new SolanaAgentKit(wallet, rpc, {})
//   + new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), rpc, {})
//
// It runs with a fresh in-memory agent key, which touches no disk. On a local validator it airdrops
// the agent's float; on devnet, whose faucet rate-limits, a funder pays it (--funder, a keyfile made by
// solana-keygen). --treasury names the treasury; otherwise it is a fresh key.
//
//   node apps/agentkit/src/run.ts --url http://127.0.0.1:8899
//   node apps/agentkit/src/run.ts --url https://api.devnet.solana.com --funder keys/devnet-operator.json --treasury <pubkey>
//
// It counts how often the kit asks the wallet to sign one payment, then sends payments and drains
// through the kit's two paths: a whole transaction (signAndSendTransaction) and bare instructions
// (the path the kit's plugins use, which signs more than once).

import { readFileSync } from "node:fs";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { KeypairWallet, SolanaAgentKit, signOrSendTX } from "solana-agent-kit";
import { createGuard, encodeBase58, guardedWallet, PROGRAMS, SolanautDenied, type BaseWalletLike, type PolicyInput } from "@solanaut/sdk";
import { generateKeyPairSync } from "node:crypto";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const url = arg("url") ?? "http://127.0.0.1:8899";
const funderFile = arg("funder");
const connection = new Connection(url, "confirmed");
const agentKey = Keypair.generate();
const treasury = arg("treasury") ? new PublicKey(arg("treasury")!) : Keypair.generate().publicKey;
const attacker = Keypair.generate().publicKey;
const operator = encodeBase58(Buffer.from(generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x!, "base64url"));

const policy: PolicyInput = {
  version: 1,
  principal: [agentKey.publicKey.toBase58()],
  programs: { allow: [PROGRAMS.system, PROGRAMS.computeBudget], opaque: "deny" },
  destinations: { allow: [treasury.toBase58()] },
  sol: { maxPerTx: BigInt(LAMPORTS_PER_SOL / 10), maxPerWindow: BigInt(LAMPORTS_PER_SOL) },
  tokens: [],
  fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 10_000_000n, tipAccounts: [] },
  lookupTables: [],
  windowMs: 3_600_000,
  intents: { maxAttempts: 3 },
  latch: { afterDenials: 50, releaseKey: operator, guardId: "agentkit", cluster: "localnet" },
  messages: { allow: false },
  cosign: { allow: false },
  sensor: { expectedPerMinute: 6 },
};

/** The kit's own wallet, with a counter on how often it is asked to sign. */
function counted(wallet: KeypairWallet) {
  let signs = 0;
  const w = {
    publicKey: wallet.publicKey,
    signTransaction: async <T>(tx: T) => (signs++, wallet.signTransaction(tx as never) as Promise<T>),
    signAllTransactions: async <T>(txs: T[]) => ((signs += txs.length), wallet.signAllTransactions(txs as never) as Promise<T[]>),
    signAndSendTransaction: (tx: never, o?: never) => (signs++, wallet.signAndSendTransaction(tx, o)),
    sendTransaction: (tx: never) => wallet.sendTransaction(tx),
    signMessage: (m: Uint8Array) => wallet.signMessage(m),
  };
  return { wallet: w, signs: () => signs, reset: () => void (signs = 0) };
}

const pay = (to = treasury, sol = 0.01): TransactionInstruction => SystemProgram.transfer({ fromPubkey: agentKey.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) });
async function wholeTransaction(ix: TransactionInstruction) {
  const { blockhash } = await connection.getLatestBlockhash();
  return new Transaction({ feePayer: agentKey.publicKey, recentBlockhash: blockhash }).add(ix);
}

async function attempt(label: string, run: () => Promise<unknown>, signs: () => number, reset: () => void) {
  reset();
  try {
    const r = await run();
    console.log(`  ${label.padEnd(58)} landed: ${String(r)}   wallet asked to sign ${signs()}×`);
    return { label, result: "landed", signs: signs() };
  } catch (e) {
    const rule = e instanceof SolanautDenied ? e.rule : (e as Error).message.split("\n")[0]!.slice(0, 60);
    console.log(`  ${label.padEnd(58)} ${e instanceof SolanautDenied ? "DENIED" : "ERROR"}: ${rule}   wallet asked to sign ${signs()}×`);
    return { label, result: e instanceof SolanautDenied ? `denied: ${rule}` : `error: ${rule}`, signs: signs() };
  }
}

async function main() {
  await connection.getVersion().catch(() => {
    console.error(`no validator at ${url}`);
    process.exit(1);
  });
  // The kit's own Connection reads at "finalized", web3.js's default: wait until the float is there too.
  if (funderFile) {
    const funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(funderFile, "utf8"))));
    const funded = await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: agentKey.publicKey, lamports: 0.08 * LAMPORTS_PER_SOL })), [funder], { commitment: "finalized" });
    console.log(`the agent ${agentKey.publicKey.toBase58()} was paid a float of 0.08 SOL by ${funder.publicKey.toBase58()}: ${funded}`);
  } else {
    const airdrop = await connection.requestAirdrop(agentKey.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdrop, "finalized");
  }

  console.log("\nwithout Solanaut: new SolanaAgentKit(wallet, rpc, {})");
  const bare = counted(new KeypairWallet(agentKey, url));
  const plain = new SolanaAgentKit(bare.wallet as never, url, {});
  const b1 = await attempt("instructions (the plugins' path): pay the treasury", () => signOrSendTX(plain, [pay()]), bare.signs, bare.reset);
  const b2 = await attempt("instructions: pay the attacker", () => signOrSendTX(plain, [pay(attacker, 0.05)]), bare.signs, bare.reset);

  console.log("\nwith Solanaut: new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), rpc, {})");
  const guard = await createGuard({ policy });
  const inner = counted(new KeypairWallet(agentKey, url));
  const agent = new SolanaAgentKit(guardedWallet(inner.wallet as unknown as BaseWalletLike, guard, { rpc: url }) as never, url, {});
  const g1 = await attempt("a whole transaction: pay the treasury", async () => signOrSendTX(agent, await wholeTransaction(pay(treasury, 0.011))), inner.signs, inner.reset);
  const g2 = await attempt("a whole transaction: pay the attacker", async () => signOrSendTX(agent, await wholeTransaction(pay(attacker, 0.05))), inner.signs, inner.reset);
  const g3 = await attempt("instructions (the plugins' path): pay the treasury", () => signOrSendTX(agent, [pay(treasury, 0.012)]), inner.signs, inner.reset);
  const g4 = await attempt("instructions: pay the attacker", () => signOrSendTX(agent, [pay(attacker, 0.05)]), inner.signs, inner.reset);

  const decisions = guard.entries().filter((e) => e.kind === "decision");
  console.log(`\nthe guard's record: ${guard.entries().length} entries; ${decisions.map((d) => (d.kind === "decision" ? (d.allow ? "allow" : d.rule) : "")).join(", ")}`);
  console.log(`treasury holds ${(await connection.getBalance(treasury)) / LAMPORTS_PER_SOL} SOL; the attacker holds ${(await connection.getBalance(attacker)) / LAMPORTS_PER_SOL} SOL`);
  console.log(JSON.stringify({ unguarded: [b1, b2], guarded: [g1, g2, g3, g4] }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
