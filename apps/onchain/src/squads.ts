// The on-chain bound (milestone 2a.9, ADR-006, docs/SPEC.md §9): a controlled Squads v4 multisig
// whose config authority is the operator, a vault holding the funds, and a daily spending limit
// that names the agent's key, which is never a multisig member, with its destinations set. Then a
// stolen-key drill: the agent's key alone tries to move more than the limit, and to an unlisted
// address, and the Squads program refuses both on chain. Then the revoke, timed: the operator
// removes the limit, and the next use fails.
//
//   node apps/onchain/src/squads.ts --url <rpc> --operator keys/devnet-operator.json \
//     --agent keys/devnet-agent.json --treasury keys/devnet-treasury.json [--keep] [--out <squads.json>]
//
// --keep skips the revoke, leaving the limit in place for the cockpit to show; --out writes the
// public addresses the cockpit reads.
//
// --multisig <pda> resumes on a multisig this script made earlier, so an interrupted run costs no
// second vault: it skips creating and funding it, and adds a fresh limit. With --limit <pda> it
// reuses that limit too. Whatever it reuses, it checks first: the operator is the config authority,
// the agent's key is no member, and the limit names the agent's key and the treasury only.
//
// On a local validator (`--url http://127.0.0.1:8899`) it airdrops what it needs; on devnet it
// needs the operator funded first, and says so. The refused attempts are sent without preflight,
// so the refusal is the program's, recorded on chain with a signature. It prints public keys,
// signatures and timings, never a secret key. Keys are made with solana-keygen in keys/.

import { readFileSync, writeFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const url = arg("url");
if (!url) {
  console.error(
    "usage: node apps/onchain/src/squads.ts --url <rpc> --operator <keyfile> --agent <keyfile> --treasury <keyfile>",
  );
  process.exit(2);
}
const load = (path: string | undefined, label: string) => {
  if (!path) throw new Error(`--${label} is required`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
};
const operator = load(arg("operator"), "operator");
const agent = load(arg("agent"), "agent");
const treasury = load(arg("treasury"), "treasury").publicKey;
const attacker = Keypair.generate().publicKey;
const local = /127\.0\.0\.1|localhost/.test(url);
const connection = new Connection(url, "confirmed");
const cluster = local ? "custom&customUrl=" + encodeURIComponent(url) : url.includes("devnet") ? "devnet" : "unknown";
const link = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`;
const sol = (n: number) => Math.round(n * LAMPORTS_PER_SOL);

const LIMIT = sol(0.02);
const record: Record<string, unknown> = {
  cluster: url,
  at: new Date().toISOString(),
  operator: operator.publicKey.toBase58(),
  agent: agent.publicKey.toBase58(),
  treasury: treasury.toBase58(),
  attacker: attacker.toBase58(),
};
const step = (name: string, value: unknown) => {
  record[name] = value;
  console.log(`${name}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
};

const POLL_MS = local ? 500 : 2_000;

/** Wait for a sent transaction to confirm, and read its logs and slot. `at` is when its status first read confirmed. */
async function confirmed(signature: string): Promise<{ err: unknown; logs: string[]; at: number; slot: number }> {
  const deadline = Date.now() + 120_000;
  let at: number | undefined;
  while (Date.now() < deadline) {
    try {
      const s = (await connection.getSignatureStatuses([signature])).value[0];
      if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) {
        at ??= performance.now();
        // A public RPC can report the status before it serves the transaction: wait for both.
        const tx = await connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 1,
        });
        if (tx) return { err: s.err, logs: tx.meta?.logMessages ?? [], at, slot: tx.slot };
      }
    } catch (e) {
      // The public devnet RPC limits each method's rate (HTTP 429). The transaction is already sent;
      // only its status is late, so keep polling until the deadline.
      if (!String(e).includes("429")) throw e;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`${signature} was not confirmed in 120 s`);
}

/** The Squads error a failed transaction's logs name, if any. */
const squadsError = (logs: string[]) =>
  logs.map((l) => /Error Code: (\w+)/.exec(l)?.[1]).find(Boolean) ??
  logs.find((l) => /failed|Error/.test(l)) ??
  "no error in the logs";

