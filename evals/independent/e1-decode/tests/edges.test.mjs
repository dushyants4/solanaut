// Harder encodings and boundaries for §3 EffectsV1, §4 and §5 rules 1, 6, 9, 10, 11, 12.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuard } from "@solanaut/sdk";
import {
  P, cast, compile, sys, tok, cb, acct, decide, effects, rawLegacy, u8, u32, u64, cat, addrBytes, newKey, randomHash,
  seedBytes, withSeed, ata, basePolicy, neutralSensor,
} from "./lib.mjs";
import { denied, allowed } from "./assert-helpers.mjs";

const c = await cast();
const { S, W, R, SR } = acct;
const legacy = (...ixs) => compile({ payer: c.A, ixs });

test("E01 a required signer outside the principal that no instruction uses is still other-signer", async () => {
  // Header says two signers: A and C. Only A appears in an instruction.
  const m = rawLegacy({ header: [2, 1, 1], keys: [c.A, c.C, c.B, P.system], blockhash: randomHash(),
    ixs: [{ p: 3, a: [0, 2], d: cat(u32(2), u64(1000n)) }] });
  const e = effects(c, m);
  assert.deepEqual(e.otherSigners, [c.C]);
  denied(await decide(c, m), "other-signer");
});

test("E02 two SOL transfers of 2^63 each (a u64 sum that wraps to 0) are over-per-tx-cap", async () => {
  const half = 1n << 63n;
  denied(await decide(c, legacy(sys.transfer(c.A, c.B, half), sys.transfer(c.A, c.B, half))), "over-per-tx-cap");
});

test("E03 a SOL cap of 2^53 and a transfer of 2^53+1 (equal as JS numbers) is over-per-tx-cap", async () => {
  const cap = 1n << 53n;
  const edit = (p) => { p.sol.maxPerTx = cap; p.sol.maxPerWindow = 1n << 60n; };
  allowed(await decide(c, legacy(sys.transfer(c.A, c.B, cap)), edit));
  denied(await decide(c, legacy(sys.transfer(c.A, c.B, cap + 1n)), edit), "over-per-tx-cap");
});

test("E04 two TransferChecked of one listed mint, each under its cap, together over it, are over-per-tx-cap", async () => {
  const t = () => tok.transferChecked(P.token, c.ataA_M, c.M, c.ataB_M, c.A, 600_000n);
  denied(await decide(c, legacy(t(), t())), "over-per-tx-cap");
});

test("E05 a SOL Transfer plus CreateAccount funding, each under the cap, together over it, are over-per-tx-cap", async () => {
  denied(await decide(c, legacy(sys.transfer(c.A, c.B, 600_000_000n), sys.createAccount(c.A, c.K2, 600_000_000n))), "over-per-tx-cap");
});

test("E06 TransferWithSeed to an allowed owner counts its lamports: over the SOL cap is over-per-tx-cap", async () => {
  const from = await withSeed(c.A, "vault", P.system);
  const ix = { program: P.system, accounts: [W(from), SR(c.A), W(c.B)],
    data: cat(u32(11), u64(2_000_000_000n), seedBytes("vault"), addrBytes(P.system)) };
  denied(await decide(c, legacy(ix)), "over-per-tx-cap");
});

test("E07 plain Transfer from the second principal key's ATA of a listed mint: mint inferred, admitted", async () => {
  const ataK2 = await ata(c.K2, c.M, "token");
  const d = await decide(c, legacy(tok.transfer(P.token, ataK2, c.ataB_M, c.K2, 5n)));
  allowed(d);
  assert.deepEqual(d.amounts.tokens, [{ mint: c.M, amount: "5" }]);
});

test("E08 plain Token-2022 Transfer from the principal's classic-derived ATA of a 'token' mint cannot infer the mint: token-mint-unknown", async () => {
  denied(await decide(c, legacy(tok.transfer(P.token2022, c.ataA_M, c.DIRECT, c.A, 5n))), "token-mint-unknown");
});

test("E09 a Token instruction with empty data (no discriminator) is instruction-denied", async () => {
  denied(await decide(c, legacy(tok.raw(P.token, [W(c.ataA_M), SR(c.A)], new Uint8Array(0)))), "instruction-denied");
});

test("E10 Token-2022 TransferCheckedWithFee (26/1, Alpha) is denied in the Beta as instruction-denied", async () => {
  const data = cat(u8(26), u8(1), u64(10n), u8(6), u64(0n));
  const ix = tok.raw(P.token2022, [W(c.ataA_M22), R(c.M22), W(c.ataB_M22), SR(c.A)], data);
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("E11 an instruction account index past the account list is malformed-proposal", async () => {
  const m = rawLegacy({ header: [1, 0, 1], keys: [c.A, c.B, P.system], blockhash: randomHash(),
    ixs: [{ p: 2, a: [0, 9], d: cat(u32(2), u64(1000n)) }] });
  denied(await decide(c, m), "malformed-proposal");
});

test("E12 a header with zero required signatures (no fee payer) is malformed-proposal", async () => {
  const m = rawLegacy({ header: [0, 0, 1], keys: [c.A, P.system], blockhash: randomHash(),
    ixs: [{ p: 1, a: [], d: Uint8Array.of(1) }] });
  denied(await decide(c, m), "malformed-proposal");
});

test("E13 a proposal whose blockHeight is a number, not a bigint, is malformed-proposal", async () => {
  const m = legacy(sys.transfer(c.A, c.B, 1000n));
  const guard = await createGuard({ policy: basePolicy(c), sensor: neutralSensor });
  const d = guard.check({ message: m, at: 1_700_000_000_000, blockHeight: 100 });
  guard.close();
  denied(d, "malformed-proposal");
});

test("E14 ComputeBudget RequestHeapFrame and SetLoadedAccountsDataSizeLimit are benign in legacy: admitted", async () => {
  allowed(await decide(c, legacy(cb.heap(64 * 1024), cb.loaded(64 * 1024), sys.transfer(c.A, c.B, 1n))));
});

test("E15 a SOL transfer to an allowed owner's token account (not itself an allowed owner) is destination-not-allowed", async () => {
  denied(await decide(c, legacy(sys.transfer(c.A, c.ataB_M, 1000n))), "destination-not-allowed");
});
