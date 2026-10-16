// Milestone 2a.3, instructions classified (docs/SPEC.md §4, ADR-009). Every instruction of a
// decoded program is in exactly one class: value-moving, denied, or benign; anything unlisted is
// denied. Instructions here are built by the Solana program clients (@solana-program/system,
// token and compute-budget), never by Solanaut, and compiled by @solana/kit into each version.

import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  createNoopSigner,
  createTransactionMessage,
  getCompiledTransactionMessageEncoder,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessagePriorityFeeLamports,
  setTransactionMessageComputeUnitLimit,
  type Address,
  type Blockhash,
  type Instruction,
} from "@solana/kit";
import {
  getAdvanceNonceAccountInstruction,
  getAllocateInstruction,
  getAssignInstruction,
  getAuthorizeNonceAccountInstruction,
  getCreateAccountAllowPrefundInstruction,
  getCreateAccountInstruction,
  getCreateAccountWithSeedInstruction,
  getInitializeNonceAccountInstruction,
  getTransferSolInstruction,
  getTransferSolWithSeedInstruction,
  getUpgradeNonceAccountInstruction,
  getWithdrawNonceAccountInstruction,
  identifySystemInstruction,
  SystemInstruction,
} from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getApproveInstruction,
  getCloseAccountInstruction,
  getRevokeInstruction,
  getSyncNativeInstruction,
  getTransferCheckedInstruction,
  getTransferInstruction,
  identifyTokenInstruction,
  TokenInstruction,
} from "@solana-program/token";
import {
  getRequestHeapFrameInstruction,
  getRequestUnitsInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getSetLoadedAccountsDataSizeLimitInstruction,
  identifyComputeBudgetInstruction,
  ComputeBudgetInstruction,
} from "@solana-program/compute-budget";
import { PublicKey } from "@solana/web3.js";
import { classifyInstruction, effectsOf, PROGRAMS, type ClassifyContext, type EffectsV1 } from "../src/classify.ts";
import { associatedTokenAddress, findProgramAddress, isOnCurve } from "../src/pda.ts";
import { decodeBase58, encodeBase58 } from "../src/base58.ts";
import { kitAddress, randomAddress, rng, type Version } from "./support/kit.ts";

const r = rng(2203);
const AGENT = randomAddress(r);
const SECOND = randomAddress(r);
const TREASURY = randomAddress(r);
const ATTACKER = randomAddress(r);
const TIP = randomAddress(r);
const USDC = randomAddress(r);
const PYUSD = randomAddress(r);
const NONCE = randomAddress(r);
const NEW = randomAddress(r);
const OPAQUE = randomAddress(r);
const TOKEN = PROGRAMS.token as Address;
const TOKEN_2022 = PROGRAMS.token2022 as Address;

const ctx: ClassifyContext = {
  principal: [AGENT, SECOND],
  destinations: [TREASURY],
  tokens: [{ mint: USDC, program: "token" }, { mint: PYUSD, program: "token-2022" }],
  tipAccounts: [TIP],
  lookupTables: [],
};

const signer = (a: Address) => createNoopSigner(a);
const ata = async (owner: Address, mint: Address, tokenProgram = TOKEN) => (await findAssociatedTokenPda({ owner, mint, tokenProgram }))[0];

function build(instructions: Instruction[], o: { version?: Version; blockhashSeed?: number; priorityFee?: bigint; cuLimit?: number } = {}): Uint8Array {
  const version = o.version ?? "legacy";
  let m: any = createTransactionMessage({ version });
  m = setTransactionMessageFeePayerSigner(signer(AGENT), m);
  m = setTransactionMessageLifetimeUsingBlockhash({ blockhash: kitAddress(rng(o.blockhashSeed ?? 1).bytes(32)) as unknown as Blockhash, lastValidBlockHeight: 100n }, m);
  m = appendTransactionMessageInstructions(instructions, m);
  if (version === 1 && o.priorityFee !== undefined) m = setTransactionMessagePriorityFeeLamports(o.priorityFee, m);
  if (version === 1 && o.cuLimit !== undefined) m = setTransactionMessageComputeUnitLimit(o.cuLimit, m);
  return new Uint8Array(getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(m) as never));
}

