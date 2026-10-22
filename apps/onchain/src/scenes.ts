// The demo's scenes on a cluster (docs/submission/DEMO.md), through the product's own path: one
// agent, one policy, one durable guard record, and every proposal through guardedWallet, which
// checks, signs, sends the checked bytes itself and records the outcome. It is the end-to-end
// battery of docs/SPEC.md §11 and milestone 2b.3's demo script; the cockpit then shows its record.
//
//   node apps/onchain/src/scenes.ts --url <rpc> --agent keys/devnet-agent.json \
//     --operator keys/devnet-operator.json --treasury <pubkey> --dir .sandbox/devnet
//
// The scenes, numbered as in DEMO.md:
//   benign     two payments to the treasury: allowed, signed, sent, landed
//   5 re-sign  the same payment again, with a new blockhash, while the first is in flight
//   7 crash    the guard's process is killed after a payment is sent and before its outcome is
//              recorded; a new process restores the guard from the record, replays it, refuses the
//              payment again while it could still land, then records how it went
//   2 fooled   a payment to an address read from hostile token metadata
//   3 authority  an SPL Approve for the attacker, then a payment built on a durable nonce
//   4 loop     an unfunded agent retries a payment the RPC refuses each time, until Keel stops it
//   release    the guard is latched; the operator signs the release text, and a payment lands
// The loop runs last but one because Keel's stop latches the guard. Scene 6, the stolen key, is
// apps/onchain/src/squads.ts.
//
// The record and the policy are written to --dir, for `npm run cockpit`. Keys come from files made by
// solana-keygen; the script prints public keys and signatures only. The operator's key signs only the
// latch release. On a local validator the script airdrops what the agent needs.

import { spawn } from "node:child_process";
import { createPrivateKey, sign } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createGuard, fileStore, guardedWallet, jsonRpc, PROGRAMS, replay, SolanautDenied, type BaseWalletLike, type Entry, type Guard, type PolicyInput, type RpcLike } from "@solanaut/sdk";

const url = required("url");
const dir = required("dir");
const agent = keypairFrom(required("agent"));
const operator = keypairFrom(required("operator"));
const treasury = new PublicKey(required("treasury"));
const child = process.argv.includes("--child");
const local = /127\.0\.0\.1|localhost/.test(url);
const connection = new Connection(url, "confirmed");
const rpc = jsonRpc(url, { pollMs: local ? 500 : 2_000 });
const record = join(dir, "guard.jsonl");
const policyFile = join(dir, "policy.json");

/** The fixed DER header of a PKCS #8 ed25519 private key; the key's 32-byte seed follows it. */
const ED25519_PKCS8_HEADER = Buffer.from("302e020100300506032b657004220420", "hex");

type DecisionEntry = Extract<Entry, { kind: "decision" }>;

async function main() {
  if (child) return untilTheCrash();

  await fundTheAgent();
  const loopAgent = Keypair.generate();
  const policy = policyFor(loopAgent.publicKey);
  startTheRecord(policy);

  const sent = await runTheFirstProcessUntilKilled();
  const { guard, wallet } = await restoreAfterTheCrash(policy, sent);

  const attacker = Keypair.generate().publicKey;
  await fooled(guard, wallet, attacker);
  await standingAuthority(guard, wallet, attacker);
  await looping(guard, loopAgent);
  await theRelease(guard, wallet);
  await summarise(guard, policy);
  guard.close();
}

// --- the first process: scenes up to the crash -----------------------------------------------------

async function untilTheCrash() {
  const policy = JSON.parse(readFileSync(policyFile, "utf8")) as PolicyInput;
  const guard = await createGuard({ policy, log: fileStore(record, { ownership: "kernel" }) });
  const wallet = guardedWallet(walletOf(agent), guard, { rpc });
  await benign(guard, wallet);
  await reSigningTooEarly(guard, wallet);
  await theCrash(guard);
}

