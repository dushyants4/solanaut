// §3 "A receipt is an allowed DecisionV1" and §7 "Receipts are redeemed".
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuard } from "@solanaut/sdk";
import { mk, transfer, prop, keypair, calmSensor, logPath, rmLog } from "./lib/helpers.mjs";

const T0 = 3_000_000;

async function receipt(opts) {
  const ctx = await mk({}, opts);
  const msg = transfer(ctx.agent, ctx.dest, 1000n);
  const a = ctx.guard.check(prop(msg, T0, 100, 250));
  assert.equal(a.allow, true);
  return { ...ctx, msg, a };
}

test("S28 §7 'a receipt signs once': the first redeem is ok, the second is refused", async () => {
  const { guard, msg, a } = await receipt();
  const r1 = guard.redeem(msg, a.hash, 100n);
  assert.equal(r1.ok, true, r1.reason);
  const r2 = guard.redeem(msg, a.hash, 100n);
  assert.equal(r2.ok, false, "a used receipt");
});

test("S29 §3 receipt: sha256(bytes) must equal messageHash; other bytes are refused", async () => {
  const { guard, agent, dest, a, msg } = await receipt();
  const same = transfer(agent, dest, 1000n); // same effects, other blockhash: other bytes
  assert.equal(guard.redeem(same, a.hash, 100n).ok, false, "same effects, different bytes");
  const flipped = new Uint8Array(msg); flipped[flipped.length - 1] ^= 1;
  assert.equal(guard.redeem(flipped, a.hash, 100n).ok, false, "one bit changed");
});

test("S30 §3 receipt: past expires.lastValidBlockHeight is refused", async () => {
  const { guard, msg, a } = await receipt();
  assert.equal(guard.redeem(msg, a.hash, 251n).ok, false);
});

test("S31 §3 / §7 'At exactly an attempt's lastValidBlockHeight it can still land': redeem at exactly lvbh is ok", async () => {
  const { guard, msg, a } = await receipt();
  const r = guard.redeem(msg, a.hash, 250n);
  assert.equal(r.ok, true, r.reason);
});

test("S32 §3 receipt: a denied decision is not a receipt", async () => {
  const { guard, agent } = await mk();
  const msg = transfer(agent, keypair().address, 1000n);
  const d = guard.check(prop(msg, T0, 100, 250));
  assert.equal(d.allow, false);
  assert.equal(guard.redeem(msg, d.hash, 100n).ok, false);
});

test("S33 §3 receipt: policyHash must equal the guard's own; a receipt from before a policy change is refused", async () => {
  const log = logPath("redeem-policy");
  try {
    const ctx = await receipt({ log });
    ctx.guard.close();
    const p2 = { ...ctx.policy, sol: { maxPerTx: 999_999n, maxPerWindow: 10_000_000n } };
    const g2 = await createGuard({ policy: p2, sensor: calmSensor, log });
    assert.notEqual(g2.policyHash, ctx.a.policyHash);
    assert.equal(g2.redeem(ctx.msg, ctx.a.hash, 100n).ok, false);
    g2.close();
  } finally { rmLog(log); }
});

test("S34 §3 / §7 'which survives restarts': a used receipt stays used after the guard restarts", async () => {
  const log = logPath("redeem-restart");
  try {
    const ctx = await receipt({ log });
    assert.equal(ctx.guard.redeem(ctx.msg, ctx.a.hash, 100n).ok, true);
    ctx.guard.close();
    const g2 = await createGuard({ policy: ctx.policy, sensor: calmSensor, log });
    assert.equal(g2.redeem(ctx.msg, ctx.a.hash, 100n).ok, false);
    g2.close();
  } finally { rmLog(log); }
});

test("S35 §3 receipt (unclear): redeem with no block height, for a receipt that carries an expiry", async () => {
  const { guard, msg, a } = await receipt();
  const r = guard.redeem(msg, a.hash);
  // Spec: "the current block height ... is at most expires.lastValidBlockHeight". With no height given
  // the condition cannot be checked. Recorded, not asserted.
  console.log(`S35 observed: ok=${r.ok} reason=${JSON.stringify(r.reason)}`);
});

test("S36 §3 / §7 (unclear): redeem a receipt already reported expired, within its height", async () => {
  const { guard, msg, a } = await receipt();
  guard.report(a.hash, "expired"); // releases value and fees, and admits attempt 2
  const r = guard.redeem(msg, a.hash, 100n);
  console.log(`S36 observed: ok=${r.ok} reason=${JSON.stringify(r.reason)}`);
});
