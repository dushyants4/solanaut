// The latch experiment (docs/SPEC.md §12, the open question on latching after a denied retry). The same
// proposal streams run through a scratch copy of the guard under each latch variant (LATCH_VARIANT):
//   V0  today: any denial at REGROUND latches
//   A   REGROUND latches only when Keel is the reason (rule 17, loop-reground)
//   B   a REGROUND denial latches only if the denial before it was also at REGROUND
//   C   A or B
// The run of denials (afterDenials) latches in every variant. The agent here keeps proposing whatever the
// guard says, so each stream shows when the latch trips and what got through before it.
//
// Run it through run.py, which builds the SDK copy with the switch: uv run --script evals/sdk/latch-variants/run.py

import { generateKeyPairSync } from "node:crypto";
import {
  appendTransactionMessageInstructions, compileTransactionMessage, createNoopSigner, createTransactionMessage,
  getCompiledTransactionMessageEncoder, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  type Address, type Blockhash, type Instruction,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { PROGRAMS } from "./sdk/src/classify.ts";
import { createGuard, type Decision, type Guard } from "./sdk/src/guard.ts";
import type { PolicyInput } from "./sdk/src/policy.ts";
import { encodeBase58 } from "./sdk/src/base58.ts";
import { kitAddress, randomAddress, rng } from "./sdk/test/support/kit.ts";

const VARIANT = process.env.LATCH_VARIANT ?? "V0";
const r = rng(4242);
const AGENT = randomAddress(r);
const DESTS = [randomAddress(r), randomAddress(r), randomAddress(r)];
const SOL = 1_000_000_000n;
const operator = encodeBase58(Buffer.from(generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x!, "base64url"));
const policy: PolicyInput = {
  version: 1, principal: [AGENT], programs: { allow: [PROGRAMS.system, PROGRAMS.computeBudget], opaque: "deny" },
  destinations: { allow: DESTS }, sol: { maxPerTx: SOL, maxPerWindow: 10_000n * SOL }, tokens: [],
  fees: { maxPriorityPerTx: 10_000_000n, maxPerWindow: 10_000n * SOL, tipAccounts: [] }, lookupTables: [], windowMs: 86_400_000,
  intents: { maxAttempts: 3 }, latch: { afterDenials: 5, releaseKey: operator, guardId: "latch-exp", cluster: "localnet" },
  messages: { allow: false }, cosign: { allow: false }, sensor: { expectedPerMinute: 6 },
};

let seed = 1;
function message(ixs: Instruction[]): Uint8Array {
  let m: any = createTransactionMessage({ version: "legacy" });
  m = setTransactionMessageFeePayerSigner(createNoopSigner(AGENT), m);
  m = setTransactionMessageLifetimeUsingBlockhash({ blockhash: kitAddress(rng(seed++).bytes(32)) as unknown as Blockhash, lastValidBlockHeight: 1n }, m);
  m = appendTransactionMessageInstructions(ixs, m);
  return new Uint8Array(getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(m) as never));
}
const pay = (to: Address, lamports: bigint) => getTransferSolInstruction({ source: createNoopSigner(AGENT), destination: to, amount: lamports });
const fees = (t: number) => [getSetComputeUnitLimitInstruction({ units: 200_000 }), getSetComputeUnitPriceInstruction({ microLamports: BigInt(1_000 * 2 ** t) })];

const SHORT: Record<string, string> = {
  "intent-in-flight": "inflight", "loop-reground": "LOOP", "intent-attempts-exhausted": "exhausted", "destination-not-allowed": "dest",
  latched: "latched", "inhibit-cap": "inhibit", "over-per-tx-cap": "cap",
};

