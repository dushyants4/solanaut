// Sharper probes. G-cases assert what the spec states; U-cases are where the spec is silent or ambiguous:
// they record what the guard did (as a diagnostic) and assert only that it decided.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  P, cast, compile, sys, tok, cb, memo, acct, decide, effects, rawLegacy, rawV0, rawV1, u8, u32, u64, cat, addrBytes,
  newKey, randomHash, seedBytes, withSeed, ata,
} from "./lib.mjs";
import { denied, allowed } from "./assert-helpers.mjs";

const c = await cast();
const { S, W, R, SR } = acct;
const legacy = (...ixs) => compile({ payer: c.A, ixs });
const transferData = (l) => cat(u32(2), u64(l));
const show = (d) => (d.allow ? "allow" : `deny ${d.rule}: ${d.reason}`);

test("G01 a System instruction whose u32 discriminator is 0x01000002 (low byte 2 = Transfer) is unknown: instruction-denied", async () => {
  const ix = { program: P.system, accounts: [S(c.A), W(c.B)], data: cat(Uint8Array.of(2, 0, 0, 1), u64(1000n)) };
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("G02 TransferChecked naming listed mint M2 into an allowed owner's ATA for mint M (not for M2) is destination-not-allowed", async () => {
  const M2 = newKey();
  const ataA_M2 = await ata(c.A, M2, "token");
  const edit = (p) => { p.tokens.push({ mint: M2, program: "token", maxPerTx: 1_000_000n, maxPerWindow: 1_000_000_000n }); };
  denied(await decide(c, legacy(tok.transferChecked(P.token, ataA_M2, M2, c.ataB_M, c.A, 10n)), edit), "destination-not-allowed");
});

test("G03 caps are per asset: SOL at its cap, M at its cap and M22 at its cap in one message are admitted", async () => {
  const d = await decide(c, legacy(
    sys.transfer(c.A, c.B, 1_000_000_000n),
    tok.transferChecked(P.token, c.ataA_M, c.M, c.ataB_M, c.A, 1_000_000n),
    tok.transferChecked(P.token2022, c.ataA_M22, c.M22, c.ataB_M22, c.A, 1_000_000n),
  ));
  allowed(d);
  assert.equal(d.amounts.sol, "1000000000");
});

test("G04 a zero-lamport System Transfer to the attacker is still destination-not-allowed", async () => {
  denied(await decide(c, legacy(sys.transfer(c.A, c.C, 0n))), "destination-not-allowed");
});

test("G05 CreateAccountWithSeed into an address the policy names directly: admitted, lamports read after the variable-length seed", async () => {
  const seed = "a-longer-seed-of-29-bytes-xyz";
  const created = await withSeed(c.A, seed, P.system);
  const ix = { program: P.system, accounts: [S(c.A), W(created), SR(c.A)],
    data: cat(u32(3), addrBytes(c.A), seedBytes(seed), u64(3_000_000n), u64(0n), addrBytes(P.system)) };
  const edit = (p) => { p.destinations.allow.push(created); };
  const m = legacy(ix);
  const e = effects(c, m, edit);
  assert.deepEqual(e.sol, [{ from: c.A, to: created, lamports: 3_000_000n, kind: "new-account" }]);
  allowed(await decide(c, m, edit));
});

test("G06 plain Token-2022 Transfer from the principal's Token-2022 ATA of a listed 2022 mint: mint inferred, admitted", async () => {
  const d = await decide(c, legacy(tok.transfer(P.token2022, c.ataA_M22, c.ataB_M22, c.A, 7n)));
  allowed(d);
  assert.deepEqual(d.amounts.tokens, [{ mint: c.M22, amount: "7" }]);
});

test("G07 v1 whose config mask sets only one of the two priority-fee bits does not parse: malformed-proposal", async () => {
  const m = rawV1({ header: [1, 0, 1], keys: [c.A, c.B, P.system], blockhash: randomHash(),
    config: { cuLimit: 450 }, ixs: [{ p: 2, a: [0, 1], d: transferData(1000n) }] });
  allowed(await decide(c, m)); // precondition: well formed with mask 0b100
  const bad = m.slice();
  bad[4] = 0b101; // mask byte 0: CU limit + only bit 0 of the fee pair
  denied(await decide(c, bad), "malformed-proposal");
});

test("G08 v0 loading a read-only account from an unpinned table that no instruction uses is lookup-table-unpinned", async () => {
  const pin = (p) => { p.lookupTables = [{ address: c.LT, entries: [c.B] }]; };
  const m = rawV0({ header: [1, 0, 1], keys: [c.A, P.system], blockhash: randomHash(),
    ixs: [{ p: 1, a: [0, 2], d: transferData(1000n) }],
    lookups: [{ table: c.LT, w: [0], r: [] }, { table: c.LT2, w: [], r: [0] }] });
  denied(await decide(c, m, pin), "lookup-table-unpinned");
});

test("G09 a fee payer outside the principal is other-signer", async () => {
  const m = compile({ payer: c.C, ixs: [sys.transfer(c.A, c.B, 1000n)] });
  denied(await decide(c, m), "other-signer");
});

test("G10 v0 durable nonce (AdvanceNonceAccount first, no tables) is durable-nonce-denied", async () => {
  const m = compile({ payer: c.A, version: 0, ixs: [sys.advanceNonce(newKey(), c.A), sys.transfer(c.A, c.B, 1000n)] });
  denied(await decide(c, m), "durable-nonce-denied");
});

// ---------------- unclear: recorded, not judged ----------------
test("U01 plain Transfer from a non-ATA source into an allowed owner's ATA for a listed mint: rule 10 or rule 11?", async (t) => {
  const d = await decide(c, legacy(tok.transfer(P.token, newKey(), c.ataB_M, c.A, 10n)));
  t.diagnostic(`observed: ${show(d)}`);
  assert.equal(d.allow, false);
});

test("U02 SetComputeUnitLimit above 1,400,000 with a price: is the fee's limit capped?", async (t) => {
  const e = effects(c, legacy(cb.limit(2_000_000), cb.price(1_000_000n), sys.transfer(c.A, c.B, 1n)));
  t.diagnostic(`observed: computeUnitLimit ${e.computeUnitLimit}, priorityFee ${e.priorityFee}`);
  const d = await decide(c, legacy(cb.limit(2_000_000), cb.price(1_000_000n), sys.transfer(c.A, c.B, 1n)));
  t.diagnostic(`decision: ${show(d)}`);
});

test("U03 Memo (a decoded program) absent from programs.allow: must decoded programs be allowlisted?", async (t) => {
  const d = await decide(c, legacy(memo("x"), sys.transfer(c.A, c.B, 1n)), (p) => { p.programs.allow = p.programs.allow.filter((x) => x !== P.memo); });
  t.diagnostic(`observed: ${show(d)}`);
  const d2 = await decide(c, legacy(cb.price(1n), sys.transfer(c.A, c.B, 1n)), (p) => { p.programs.allow = p.programs.allow.filter((x) => x !== P.cb); });
  t.diagnostic(`ComputeBudget absent: ${show(d2)}`);
});

test("U04 a legacy message listing the same static key twice", async (t) => {
  const m = rawLegacy({ header: [1, 0, 1], keys: [c.A, c.B, c.B, P.system], blockhash: randomHash(),
    ixs: [{ p: 3, a: [0, 2], d: transferData(1000n) }] });
  const d = await decide(c, m);
  t.diagnostic(`observed: ${show(d)}`);
});

test("U05 a self-transfer from the principal fee payer to itself (A is not in destinations.allow)", async (t) => {
  const d = await decide(c, legacy(sys.transfer(c.A, c.A, 1000n)));
  t.diagnostic(`observed: ${show(d)}`);
});

// ---------------- added last: layouts with variable or missing parts, and trailing bytes per version ----------------
test("G11 CreateAccount whose data stops before the owner (20 of 52 bytes) is instruction-denied", async () => {
  const ix = { program: P.system, accounts: [S(c.A), S(c.K2)], data: cat(u32(0), u64(2_000_000n), u64(0n)) };
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("G12 TransferWithSeed whose seed length claims 2^40 bytes (data far shorter) is instruction-denied", async () => {
  const from = await withSeed(c.A, "vault", P.system);
  const ix = { program: P.system, accounts: [W(from), SR(c.A), W(c.B)],
    data: cat(u32(11), u64(5000n), u64(1n << 40n), new TextEncoder().encode("vault"), addrBytes(P.system)) };
  denied(await decide(c, legacy(ix)), "instruction-denied");
});

test("G13 one trailing byte after a complete v1 message is malformed-proposal", async () => {
  const m = rawV1({ header: [1, 0, 1], keys: [c.A, c.B, P.system], blockhash: randomHash(), config: { cuLimit: 450 },
    ixs: [{ p: 2, a: [0, 1], d: transferData(1000n) }] });
  allowed(await decide(c, m));
  denied(await decide(c, cat(m, Uint8Array.of(0))), "malformed-proposal");
});

test("G14 one trailing byte after a complete v0 message is malformed-proposal", async () => {
  const m = compile({ payer: c.A, version: 0, ixs: [sys.transfer(c.A, c.B, 1000n)] });
  allowed(await decide(c, m));
  denied(await decide(c, cat(m, Uint8Array.of(0))), "malformed-proposal");
});

test("U08 a legacy header claiming more read-only unsigned accounts than there are unsigned keys", async (t) => {
  const m = rawLegacy({ header: [1, 0, 5], keys: [c.A, c.B, P.system], blockhash: randomHash(),
    ixs: [{ p: 2, a: [0, 1], d: transferData(1000n) }] });
  const d = await decide(c, m);
  t.diagnostic(`observed: ${show(d)}`);
});