const fx = (ixs: Instruction[], o?: Parameters<typeof build>[1]): EffectsV1 => effectsOf(build(ixs, o), ctx);
const deniedNames = (e: EffectsV1) => e.denied.map((d) => `${d.rule}:${d.instruction}`);
const VERSIONS: Version[] = ["legacy", 0, 1];

// --- addresses derived offline ------------------------------------------------------------------

test("the curve check and program-derived addresses agree with web3.js on random inputs", () => {
  const g = rng(31);
  let on = 0;
  for (let i = 0; i < 300; i++) {
    const b = g.bytes(32);
    const mine = isOnCurve(b);
    assert.equal(mine, PublicKey.isOnCurve(b), `bytes ${encodeBase58(b)}`);
    on += mine ? 1 : 0;
  }
  assert.ok(on > 50 && on < 250, `about half of random strings are curve points; saw ${on} of 300`);
  for (let i = 0; i < 50; i++) {
    const program = g.bytes(32);
    const seeds = [g.bytes(g.int(0, 32)), g.bytes(g.int(0, 32))];
    const [ref, refBump] = PublicKey.findProgramAddressSync(seeds, new PublicKey(program));
    const [mine, bump] = findProgramAddress(seeds, encodeBase58(program));
    assert.equal(mine, ref.toBase58());
    assert.equal(bump, refBump);
  }
});

test("associated token accounts are derived as the token client derives them, for Token and Token-2022", async () => {
  for (let i = 0; i < 20; i++) {
    const owner = randomAddress(r);
    const mint = randomAddress(r);
    for (const [program, label] of [[TOKEN, "token"], [TOKEN_2022, "token-2022"]] as const) {
      assert.equal(associatedTokenAddress(owner, mint, label), await ata(owner, mint, program));
    }
  }
  assert.notEqual(associatedTokenAddress(AGENT, USDC, "token"), associatedTokenAddress(AGENT, USDC, "token-2022"));
});

// --- System -------------------------------------------------------------------------------------

test("System Transfer is value-moving: the destination and lamports are counted, in every version", () => {
  for (const version of VERSIONS) {
    const e = fx([getTransferSolInstruction({ source: signer(AGENT), destination: TREASURY, amount: 1_500_000_000n })], { version });
    assert.deepEqual(e.sol, [{ from: AGENT, to: TREASURY, lamports: 1_500_000_000n, kind: "transfer" }], `version ${version}`);
    assert.deepEqual(e.denied, []);
    assert.equal(e.version, version);
    assert.deepEqual(e.programs, [PROGRAMS.system]);
  }
});

test("System TransferWithSeed, CreateAccount and CreateAccountWithSeed move lamports, and are counted", () => {
  const seeded = fx([getTransferSolWithSeedInstruction({ source: SECOND, baseAccount: signer(AGENT), destination: ATTACKER, amount: 7n, fromSeed: "s", fromOwner: OPAQUE })]);
  assert.deepEqual(seeded.sol, [{ from: SECOND, to: ATTACKER, lamports: 7n, kind: "transfer" }]);

  const created = fx([getCreateAccountInstruction({ payer: signer(AGENT), newAccount: signer(NEW), lamports: 2_039_280n, space: 165, programAddress: TOKEN })]);
  assert.deepEqual(created.sol, [{ from: AGENT, to: NEW, lamports: 2_039_280n, kind: "new-account" }]);

  const withSeed = fx([getCreateAccountWithSeedInstruction({ payer: signer(AGENT), newAccount: ATTACKER, base: AGENT, seed: "x", amount: 99n, space: 0, programAddress: OPAQUE })]);
  assert.deepEqual(withSeed.sol, [{ from: AGENT, to: ATTACKER, lamports: 99n, kind: "new-account" }]);
});