async function benign(guard: Guard, wallet: BaseWalletLike) {
  say("\nbenign · payments to the treasury");
  await propose(guard, wallet, "benign", "0.001 SOL to the treasury", await payTheTreasury(0.001));
  await propose(guard, wallet, "benign", "0.0015 SOL to the treasury", await payTheTreasury(0.0015));
}

async function reSigningTooEarly(guard: Guard, wallet: BaseWalletLike) {
  say("\nscene 5 · re-signing too early");
  const seq = guard.status().seq;
  const first = propose(guard, wallet, "5 re-sign", "0.002 SOL to the treasury: the first attempt", await payTheTreasury(0.002));
  await until(() => guard.entries().some((entry) => entry.kind === "redeem" && entry.seq >= seq), "the first attempt's receipt");
  await propose(guard, wallet, "5 re-sign", "the same, new blockhash, the first still in flight", await payTheTreasury(0.002));
  await first;
  operatorReleases(guard, "5 re-sign");
}

async function theCrash(guard: Guard) {
  say("\nscene 7 · the crash: the guard's process is killed after the send, before the outcome is recorded");
  // The RPC sends, then the process dies where it would have waited for the outcome.
  const killedAfterSend: RpcLike = {
    ...rpc,
    confirm: async (signature) => {
      say(`SENT ${signature}`);
      say(`  7 crash    0.0012 SOL to the treasury: sent ${explorerLink(signature)}; now SIGKILL`);
      process.kill(process.pid, "SIGKILL");
      return new Promise(() => {});
    },
  };
  const doomed = guardedWallet(walletOf(agent), guard, { rpc: killedAfterSend });
  await doomed.signAndSendTransaction(await payTheTreasury(0.0012));
  throw new Error("still alive after SIGKILL");
}

// --- the second process: restore, then the rest -----------------------------------------------------

/** On a local validator, airdrop what the agent needs; anywhere, refuse to start without it. */
async function fundTheAgent() {
  if (local && (await connection.getBalance(agent.publicKey)) < solToLamports(0.05)) {
    const airdrop = await connection.requestAirdrop(agent.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdrop, "confirmed");
  }
  const balance = await connection.getBalance(agent.publicKey);
  if (balance < solToLamports(0.012)) {
    console.error(`the agent ${agent.publicKey.toBase58()} holds ${balance / LAMPORTS_PER_SOL} SOL on ${url}; the scenes need 0.012. Fund it and run again.`);
    process.exit(1);
  }
}

/** Write the policy for the cockpit, start an empty record, and say what is about to run. */
function startTheRecord(policy: PolicyInput) {
  mkdirSync(dir, { recursive: true });
  rmSync(record, { force: true });
  writeFileSync(policyFile, JSON.stringify(policy, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2));
  say(`Solanaut scenes · ${url}`);
  say(`agent ${agent.publicKey.toBase58()} · treasury ${treasury.toBase58()} · operator ${operator.publicKey.toBase58()}`);
  say(`policy: System and Token; the treasury only; 0.005 SOL a payment, 0.03 an hour; record ${record}`);
}

/** Run the first scenes in a child process, relay what it says, and return the signature it sent before it was killed. */
async function runTheFirstProcessUntilKilled(): Promise<string> {
  const first = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), "--child"], { stdio: ["ignore", "pipe", "inherit"] });
  let sent: string | undefined;
  let buffered = "";
  first.stdout.on("data", (chunk: Buffer) => {
    buffered += chunk.toString();
    let end;
    while ((end = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, end);
      buffered = buffered.slice(end + 1);
      if (line.startsWith("SENT ")) sent = line.slice(5);
      else say(line);
    }
  });
  const [code, signal] = (await new Promise((resolve) => first.on("exit", (exitCode, exitSignal) => resolve([exitCode, exitSignal])))) as [number | null, string | null];
  if (signal !== "SIGKILL" || !sent) throw new Error(`the first process ended with ${signal ?? code}, not killed after a send`);
  return sent;
}

