// A guarded payment, start to finish, offline: a policy, a payment the guard admits, redeems and
// sees reported, and one it refuses before anything is signed. Keys live in memory for this run
// only, and nothing is sent: there is no network here.
//
//   node examples/guarded-payment.mjs
//
// On a cluster, the blockhash and the two heights come from the RPC, and the signed bytes are sent
// where this example only signs them (apps/sandbox/src/main.ts does both).

import { generateKeyPairSync } from "node:crypto";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { createGuard, encodeBase58, PROGRAMS } from "@solanaut/sdk";

const agent = Keypair.generate();
const treasury = Keypair.generate().publicKey;
const stranger = Keypair.generate().publicKey;

const policy = {
  version: 1,
  principal: [agent.publicKey.toBase58()],
  programs: { allow: [PROGRAMS.system], opaque: "deny" },
  destinations: { allow: [treasury.toBase58()] },
  sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 3_000_000_000n },
  tokens: [],
  fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 10_000_000n, tipAccounts: [] },
  lookupTables: [],
  windowMs: 60_000,
  intents: { maxAttempts: 3 },
  latch: { afterDenials: 5, releaseKey: operatorKey(), guardId: "example", cluster: "localnet" },
  messages: { allow: false },
  cosign: { allow: false },
  sensor: { expectedPerMinute: 6 },
};

// What the chain would say: a recent blockhash, the current height, and the last height at which
// that blockhash is valid. Heights are bigints.
const block = { blockhash: Keypair.generate().publicKey.toBase58(), height: 1_000n, lastValidHeight: 1_150n };

const guard = await createGuard({ policy, onRefusal: tellTheOperator });
try {
  pay(treasury, 250_000_000);
  pay(stranger, 250_000_000);
} finally {
  guard.close();
}

/** Check the payment's bytes, and sign only what the guard admitted. */
function pay(to, lamports) {
  const transaction = transfer(to, lamports);
  const message = transaction.serializeMessage();
  const decision = guard.check({
    message,
    at: Date.now(),
    blockHeight: block.height,
    lastValidBlockHeight: block.lastValidHeight,
  });
  if (!decision.allow) {
    console.log(`${lamports} lamports to ${to.toBase58()}: refused before signing`);
    return;
  }

  const receipt = guard.redeem(message, decision.hash, block.height);
  if (!receipt.ok) throw new Error(`the receipt did not redeem: ${receipt.reason}`);
  transaction.sign(agent);
  // On a cluster: send transaction.serialize(), and wait for the outcome.
  guard.report(decision.hash, "landed");
  console.log(`${lamports} lamports to ${to.toBase58()}: allowed, signed, reported landed`);
}

function transfer(to, lamports) {
  const payment = SystemProgram.transfer({ fromPubkey: agent.publicKey, toPubkey: to, lamports });
  return new Transaction({ feePayer: agent.publicKey, recentBlockhash: block.blockhash }).add(payment);
}

/** The operator's log hears the rule and the reason; an adapter would tell the agent only the class. */
function tellTheOperator({ rule, reason }) {
  console.log(`  operator log: ${rule}: ${reason}`);
}

/** The key that would sign a latch release. It has to exist, outside the principal; this run never uses it. */
function operatorKey() {
  const { x } = generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" });
  return encodeBase58(Buffer.from(x, "base64url"));
}
