// §5 "The first failing rule is the reason for the decision": messages that break two rules at once.
// The offending instructions are placed so that instruction order would name the later rule first.
import { test } from "node:test";
import {
  P, cast, compile, sys, tok, cb, acct, decide, rawV0, rawLegacy, u32, u64, cat, newKey, randomHash, ata,
} from "./lib.mjs";
import { denied } from "./assert-helpers.mjs";

const c = await cast();
const { W } = acct;
const legacy = (...ixs) => compile({ payer: c.A, ixs });
const transferData = (l) => cat(u32(2), u64(l));

test("O01 rule 3 before rule 5: v0 with an unpinned table and a durable nonce first is lookup-table-unpinned", async () => {
  const nonce = newKey();
  const m = rawV0({ header: [1, 0, 2], keys: [c.A, nonce, P.system, P.sysvarRecentBlockhashes], blockhash: randomHash(),
    ixs: [{ p: 2, a: [1, 3, 0], d: u32(4) }, { p: 2, a: [0, 4], d: transferData(1000n) }],
    lookups: [{ table: c.LT2, w: [0], r: [] }] });
  denied(await decide(c, m), "lookup-table-unpinned");
});

test("O02 rule 5 before rule 6: a durable nonce first and a transfer signed by an outside key is durable-nonce-denied", async () => {
  denied(await decide(c, legacy(sys.advanceNonce(newKey(), c.A), sys.transfer(c.C, c.B, 1000n))), "durable-nonce-denied");
});

test("O03 rule 6 before rule 7: an unlisted program's instruction, then one signed by an outside key, is other-signer", async () => {
  denied(await decide(c, legacy({ program: c.Q, accounts: [W(c.A)], data: Uint8Array.of(1) }, sys.transfer(c.C, c.B, 1n))), "other-signer");
});

test("O04 rule 7 before rule 9: Approve first, then an unlisted program, is program-not-allowed", async () => {
  denied(await decide(c, legacy(tok.approve(P.token, c.ataA_M, c.C, c.A, 1n), { program: c.Q, accounts: [W(c.A)], data: Uint8Array.of(1) })), "program-not-allowed");
});

test("O05 rule 8 before rule 9: Approve first, then an opaque program under 'deny', is opaque-program", async () => {
  denied(await decide(c, legacy(tok.approve(P.token, c.ataA_M, c.C, c.A, 1n), { program: c.OP, accounts: [W(c.A)], data: Uint8Array.of(1) })), "opaque-program");
});

test("O06 rule 9 before rule 10: a transfer to the attacker first, then Approve, is instruction-denied", async () => {
  denied(await decide(c, legacy(sys.transfer(c.A, c.C, 1000n), tok.approve(P.token, c.ataA_M, c.C, c.A, 1n))), "instruction-denied");
});

test("O07 rule 10 before rule 11: an unlisted mint sent to the attacker's ATA is destination-not-allowed", async () => {
  const ataC_X = await ata(c.C, c.X, "token");
  denied(await decide(c, legacy(tok.transferChecked(P.token, c.ataA_X, c.X, ataC_X, c.A, 10n))), "destination-not-allowed");
});

test("O08 rule 11 before rule 12: SOL over its cap first, then an unlisted mint to an allowed owner, is mint-not-allowed", async () => {
  denied(await decide(c, legacy(sys.transfer(c.A, c.B, 2_000_000_000n), tok.transferChecked(P.token, c.ataA_X, c.X, c.ataB_X, c.A, 10n))), "mint-not-allowed");
});

test("O09 rule 12 before rule 13: a priority fee over its cap and SOL over its cap is over-per-tx-cap", async () => {
  denied(await decide(c, legacy(cb.limit(10_000), cb.price(2_000_000n), sys.transfer(c.A, c.B, 2_000_000_000n))), "over-per-tx-cap");
});

test("O10 rule 1 before rule 7: an unlisted program's instruction with an account index past the list is malformed-proposal", async () => {
  // keys: A, Q. The instruction's only account index is 5.
  const m = rawLegacy({ header: [1, 0, 1], keys: [c.A, c.Q], blockhash: randomHash(), ixs: [{ p: 1, a: [5], d: Uint8Array.of(1) }] });
  denied(await decide(c, m), "malformed-proposal");
});
