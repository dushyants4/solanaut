// §4 "Fees", §5 rules 13 and 16 (fee composition), and §4's decided items on ComputeBudget and the intent key.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  P, cast, compile, sys, tok, cb, memo, acct, decide, effects, u8, u32, u64, cat, newKey, randomHash,
} from "./lib.mjs";
import { denied, allowed } from "./assert-helpers.mjs";

const c = await cast();
const { W, SR } = acct;
const legacy = (...ixs) => compile({ payer: c.A, ixs });

// ---------------- the priority-fee formula ----------------
test("F01 with SetComputeUnitLimit: ceil(price × limit / 1e6); price 3, limit 333,333 gives 1, not 0", () => {
  const e = effects(c, legacy(cb.limit(333_333), cb.price(3n), sys.transfer(c.A, c.B, 1n)));
  assert.equal(e.computeUnitLimit, 333_333);
  assert.equal(e.priorityFee, 1n);
});

test("F02 without SetComputeUnitLimit, builtins only: 3,000 each for ComputeBudget and System (limit 6,000)", () => {
  const e = effects(c, legacy(cb.price(1_000_000n), sys.transfer(c.A, c.B, 1n)));
  assert.equal(e.computeUnitLimit, 6_000);
  assert.equal(e.priorityFee, 6_000n);
});

test("F03 without SetComputeUnitLimit, Memo is not a builtin: counted at 200,000 (limit 206,000)", () => {
  const e = effects(c, legacy(cb.price(1_000_000n), memo("x"), sys.transfer(c.A, c.B, 1n)));
  assert.equal(e.computeUnitLimit, 206_000);
  assert.equal(e.priorityFee, 206_000n);
});

test("F04 the default limit is capped at 1,400,000 (ComputeBudget + 7 Memos would be 1,403,000)", () => {
  const memos = Array.from({ length: 7 }, (_, i) => memo(`m${i}`));
  const e = effects(c, legacy(cb.price(1_000_000n), ...memos));
  assert.equal(e.computeUnitLimit, 1_400_000);
  assert.equal(e.priorityFee, 1_400_000n);
});

test("F05 [drain] a price with no limit: token transfer at 50,000 µL/CU, default limit 203,000, fee 10,150 > 10,000 is over-fee-cap", async () => {
  const m = legacy(cb.price(50_000n), tok.transferChecked(P.token, c.ataA_M, c.M, c.ataB_M, c.A, 10n));
  assert.equal(effects(c, m).priorityFee, 10_150n);
  denied(await decide(c, m), "over-fee-cap");
});

test("F06 rule 13 boundary: a priority fee exactly at maxPriorityPerTx is admitted, one lamport over is over-fee-cap", async () => {
  allowed(await decide(c, legacy(cb.limit(10_000), cb.price(1_000_000n), sys.transfer(c.A, c.B, 1n))));
  denied(await decide(c, legacy(cb.limit(10_001), cb.price(1_000_000n), sys.transfer(c.A, c.B, 1n))), "over-fee-cap");
});

test("F07 no SetComputeUnitPrice means no priority fee, whatever the limit", () => {
  const e = effects(c, legacy(cb.limit(1_400_000), sys.transfer(c.A, c.B, 1n)));
  assert.equal(e.priorityFee, 0n);
});

test("F08 a u64-max price (fee ~2.6e19 lamports) is over-fee-cap, not lost to overflow", async () => {
  const m = legacy(cb.limit(1_400_000), cb.price((1n << 64n) - 1n), sys.transfer(c.A, c.B, 1n));
  denied(await decide(c, m), "over-fee-cap");
});

// ---------------- base fee and tips ----------------
test("F09 base fee: 5,000 per signature, counting precompile signatures (2 signers + Ed25519×2 + secp256k1×1 + secp256r1×3 = 40,000)", async () => {
  const ed = { program: P.ed25519, accounts: [], data: cat(u8(2), u8(0), new Uint8Array(28)) };
  const k1 = { program: P.secp256k1, accounts: [], data: cat(u8(1), new Uint8Array(11)) };
  const r1 = { program: P.secp256r1, accounts: [], data: cat(u8(3), u8(0), new Uint8Array(42)) };
  const signed = { program: P.memo, accounts: [SR(c.K2)], data: new TextEncoder().encode("k2") };
  const m = legacy(ed, k1, r1, signed, sys.transfer(c.A, c.B, 1n));
  const e = effects(c, m);
  assert.equal(e.signers.length, 2);
  assert.equal(e.baseFee, 40_000n);
  const d = await decide(c, m, (p) => { p.programs.allow.push(P.ed25519, P.secp256k1, P.secp256r1); p.programs.opaque = "allow"; });
  allowed(d);
  assert.equal(d.amounts.fees, "40000");
});

