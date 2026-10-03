// §4's per-instruction table, every named instruction: its class through classifyInstruction (InstructionClass:
// "value-moving" | "benign" | "denied" | "opaque"), then the names not yet sent through a decision.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyInstruction } from "@solanaut/sdk";
import { P, cast, compile, sys, tok, acct, decide, u8, u32, u64, cat, addrBytes, newKey, seedBytes, withSeed } from "./lib.mjs";
import { denied, allowed } from "./assert-helpers.mjs";

const c = await cast();
const { S, W, R, SR } = acct;
const legacy = (...ixs) => compile({ payer: c.A, ixs });
const key = addrBytes(newKey());
const rent = "SysvarRent111111111111111111111111111111111";

function classes(program, rows) {
  const wrong = [];
  for (const [label, data, want] of rows) {
    const got = classifyInstruction(program, data);
    if (got.class !== want) wrong.push(`${label}: want ${want}, got ${got.class} (${got.name})`);
  }
  assert.deepEqual(wrong, []);
}

test("R01 System row: Transfer, TransferWithSeed and the CreateAccount family value-moving; Assign/Allocate families and every nonce instruction denied", () => {
  classes(P.system, [
    ["CreateAccount", cat(u32(0), u64(1n), u64(0n), key), "value-moving"],
    ["Assign", cat(u32(1), key), "denied"],
    ["Transfer", cat(u32(2), u64(1n)), "value-moving"],
    ["CreateAccountWithSeed", cat(u32(3), key, seedBytes("s"), u64(1n), u64(0n), key), "value-moving"],
    ["AdvanceNonceAccount", u32(4), "denied"],
    ["WithdrawNonceAccount", cat(u32(5), u64(1n)), "denied"],
    ["InitializeNonceAccount", cat(u32(6), key), "denied"],
    ["AuthorizeNonceAccount", cat(u32(7), key), "denied"],
    ["Allocate", cat(u32(8), u64(0n)), "denied"],
    ["AllocateWithSeed", cat(u32(9), key, seedBytes("s"), u64(0n), key), "denied"],
    ["AssignWithSeed", cat(u32(10), key, seedBytes("s"), key), "denied"],
    ["TransferWithSeed", cat(u32(11), u64(1n), seedBytes("s"), key), "value-moving"],
    ["UpgradeNonceAccount", u32(12), "denied"],
    ["CreateAccountAllowPrefund", cat(u32(13), u64(1n), u64(0n), key), "value-moving"],
    ["unknown(14)", u32(14), "denied"],
  ]);
});

test("R02 SPL Token row: Transfer/TransferChecked value-moving; the denied list; Revoke, SyncNative and InitializeAccount 1/2/3 benign; unlisted and p-token additions denied", () => {
  classes(P.token, [
    ["InitializeMint (unlisted)", cat(u8(0), u8(6), key, u8(0)), "denied"],
    ["InitializeAccount", u8(1), "benign"],
    ["InitializeMultisig (unlisted)", cat(u8(2), u8(1)), "denied"],
    ["Transfer", cat(u8(3), u64(1n)), "value-moving"],
    ["Approve", cat(u8(4), u64(1n)), "denied"],
    ["Revoke", u8(5), "benign"],
    ["SetAuthority", cat(u8(6), u8(2), u8(1), key), "denied"],
    ["MintTo", cat(u8(7), u64(1n)), "denied"],
    ["Burn", cat(u8(8), u64(1n)), "denied"],
    ["CloseAccount", u8(9), "denied"],
    ["FreezeAccount", u8(10), "denied"],
    ["ThawAccount", u8(11), "denied"],
    ["TransferChecked", cat(u8(12), u64(1n), u8(6)), "value-moving"],
    ["ApproveChecked", cat(u8(13), u64(1n), u8(6)), "denied"],
    ["MintToChecked", cat(u8(14), u64(1n), u8(6)), "denied"],
    ["BurnChecked", cat(u8(15), u64(1n), u8(6)), "denied"],
    ["InitializeAccount2", cat(u8(16), key), "benign"],
    ["SyncNative", u8(17), "benign"],
    ["InitializeAccount3", cat(u8(18), key), "benign"],
    ["WithdrawExcessLamports (38)", u8(38), "denied"],
    ["UnwrapLamports (45)", u8(45), "denied"],
    ["Batch (255)", cat(u8(255), u8(0), u8(0)), "denied"],
  ]);
});

