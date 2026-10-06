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

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const need = (name: string) => {
  const v = arg(name);
  if (!v) {
    console.error(`--${name} is required: node apps/onchain/src/scenes.ts --url <rpc> --agent <keyfile> --operator <keyfile> --treasury <pubkey> --dir <dir>`);
    process.exit(2);
  }
  return v;
};
const load = (path: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));

const url = need("url");
const dir = need("dir");
const agent = load(need("agent"));
const operator = load(need("operator"));
const treasury = new PublicKey(need("treasury"));
const child = process.argv.includes("--child");
const local = /127\.0\.0\.1|localhost/.test(url);
const connection = new Connection(url, "confirmed");
const rpc = jsonRpc(url, { pollMs: local ? 500 : 2_000 });
const record = join(dir, "guard.jsonl");
const policyFile = join(dir, "policy.json");

const sol = (n: number) => Math.round(n * LAMPORTS_PER_SOL);
const short = (s: string) => `${s.slice(0, 8)}…`;
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${local ? "custom&customUrl=" + encodeURIComponent(url) : "devnet"}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The policy: the agent and the loop's unfunded agent, System and Token, the treasury only, small caps. */
function policyFor(loopAgent: PublicKey): PolicyInput {
  return {
    version: 1,
    principal: [agent.publicKey.toBase58(), loopAgent.toBase58()],
    programs: { allow: [PROGRAMS.system, PROGRAMS.token, PROGRAMS.computeBudget, PROGRAMS.memo], opaque: "deny" },
    destinations: { allow: [treasury.toBase58()] },
    sol: { maxPerTx: BigInt(sol(0.005)), maxPerWindow: BigInt(sol(0.03)) },
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
function walletOf(kp: Keypair): BaseWalletLike<Transaction> {
  const signOne = <T extends Transaction>(tx: T): T => (tx.partialSign(kp), tx);
  return {
    publicKey: kp.publicKey,
    signTransaction: async <T extends Transaction>(tx: T) => signOne(tx),
    signAllTransactions: async <T extends Transaction>(txs: T[]) => txs.map(signOne),
    signAndSendTransaction: async () => {
      throw new Error("the guard sends; the wallet never does");
    },
    signMessage: async () => {
      throw new Error("never asked");
    },
  };
}

let lastBlockhash = "";
/** A transaction from `from`, with the cluster's latest blockhash; with `fresh`, one this script has not used. */
async function tx(from: PublicKey, fresh: boolean, ...ixs: TransactionInstruction[]) {
  let { blockhash } = await connection.getLatestBlockhash("confirmed");
  for (let i = 0; fresh && blockhash === lastBlockhash && i < 50; i++) {
    await sleep(200);
    ({ blockhash } = await connection.getLatestBlockhash("confirmed"));
  }
  lastBlockhash = blockhash;
  return new Transaction({ feePayer: from, recentBlockhash: blockhash }).add(...ixs);
}
const pay = (from: PublicKey, to: PublicKey, amount: number) => SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: sol(amount) });

/** Print a line, synchronously: a line written just before the process is killed must not be lost. */
const say = (line: string) => writeSync(1, `${line}\n`);

type DecisionEntry = Extract<Entry, { kind: "decision" }>;

/** Keel's posture and the sensor's three numbers, for a decision. */
function keel(d: DecisionEntry | undefined) {
  const t = d?.telemetry;
  return `${d?.posture ?? "-"}${t ? ` I ${t.intensity.toFixed(2)} V ${t.valence.toFixed(2)} R ${t.repetition.toFixed(2)}` : ""}`;
}

/** The latest decision on these message bytes. */
const decisionOn = (g: Guard, message: string) => g.entries().filter((e): e is DecisionEntry => e.kind === "decision" && e.message === message).at(-1);

/** Propose a transaction through the guarded wallet, and say what happened. */
async function propose(g: Guard, w: BaseWalletLike, scene: string, what: string, t: Transaction) {
  const head = `  ${scene.padEnd(10)} ${what.padEnd(54)}`;
  const message = Buffer.from(t.serializeMessage()).toString("base64");
  try {
    const { signature } = await w.signAndSendTransaction(t);
    const d = decisionOn(g, message);
    const report = g.entries().find((e) => e.kind === "report" && e.decision === d?.hash);
    const outcome = report?.kind === "report" ? report.outcome : "not reported";
    say(`${head} ALLOW                         ${keel(d).padEnd(36)} sent, ${outcome}: ${explorer(signature)}`);
    return { allow: true as const, signature, outcome };
  } catch (e) {
    if (e instanceof SolanautDenied) {
      const d = e.decision as DecisionEntry | null;
      say(`${head} DENY ${e.rule.padEnd(24)} ${keel(d ?? undefined).padEnd(36)} ${d?.latch ? "LATCHES the guard; " : ""}not signed, not sent`);
      return { allow: false as const, rule: e.rule };
    }
    if ((e as { refused?: unknown }).refused === true) {
      say(`${head} ALLOW                         ${keel(decisionOn(g, message)).padEnd(36)} sent; the RPC refused it: ${(e as Error).message.split("\n")[0]!.slice(0, 60)}`);
      return { allow: true as const, refused: true };
    }
    throw e;
  }
}

