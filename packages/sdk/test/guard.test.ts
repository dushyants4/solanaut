// The first evals, written before the guard existed and run against a stub that allowed
// everything (runs/2026-09-27-setup.md records that failing run). Each test names the one
// property it proves.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Keypair, SystemProgram, Transaction, TransactionInstruction, PublicKey } from "@solana/web3.js";
import { createGuard, describeTransaction, type Policy, type Proposal } from "../src/index.ts";

const agent = Keypair.generate().publicKey;
const treasury = Keypair.generate().publicKey.toBase58();
const attacker = Keypair.generate().publicKey.toBase58();
const SYSTEM = SystemProgram.programId.toBase58();

const policy: Policy = {
  allowedPrograms: [SYSTEM],
  allowedDestinations: [treasury],
  maxLamportsPerTx: 1_000_000_000, // 1 SOL
  maxLamportsPerWindow: 3_000_000_000, // 3 SOL
  windowMs: 60_000,
};

const transfer = (to: string, lamports: number, at: number): Proposal => ({
  programIds: [SYSTEM],
  transfers: [{ to, lamports }],
  at,
});

test("a transfer to a destination off the allowlist is denied, whatever came before it", async () => {
  const guard = await createGuard({ policy });
  const d = guard.evaluate(transfer(attacker, 500_000_000, 0));
  assert.equal(d.allow, false);
  assert.equal(d.rule, "destination-not-allowed");
});

test("a program off the allowlist is denied", async () => {
  const guard = await createGuard({ policy });
  const memo = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
  const d = guard.evaluate({ programIds: [SYSTEM, memo], transfers: [{ to: treasury, lamports: 1 }], at: 0 });
  assert.equal(d.allow, false);
  assert.equal(d.rule, "program-not-allowed");
});

test("a transfer over the per-transaction cap is denied", async () => {
  const guard = await createGuard({ policy });
  const d = guard.evaluate(transfer(treasury, 1_500_000_000, 0));
  assert.equal(d.allow, false);
  assert.equal(d.rule, "over-per-tx-cap");
});

test("the window cap counts what was allowed, not what was proposed", async () => {
  const guard = await createGuard({ policy });
  const allowed = [0, 1, 2, 3].map((i) => {
    const d = guard.evaluate(transfer(treasury, 900_000_000 + i, 1_000 * (i + 1) * 7));
    if (d.allow) guard.report("success");
    return d;
  });
  // 3 x 0.9 SOL fit under 3 SOL; the fourth would make 3.6.
  assert.deepEqual(allowed.map((d) => d.allow), [true, true, true, false]);
  assert.equal(allowed[3]!.rule, "over-window-cap");
});

test("an identical failing proposal, repeated, is stopped by the control loop, and the turn is measured", async () => {
  const guard = await createGuard({ policy });
  const decisions = [];
  for (let turn = 1; turn <= 12; turn++) {
    const d = guard.evaluate(transfer(treasury, 250_000_000, turn * 400));
    decisions.push(d);
    if (!d.allow) break;
    guard.report("failure"); // the send failed; the agent retries word for word
  }
  const stoppedAt = decisions.findIndex((d) => !d.allow) + 1;
  // Measured, not assumed: print it so the run record carries the number.
  console.log(`  retry loop stopped at turn ${stoppedAt}: ${decisions.map((d) => d.posture).join(" -> ")}`);
  assert.equal(decisions[0]!.allow, true, "the first attempt is a normal transfer");
  assert.ok(stoppedAt > 1 && stoppedAt <= 12, `expected a stop within 12 turns, got ${stoppedAt}`);
  assert.equal(decisions[stoppedAt - 1]!.rule, "loop-reground");
});

test("varied, successful transfers are not stopped", async () => {
  const guard = await createGuard({ policy: { ...policy, maxLamportsPerWindow: 100_000_000_000 } });
  for (let turn = 1; turn <= 20; turn++) {
    const lamports = 10_000_000 + ((turn * 7_919_993) % 90_000_000);
    const d = guard.evaluate(transfer(treasury, lamports, turn * 30_000));
    assert.equal(d.allow, true, `turn ${turn} was stopped: ${d.reason}`);
    guard.report("success");
  }
});

test("telemetry the controller refuses fails closed", async () => {
  const guard = await createGuard({ policy, sensor: () => ({ intensity: Number.NaN, valence: 0, repetition: 0 }) });
  const d = guard.evaluate(transfer(treasury, 1, 0));
  assert.equal(d.allow, false);
  assert.equal(d.rule, "fail-closed");
});

test("a controller that is not the verified binary is refused at creation", async () => {
  await assert.rejects(createGuard({ policy, expectedDigest: "0".repeat(64) }), /digest/);
});

test("a web3.js transaction is described by its programs and its transfers", () => {
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: agent, toPubkey: new PublicKey(treasury), lamports: 42 }),
    new TransactionInstruction({ programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), keys: [], data: Buffer.from("hello") }),
  );
  const p = describeTransaction(tx, 5);
  assert.deepEqual(p.programIds.sort(), [SYSTEM, "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"].sort());
  assert.deepEqual(p.transfers, [{ to: treasury, lamports: 42 }]);
  assert.equal(p.at, 5);
});