async function main() {
  const balance = await connection.getBalance(operator.publicKey);
  if (balance < sol(0.15)) {
    if (!local) {
      console.error(
        `the operator ${operator.publicKey.toBase58()} holds ${balance / LAMPORTS_PER_SOL} SOL on ${url}; it needs 0.15. Fund it from https://faucet.solana.com and run again.`,
      );
      process.exit(1);
    }
    await confirmed(await connection.requestAirdrop(operator.publicKey, 2 * LAMPORTS_PER_SOL));
  }

  const resumed = arg("multisig");
  let multisigPda: PublicKey;
  if (!resumed) {
    // 1. A controlled multisig: the operator is its config authority and its only member.
    const createKey = Keypair.generate();
    [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });
    const [programConfigPda] = multisig.getProgramConfigPda({});
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, programConfigPda);
    const created = await multisig.rpc.multisigCreateV2({
      connection,
      treasury: programConfig.treasury,
      createKey,
      creator: operator,
      multisigPda,
      configAuthority: operator.publicKey,
      threshold: 1,
      members: [{ key: operator.publicKey, permissions: multisig.types.Permissions.all() }],
      timeLock: 0,
      rentCollector: null,
    });
    await confirmed(created);
    step("multisig", multisigPda.toBase58());
    step("create", link(created));
  } else {
    multisigPda = new PublicKey(resumed);
    step("multisig", `${multisigPda.toBase58()} (resumed)`);
  }

  // 2. The vault holds the funds; the agent holds only a fee float.
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
  step("vault", vaultPda.toBase58());
  if (!resumed) {
    const funded = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        SystemProgram.transfer({ fromPubkey: operator.publicKey, toPubkey: vaultPda, lamports: sol(0.1) }),
        SystemProgram.transfer({ fromPubkey: operator.publicKey, toPubkey: agent.publicKey, lamports: sol(0.01) }),
      ),
      [operator],
    );
    step("fund", link(funded));
  }

  // 3. The spending limit: SOL, 0.02 a day, the agent's key only, the treasury only.
  let spendingLimit: PublicKey;
  if (!arg("limit")) {
    const limitKey = Keypair.generate().publicKey;
    [spendingLimit] = multisig.getSpendingLimitPda({ multisigPda, createKey: limitKey });
    const added = await multisig.rpc.multisigAddSpendingLimit({
      connection,
      feePayer: operator,
      multisigPda,
      spendingLimit,
      configAuthority: operator.publicKey,
      rentPayer: operator,
      createKey: limitKey,
      vaultIndex: 0,
      mint: PublicKey.default,
      amount: BigInt(LIMIT),
      period: multisig.types.Period.Day,
      members: [agent.publicKey],
      destinations: [treasury],
    });
    await confirmed(added);
    step("spendingLimit", spendingLimit.toBase58());
    step("addLimit", link(added));
  } else {
    spendingLimit = new PublicKey(arg("limit")!);
    step("spendingLimit", `${spendingLimit.toBase58()} (resumed)`);
  }

  // The operator holds the config; the agent's key is on the limit, and not in the multisig.
  const ms = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
  const sl = await multisig.accounts.SpendingLimit.fromAccountAddress(connection, spendingLimit);
  step(
    "multisigMembers",
    ms.members.map((m) => m.key.toBase58()),
  );
  step(
    "limitMembers",
    sl.members.map((k) => k.toBase58()),
  );
  step(
    "limitDestinations",
    sl.destinations.map((k) => k.toBase58()),
  );
  step("limitRemaining", Number(sl.remainingAmount) / LAMPORTS_PER_SOL);
  if (!ms.configAuthority.equals(operator.publicKey))
    throw new Error("the operator must be the multisig's config authority");
  if (ms.members.some((m) => m.key.equals(agent.publicKey)))
    throw new Error("the agent's key must not be a multisig member");
  if (!sl.multisig.equals(multisigPda) || sl.members.length !== 1 || !sl.members[0]!.equals(agent.publicKey))
    throw new Error("the limit must belong to this multisig and name the agent's key only");
  if (sl.destinations.length !== 1 || !sl.destinations[0]!.equals(treasury))
    throw new Error("the limit must name the treasury only");
  if ((await connection.getBalance(agent.publicKey)) < sol(0.001))
    throw new Error("the agent's key needs a fee float of 0.001 SOL: run once without --multisig, or fund it");

  // 4. The agent's key alone, as a thief holding it would: within the limit, past it, and elsewhere.
  const use = async (amount: number, destination: PublicKey) => {
    const signature = await multisig.rpc.spendingLimitUse({
      connection,
      feePayer: agent,
      member: agent,
      multisigPda,
      spendingLimit,
      vaultIndex: 0,
      amount,
      decimals: 9,
      destination,
      sendOptions: { skipPreflight: true },
    });
    const { err, logs } = await confirmed(signature);
    return { signature: link(signature), ok: err === null, error: err === null ? null : squadsError(logs) };
  };
  step("useWithinLimit", await use(sol(0.01), treasury));
  step("usePastLimit", await use(sol(0.015), treasury));
  step("useUnlistedDestination", await use(sol(0.001), attacker));

  if (arg("out"))
    writeFileSync(
      arg("out")!,
      JSON.stringify(
        {
          cluster: url,
          multisig: multisigPda.toBase58(),
          vault: vaultPda.toBase58(),
          spendingLimit: spendingLimit.toBase58(),
          agent: agent.publicKey.toBase58(),
        },
        null,
        2,
      ),
    );
  if (process.argv.includes("--keep")) {
    step("revoke", "skipped (--keep): the limit stays in place");
    console.log(`\n${JSON.stringify(record)}`);
    return;
  }

  // 5. The revoke, timed from send to confirmed, then the next use.
  const slot0 = await connection.getSlot("processed");
  const t0 = performance.now();
  const removed = await multisig.rpc.multisigRemoveSpendingLimit({
    connection,
    feePayer: operator,
    multisigPda,
    configAuthority: operator.publicKey,
    spendingLimit,
    rentCollector: operator.publicKey,
  });
  const sent = performance.now();
  const { at, slot } = await confirmed(removed);
  step("revoke", link(removed));
  // Timed on the client to the first confirmed status it saw, so at most one poll late; the send
  // includes the RPC's preflight simulation. The chain's own measure is the slots between the slot
  // current at the send and the slot the removal landed in.
  step("revokeMs", {
    total: Math.round(at - t0),
    send: Math.round(sent - t0),
    sentToConfirmed: Math.round(at - sent),
    pollMs: POLL_MS,
  });
  step("revokeSlots", slot - slot0);
  step("useAfterRevoke", await use(sol(0.001), treasury));

  step("vaultBalance", (await connection.getBalance(vaultPda)) / LAMPORTS_PER_SOL);
  step("treasuryBalance", (await connection.getBalance(treasury)) / LAMPORTS_PER_SOL);
  console.log(`\n${JSON.stringify(record)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