test("F10 a tip to a tip account is not a SOL payment: allowed past sol.maxPerTx, counted in fees", async () => {
  const m = legacy(sys.transfer(c.A, c.T, 500_000_000n));
  const e = effects(c, m);
  assert.equal(e.tips, 500_000_000n);
  assert.deepEqual(e.sol, []);
  const d = await decide(c, m, (p) => { p.sol.maxPerTx = 1000n; });
  allowed(d);
  assert.equal(d.amounts.sol, "0");
  assert.equal(d.amounts.fees, "500005000");
});

test("F11 the fee window counts base + priority + tips together: 15,000 fits a 15,000 window, not a 14,999 one", async () => {
  // base 5,000; priority: price 1e6 × default (3,000 CB + 3,000 + 3,000) = 9,000; tip 1,000.
  const m = legacy(cb.price(1_000_000n), sys.transfer(c.A, c.B, 1n), sys.transfer(c.A, c.T, 1_000n));
  const d = await decide(c, m, (p) => { p.fees.maxPerWindow = 15_000n; });
  allowed(d);
  assert.equal(d.amounts.fees, "15000");
  denied(await decide(c, m, (p) => { p.fees.maxPerWindow = 14_999n; }), "over-window-cap");
});

// ---------------- ComputeBudget, decided at 2a.3 ----------------
test("F12 two SetComputeUnitPrice instructions are instruction-denied", async () => {
  denied(await decide(c, legacy(cb.price(1n), cb.price(1n), sys.transfer(c.A, c.B, 1n))), "instruction-denied");
});

test("F13 the deprecated RequestUnits (0) is instruction-denied", async () => {
  denied(await decide(c, legacy(cb.requestUnits(200_000, 0), sys.transfer(c.A, c.B, 1n))), "instruction-denied");
});

test("F14 SetComputeUnitLimit with data one byte short (u32 cut to 3 bytes) is instruction-denied", async () => {
  denied(await decide(c, legacy(cb.raw(Uint8Array.of(2, 0x10, 0x27, 0x00)), sys.transfer(c.A, c.B, 1n))), "instruction-denied");
});

test("F15 SetComputeUnitPrice with one trailing byte is instruction-denied", async () => {
  denied(await decide(c, legacy(cb.raw(cat(u8(3), u64(1n), u8(0))), sys.transfer(c.A, c.B, 1n))), "instruction-denied");
});

// ---------------- the intent key, decided at 2a.3 ----------------
test("F16 the intent key leaves out blockhash, version, fees, tips, ComputeBudget and Memo; the amount is in it", () => {
  const plain = compile({ payer: c.A, ixs: [sys.transfer(c.A, c.B, 1000n)], blockhash: randomHash() });
  const dressed = compile({ payer: c.A, version: 0, blockhash: randomHash(),
    ixs: [cb.price(5n), cb.limit(10_000), memo("retry"), sys.transfer(c.A, c.B, 1000n), sys.transfer(c.A, c.T, 777n)] });
  const other = compile({ payer: c.A, ixs: [sys.transfer(c.A, c.B, 1001n)], blockhash: randomHash() });
  assert.equal(effects(c, dressed).intentKey, effects(c, plain).intentKey);
  assert.notEqual(effects(c, other).intentKey, effects(c, plain).intentKey);
});

test("F17 two calls to the same opaque program share an intent key whatever their data", () => {
  const a = legacy({ program: c.OP, accounts: [W(c.A)], data: Uint8Array.of(1) });
  const b = legacy({ program: c.OP, accounts: [W(c.A)], data: Uint8Array.of(9, 9, 9, 9) });
  assert.equal(effects(c, a).intentKey, effects(c, b).intentKey);
});
