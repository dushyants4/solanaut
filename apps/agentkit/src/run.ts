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

import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { KeypairWallet, SolanaAgentKit, signOrSendTX } from "solana-agent-kit";
import { createGuard, encodeBase58, guardedWallet, PROGRAMS, SolanautDenied, type BaseWalletLike, type Guard, type PolicyInput } from "@solanaut/sdk";

const url = option("url") ?? "http://127.0.0.1:8899";
const funderFile = option("funder");
const connection = new Connection(url, "confirmed");
const agentKey = Keypair.generate();
const treasury = option("treasury") ? new PublicKey(option("treasury")!) : Keypair.generate().publicKey;
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

async function main() {
  await connection.getVersion().catch(() => {
    console.error(`no validator at ${url}`);
    process.exit(1);
  });
  await fundTheAgent();

  console.log("\nwithout Solanaut: new SolanaAgentKit(wallet, rpc, {})");
  const bare = counted(new KeypairWallet(agentKey, url));
  const plain = new SolanaAgentKit(bare.wallet as never, url, {});
  const unguarded = [
    await attempt(bare, "instructions (the plugins' path): pay the treasury", () => signOrSendTX(plain, [pay()])),
    await attempt(bare, "instructions: pay the attacker", () => signOrSendTX(plain, [pay(attacker, 0.05)])),
  ];

  console.log("\nwith Solanaut: new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), rpc, {})");
  const guard = await createGuard({ policy });
  const inner = counted(new KeypairWallet(agentKey, url));
  const agent = new SolanaAgentKit(guardedWallet(inner.wallet as unknown as BaseWalletLike, guard, { rpc: url }) as never, url, {});
  const guarded = [
    await attempt(inner, "a whole transaction: pay the treasury", async () => signOrSendTX(agent, await wholeTransaction(pay(treasury, 0.011))), guard),
    await attempt(inner, "a whole transaction: pay the attacker", async () => signOrSendTX(agent, await wholeTransaction(pay(attacker, 0.05))), guard),
    await attempt(inner, "instructions (the plugins' path): pay the treasury", () => signOrSendTX(agent, [pay(treasury, 0.012)]), guard),
    await attempt(inner, "instructions: pay the attacker", () => signOrSendTX(agent, [pay(attacker, 0.05)]), guard),
  ];

  const verdicts = guard.entries().flatMap((entry) => (entry.kind === "decision" ? [entry.allow ? "allow" : entry.rule] : []));
  console.log(`\nthe guard's record: ${guard.entries().length} entries; ${verdicts.join(", ")}`);
  console.log(`treasury holds ${(await connection.getBalance(treasury)) / LAMPORTS_PER_SOL} SOL; the attacker holds ${(await connection.getBalance(attacker)) / LAMPORTS_PER_SOL} SOL`);
  console.log(JSON.stringify({ unguarded, guarded }));
}

/** On devnet a funder pays the agent's float; on a local validator, an airdrop does. */
async function fundTheAgent() {
  // The kit's own Connection reads at "finalized", web3.js's default: wait until the float is there too.
  if (funderFile) {
    const funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(funderFile, "utf8"))));
    const float = SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: agentKey.publicKey, lamports: 0.08 * LAMPORTS_PER_SOL });
    const funded = await sendAndConfirmTransaction(connection, new Transaction().add(float), [funder], { commitment: "finalized" });
    console.log(`the agent ${agentKey.publicKey.toBase58()} was paid a float of 0.08 SOL by ${funder.publicKey.toBase58()}: ${funded}`);
  } else {
    const airdrop = await connection.requestAirdrop(agentKey.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdrop, "finalized");
  }
}

/** The kit's own wallet, with a counter on how often it is asked to sign. */
function counted(wallet: KeypairWallet) {
  let signs = 0;
  const countingWallet = {
    publicKey: wallet.publicKey,
    signTransaction: async <T>(transaction: T) => {
      signs++;
      return wallet.signTransaction(transaction as never) as Promise<T>;
    },
    signAllTransactions: async <T>(transactions: T[]) => {
      signs += transactions.length;
      return wallet.signAllTransactions(transactions as never) as Promise<T[]>;
    },
    signAndSendTransaction: (transaction: never, options?: never) => {
      signs++;
      return wallet.signAndSendTransaction(transaction, options);
    },
    sendTransaction: (transaction: never) => wallet.sendTransaction(transaction),
    signMessage: (message: Uint8Array) => wallet.signMessage(message),
  };
  return { wallet: countingWallet, signs: () => signs, reset: () => void (signs = 0) };
}

type CountedWallet = ReturnType<typeof counted>;

/** Run one of the kit's paths and print what happened, and how often the wallet was asked to sign. */
async function attempt(counter: CountedWallet, label: string, run: () => Promise<unknown>, guard?: Guard) {
  counter.reset();
  try {
    const result = await run();
    console.log(`  ${label.padEnd(58)} landed: ${String(result)}   wallet asked to sign ${counter.signs()}×`);
    return { label, result: "landed", signs: counter.signs() };
  } catch (error) {
    const denied = error instanceof SolanautDenied;
    const rule = denied ? ruleOf(error, guard) : (error as Error).message.split("\n")[0]!.slice(0, 60);
    console.log(`  ${label.padEnd(58)} ${denied ? "DENIED" : "ERROR"}: ${rule}   wallet asked to sign ${counter.signs()}×`);
    return { label, result: denied ? `denied: ${rule}` : `error: ${rule}`, signs: counter.signs() };
  }
}

/**
 * The rule that refused. The agent's error carries only the denial's class (ADR-025); this script is
 * also the operator, so it reads the rule from the guard's own record.
 */
function ruleOf(denied: SolanautDenied, guard?: Guard): string {
  const decision = guard?.entries().find((entry) => entry.kind === "decision" && entry.seq === denied.ref);
  return decision?.kind === "decision" && decision.rule ? decision.rule : denied.class;
}

function pay(to = treasury, sol = 0.01): TransactionInstruction {
  return SystemProgram.transfer({ fromPubkey: agentKey.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) });
}

async function wholeTransaction(instruction: TransactionInstruction) {
  const { blockhash } = await connection.getLatestBlockhash();
  return new Transaction({ feePayer: agentKey.publicKey, recentBlockhash: blockhash }).add(instruction);
}

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
