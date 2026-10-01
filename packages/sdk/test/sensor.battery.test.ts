// The benign and loop batteries for sensors v0 and v1 (docs/SPEC.md §6 and §11; defect D8). The
// same proposal streams go through a guard with each sensor. Nothing here sets a threshold: the
// false-stop rates and the stop turns are measured and printed, and the one assertion about D8 is
// that sensor v1 stops no more benign payments than sensor v0 on the same streams. Sensor v1's
// coefficients were fixed (src/sensor.ts, SENSOR_V1) before this battery first ran.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  createNoopSigner,
  createTransactionMessage,
  getCompiledTransactionMessageEncoder,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
  type Instruction,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { PROGRAMS } from "../src/classify.ts";
import { createGuard, type Decision } from "../src/guard.ts";
import type { PolicyInput } from "../src/policy.ts";
import { sensorV0, sensorV1, type Sensor } from "../src/sensor.ts";
import { encodeBase58 } from "../src/base58.ts";
import { generateKeyPairSync } from "node:crypto";
import { kitAddress, randomAddress, rng } from "./support/kit.ts";

const r = rng(808);
const AGENT = randomAddress(r);
const DESTS = [randomAddress(r), randomAddress(r), randomAddress(r)];
const SOL = 1_000_000_000n;
const operator = encodeBase58(Buffer.from(generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x!, "base64url"));

const policy: PolicyInput = {
  version: 1,
  principal: [AGENT],
  programs: { allow: [PROGRAMS.system, PROGRAMS.computeBudget], opaque: "deny" },
  destinations: { allow: DESTS },
  sol: { maxPerTx: SOL, maxPerWindow: 10_000n * SOL },
  tokens: [],
  fees: { maxPriorityPerTx: 10_000_000n, maxPerWindow: 10_000n * SOL, tipAccounts: [] },
  lookupTables: [],
  windowMs: 86_400_000,
  intents: { maxAttempts: 3 },
  latch: { afterDenials: 5, releaseKey: operator, guardId: "battery", cluster: "localnet" },
  messages: { allow: false },
  cosign: { allow: false },
  sensor: { expectedPerMinute: 6 },
};

function message(ixs: Instruction[], seed: number): Uint8Array {
  let m: any = createTransactionMessage({ version: "legacy" });
  m = setTransactionMessageFeePayerSigner(createNoopSigner(AGENT), m);
  m = setTransactionMessageLifetimeUsingBlockhash({ blockhash: kitAddress(rng(seed).bytes(32)) as unknown as Blockhash, lastValidBlockHeight: 1n }, m);
  m = appendTransactionMessageInstructions(ixs, m);
  return new Uint8Array(getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(m) as never));
}
const pay = (to: Address, lamports: bigint) => getTransferSolInstruction({ source: createNoopSigner(AGENT), destination: to, amount: lamports });

/** Wilson's 95% interval for k of n. */
function wilson(k: number, n: number): [number, number] {
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

interface Payment { at: number; to: Address; lamports: bigint }

/** A benign stream run through a guard: every payment within policy, every allowed one landing. */
async function benign(sensor: Sensor, stream: Payment[]) {
  const g = await createGuard({ policy, sensor });
  const stops: Record<string, number> = {};
  stream.forEach((p, i) => {
    const d = g.check({ message: message([pay(p.to, p.lamports)], i), at: p.at });
    if (d.allow) g.report(d.hash, "landed");
    else stops[d.rule!] = (stops[d.rule!] ?? 0) + 1;
  });
  const k = Object.values(stops).reduce((a, b) => a + b, 0);
  return { k, n: stream.length, stops };
}

function poisson(n: number, perMinute: number, seed: number): Payment[] {
  const g = rng(seed);
  let at = 0;
  return Array.from({ length: n }, () => {
    at += Math.round((-Math.log(1 - g.next()) * 60_000) / perMinute);
    return { at, to: g.pick(DESTS), lamports: BigInt(g.int(10, 500)) * 1_000_000n };
  });
}

function bursts(batches: number, size: number, everyMs: number, seed: number): Payment[] {
  const g = rng(seed);
  return Array.from({ length: batches }, (_, b) =>
    Array.from({ length: size }, (_, i) => ({ at: b * everyMs + i * g.int(200, 600), to: DESTS[i % DESTS.length]!, lamports: BigInt(g.int(10, 500)) * 1_000_000n + BigInt(i) })),
  ).flat();
}

test("the benign battery: 600 payments at the expected rate, and 600 in bursts; v0 against v1, measured", async () => {
  const lines: string[] = [];
  for (const [label, stream] of [
    // Seeds 1 and 2 were the first run's, which found the landed-repeat defect; these are fresh.
    ["Poisson, 6 a minute (the policy's expected rate)", poisson(600, 6, 3)],
    ["bursts of 5 payouts, 0.2 to 0.6 s apart, every 5 minutes", bursts(120, 5, 300_000, 4)],
  ] as const) {
    const v0 = await benign(sensorV0, stream);
    const v1 = await benign(sensorV1, stream);
    for (const [name, res] of [["v0", v0], ["v1", v1]] as const) {
      const [lo, hi] = wilson(res.k, res.n);
      lines.push(`${label} · sensor ${name}: ${res.k} of ${res.n} stopped, ${pct(res.k / res.n)} (95% CI ${pct(lo)} to ${pct(hi)}) ${JSON.stringify(res.stops)}`);
    }
    assert.ok(v1.k <= v0.k, `${label}: sensor v1 stopped ${v1.k}, more than sensor v0's ${v0.k}`);
  }
  for (const l of lines) console.log(`  benign: ${l}`);
});

/** A loop: the agent proposes, the send fails, it tries again; until a rule stops it, or 12 turns. */
async function loop(sensor: Sensor, ixsFor: (turn: number) => Instruction[], gapMs: number) {
  const g = await createGuard({ policy, sensor });
  const ds: Decision[] = [];
  for (let turn = 1; turn <= 12; turn++) {
    const d = g.check({ message: message(ixsFor(turn), turn), at: turn * gapMs });
    ds.push(d);
    if (!d.allow) break;
    g.report(d.hash, "failed");
  }
  const stop = ds.findIndex((d) => !d.allow);
  return stop < 0 ? "not stopped in 12 turns" : `turn ${stop + 1}, ${ds[stop]!.rule} (${ds.map((d) => d.posture).join(" > ")})`;
}

test("the loop battery: identical retries, rising fees, two alternating shapes; the stop turn measured for v0 and v1", async () => {
  const cases: [string, (t: number) => Instruction[], number][] = [
    ["identical retries, 400 ms apart", () => [pay(DESTS[0]!, 250_000_000n)], 400],
    ["identical retries, 5 s apart", () => [pay(DESTS[0]!, 250_000_000n)], 5_000],
    ["rising fees, 400 ms apart", (t) => [getSetComputeUnitLimitInstruction({ units: 200_000 }), getSetComputeUnitPriceInstruction({ microLamports: BigInt(1_000 * 2 ** t) }), pay(DESTS[0]!, 250_000_000n)], 400],
    ["two shapes alternating, 400 ms apart", (t) => [pay(DESTS[t % 2]!, 250_000_000n + BigInt(t))], 400],
  ];
  for (const [label, ixs, gap] of cases) {
    const v0 = await loop(sensorV0, ixs, gap);
    const v1 = await loop(sensorV1, ixs, gap);
    console.log(`  loop: ${label} · v0: ${v0} · v1: ${v1}`);
    assert.match(v1, /turn \d+|not stopped/, "measured and reported; no stop turn is assumed");
  }
});