test("R03 Token-2022 row: Transfer/TransferChecked value-moving; the SPL Token denied list plus every extension instruction denied; Revoke, SyncNative, InitializeAccount family benign", () => {
  classes(P.token2022, [
    ["InitializeAccount", u8(1), "benign"],
    ["Transfer", cat(u8(3), u64(1n)), "value-moving"],
    ["Approve", cat(u8(4), u64(1n)), "denied"],
    ["Revoke", u8(5), "benign"],
    ["SetAuthority", cat(u8(6), u8(2), u8(1), key), "denied"],
    ["MintTo", cat(u8(7), u64(1n)), "denied"],
    ["Burn", cat(u8(8), u64(1n)), "denied"],
    ["CloseAccount", u8(9), "denied"],
    ["FreezeAccount", u8(10), "denied"],
    ["ThawAccount", u8(11), "denied"],
    ["TransferChecked", cat(u8(12), u64(1n), u8(6)), "value-moving"],
    ["ApproveChecked", cat(u8(13), u64(1n), u8(6)), "denied"],
    ["MintToChecked", cat(u8(14), u64(1n), u8(6)), "denied"],
    ["BurnChecked", cat(u8(15), u64(1n), u8(6)), "denied"],
    ["InitializeAccount2", cat(u8(16), key), "benign"],
    ["SyncNative", u8(17), "benign"],
    ["InitializeAccount3", cat(u8(18), key), "benign"],
    ["TransferFeeExtension (26) incl. TransferCheckedWithFee", cat(u8(26), u8(1), u64(1n), u8(6), u64(0n)), "denied"],
    ["ConfidentialTransferExtension (27)", cat(u8(27), u8(0)), "denied"],
    ["DefaultAccountStateExtension (28)", cat(u8(28), u8(1), u8(1)), "denied"],
    ["Reallocate (29)", u8(29), "denied"],
    ["MemoTransferExtension (30)", cat(u8(30), u8(0)), "denied"],
    ["InterestBearingMintExtension (33)", cat(u8(33), u8(1), u16le(5)), "denied"],
    ["CpiGuardExtension (34)", cat(u8(34), u8(1)), "denied"],
    ["InitializePermanentDelegate (35)", cat(u8(35), key), "denied"],
    ["TransferHookExtension (36)", cat(u8(36), u8(1), key), "denied"],
  ]);
});
function u16le(n) { return Uint8Array.of(n & 0xff, n >> 8); }

test("R04 ComputeBudget row (legacy and v0): RequestHeapFrame, SetComputeUnitLimit, SetComputeUnitPrice, SetLoadedAccountsDataSizeLimit benign; RequestUnits denied", () => {
  classes(P.cb, [
    ["RequestUnits (0)", cat(u8(0), u32(1), u32(0)), "denied"],
    ["RequestHeapFrame", cat(u8(1), u32(32 * 1024)), "benign"],
    ["SetComputeUnitLimit", cat(u8(2), u32(1)), "benign"],
    ["SetComputeUnitPrice", cat(u8(3), u64(1n)), "benign"],
    ["SetLoadedAccountsDataSizeLimit", cat(u8(4), u32(1)), "benign"],
  ]);
});

test("R05 Memo row, v1 and v2: any instruction is benign, empty or non-UTF-8 data included", () => {
  for (const program of [P.memo, P.memoV1]) {
    classes(program, [["text", new TextEncoder().encode("hello"), "benign"], ["empty", new Uint8Array(0), "benign"], ["0xff 0xfe", Uint8Array.of(0xff, 0xfe), "benign"]]);
  }
});

test("R06 any other program is opaque, whatever its data", () => {
  classes(newKey(), [["data 01", Uint8Array.of(1), "opaque"], ["empty", new Uint8Array(0), "opaque"]]);
});

test("R07 the Associated Token Account program is not decoded in the Beta (§1: ATA decoding is Alpha): opaque", () => {
  classes(P.ata, [["Create", new Uint8Array(0), "opaque"], ["CreateIdempotent", u8(1), "opaque"], ["RecoverNested", u8(2), "opaque"]]);
});