/** A stream: the guard, a recorder, and the turn numbers of the legitimate payments to count stops among. */
class Run {
  ds: Decision[] = [];
  legit: number[] = [];
  g: Guard;
  constructor(g: Guard) {
    this.g = g;
  }
  check(ixs: Instruction[], at: number, o: { height?: bigint; legit?: boolean } = {}) {
    const d = this.g.check({ message: message(ixs), at, blockHeight: o.height, lastValidBlockHeight: o.height === undefined ? undefined : o.height + 150n });
    this.ds.push(d);
    if (o.legit) this.legit.push(this.ds.length - 1);
    return d;
  }
  summary() {
    const seq = this.ds.map((d) => (d.allow ? "ok" : (SHORT[d.rule!] ?? d.rule)) + (d.latch ? "*" : "")).join(" ");
    const latchAt = this.ds.findIndex((d) => d.latch);
    const allowed = this.ds.filter((d) => d.allow).length;
    const legitStopped = this.legit.filter((i) => !this.ds[i]!.allow).length;
    return { seq, latchTurn: latchAt < 0 ? "-" : String(latchAt + 1), allowed, legitStopped: this.legit.length ? `${legitStopped}/${this.legit.length}` : "-" };
  }
}
const fresh = async () => new Run(await createGuard({ policy }));