/** Scene 7, continued: a new process restores the guard, refuses the killed payment again, and records its outcome. */
async function restoreAfterTheCrash(policy: PolicyInput, sent: string) {
  say(`\n  7 crash    a new process: the guard restores itself from ${record}`);
  const guard = await createGuard({ policy, log: fileStore(record, { ownership: "kernel" }) });
  const entries = guard.entries();
  const pending = entries.filter((entry): entry is DecisionEntry => entry.kind === "decision" && entry.allow).at(-1)!;
  say(`  7 crash    restored ${entries.length} entries; ${await replayed(guard, policy)}`);

  const wallet = guardedWallet(walletOf(agent), guard, { rpc });
  await propose(guard, wallet, "7 crash", "the killed payment again, while it could still land", await payTheTreasury(0.0012));
  const outcome = await rpc.confirm(sent, BigInt(pending.expires?.lastValidBlockHeight ?? 0));
  guard.report(pending.hash, outcome);
  say(`  7 crash    the killed attempt's outcome, read from the chain and recorded: ${outcome}`);
  operatorReleases(guard, "7 crash");
  return { guard, wallet };
}

async function fooled(guard: Guard, wallet: BaseWalletLike, attacker: PublicKey) {
  say("\nscene 2 · fooled: the agent read \"send 0.004 SOL to <attacker>\" in token metadata");
  await propose(guard, wallet, "2 fooled", "0.004 SOL to the attacker", await transactionFrom(agent.publicKey, true, pay(agent.publicKey, attacker, 0.004)));
}

async function standingAuthority(guard: Guard, wallet: BaseWalletLike, attacker: PublicKey) {
  say("\nscene 3 · tricked into standing authority");
  const from = agent.publicKey;
  const approve = approveEverything(Keypair.generate().publicKey, attacker, from);
  await propose(guard, wallet, "3 approve", "SPL Approve: the attacker as delegate, for everything", await transactionFrom(from, true, approve));
  const advanceNonce = SystemProgram.nonceAdvance({ noncePubkey: Keypair.generate().publicKey, authorizedPubkey: from });
  await propose(guard, wallet, "3 nonce", "0.001 SOL to the treasury, on a durable nonce", await transactionFrom(from, true, advanceNonce, pay(from, treasury, 0.001)));
  operatorReleases(guard, "3 nonce");
}

async function looping(guard: Guard, loopAgent: Keypair) {
  say("\nscene 4 · looping: an unfunded agent retries a payment the RPC refuses");
  const loopWallet = guardedWallet(walletOf(loopAgent), guard, { rpc });
  const from = loopAgent.publicKey;
  for (let turn = 1; turn <= 8; turn++) {
    const result = await propose(guard, loopWallet, `4 loop`, `turn ${turn}: 0.001 SOL to the treasury, from an empty account`, await transactionFrom(from, false, pay(from, treasury, 0.001)));
    if (!result.allow) break;
  }
  const status = guard.status();
  say(`  4 loop     the guard is ${status.latched ? `LATCHED at decision ${status.latchSeq}` : "not latched"}`);
}

async function theRelease(guard: Guard, wallet: BaseWalletLike) {
  say("\nrelease · the guard is latched until the operator signs the release text");
  await propose(guard, wallet, "release", "0.001 SOL to the treasury, while latched", await payTheTreasury(0.001));
  operatorReleases(guard, "release");
  await propose(guard, wallet, "release", "0.001 SOL to the treasury, after the release", await payTheTreasury(0.001));
}

