// A guard record for the cockpit to show: payments that land, a drain, a re-send while the first
// is in flight, a durable nonce, garbage bytes, an over-cap payment. Public keys only; nothing is
// signed or sent. It writes the policy and a fresh record into the directory it is given.
//
//   node apps/cockpit/src/demo.ts --dir .sandbox/cockpit --agent <pubkey> --treasury <pubkey> --operator <pubkey>

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createGuard, PROGRAMS, type PolicyInput } from "@solanaut/sdk";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i > 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`--${name} is required`);
  return v;
};
const dir = arg("dir");
const agent = new PublicKey(arg("agent"));
const treasury = new PublicKey(arg("treasury"));
const operator = arg("operator");
const attacker = Keypair.generate().publicKey;
const nonce = Keypair.generate().publicKey;

const policy: PolicyInput = {
  version: 1,
  principal: [agent.toBase58()],
  programs: { allow: [PROGRAMS.system, PROGRAMS.computeBudget, PROGRAMS.memo], opaque: "deny" },
  destinations: { allow: [treasury.toBase58()] },
  sol: { maxPerTx: 50_000_000n, maxPerWindow: 200_000_000n },
  tokens: [],
  fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 10_000_000n, tipAccounts: [] },
  lookupTables: [],
  windowMs: 3_600_000,
  intents: { maxAttempts: 3 },
  latch: { afterDenials: 8, releaseKey: operator, guardId: "cockpit-demo", cluster: "localnet" },
  messages: { allow: false },
  cosign: { allow: false },
  sensor: { expectedPerMinute: 6 },
};

mkdirSync(dir, { recursive: true });
rmSync(join(dir, "guard.jsonl"), { force: true });
writeFileSync(join(dir, "policy.json"), JSON.stringify(policy, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2));
const g = await createGuard({ policy, log: join(dir, "guard.jsonl") });

let at = Date.now() - 10 * 60_000;
let height = 1_000n;
const message = (...ixs: Parameters<Transaction["add"]>) =>
  new Uint8Array(new Transaction({ feePayer: agent, recentBlockhash: Keypair.generate().publicKey.toBase58() }).add(...ixs).serializeMessage());
const pay = (to: PublicKey, sol: number) => SystemProgram.transfer({ fromPubkey: agent, toPubkey: to, lamports: Math.round(sol * 1e9) });
const check = (bytes: Uint8Array) => g.check({ message: bytes, at: (at += 41_000), blockHeight: (height += 20n), lastValidBlockHeight: height + 150n });

const report = (d: ReturnType<typeof check>, outcome: "landed" | "failed" | "unknown") => {
  if (d.allow) g.report(d.hash, outcome);
  return d;
};
const ds = [
  ...[0.004, 0.006, 0.012].map((amount) => report(check(message(pay(treasury, amount))), "landed")),
  check(message(pay(attacker, 0.5))),
  report(check(message(pay(treasury, 0.003))), "unknown"),
  check(message(pay(treasury, 0.003))),
  check(message(SystemProgram.nonceAdvance({ noncePubkey: nonce, authorizedPubkey: agent }), pay(treasury, 0.001))),
  g.check({ message: Uint8Array.of(9, 9, 9), at: (at += 41_000) }),
  check(message(pay(treasury, 2))),
  report(check(message(pay(treasury, 0.008))), "failed"),
  check(message(pay(treasury, 0.002))),
];
for (const d of ds) console.log(`  ${String(d.seq).padStart(2)} ${d.allow ? "ALLOW" : `DENY ${d.rule}`}  ${d.posture ?? "-"}  ${d.telemetry ? [d.telemetry.intensity, d.telemetry.valence, d.telemetry.repetition].map((x) => x.toFixed(2)).join(" ") : ""}`);
g.close();
console.log(`wrote ${join(dir, "guard.jsonl")} and ${join(dir, "policy.json")}`);