const cases: [string, () => Promise<Run>][] = [
  ["identical failing retries, 400 ms", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) { const d = x.check([pay(DESTS[0]!, 250_000_000n)], t * 400); if (d.allow) x.g.report(d.hash, "failed"); }
    return x;
  }],
  ["identical failing retries, 5 s", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) { const d = x.check([pay(DESTS[0]!, 250_000_000n)], t * 5_000); if (d.allow) x.g.report(d.hash, "failed"); }
    return x;
  }],
  ["rising fees, failing, 400 ms", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) { const d = x.check([...fees(t), pay(DESTS[0]!, 250_000_000n)], t * 400); if (d.allow) x.g.report(d.hash, "failed"); }
    return x;
  }],
  ["two shapes alternating, failing, 400 ms", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) { const d = x.check([pay(DESTS[t % 2]!, 250_000_000n + BigInt(t))], t * 400); if (d.allow) x.g.report(d.hash, "failed"); }
    return x;
  }],
  ["scene 5: one early re-sign, then 10 normal payments (landed)", async () => {
    const x = await fresh();
    const first = x.check([pay(DESTS[0]!, 2_000_000n)], 10_000, { height: 1_000n, legit: true });
    x.check([pay(DESTS[0]!, 2_000_000n)], 11_000, { height: 1_005n });
    if (first.allow) x.g.report(first.hash, "landed");
    for (let t = 0; t < 10; t++) { const d = x.check([pay(DESTS[1 + (t % 2)]!, BigInt(3_000_000 + t * 1_000))], 20_000 + t * 10_000, { height: 1_010n + BigInt(t * 25), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    return x;
  }],
  ["cockpit demo: unknown outcome, re-sent once, then 10 normal payments", async () => {
    const x = await fresh();
    const first = x.check([pay(DESTS[0]!, 2_000_000n)], 10_000, { height: 1_000n, legit: true });
    if (first.allow) x.g.report(first.hash, "unknown");
    x.check([pay(DESTS[0]!, 2_000_000n)], 30_000, { height: 1_050n });
    if (first.allow) x.g.report(first.hash, "landed");
    for (let t = 0; t < 10; t++) { const d = x.check([pay(DESTS[1 + (t % 2)]!, BigInt(3_000_000 + t * 1_000))], 40_000 + t * 10_000, { height: 1_060n + BigInt(t * 25), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    return x;
  }],
  ["the kit's double signing: each of 6 payments signed twice, first landing", async () => {
    const x = await fresh();
    for (let i = 0; i < 6; i++) {
      const a = x.check([pay(DESTS[i % 3]!, BigInt(5_000_000 + i * 1_000))], 10_000 + i * 15_000, { height: 1_000n + BigInt(i * 40), legit: true });
      x.check([pay(DESTS[i % 3]!, BigInt(5_000_000 + i * 1_000))], 10_500 + i * 15_000, { height: 1_002n + BigInt(i * 40) });
      if (a.allow) x.g.report(a.hash, "landed");
    }
    return x;
  }],
  ["drain storm: the same 0.5 SOL drain, 12 times, 2 s apart", async () => {
    const x = await fresh();
    const attacker = randomAddress(r);
    for (let t = 1; t <= 12; t++) x.check([pay(attacker, SOL / 2n)], t * 2_000);
    return x;
  }],
  ["drain storm: 12 drains, new address and amount each, 2 s apart", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) x.check([pay(randomAddress(r), SOL / 2n + BigInt(t))], t * 2_000);
    return x;
  }],
];

// Scene 5 and the cockpit demo at devnet's proportions: the re-signed payment a share of the per-payment cap.
for (const share of [0.1, 0.2, 0.3, 0.4, 0.6, 0.8]) {
  const amount = BigInt(Math.round(share * 1_000)) * 1_000_000n;
  cases.push([`scene 5 at ${share * 100}% of the cap: two landed payments, one early re-sign, then 10 normal payments`, async () => {
    const x = await fresh();
    for (let t = 0; t < 2; t++) { const d = x.check([pay(DESTS[0]!, amount / 2n + BigInt(t))], 1_000 + t * 2_000, { height: 900n + BigInt(t * 10), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    const first = x.check([pay(DESTS[0]!, amount)], 6_000, { height: 1_000n, legit: true });
    x.check([pay(DESTS[0]!, amount)], 7_000, { height: 1_005n });
    if (first.allow) x.g.report(first.hash, "landed");
    for (let t = 0; t < 10; t++) { const d = x.check([pay(DESTS[1 + (t % 2)]!, amount / 2n + BigInt(t))], 20_000 + t * 10_000, { height: 1_010n + BigInt(t * 25), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    return x;
  }]);
}
cases.push(["the cockpit demo at its proportions: a denial, an unknown outcome re-sent, then 10 normal payments", async () => {
  const x = await fresh();
  const amount = 60_000_000n; // 6% of the cap, as in the demo record
  x.check([pay(randomAddress(r), SOL / 2n)], 1_000);
  const first = x.check([pay(DESTS[0]!, amount)], 10_000, { height: 1_000n, legit: true });
  if (first.allow) x.g.report(first.hash, "unknown");
  x.check([pay(DESTS[0]!, amount)], 30_000, { height: 1_050n });
  if (first.allow) x.g.report(first.hash, "landed");
  for (let t = 0; t < 10; t++) { const d = x.check([pay(DESTS[1 + (t % 2)]!, amount + BigInt(t))], 40_000 + t * 10_000, { height: 1_060n + BigInt(t * 25), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
  return x;
}]);

function poisson(n: number, perMinute: number, s: number) {
  const g = rng(s); let at = 0;
  return Array.from({ length: n }, () => { at += Math.round((-Math.log(1 - g.next()) * 60_000) / perMinute); return { at, to: g.pick(DESTS), lamports: BigInt(g.int(10, 500)) * 1_000_000n }; });
}
function bursts(batches: number, size: number, everyMs: number, s: number) {
  const g = rng(s);
  return Array.from({ length: batches }, (_, b) => Array.from({ length: size }, (_, i) => ({ at: b * everyMs + i * g.int(200, 600), to: DESTS[i % DESTS.length]!, lamports: BigInt(g.int(10, 500)) * 1_000_000n + BigInt(i) }))).flat();
}
for (const [label, stream] of [["benign: 600 at the expected rate", poisson(600, 6, 3)], ["benign: 600 in bursts", bursts(120, 5, 300_000, 4)]] as const) {
  cases.push([label, async () => {
    const x = await fresh();
    for (const p of stream) { const d = x.check([pay(p.to, p.lamports)], p.at, { legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    return x;
  }]);
}

console.log(`variant ${VARIANT}`);
for (const [label, run] of cases) {
  const s = (await run()).summary();
  const seq = s.seq.length > 150 ? `${s.seq.slice(0, 60)} … (${s.seq.split(" ").length} decisions)` : s.seq;
  console.log(JSON.stringify({ variant: VARIANT, case: label, latchTurn: s.latchTurn, allowed: s.allowed, legitStopped: s.legitStopped, seq }));
}
