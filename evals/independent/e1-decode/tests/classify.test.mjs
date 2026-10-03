// §4's per-instruction table, row by row, and its "Decided while building the classifier" items.
// §11's drain battery cases are marked [drain].
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  P, cast, compile, sys, tok, cb, memo, acct, decide, effects, u8, u32, u64, cat, addrBytes, newKey, seedBytes, withSeed, ata,
} from "./lib.mjs";
import { denied, allowed } from "./assert-helpers.mjs";

const c = await cast();
const { S, W, R, SR } = acct;
const legacy = (...ixs) => compile({ payer: c.A, ixs });

// ---------------- System ----------------
test("C01 [drain] System Transfer to a new recipient is destination-not-allowed", async () => {
  denied(await decide(c, legacy(sys.transfer(c.A, c.C, 1000n))), "destination-not-allowed");
});

test("C02 System Transfer to an allowed owner is admitted and counted as SOL", async () => {
  const d = await decide(c, legacy(sys.transfer(c.A, c.B, 123_456n)));
  allowed(d);
  assert.equal(d.amounts.sol, "123456");
});

test("C03 System TransferWithSeed (base is the principal) to the attacker is destination-not-allowed", async () => {
  const from = await withSeed(c.A, "vault", P.system);
  const ix = { program: P.system, accounts: [W(from), SR(c.A), W(c.C)],
    data: cat(u32(11), u64(5000n), seedBytes("vault"), addrBytes(P.system)) };
  denied(await decide(c, legacy(ix)), "destination-not-allowed");
});

test("C04 System CreateAccountWithSeed funding an address that is not an allowed destination is destination-not-allowed", async () => {
  const created = await withSeed(c.A, "s", P.system);
  const ix = { program: P.system, accounts: [S(c.A), W(created), SR(c.A)],
    data: cat(u32(3), addrBytes(c.A), seedBytes("s"), u64(2_000_000n), u64(0n), addrBytes(P.system)) };
  denied(await decide(c, legacy(ix)), "destination-not-allowed");
});

test("C05 System CreateAccount funding an allowed destination (a principal key that signs) is admitted as new-account", async () => {
  const m = legacy(sys.createAccount(c.A, c.K2, 2_000_000n));
  const e = effects(c, m);
  assert.deepEqual(e.sol, [{ from: c.A, to: c.K2, lamports: 2_000_000n, kind: "new-account" }]);
  allowed(await decide(c, m));
});

test("C06 [drain] System CreateAccount funding a counterparty's key (which must sign) is other-signer", async () => {
  denied(await decide(c, legacy(sys.createAccount(c.A, c.C, 2_000_000n))), "other-signer");
});