test("System CreateAccountAllowPrefund: funded lamports are counted; unfunded moves nothing; a principal account is never assigned away", () => {
  const funded = fx([getCreateAccountAllowPrefundInstruction({ newAccount: signer(NEW), payer: signer(AGENT), lamports: 5_000n, space: 0, programAddress: OPAQUE })]);
  assert.deepEqual(funded.sol, [{ from: AGENT, to: NEW, lamports: 5_000n, kind: "new-account" }]);
  assert.deepEqual(funded.denied, []);

  const unfunded = fx([getCreateAccountAllowPrefundInstruction({ newAccount: signer(NEW), space: 0, programAddress: OPAQUE })]);
  assert.deepEqual(unfunded.sol, []);
  assert.deepEqual(unfunded.denied, []);

  const brick = fx([getCreateAccountAllowPrefundInstruction({ newAccount: signer(SECOND), space: 0, programAddress: OPAQUE })]);
  assert.deepEqual(deniedNames(brick), ["instruction-denied:System.CreateAccountAllowPrefund"]);
  assert.match(brick.denied[0]!.reason, /principal/);
});

test("System Assign and Allocate are denied: they hand an account to another program", () => {
  const e = fx([getAssignInstruction({ account: signer(AGENT), programAddress: OPAQUE }), getAllocateInstruction({ newAccount: signer(SECOND), space: 10 })]);
  assert.deepEqual(deniedNames(e), ["instruction-denied:System.Assign", "instruction-denied:System.Allocate"]);
});

test("durable nonces: AdvanceNonceAccount first marks the message, and every nonce instruction is denied", () => {
  const advance = getAdvanceNonceAccountInstruction({ nonceAccount: NONCE, nonceAuthority: signer(AGENT) });
  const transfer = getTransferSolInstruction({ source: signer(AGENT), destination: TREASURY, amount: 1n });
  const e = fx([advance, transfer]);
  assert.equal(e.nonce, true);
  assert.deepEqual(deniedNames(e), ["durable-nonce-denied:System.AdvanceNonceAccount"]);
  assert.deepEqual(e.sol, [{ from: AGENT, to: TREASURY, lamports: 1n, kind: "transfer" }], "the transfer is still counted");

  const others = fx([
    getWithdrawNonceAccountInstruction({ nonceAccount: NONCE, recipientAccount: ATTACKER, nonceAuthority: signer(AGENT), withdrawAmount: 1n }),
    getInitializeNonceAccountInstruction({ nonceAccount: NONCE, nonceAuthority: AGENT }),
    getAuthorizeNonceAccountInstruction({ nonceAccount: NONCE, nonceAuthority: signer(AGENT), newNonceAuthority: ATTACKER }),
    getUpgradeNonceAccountInstruction({ nonceAccount: NONCE }),
    advance,
  ]);
  assert.equal(others.nonce, false, "AdvanceNonceAccount is not the first instruction");
  assert.deepEqual(deniedNames(others), [
    "durable-nonce-denied:System.WithdrawNonceAccount",
    "durable-nonce-denied:System.InitializeNonceAccount",
    "durable-nonce-denied:System.AuthorizeNonceAccount",
    "durable-nonce-denied:System.UpgradeNonceAccount",
    "durable-nonce-denied:System.AdvanceNonceAccount",
  ]);
});