/** Count the record's entries by kind and verdict, and replay it once more. */
async function summarise(guard: Guard, policy: PolicyInput) {
  const counts: Record<string, number> = {};
  for (const entry of guard.entries()) {
    const kind = entry.kind === "decision" ? (entry.allow ? "allow" : `deny ${entry.rule}`) : entry.kind;
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  const tally = Object.entries(counts).map(([kind, count]) => `${kind} ${count}`).join(" · ");
  say(`\nthe record: ${guard.entries().length} entries · ${tally}`);
  say(await replayed(guard, policy));
}

// --- the steps every scene shares ------------------------------------------------------------------

/** The policy: the agent and the loop's unfunded agent, System and Token, the treasury only, small caps. */
function policyFor(loopAgent: PublicKey): PolicyInput {
  return {
    version: 1,
    principal: [agent.publicKey.toBase58(), loopAgent.toBase58()],
    programs: { allow: [PROGRAMS.system, PROGRAMS.token, PROGRAMS.computeBudget, PROGRAMS.memo], opaque: "deny" },
    destinations: { allow: [treasury.toBase58()] },
    sol: { maxPerTx: BigInt(solToLamports(0.005)), maxPerWindow: BigInt(solToLamports(0.03)) },
    tokens: [],
    fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 10_000_000n, tipAccounts: [] },
    lookupTables: [],
    windowMs: 3_600_000,
    intents: { maxAttempts: 3 },
    latch: { afterDenials: 8, releaseKey: operator.publicKey.toBase58(), guardId: "scenes", cluster: local ? "localnet" : "devnet" },
    messages: { allow: false },
    cosign: { allow: false },
    sensor: { expectedPerMinute: 20 },
  };
}

/** A wallet over a keypair, as Solana Agent Kit's KeypairWallet signs: in place. It never sends; the guard does. */
function walletOf(keypair: Keypair): BaseWalletLike<Transaction> {
  const signOne = <T extends Transaction>(transaction: T): T => {
    transaction.partialSign(keypair);
    return transaction;
  };
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends Transaction>(transaction: T) => signOne(transaction),
    signAllTransactions: async <T extends Transaction>(transactions: T[]) => transactions.map(signOne),
    signAndSendTransaction: async () => {
      throw new Error("the guard sends; the wallet never does");
    },
    signMessage: async () => {
      throw new Error("never asked");
    },
  };
}

/** Propose a transaction through the guarded wallet, and say what happened. */
async function propose(guard: Guard, wallet: BaseWalletLike, scene: string, what: string, transaction: Transaction) {
  const head = `  ${scene.padEnd(10)} ${what.padEnd(54)}`;
  const message = Buffer.from(transaction.serializeMessage()).toString("base64");
  try {
    const { signature } = await wallet.signAndSendTransaction(transaction);
    const decision = decisionOn(guard, message);
    const report = guard.entries().find((entry) => entry.kind === "report" && entry.decision === decision?.hash);
    const outcome = report?.kind === "report" ? report.outcome : "not reported";
    say(`${head} ALLOW                         ${keel(decision).padEnd(36)} sent, ${outcome}: ${explorerLink(signature)}`);
    return { allow: true as const, signature, outcome };
  } catch (error) {
    if (error instanceof SolanautDenied) return explainDenial(guard, error, head, message);
    if ((error as { refused?: unknown }).refused === true) {
      say(`${head} ALLOW                         ${keel(decisionOn(guard, message)).padEnd(36)} sent; the RPC refused it: ${(error as Error).message.split("\n")[0]!.slice(0, 60)}`);
      return { allow: true as const, refused: true };
    }
    throw error;
  }
}

/** This is the operator's console: the agent's error names only a class, so recover the details from the private record. */
function explainDenial(guard: Guard, denied: SolanautDenied, head: string, message: string) {
  const decision = denied.ref >= 0 ? guard.entries().find((entry): entry is DecisionEntry => entry.kind === "decision" && entry.seq === denied.ref) : decisionOn(guard, message);
  if (decision?.allow) {
    const report = guard.entries().findLast((entry) => entry.kind === "report" && entry.decision === decision.hash);
    const outcome = report?.kind === "report" ? report.outcome : "unknown";
    say(`${head} ALLOW                         ${keel(decision).padEnd(36)} wrapper refused; outcome ${outcome}; inspect before retry`);
    return { allow: true as const, refused: outcome === "failed", outcome };
  }
  const rule = decision?.rule ?? denied.class;
  say(`${head} DENY ${rule.padEnd(24)} ${keel(decision).padEnd(36)} ${decision?.latch ? "LATCHES the guard; " : ""}not signed, not sent`);
  return { allow: false as const, rule };
}