test("R08 SPL Token denied column through a decision: ApproveChecked, MintTo, MintToChecked, Burn, BurnChecked, FreezeAccount, ThawAccount each instruction-denied", async () => {
  const ixs = {
    ApproveChecked: tok.raw(P.token, [W(c.ataA_M), R(c.M), R(c.C), SR(c.A)], cat(u8(13), u64(1n), u8(6))),
    MintTo: tok.raw(P.token, [W(c.M), W(c.ataA_M), SR(c.A)], cat(u8(7), u64(1n))),
    MintToChecked: tok.raw(P.token, [W(c.M), W(c.ataA_M), SR(c.A)], cat(u8(14), u64(1n), u8(6))),
    Burn: tok.raw(P.token, [W(c.ataA_M), W(c.M), SR(c.A)], cat(u8(8), u64(1n))),
    BurnChecked: tok.raw(P.token, [W(c.ataA_M), W(c.M), SR(c.A)], cat(u8(15), u64(1n), u8(6))),
    FreezeAccount: tok.raw(P.token, [W(c.ataA_M), R(c.M), SR(c.A)], u8(10)),
    ThawAccount: tok.raw(P.token, [W(c.ataA_M), R(c.M), SR(c.A)], u8(11)),
  };
  const wrong = [];
  for (const [n, ix] of Object.entries(ixs)) {
    const d = await decide(c, legacy(ix));
    if (d.allow || d.rule !== "instruction-denied") wrong.push(`${n}: ${d.allow ? "allow" : d.rule}`);
  }
  assert.deepEqual(wrong, []);
});

test("R09 System denied column through a decision: AssignWithSeed, Allocate, AllocateWithSeed each instruction-denied", async () => {
  const derived = await withSeed(c.A, "s", P.system);
  const ixs = {
    AssignWithSeed: { program: P.system, accounts: [W(derived), SR(c.A)], data: cat(u32(10), addrBytes(c.A), seedBytes("s"), addrBytes(c.OP)) },
    Allocate: sys.allocate(c.A, 1024n),
    AllocateWithSeed: { program: P.system, accounts: [W(derived), SR(c.A)], data: cat(u32(9), addrBytes(c.A), seedBytes("s"), u64(1024n), addrBytes(c.OP)) },
  };
  const wrong = [];
  for (const [n, ix] of Object.entries(ixs)) {
    const d = await decide(c, legacy(ix));
    if (d.allow || d.rule !== "instruction-denied") wrong.push(`${n}: ${d.allow ? "allow" : d.rule}`);
  }
  assert.deepEqual(wrong, []);
});

test("R10 InitializeNonceAccount and UpgradeNonceAccount, not first, are each durable-nonce-denied", async () => {
  const nonce = newKey();
  const ixs = {
    InitializeNonceAccount: { program: P.system, accounts: [W(nonce), R(P.sysvarRecentBlockhashes), R(rent)], data: cat(u32(6), addrBytes(c.A)) },
    UpgradeNonceAccount: { program: P.system, accounts: [W(nonce)], data: u32(12) },
  };
  const wrong = [];
  for (const [n, ix] of Object.entries(ixs)) {
    const d = await decide(c, legacy(sys.transfer(c.A, c.B, 1n), ix));
    if (d.allow || d.rule !== "durable-nonce-denied") wrong.push(`${n}: ${d.allow ? "allow" : d.rule}`);
  }
  assert.deepEqual(wrong, []);
});

test("R11 benign column through a decision: Token SyncNative, InitializeAccount, InitializeAccount2 and Token-2022 SyncNative, InitializeAccount3 each admitted", async () => {
  const fresh = newKey();
  const ixs = {
    "Token SyncNative": tok.syncNative(P.token, c.ataA_M),
    "Token InitializeAccount": tok.raw(P.token, [W(fresh), R(c.M), R(c.A), R(rent)], u8(1)),
    "Token InitializeAccount2": tok.raw(P.token, [W(fresh), R(c.M), R(rent)], cat(u8(16), addrBytes(c.A))),
    "Token-2022 SyncNative": tok.syncNative(P.token2022, c.ataA_M22),
    "Token-2022 InitializeAccount3": tok.raw(P.token2022, [W(fresh), R(c.M22)], cat(u8(18), addrBytes(c.A))),
  };
  const wrong = [];
  for (const [n, ix] of Object.entries(ixs)) {
    const d = await decide(c, legacy(ix));
    if (!d.allow) wrong.push(`${n}: ${d.rule}: ${d.reason}`);
  }
  assert.deepEqual(wrong, []);
});

test("R12 p-token UnwrapLamports (45) through a decision is instruction-denied", async () => {
  denied(await decide(c, legacy(tok.raw(P.token, [W(c.ataA_M), W(c.C), SR(c.A)], cat(u8(45), u8(0))))), "instruction-denied");
});