test("System: an unknown instruction, or data that does not fit its layout, is denied", () => {
  const raw = (data: number[], accounts = [{ address: AGENT, role: 3 }]) => ({ programAddress: PROGRAMS.system as Address, accounts, data: Uint8Array.from(data) }) as Instruction;
  const e = fx([
    raw([14, 0, 0, 0]),
    raw([0xff, 0xff, 0xff, 0xff]),
    raw([2, 0, 0, 0, 1, 2, 3]), // Transfer with a short amount
    raw([2, 0, 0]), // a short discriminant
    raw([2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 9], [{ address: AGENT, role: 3 }, { address: TREASURY, role: 1 }]), // Transfer with a trailing byte
    raw([2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [{ address: AGENT, role: 3 }]), // Transfer with one account
  ]);
  assert.deepEqual(deniedNames(e), [
    "instruction-denied:System.unknown(14)",
    "instruction-denied:System.unknown(4294967295)",
    "instruction-denied:System.Transfer",
    "instruction-denied:System.unknown",
    "instruction-denied:System.Transfer",
    "instruction-denied:System.Transfer",
  ]);
  assert.deepEqual(e.sol, [], "nothing malformed is counted as if it were understood");
});

// --- SPL Token and Token-2022 -------------------------------------------------------------------

test("Token Transfer from the principal's associated account infers the mint; to an allowed owner's account, names the owner", async () => {
  const from = await ata(AGENT, USDC);
  const to = await ata(TREASURY, USDC);
  const e = fx([getTransferInstruction({ source: from, destination: to, authority: signer(AGENT), amount: 2_000_000n })]);
  assert.deepEqual(e.tokens, [{ program: "token", mint: USDC, fromAccount: from, authority: AGENT, toAccount: to, toOwner: TREASURY, amount: 2_000_000n, decimals: null }]);
  assert.deepEqual(e.denied, []);
});

test("Token Transfer from any other account leaves the mint unknown, and a non-associated destination has no owner", async () => {
  const stranger = randomAddress(r);
  const e = fx([getTransferInstruction({ source: stranger, destination: ATTACKER, authority: signer(AGENT), amount: 1n })]);
  assert.equal(e.tokens[0]!.mint, null);
  assert.equal(e.tokens[0]!.toOwner, null);
  assert.equal(e.tokens[0]!.toAccount, ATTACKER);
});

test("TransferChecked names its mint and decimals, under Token and under Token-2022", async () => {
  const checked = fx([getTransferCheckedInstruction({ source: await ata(AGENT, USDC), mint: USDC, destination: await ata(TREASURY, USDC), authority: signer(AGENT), amount: 5n, decimals: 6 })]);
  assert.deepEqual([checked.tokens[0]!.program, checked.tokens[0]!.mint, checked.tokens[0]!.toOwner, checked.tokens[0]!.decimals], ["token", USDC, TREASURY, 6]);

  const t22 = fx([getTransferCheckedInstruction({ source: await ata(AGENT, PYUSD, TOKEN_2022), mint: PYUSD, destination: await ata(TREASURY, PYUSD, TOKEN_2022), authority: signer(AGENT), amount: 5n, decimals: 6 }, { programAddress: TOKEN_2022 })]);
  assert.deepEqual([t22.tokens[0]!.program, t22.tokens[0]!.mint, t22.tokens[0]!.toOwner], ["token-2022", PYUSD, TREASURY]);

  // Run by the Token program, but sent to the owner's Token-2022 account: not that owner's account for this program.
  const wrongProgram = fx([getTransferCheckedInstruction({ source: await ata(AGENT, PYUSD), mint: PYUSD, destination: await ata(TREASURY, PYUSD, TOKEN_2022), authority: signer(AGENT), amount: 5n, decimals: 6 })]);
  assert.equal(wrongProgram.tokens[0]!.program, "token");
  assert.equal(wrongProgram.tokens[0]!.toOwner, null, "a Token-2022 associated account is not the Token program's");
});

test("Token-2022 TransferCheckedWithFee is value-moving while Token keeps discriminator 26 denied", () => {
  assert.deepEqual(classifyInstruction(PROGRAMS.token2022, Uint8Array.of(26)), { name: "TransferCheckedWithFee", class: "value-moving" });
  assert.equal(classifyInstruction(PROGRAMS.token, Uint8Array.of(26)).class, "denied");
});

test("Token: Approve, CloseAccount and the other authority-granting instructions are denied; Revoke and SyncNative are benign", async () => {
  const acct = await ata(AGENT, USDC);
  const e = fx([
    getApproveInstruction({ source: acct, delegate: ATTACKER, owner: signer(AGENT), amount: 1n }),
    getCloseAccountInstruction({ account: acct, destination: ATTACKER, owner: signer(AGENT) }),
    getRevokeInstruction({ source: acct, owner: signer(AGENT) }),
    getSyncNativeInstruction({ account: acct }),
  ]);
  assert.deepEqual(deniedNames(e), ["instruction-denied:Token.Approve", "instruction-denied:Token.CloseAccount"]);
  assert.deepEqual(e.tokens, []);
});

test("Token: every discriminator has the class the spec gives it, under both token programs", () => {
  const denied = ["Approve", "ApproveChecked", "SetAuthority", "CloseAccount", "Burn", "BurnChecked", "MintTo", "MintToChecked", "FreezeAccount", "ThawAccount"];
  const benign = ["Revoke", "SyncNative", "InitializeAccount", "InitializeAccount2", "InitializeAccount3"];
  const moving = ["Transfer", "TransferChecked"];
  for (let d = 0; d <= 255; d++) {
    for (const program of [PROGRAMS.token, PROGRAMS.token2022]) {
      const c = classifyInstruction(program, Uint8Array.of(d));
      if (program === PROGRAMS.token) {
        let ref: string | null = null;
        try { ref = TokenInstruction[identifyTokenInstruction(Uint8Array.of(d))]!; } catch { /* the client does not know it */ }
        if (ref !== null) assert.equal(c.name, ref, `discriminator ${d}`);
      }
      const expected = (moving.includes(c.name) || (program === PROGRAMS.token2022 && c.name === "TransferCheckedWithFee")) ? "value-moving" : benign.includes(c.name) ? "benign" : "denied";
      assert.equal(c.class, expected, `${program} discriminator ${d} (${c.name})`);
      if (denied.includes(c.name)) assert.equal(c.class, "denied");
    }
  }
  for (const [d, name] of [[38, "WithdrawExcessLamports"], [45, "UnwrapLamports"], [255, "Batch"]] as const) {
    assert.deepEqual(classifyInstruction(PROGRAMS.token, Uint8Array.of(d)), { name, class: "denied" }, "p-token's additions are denied");
  }
});

test("Token: a transfer whose authority does not sign (a multisig authority) is denied", async () => {
  const e = fx([getTransferInstruction({ source: await ata(AGENT, USDC), destination: await ata(TREASURY, USDC), authority: OPAQUE, amount: 1n, multiSigners: [signer(AGENT)] })]);
  assert.deepEqual(deniedNames(e), ["instruction-denied:Token.Transfer"]);
  assert.match(e.denied[0]!.reason, /authority/);
  assert.deepEqual(e.tokens, []);
});

// --- ComputeBudget and fees ---------------------------------------------------------------------

test("ComputeBudget: the instruction names match the compute-budget client for every discriminator", () => {
  for (let d = 0; d <= 255; d++) {
    const c = classifyInstruction(PROGRAMS.computeBudget, Uint8Array.of(d));
    let ref: string | null = null;
    try { ref = ComputeBudgetInstruction[identifyComputeBudgetInstruction(Uint8Array.of(d))]!; } catch { /* unknown to the client */ }
    if (ref !== null) assert.equal(c.name, ref, `discriminator ${d}`);
    assert.equal(c.class, ["RequestHeapFrame", "SetComputeUnitLimit", "SetComputeUnitPrice", "SetLoadedAccountsDataSizeLimit"].includes(c.name) ? "benign" : "denied", `discriminator ${d}`);
  }
});

test("System: the instruction names match the system client for every discriminator", () => {
  const SPEC_NAME: Record<string, string> = { TransferSol: "Transfer", TransferSolWithSeed: "TransferWithSeed" };
  for (let d = 0; d <= 20; d++) {
    const c = classifyInstruction(PROGRAMS.system, Uint8Array.of(d, 0, 0, 0));
    let ref: string | null = null;
    try { ref = SystemInstruction[identifySystemInstruction(Uint8Array.of(d, 0, 0, 0))]!; } catch { /* unknown */ }
    if (ref !== null) assert.equal(c.name, SPEC_NAME[ref] ?? ref, `discriminator ${d}`);
    else assert.equal(c.name, `unknown(${d})`);
  }
});

test("fees, legacy and v0: price × limit, rounded up; the default limit when none is set; no price, no fee", () => {
  const pay = getTransferSolInstruction({ source: signer(AGENT), destination: TREASURY, amount: 1n });
  for (const version of ["legacy", 0] as const) {
    const both = fx([getSetComputeUnitLimitInstruction({ units: 300_000 }), getSetComputeUnitPriceInstruction({ microLamports: 1_000_001n }), pay], { version });
    assert.equal(both.computeUnitLimit, 300_000);
    assert.equal(both.priorityFee, 300_001n, "ceil(1,000,001 × 300,000 / 1,000,000)");
    assert.equal(both.baseFee, 5_000n);

    const priceOnly = fx([getSetComputeUnitPriceInstruction({ microLamports: 10n }), pay, { programAddress: OPAQUE, accounts: [], data: new Uint8Array() } as Instruction], { version });
    // ComputeBudget and System are builtins at 3,000 units each; the opaque program gets 200,000.
    assert.equal(priceOnly.computeUnitLimit, 206_000);
    assert.equal(priceOnly.priorityFee, 3n, "ceil(10 × 206,000 / 1,000,000)");

    const capped = fx([getSetComputeUnitLimitInstruction({ units: 9_000_000 }), getSetComputeUnitPriceInstruction({ microLamports: 1_000_000n }), pay], { version });
    assert.equal(capped.computeUnitLimit, 1_400_000, "the runtime caps the limit");
    assert.equal(capped.priorityFee, 1_400_000n);

    assert.equal(fx([getSetComputeUnitLimitInstruction({ units: 1_000_000 }), pay], { version }).priorityFee, 0n);
  }
});

test("fees: two of the same ComputeBudget instruction, or the deprecated RequestUnits, are denied", () => {
  const e = fx([getSetComputeUnitPriceInstruction({ microLamports: 1n }), getSetComputeUnitPriceInstruction({ microLamports: 2n }), getRequestUnitsInstruction({ units: 1, additionalFee: 1 })]);
  assert.deepEqual(deniedNames(e), ["instruction-denied:ComputeBudget.SetComputeUnitPrice", "instruction-denied:ComputeBudget.RequestUnits"]);
  const fine = fx([getRequestHeapFrameInstruction({ bytes: 64 * 1024 }), getSetLoadedAccountsDataSizeLimitInstruction({ accountDataSizeLimit: 1024 })]);
  assert.deepEqual(fine.denied, []);
});

test("fees, v1: the priority fee is the config's lamport total, and any ComputeBudget instruction is a denied decoy", () => {
  const pay = getTransferSolInstruction({ source: signer(AGENT), destination: TREASURY, amount: 1n });
  const e = fx([pay], { version: 1, priorityFee: 12_345n, cuLimit: 50_000 });
  assert.equal(e.priorityFee, 12_345n);
  assert.equal(e.computeUnitLimit, 50_000);
  assert.deepEqual(e.denied, []);

  const unset = fx([pay], { version: 1 });
  assert.equal(unset.priorityFee, 0n);
  assert.equal(unset.computeUnitLimit, 0, "an unset v1 limit is zero, not a default");

  const decoy = fx([getSetComputeUnitPriceInstruction({ microLamports: 1n }), pay], { version: 1, priorityFee: 900_000n });
  assert.deepEqual(deniedNames(decoy), ["instruction-denied:ComputeBudget.SetComputeUnitPrice"]);
  assert.match(decoy.denied[0]!.reason, /v1/);
  assert.equal(decoy.priorityFee, 900_000n, "the decoy's price is ignored; the config decides");
});

test("fees: 5,000 lamports per signature, and SOL to a tip account counts as a tip, not a payment", () => {
  const e = fx([
    getTransferSolInstruction({ source: signer(AGENT), destination: TIP, amount: 10_000n }),
    getTransferSolInstruction({ source: signer(SECOND), destination: TREASURY, amount: 3n }),
  ]);
  assert.deepEqual(e.signers, [AGENT, SECOND]);
  assert.equal(e.baseFee, 10_000n);
  assert.equal(e.tips, 10_000n);
  assert.deepEqual(e.sol, [{ from: SECOND, to: TREASURY, lamports: 3n, kind: "transfer" }]);
});

// --- signers ------------------------------------------------------------------------------------

test("other signers: every required signer outside the principal is reported, for rule 6", () => {
  assert.deepEqual(fx([getTransferSolInstruction({ source: signer(SECOND), destination: TREASURY, amount: 1n })]).otherSigners, []);
  assert.deepEqual(fx([getTransferSolInstruction({ source: signer(ATTACKER), destination: TREASURY, amount: 1n })]).otherSigners, [ATTACKER]);
  const created = fx([getCreateAccountInstruction({ payer: signer(AGENT), newAccount: signer(NEW), lamports: 1n, space: 0, programAddress: OPAQUE })]);
  assert.deepEqual(created.otherSigners, [NEW], "a fresh account's own signature is a signer outside the principal");
  const memo = { programAddress: PROGRAMS.memo as Address, accounts: [{ address: OPAQUE, role: 2 }], data: Uint8Array.of(1) } as Instruction;
  assert.deepEqual(fx([memo]).otherSigners, [OPAQUE], "a signer is a signer, whatever instruction asks for it");
});

// --- other programs -----------------------------------------------------------------------------

test("Memo is benign; a program the guard does not decode is listed as opaque", () => {
  const memo = (p: string) => ({ programAddress: p as Address, accounts: [{ address: AGENT, role: 2 }], data: new TextEncoder().encode("invoice 42") }) as Instruction;
  const e = fx([memo(PROGRAMS.memo), memo(PROGRAMS.memoV1), { programAddress: OPAQUE, accounts: [{ address: AGENT, role: 3 }], data: Uint8Array.of(1, 2) } as Instruction]);
  assert.deepEqual(e.denied, []);
  assert.deepEqual(e.programs, [PROGRAMS.memo, PROGRAMS.memoV1, OPAQUE]);
  assert.deepEqual(e.opaque, [OPAQUE]);
});

// --- hashes -------------------------------------------------------------------------------------

test("the message hash is the SHA-256 of the message bytes", () => {
  const bytes = build([getTransferSolInstruction({ source: signer(AGENT), destination: TREASURY, amount: 1n })]);
  assert.equal(effectsOf(bytes, ctx).messageHash, createHash("sha256").update(bytes).digest("hex"));
});

test("the intent key ignores the blockhash, the fees, memos and the version, and follows what moves", async () => {
  const pay = (amount: bigint, to = TREASURY) => getTransferSolInstruction({ source: signer(AGENT), destination: to, amount });
  const memo = { programAddress: PROGRAMS.memo as Address, accounts: [], data: Uint8Array.of(1) } as Instruction;
  const base = fx([pay(5n)]).intentKey;
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(fx([pay(5n)], { blockhashSeed: 2 }).intentKey, base, "a new blockhash is the same intent");
  assert.equal(fx([getSetComputeUnitPriceInstruction({ microLamports: 999n }), pay(5n)]).intentKey, base, "a higher fee is the same intent");
  assert.equal(fx([pay(5n)], { version: 1, priorityFee: 77n }).intentKey, base, "another version is the same intent");
  assert.equal(fx([memo, pay(5n)]).intentKey, base, "a memo does not make a new intent");
  assert.notEqual(fx([pay(6n)]).intentKey, base, "a different amount is a different intent");
  assert.notEqual(fx([pay(5n, ATTACKER)]).intentKey, base, "a different destination is a different intent");
  assert.notEqual(fx([pay(5n), pay(5n)]).intentKey, base, "two payments are not one");
});

// --- pins in v0 ----------------------------------------------------------------------------------

test("v0: a destination loaded from a pinned table is classified like a static one", () => {
  const table = randomAddress(r);
  const pinned: ClassifyContext = { ...ctx, lookupTables: [{ address: table, entries: [OPAQUE, TREASURY] }] };
  let m: any = createTransactionMessage({ version: 0 });
  m = setTransactionMessageFeePayerSigner(signer(AGENT), m);
  m = setTransactionMessageLifetimeUsingBlockhash({ blockhash: kitAddress(rng(9).bytes(32)) as unknown as Blockhash, lastValidBlockHeight: 1n }, m);
  m = appendTransactionMessageInstructions([{ ...getTransferSolInstruction({ source: signer(AGENT), destination: TREASURY, amount: 4n }), accounts: [{ address: AGENT, role: 3, signer: signer(AGENT) }, { address: TREASURY, role: 1, lookupTableAddress: table, addressIndex: 1 }] } as any], m);
  const bytes = new Uint8Array(getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(m) as never));
  assert.deepEqual(effectsOf(bytes, pinned).sol, [{ from: AGENT, to: TREASURY, lamports: 4n, kind: "transfer" }]);
  assert.throws(() => effectsOf(bytes, ctx), /not pinned/);
});

test("base58 of the system program id decodes to 32 zero bytes (sanity for the constants)", () => {
  assert.deepEqual(decodeBase58(PROGRAMS.system), new Uint8Array(32));
});