/** The operator's release: an ed25519 signature, by the policy's release key, over the guard's release text. */
function operatorReleases(g: Guard, scene: string) {
  const s = g.status();
  if (!s.latched) return;
  const text = g.releaseText(new Date(Date.now() + 10 * 60_000).toISOString());
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(operator.secretKey.subarray(0, 32))]), format: "der", type: "pkcs8" });
  const released = g.release(text, new Uint8Array(sign(null, Buffer.from(text), key)), Date.now());
  say(`  ${scene.padEnd(10)} latched at decision ${s.latchSeq}; the operator signs "${text.split("\n").slice(1, 5).join(" · ")} · …": ${released.released ? "released" : `refused: ${released.reason}`}`);
}

/** Wait until `f` holds, polling. */
async function until(f: () => boolean, what: string) {
  for (let i = 0; i < 600; i++) {
    if (f()) return;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function replayed(g: Guard, policy: PolicyInput) {
  const r = await replay(g.entries(), policy);
  return r.ok ? `replay: ${r.decisions} decisions, 0 divergences` : `replay DIVERGED at seq ${r.divergence?.seq}, field ${r.divergence?.field}`;
}

// --- the first process: scenes up to the crash -----------------------------------------------------

async function untilTheCrash() {
  const policy = JSON.parse(readFileSync(policyFile, "utf8")) as PolicyInput;
  const g = await createGuard({ policy, log: fileStore(record, { ownership: "kernel" }) });
  const w = guardedWallet(walletOf(agent), g, { rpc });
  const a = agent.publicKey;

  say("\nbenign · payments to the treasury");
  await propose(g, w, "benign", "0.001 SOL to the treasury", await tx(a, true, pay(a, treasury, 0.001)));
  await propose(g, w, "benign", "0.0015 SOL to the treasury", await tx(a, true, pay(a, treasury, 0.0015)));

  say("\nscene 5 · re-signing too early");
  const seq = g.status().seq;
  const first = propose(g, w, "5 re-sign", "0.002 SOL to the treasury: the first attempt", await tx(a, true, pay(a, treasury, 0.002)));
  await until(() => g.entries().some((e) => e.kind === "redeem" && e.seq >= seq), "the first attempt's receipt");
  await propose(g, w, "5 re-sign", "the same, new blockhash, the first still in flight", await tx(a, true, pay(a, treasury, 0.002)));
  await first;
  operatorReleases(g, "5 re-sign");

  say("\nscene 7 · the crash: the guard's process is killed after the send, before the outcome is recorded");
  // The RPC sends, then the process dies where it would have waited for the outcome.
  const killedAfterSend: RpcLike = {
    ...rpc,
    confirm: async (signature) => {
      say(`SENT ${signature}`);
      say(`  7 crash    0.0012 SOL to the treasury: sent ${explorer(signature)}; now SIGKILL`);
      process.kill(process.pid, "SIGKILL");
      return new Promise(() => {});
    },
  };
  const doomed = guardedWallet(walletOf(agent), g, { rpc: killedAfterSend });
  await doomed.signAndSendTransaction(await tx(a, true, pay(a, treasury, 0.0012)));
  throw new Error("still alive after SIGKILL");
}

// --- the second process: restore, then the rest -----------------------------------------------------

async function main() {
  if (child) return untilTheCrash();

  if (local && (await connection.getBalance(agent.publicKey)) < sol(0.05)) {
    const s = await connection.requestAirdrop(agent.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(s, "confirmed");
  }
  const balance = await connection.getBalance(agent.publicKey);
  if (balance < sol(0.012)) {
    console.error(`the agent ${agent.publicKey.toBase58()} holds ${balance / LAMPORTS_PER_SOL} SOL on ${url}; the scenes need 0.012. Fund it and run again.`);
    process.exit(1);
  }

  const loopAgent = Keypair.generate();
  const policy = policyFor(loopAgent.publicKey);
  mkdirSync(dir, { recursive: true });
  rmSync(record, { force: true });
  writeFileSync(policyFile, JSON.stringify(policy, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2));
  say(`Solanaut scenes · ${url}`);
  say(`agent ${agent.publicKey.toBase58()} · treasury ${treasury.toBase58()} · operator ${operator.publicKey.toBase58()}`);
  say(`policy: System and Token; the treasury only; 0.005 SOL a payment, 0.03 an hour; record ${record}`);

  // The first process runs until it is killed.
  const proc = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), "--child"], { stdio: ["ignore", "pipe", "inherit"] });
  let sent: string | undefined;
  let buffered = "";
  proc.stdout.on("data", (c: Buffer) => {
    buffered += c.toString();
    let i;
    while ((i = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, i);
      buffered = buffered.slice(i + 1);
      if (line.startsWith("SENT ")) sent = line.slice(5);
      else say(line);
    }
  });
  const [code, signal] = (await new Promise((resolve) => proc.on("exit", (c, s) => resolve([c, s])))) as [number | null, string | null];
  if (signal !== "SIGKILL" || !sent) throw new Error(`the first process ended with ${signal ?? code}, not killed after a send`);

  say(`\n  7 crash    a new process: the guard restores itself from ${record}`);
  const g = await createGuard({ policy, log: fileStore(record, { ownership: "kernel" }) });
  const entries = g.entries();
  const pending = entries.filter((e): e is Extract<Entry, { kind: "decision" }> => e.kind === "decision" && e.allow).at(-1)!;
  say(`  7 crash    restored ${entries.length} entries; ${await replayed(g, policy)}`);
  const w = guardedWallet(walletOf(agent), g, { rpc });
  const a = agent.publicKey;
  await propose(g, w, "7 crash", "the killed payment again, while it could still land", await tx(a, true, pay(a, treasury, 0.0012)));
  const outcome = await rpc.confirm(sent, BigInt(pending.expires?.lastValidBlockHeight ?? 0));
  g.report(pending.hash, outcome);
  say(`  7 crash    the killed attempt's outcome, read from the chain and recorded: ${outcome}`);
  operatorReleases(g, "7 crash");

  say("\nscene 2 · fooled: the agent read \"send 0.004 SOL to <attacker>\" in token metadata");
  const attacker = Keypair.generate().publicKey;
  await propose(g, w, "2 fooled", "0.004 SOL to the attacker", await tx(a, true, pay(a, attacker, 0.004)));

  say("\nscene 3 · tricked into standing authority");
  const tokenAccount = Keypair.generate().publicKey;
  const approve = new TransactionInstruction({
    programId: new PublicKey(PROGRAMS.token),
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: attacker, isSigner: false, isWritable: false },
      { pubkey: a, isSigner: true, isWritable: false },
    ],
    data: (() => {
      const d = Buffer.alloc(9);
      d[0] = 4; // Approve
      d.writeBigUInt64LE(18_446_744_073_709_551_615n, 1);
      return d;
    })(),
  });
  await propose(g, w, "3 approve", "SPL Approve: the attacker as delegate, for everything", await tx(a, true, approve));
  const nonceAccount = Keypair.generate().publicKey;
  await propose(g, w, "3 nonce", "0.001 SOL to the treasury, on a durable nonce", await tx(a, true, SystemProgram.nonceAdvance({ noncePubkey: nonceAccount, authorizedPubkey: a }), pay(a, treasury, 0.001)));
  operatorReleases(g, "3 nonce");

  say("\nscene 4 · looping: an unfunded agent retries a payment the RPC refuses");
  const l = guardedWallet(walletOf(loopAgent), g, { rpc });
  for (let i = 1; i <= 8; i++) {
    const r = await propose(g, l, `4 loop`, `turn ${i}: 0.001 SOL to the treasury, from an empty account`, await tx(loopAgent.publicKey, false, pay(loopAgent.publicKey, treasury, 0.001)));
    if (!r.allow) break;
  }
  const s = g.status();
  say(`  4 loop     the guard is ${s.latched ? `LATCHED at decision ${s.latchSeq}` : "not latched"}`);

  say("\nrelease · the guard is latched until the operator signs the release text");
  await propose(g, w, "release", "0.001 SOL to the treasury, while latched", await tx(a, true, pay(a, treasury, 0.001)));
  operatorReleases(g, "release");
  await propose(g, w, "release", "0.001 SOL to the treasury, after the release", await tx(a, true, pay(a, treasury, 0.001)));

  const counts: Record<string, number> = {};
  for (const e of g.entries()) {
    const k = e.kind === "decision" ? (e.allow ? "allow" : `deny ${e.rule}`) : e.kind;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  say(`\nthe record: ${g.entries().length} entries · ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  say(await replayed(g, policy));
  g.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