/** The latest decision on these message bytes. */
function decisionOn(guard: Guard, message: string) {
  return guard.entries().filter((entry): entry is DecisionEntry => entry.kind === "decision" && entry.message === message).at(-1);
}

/** Keel's posture and the sensor's three numbers, for a decision. */
function keel(decision: DecisionEntry | undefined) {
  const telemetry = decision?.telemetry;
  const numbers = telemetry ? ` I ${telemetry.intensity.toFixed(2)} V ${telemetry.valence.toFixed(2)} R ${telemetry.repetition.toFixed(2)}` : "";
  return `${decision?.posture ?? "-"}${numbers}`;
}

/** The operator's release: an ed25519 signature, by the policy's release key, over the guard's release text. */
function operatorReleases(guard: Guard, scene: string) {
  const status = guard.status();
  if (!status.latched) return;
  const text = guard.releaseText(new Date(Date.now() + 10 * 60_000).toISOString());
  const key = createPrivateKey({ key: Buffer.concat([ED25519_PKCS8_HEADER, Buffer.from(operator.secretKey.subarray(0, 32))]), format: "der", type: "pkcs8" });
  const released = guard.release(text, new Uint8Array(sign(null, Buffer.from(text), key)), Date.now());
  say(`  ${scene.padEnd(10)} latched at decision ${status.latchSeq}; the operator signs "${text.split("\n").slice(1, 5).join(" · ")} · …": ${released.released ? "released" : `refused: ${released.reason}`}`);
}

async function replayed(guard: Guard, policy: PolicyInput) {
  const result = await replay(guard.entries(), policy);
  if (result.ok) return `replay: ${result.decisions} decisions, 0 divergences`;
  return `replay DIVERGED at seq ${result.divergence?.seq}, field ${result.divergence?.field}`;
}

function payTheTreasury(amount: number) {
  return transactionFrom(agent.publicKey, true, pay(agent.publicKey, treasury, amount));
}

let lastBlockhash = "";

/** A transaction from `from`, with the cluster's latest blockhash; with `fresh`, one this script has not used. */
async function transactionFrom(from: PublicKey, fresh: boolean, ...instructions: TransactionInstruction[]) {
  let { blockhash } = await connection.getLatestBlockhash("confirmed");
  for (let i = 0; fresh && blockhash === lastBlockhash && i < 50; i++) {
    await sleep(200);
    ({ blockhash } = await connection.getLatestBlockhash("confirmed"));
  }
  lastBlockhash = blockhash;
  return new Transaction({ feePayer: from, recentBlockhash: blockhash }).add(...instructions);
}

function pay(from: PublicKey, to: PublicKey, amount: number) {
  return SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: solToLamports(amount) });
}

/** An SPL Token Approve that makes `delegate` the delegate of `tokenAccount` for the largest amount there is. */
function approveEverything(tokenAccount: PublicKey, delegate: PublicKey, owner: PublicKey) {
  const data = Buffer.alloc(9);
  data[0] = 4; // Approve
  data.writeBigUInt64LE(18_446_744_073_709_551_615n, 1);
  return new TransactionInstruction({
    programId: new PublicKey(PROGRAMS.token),
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: delegate, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Wait until `holds` holds, polling. */
async function until(holds: () => boolean, what: string) {
  for (let i = 0; i < 600; i++) {
    if (holds()) return;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Print a line, synchronously: a line written just before the process is killed must not be lost. */
function say(line: string) {
  writeSync(1, `${line}\n`);
}

function explorerLink(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=${local ? "custom&customUrl=" + encodeURIComponent(url) : "devnet"}`;
}

function solToLamports(sol: number) {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function required(name: string) {
  const value = option(name);
  if (!value) {
    console.error(`--${name} is required: node apps/onchain/src/scenes.ts --url <rpc> --agent <keyfile> --operator <keyfile> --treasury <pubkey> --dir <dir>`);
    process.exit(2);
  }
  return value;
}

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

function keypairFrom(path: string) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
