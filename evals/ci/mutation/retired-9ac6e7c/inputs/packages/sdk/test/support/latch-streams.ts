// The archived latch experiment's streams (evals/sdk/latch-variants/measure.mts).
// Keep the stream definitions and seeds fixed: the expected results predate the implementation.

import { generateKeyPairSync } from "node:crypto";
import {
  appendTransactionMessageInstructions, compileTransactionMessage, createNoopSigner, createTransactionMessage,
  getCompiledTransactionMessageEncoder, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  type Address, type Blockhash, type Instruction,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { PROGRAMS } from "../../src/classify.ts";
import { createGuard, type Decision, type Guard } from "../../src/guard.ts";
import type { PolicyInput } from "../../src/policy.ts";
import { encodeBase58 } from "../../src/base58.ts";
import { kitAddress, randomAddress, rng } from "./kit.ts";

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

class Run {
  ds: Decision[] = [];
  legit: number[] = [];
  readonly g: Guard;
  constructor(g: Guard) { this.g = g; }
  check(ixs: Instruction[], at: number, o: { height?: bigint; legit?: boolean } = {}) {
    const d = this.g.check({ message: message(ixs), at, blockHeight: o.height, lastValidBlockHeight: o.height === undefined ? undefined : o.height + 150n });
    this.ds.push(d);
    if (o.legit) this.legit.push(this.ds.length - 1);
    return d;
  }
  summary() {
    const latchAt = this.ds.findIndex((d) => d.latch);
    return {
      latchTurn: latchAt < 0 ? null : latchAt + 1,
      allowed: this.ds.filter((d) => d.allow).length,
      legitStopped: this.legit.length ? this.legit.filter((i) => !this.ds[i]!.allow).length : null,
    };
  }
}
const fresh = async () => new Run(await createGuard({ policy }));

export const latchCases: [string, () => Promise<Run>, number | null, number, number | null][] = [
  ["identical failing retries, 400 ms", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) { const d = x.check([pay(DESTS[0]!, 250_000_000n)], t * 400); if (d.allow) x.g.report(d.hash, "failed"); }
    return x;
  }, 3, 2, null],
  ["identical failing retries, 5 s", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) { const d = x.check([pay(DESTS[0]!, 250_000_000n)], t * 5_000); if (d.allow) x.g.report(d.hash, "failed"); }
    return x;
  }, 3, 2, null],
  ["rising fees, failing, 400 ms", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) { const d = x.check([...fees(t), pay(DESTS[0]!, 250_000_000n)], t * 400); if (d.allow) x.g.report(d.hash, "failed"); }
    return x;
  }, 5, 3, null],
  ["two shapes alternating, failing, 400 ms", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) { const d = x.check([pay(DESTS[t % 2]!, 250_000_000n + BigInt(t))], t * 400); if (d.allow) x.g.report(d.hash, "failed"); }
    return x;
  }, null, 12, null],
  ["scene 5: one early re-sign, then 10 normal payments", async () => {
    const x = await fresh();
    const first = x.check([pay(DESTS[0]!, 2_000_000n)], 10_000, { height: 1_000n, legit: true });
    x.check([pay(DESTS[0]!, 2_000_000n)], 11_000, { height: 1_005n });
    if (first.allow) x.g.report(first.hash, "landed");
    for (let t = 0; t < 10; t++) { const d = x.check([pay(DESTS[1 + (t % 2)]!, BigInt(3_000_000 + t * 1_000))], 20_000 + t * 10_000, { height: 1_010n + BigInt(t * 25), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    return x;
  }, null, 11, 0],
  ["cockpit demo: unknown outcome, re-sent once", async () => {
    const x = await fresh();
    const first = x.check([pay(DESTS[0]!, 2_000_000n)], 10_000, { height: 1_000n, legit: true });
    if (first.allow) x.g.report(first.hash, "unknown");
    x.check([pay(DESTS[0]!, 2_000_000n)], 30_000, { height: 1_050n });
    if (first.allow) x.g.report(first.hash, "landed");
    for (let t = 0; t < 10; t++) { const d = x.check([pay(DESTS[1 + (t % 2)]!, BigInt(3_000_000 + t * 1_000))], 40_000 + t * 10_000, { height: 1_060n + BigInt(t * 25), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    return x;
  }, null, 11, 0],
  ["the kit's double signing: six payments signed twice", async () => {
    const x = await fresh();
    for (let i = 0; i < 6; i++) {
      const a = x.check([pay(DESTS[i % 3]!, BigInt(5_000_000 + i * 1_000))], 10_000 + i * 15_000, { height: 1_000n + BigInt(i * 40), legit: true });
      x.check([pay(DESTS[i % 3]!, BigInt(5_000_000 + i * 1_000))], 10_500 + i * 15_000, { height: 1_002n + BigInt(i * 40) });
      if (a.allow) x.g.report(a.hash, "landed");
    }
    return x;
  }, 9, 4, 2],
  ["drain storm: the same drain", async () => {
    const x = await fresh();
    const attacker = randomAddress(r);
    for (let t = 1; t <= 12; t++) x.check([pay(attacker, SOL / 2n)], t * 2_000);
    return x;
  }, 4, 0, null],
  ["drain storm: new address and amount", async () => {
    const x = await fresh();
    for (let t = 1; t <= 12; t++) x.check([pay(randomAddress(r), SOL / 2n + BigInt(t))], t * 2_000);
    return x;
  }, 5, 0, null],
];

for (const share of [0.1, 0.2, 0.3, 0.4, 0.6, 0.8]) {
  const amount = BigInt(Math.round(share * 1_000)) * 1_000_000n;
  latchCases.push([`scene 5 at ${share * 100}% of the cap`, async () => {
    const x = await fresh();
    for (let t = 0; t < 2; t++) { const d = x.check([pay(DESTS[0]!, amount / 2n + BigInt(t))], 1_000 + t * 2_000, { height: 900n + BigInt(t * 10), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    const first = x.check([pay(DESTS[0]!, amount)], 6_000, { height: 1_000n, legit: true });
    x.check([pay(DESTS[0]!, amount)], 7_000, { height: 1_005n });
    if (first.allow) x.g.report(first.hash, "landed");
    for (let t = 0; t < 10; t++) { const d = x.check([pay(DESTS[1 + (t % 2)]!, amount / 2n + BigInt(t))], 20_000 + t * 10_000, { height: 1_010n + BigInt(t * 25), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    return x;
  }, null, 13, 0]);
}
latchCases.push(["cockpit demo at its proportions", async () => {
  const x = await fresh();
  const amount = 60_000_000n;
  x.check([pay(randomAddress(r), SOL / 2n)], 1_000);
  const first = x.check([pay(DESTS[0]!, amount)], 10_000, { height: 1_000n, legit: true });
  if (first.allow) x.g.report(first.hash, "unknown");
  x.check([pay(DESTS[0]!, amount)], 30_000, { height: 1_050n });
  if (first.allow) x.g.report(first.hash, "landed");
  for (let t = 0; t < 10; t++) { const d = x.check([pay(DESTS[1 + (t % 2)]!, amount + BigInt(t))], 40_000 + t * 10_000, { height: 1_060n + BigInt(t * 25), legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
  return x;
}, null, 11, 0]);

const poisson = () => {
  const g = rng(3); let at = 0;
  return Array.from({ length: 600 }, () => { at += Math.round((-Math.log(1 - g.next()) * 60_000) / 6); return { at, to: g.pick(DESTS), lamports: BigInt(g.int(10, 500)) * 1_000_000n }; });
};
const bursts = () => {
  const g = rng(4);
  return Array.from({ length: 120 }, (_, b) => Array.from({ length: 5 }, (_, i) => ({ at: b * 300_000 + i * g.int(200, 600), to: DESTS[i % DESTS.length]!, lamports: BigInt(g.int(10, 500)) * 1_000_000n + BigInt(i) }))).flat();
};
for (const [label, stream] of [["benign: expected rate", poisson()], ["benign: bursts", bursts()]] as const) {
  latchCases.push([label, async () => {
    const x = await fresh();
    for (const p of stream) { const d = x.check([pay(p.to, p.lamports)], p.at, { legit: true }); if (d.allow) x.g.report(d.hash, "landed"); }
    return x;
  }, null, 600, 0]);
}