test("C07 CreateAccountAllowPrefund (SIMD-0312 layout) whose new account is a principal key is instruction-denied", async () => {
  const ix = { program: P.system, accounts: [S(c.K2), S(c.A)],
    data: cat(u32(13), u64(1_000_000n), u64(0n), addrBytes(P.system)) };
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("C08 System Assign (grants authority) is instruction-denied", async () => {
  denied(await decide(c, legacy(sys.assign(c.A, newKey()))), "instruction-denied");
});

test("C09 System instruction with an unknown discriminator (99) is instruction-denied", async () => {
  const ix = { program: P.system, accounts: [S(c.A), W(c.B)], data: cat(u32(99), u64(1n)) };
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("C10 [drain] a durable-nonce transfer (AdvanceNonceAccount first) is durable-nonce-denied", async () => {
  const nonce = newKey();
  denied(await decide(c, legacy(sys.advanceNonce(nonce, c.A), sys.transfer(c.A, c.B, 1000n))), "durable-nonce-denied");
});

test("C11 WithdrawNonceAccount as the second instruction is durable-nonce-denied", async () => {
  const nonce = newKey();
  denied(await decide(c, legacy(sys.transfer(c.A, c.B, 1n), sys.withdrawNonce(nonce, c.A, c.A, 1_000_000n))), "durable-nonce-denied");
});

test("C12 System Transfer with short data (u64 cut to 7 bytes) is instruction-denied", async () => {
  const ix = { program: P.system, accounts: [S(c.A), W(c.B)], data: cat(u32(2), new Uint8Array(7)) };
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("C13 System Transfer with too few accounts (no destination) is instruction-denied", async () => {
  const ix = { program: P.system, accounts: [S(c.A)], data: cat(u32(2), u64(1000n)) };
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

// ---------------- SPL Token ----------------
test("C14 Token TransferChecked of a listed mint to an allowed owner's ATA is admitted; amounts name the mint", async () => {
  const d = await decide(c, legacy(tok.transferChecked(P.token, c.ataA_M, c.M, c.ataB_M, c.A, 500_000n)));
  allowed(d);
  assert.deepEqual(d.amounts.tokens, [{ mint: c.M, amount: "500000" }]);
});

test("C15 [drain] Token TransferChecked to a non-associated account is destination-not-allowed", async () => {
  denied(await decide(c, legacy(tok.transferChecked(P.token, c.ataA_M, c.M, newKey(), c.A, 10n))), "destination-not-allowed");
});

test("C16 [drain] Token Approve to an attacker is instruction-denied", async () => {
  denied(await decide(c, legacy(tok.approve(P.token, c.ataA_M, c.C, c.A, 1_000_000n))), "instruction-denied");
});

test("C17 [drain] Token SetAuthority is instruction-denied", async () => {
  denied(await decide(c, legacy(tok.setAuthority(P.token, c.ataA_M, c.A, c.C))), "instruction-denied");
});

test("C18 Token CloseAccount (rent to the attacker) is instruction-denied", async () => {
  denied(await decide(c, legacy(tok.closeAccount(P.token, c.ataA_M, c.C, c.A))), "instruction-denied");
});

test("C19 Token Revoke is benign and admitted", async () => {
  allowed(await decide(c, legacy(tok.revoke(P.token, c.ataA_M, c.A))));
});

test("C20 p-token Batch (255) carrying a transfer to the attacker is instruction-denied", async () => {
  const inner = cat(u8(3), u64(1_000n)); // Transfer
  const ix = tok.raw(P.token, [W(c.ataA_M), W(c.ataC_M), SR(c.A)], cat(u8(255), u8(3), u8(inner.length), inner));
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("C21 p-token WithdrawExcessLamports (38) is instruction-denied", async () => {
  const ix = tok.raw(P.token, [W(c.ataA_M), W(c.C), SR(c.A)], u8(38));
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("C22 [drain] plain Transfer from the principal's ATA: mint inferred; at the cap admitted, one over is over-per-tx-cap", async () => {
  const atCap = await decide(c, legacy(tok.transfer(P.token, c.ataA_M, c.ataB_M, c.A, 1_000_000n)));
  allowed(atCap);
  assert.deepEqual(atCap.amounts.tokens, [{ mint: c.M, amount: "1000000" }]);
  denied(await decide(c, legacy(tok.transfer(P.token, c.ataA_M, c.ataB_M, c.A, 1_000_001n))), "over-per-tx-cap");
});

test("C23 plain Transfer from an account that is not the principal's ATA of a listed mint is token-mint-unknown", async () => {
  // Destination is an address the policy names directly, so rule 10 passes and rule 11 decides.
  denied(await decide(c, legacy(tok.transfer(P.token, newKey(), c.DIRECT, c.A, 10n))), "token-mint-unknown");
});

test("C24 Token TransferChecked of an unlisted mint to an allowed owner's ATA for it is mint-not-allowed", async () => {
  denied(await decide(c, legacy(tok.transferChecked(P.token, c.ataA_X, c.X, c.ataB_X, c.A, 10n))), "mint-not-allowed");
});

test("C25 Token transfer whose authority is a multisig (does not sign) is instruction-denied", async () => {
  const ms = newKey();
  const ix = tok.raw(P.token, [W(c.ataA_M), R(c.M), W(c.ataB_M), R(ms), SR(c.A)], cat(u8(12), u64(10n), u8(6)));
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("C26 Token TransferChecked with one trailing data byte is instruction-denied", async () => {
  const ix = tok.raw(P.token, [W(c.ataA_M), R(c.M), W(c.ataB_M), SR(c.A)], cat(u8(12), u64(10n), u8(6), u8(0)));
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

// ---------------- Token-2022 ----------------
test("C27 Token-2022 TransferChecked of a listed 2022 mint to the owner's Token-2022 ATA is admitted", async () => {
  allowed(await decide(c, legacy(tok.transferChecked(P.token2022, c.ataA_M22, c.M22, c.ataB_M22, c.A, 10n))));
});

test("C28 Token-2022 TransferChecked to the owner's ATA derived with the classic Token program is destination-not-allowed", async () => {
  denied(await decide(c, legacy(tok.transferChecked(P.token2022, c.ataA_M22, c.M22, c.ataB_M22_classic, c.A, 10n))), "destination-not-allowed");
});

test("C29 Token-2022 extension instruction (MemoTransfer disable, 30/1) is instruction-denied", async () => {
  const ix = tok.raw(P.token2022, [W(c.ataA_M22), SR(c.A)], cat(u8(30), u8(1)));
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

// ---------------- Memo, opaque, unlisted, other signers ----------------
test("C30 Memo v1 and v2 alongside an allowed transfer are admitted", async () => {
  allowed(await decide(c, legacy(memo("a", P.memo), memo("b", P.memoV1), sys.transfer(c.A, c.B, 1n))));
});

test("C31 an allowlisted program the guard does not decode, with opaque 'deny', is opaque-program; with 'allow', admitted", async () => {
  const m = legacy({ program: c.OP, accounts: [W(c.A)], data: Uint8Array.of(1, 2, 3) });
  denied(await decide(c, m), "opaque-program");
  allowed(await decide(c, m, (p) => { p.programs.opaque = "allow"; }));
});

test("C32 [drain] an unlisted program is program-not-allowed", async () => {
  denied(await decide(c, legacy({ program: c.Q, accounts: [W(c.A)], data: Uint8Array.of(1) })), "program-not-allowed");
});

test("C33 [drain] another signer's instruction (a transfer from a key outside the principal) is other-signer", async () => {
  denied(await decide(c, legacy(sys.transfer(c.C, c.B, 1000n))), "other-signer");
});
