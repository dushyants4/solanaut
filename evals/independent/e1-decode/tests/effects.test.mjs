// §3 EffectsV1 field by field, via effectsOf; plus remaining §4 rows and §5 rule 1 field types.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuard } from "@solanaut/sdk";
import {
  P, cast, compile, sys, tok, cb, memo, acct, decide, effects, rawV1, u8, u32, u64, cat, addrBytes, newKey, randomHash,
  basePolicy, neutralSensor,
} from "./lib.mjs";
import { denied, allowed } from "./assert-helpers.mjs";

const c = await cast();
const { S, W, R, SR } = acct;
const legacy = (...ixs) => compile({ payer: c.A, ixs });
const show = (d) => (d.allow ? "allow" : `deny ${d.rule}: ${d.reason}`);

test("X01 §3 programs are listed in order of first call; signers in message order", () => {
  const m = legacy(
    memo("a"),
    sys.transfer(c.A, c.B, 1n),
    cb.price(1n),
    { program: P.memo, accounts: [SR(c.K2)], data: Uint8Array.of(0x62) },
    tok.transferChecked(P.token, c.ataA_M, c.M, c.ataB_M, c.A, 1n),
  );
  const e = effects(c, m);
  assert.deepEqual(e.programs, [P.memo, P.system, P.cb, P.token]);
  assert.deepEqual(e.signers, [c.A, c.K2]);
  assert.equal(e.feePayer, c.A);
  assert.deepEqual(e.otherSigners, []);
});

test("X02 §3 denied entries name the instruction and index: Token.Approve at 1, System.unknown(14) at 2", () => {
  const e = effects(c, legacy(
    sys.transfer(c.A, c.B, 1n),
    tok.approve(P.token, c.ataA_M, c.C, c.A, 1n),
    { program: P.system, accounts: [S(c.A)], data: u32(14) },
  ));
  const named = e.denied.map((x) => [x.index, x.instruction, x.rule]);
  assert.deepEqual(named, [[1, "Token.Approve", "instruction-denied"], [2, "System.unknown(14)", "instruction-denied"]]);
});

test("X03 §3 nonce is true when the first instruction advances a durable nonce, and the denial is durable-nonce-denied", () => {
  const e = effects(c, legacy(sys.advanceNonce(newKey(), c.A), sys.transfer(c.A, c.B, 1n)));
  assert.equal(e.nonce, true);
  assert.equal(e.denied[0]?.rule, "durable-nonce-denied");
});

test("X04 §3 tokens: TransferChecked carries mint, decimals and the allowed owner; plain Transfer infers the mint, decimals null", () => {
  const e = effects(c, legacy(
    tok.transferChecked(P.token, c.ataA_M, c.M, c.ataB_M, c.A, 11n, 6),
    tok.transfer(P.token, c.ataA_M, c.ataB_M, c.A, 22n),
  ));
  assert.deepEqual(e.tokens, [
    { program: "token", mint: c.M, fromAccount: c.ataA_M, authority: c.A, toAccount: c.ataB_M, toOwner: c.B, amount: 11n, decimals: 6 },
    { program: "token", mint: c.M, fromAccount: c.ataA_M, authority: c.A, toAccount: c.ataB_M, toOwner: c.B, amount: 22n, decimals: null },
  ]);
});

test("X05 §3 opaque lists called programs that are not decoded", () => {
  const e = effects(c, legacy({ program: c.OP, accounts: [W(c.A)], data: Uint8Array.of(1) }, sys.transfer(c.A, c.B, 1n)));
  assert.deepEqual(e.opaque, [c.OP]);
});

test("X06 §4 AuthorizeNonceAccount (7), not first, is durable-nonce-denied", async () => {
  const ix = { program: P.system, accounts: [W(newKey()), SR(c.A)], data: cat(u32(7), addrBytes(c.C)) };
  denied(await decide(c, legacy(sys.transfer(c.A, c.B, 1n), ix)), "durable-nonce-denied");
});

test("X07 §4 Token InitializeAccount3 is benign and admitted", async () => {
  const ix = tok.raw(P.token, [W(newKey()), R(c.M)], cat(u8(18), addrBytes(c.A)));
  allowed(await decide(c, legacy(ix)));
});

test("X08 §4 Token-2022 Revoke (benign row) is admitted", async () => {
  allowed(await decide(c, legacy(tok.revoke(P.token2022, c.ataA_M22, c.A))));
});

test("X09 §4 Token-2022 Approve (the SPL Token list) is instruction-denied", async () => {
  denied(await decide(c, legacy(tok.approve(P.token2022, c.ataA_M22, c.C, c.A, 1n))), "instruction-denied");
});

// Changed after the first run: this asserted destination-not-allowed, reading "the mint's token program" (§4) as
// the program the policy lists. The text also admits the instruction's program. Now unclear: denial asserted, rule recorded.
test("X10 (unclear) a classic-Token TransferChecked of a mint listed as token-2022, into the owner's classic-derived ATA", async (t) => {
  const d = await decide(c, legacy(tok.transferChecked(P.token, c.ataA_M22, c.M22, c.ataB_M22_classic, c.A, 10n)));
  t.diagnostic(`observed: ${show(d)}`);
  assert.equal(d.allow, false);
});

test("X11 §4 intent key leaves out the version: the same transfer as legacy and as v1 shares a key", () => {
  const l = legacy(sys.transfer(c.A, c.B, 1000n));
  const v1 = rawV1({ header: [1, 0, 1], keys: [c.A, c.B, P.system], blockhash: randomHash(), config: { cuLimit: 450, priorityFee: 99n },
    ixs: [{ p: 2, a: [0, 1], d: cat(u32(2), u64(1000n)) }] });
  assert.equal(effects(c, v1).intentKey, effects(c, l).intentKey);
});

// ---------------- rule 1, field values the spec does not settle ----------------
test("U06 a proposal with at = NaN", async (t) => {
  const guard = await createGuard({ policy: basePolicy(c), sensor: neutralSensor });
  const d = guard.check({ message: legacy(sys.transfer(c.A, c.B, 1n)), at: NaN });
  guard.close();
  t.diagnostic(`observed: ${show(d)}`);
});

test("U07 a proposal whose intent is a number, not a string", async (t) => {
  const guard = await createGuard({ policy: basePolicy(c), sensor: neutralSensor });
  const d = guard.check({ message: legacy(sys.transfer(c.A, c.B, 1n)), at: 1_700_000_000_000, intent: 42 });
  guard.close();
  t.diagnostic(`observed: ${show(d)}`);
});
