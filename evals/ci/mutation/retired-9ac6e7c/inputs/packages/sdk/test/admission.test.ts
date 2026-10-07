// Milestone 2a.5, admission (docs/SPEC.md §5 and §7, ADR-004, ADR-009). The guard takes message
// bytes, decides by rules 0 to 19 in order, and records every decision in a hash chain. An allowed
// decision is a receipt bound to the bytes; intents stop a second signature while an earlier one
// could still land; the latch stops everything until the operator signs a release.
// Closes defects D5 (decoding outside the fail-closed boundary), D6 and D10 (instructions not
// decoded), D7 (nothing bound an ALLOW to the bytes) and, with policy v1, D1, D2 and D9.

import { strict as assert } from "node:assert";
import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
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
  type Address,
  type Blockhash,
  type Instruction,
} from "@solana/kit";
import {
  getAdvanceNonceAccountInstruction,
  getCreateAccountWithSeedInstruction,
  getTransferSolInstruction,
  getWithdrawNonceAccountInstruction,
} from "@solana-program/system";
import { findAssociatedTokenPda, getApproveInstruction, getTransferCheckedInstruction, getTransferInstruction } from "@solana-program/token";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { canonicalJSON } from "../src/canonical.ts";
import { PROGRAMS } from "../src/classify.ts";
import { encodeBase58 } from "../src/base58.ts";
import { createGuard, type Decision, type Guard, type GuardOptions } from "../src/guard.ts";
import { PolicyError, type PolicyInput } from "../src/policy.ts";
import { craftV1 } from "./support/craft.ts";
import { kitAddress, randomAddress, rng, type Version } from "./support/kit.ts";

const r = rng(5005);
const AGENT = randomAddress(r);
const SECOND = randomAddress(r);
const TREASURY = randomAddress(r);
const SHOP = randomAddress(r);
const ATTACKER = randomAddress(r);
const TIP = randomAddress(r);
const USDC = randomAddress(r);
const PYUSD = randomAddress(r);
const UNLISTED_MINT = randomAddress(r);
const NONCE = randomAddress(r);
const OPAQUE = randomAddress(r);
const UNLISTED_PROGRAM = randomAddress(r);
const SOL = 1_000_000_000n;

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  return { address: encodeBase58(raw), privateKey };
}
const operator = keypair();
const agentKey = keypair();
const signText = (text: string, key: KeyObject) => new Uint8Array(sign(null, Buffer.from(text, "utf8"), key));

function policyInput(o: { afterDenials?: number; opaque?: "deny" | "allow"; maxPerWindow?: bigint; feeWindow?: bigint; windowMs?: number } = {}): PolicyInput {
  return {
    version: 1,
    principal: [AGENT, SECOND],
    programs: { allow: [PROGRAMS.system, PROGRAMS.token, PROGRAMS.token2022, PROGRAMS.computeBudget, PROGRAMS.memo, OPAQUE], opaque: o.opaque ?? "deny" },
    destinations: { allow: [TREASURY, SHOP] },
    sol: { maxPerTx: 1n * SOL, maxPerWindow: o.maxPerWindow ?? 3n * SOL },
    tokens: [
      { mint: USDC, program: "token", maxPerTx: 5_000_000n, maxPerWindow: 20_000_000n },
      { mint: PYUSD, program: "token-2022", maxPerTx: 5_000_000n, maxPerWindow: 20_000_000n },
    ],
    fees: { maxPriorityPerTx: 100_000n, maxPerWindow: o.feeWindow ?? 10_000_000n, tipAccounts: [TIP] },
    lookupTables: [],
    windowMs: o.windowMs ?? 60_000,
    intents: { maxAttempts: 3 },
    latch: { afterDenials: o.afterDenials ?? 100, releaseKey: operator.address, guardId: "test-guard", cluster: "localnet" },
    messages: { allow: false },
    cosign: { allow: false },
    sensor: { expectedPerMinute: 6 },
  };
}

/** Telemetry that keeps Keel at DEFAULT, so a test sees the policy's rules alone. */
const quiet: GuardOptions["sensor"] = () => ({ intensity: 0, valence: 0, repetition: 0 });
const guardWith = (o: Parameters<typeof policyInput>[0] = {}, extra: Partial<GuardOptions> = {}) =>
  createGuard({ policy: policyInput(o), sensor: quiet, ...extra });

const signer = (a: Address) => createNoopSigner(a);
const ata = async (owner: Address, mint: Address, tokenProgram: Address = PROGRAMS.token as Address) => (await findAssociatedTokenPda({ owner, mint, tokenProgram }))[0];

function build(instructions: Instruction[], o: { version?: Version; seed?: number; priorityFee?: bigint; payer?: Address } = {}): Uint8Array {
  const version = o.version ?? "legacy";
  let m: any = createTransactionMessage({ version });
  m = setTransactionMessageFeePayerSigner(signer(o.payer ?? AGENT), m);
  m = setTransactionMessageLifetimeUsingBlockhash({ blockhash: kitAddress(rng(o.seed ?? 1).bytes(32)) as unknown as Blockhash, lastValidBlockHeight: 100n }, m);
  m = appendTransactionMessageInstructions(instructions, m);
  if (version === 1 && o.priorityFee !== undefined) m = setTransactionMessagePriorityFeeLamports(o.priorityFee, m);
  return new Uint8Array(getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(m) as never));
}
const pay = (to: Address, lamports: bigint, from: Address = AGENT) => getTransferSolInstruction({ source: signer(from), destination: to, amount: lamports });

let clock = 1_000_000;
const tick = (ms = 30_000) => (clock += ms);
const check = (g: Guard, ixs: Instruction[], o: Parameters<typeof build>[1] & { at?: number; blockHeight?: bigint; lastValidBlockHeight?: bigint; intent?: string } = {}): Decision =>
  g.check({ message: build(ixs, o), at: o.at ?? tick(), blockHeight: o.blockHeight, lastValidBlockHeight: o.lastValidBlockHeight, intent: o.intent });

function denied(d: Decision, rule: string, label = "") {
  assert.equal(d.allow, false, `${label}: expected a denial by ${rule}, got an ALLOW`);
  assert.equal(d.rule, rule, `${label}: ${d.reason}`);
}
function allowed(d: Decision, label = "") {
  assert.equal(d.allow, true, `${label}: denied by ${d.rule}: ${d.reason}`);
}

// --- rules 0 to 3 ---------------------------------------------------------------------------------

test("rule 0: an invalid policy means no guard", async () => {
  await assert.rejects(createGuard({ policy: { ...policyInput(), principal: [] } }), PolicyError);
  await assert.rejects(createGuard({ policy: { ...policyInput(), sol: { maxPerTx: Number.NaN, maxPerWindow: 1n } } as unknown as PolicyInput }), PolicyError);
});

test("rule 1: bytes that do not parse, and ill-typed fields, deny as malformed-proposal (D5: never a throw)", async () => {
  const g = await guardWith();
  const ok = build([pay(TREASURY, 1n)]);
  denied(g.check({ message: Uint8Array.of(1, 2, 3), at: tick() }), "malformed-proposal", "garbage");
  denied(g.check({ message: "AQID" as unknown as Uint8Array, at: tick() }), "malformed-proposal", "base64 text, not bytes");
  denied(g.check({ message: ok, at: Number.NaN }), "malformed-proposal", "a time that is not a number");
  denied(g.check({ message: ok, at: tick(), blockHeight: 5 as unknown as bigint }), "malformed-proposal", "a height that is not a bigint");
  denied(g.check({ message: ok, at: tick(), lastValidBlockHeight: -1n }), "malformed-proposal", "a negative height");
  denied(g.check({ message: ok, at: tick(), intent: 42 as unknown as string }), "malformed-proposal", "an intent that is not text");
  for (const junk of [null, undefined, 7, "x", [], {}, { message: null }]) {
    denied(g.check(junk as never), "malformed-proposal", `junk ${JSON.stringify(junk)}`);
  }
});

test("rule 2: a version other than legacy, 0 or 1 denies as unsupported-version", async () => {
  const bytes = craftV1();
  bytes[0] = 0x82;
  denied((await guardWith()).check({ message: bytes, at: tick() }), "unsupported-version");
});

test("rule 3: a lookup table the policy does not pin denies as lookup-table-unpinned", async () => {
  const table = randomAddress(r);
  let m: any = createTransactionMessage({ version: 0 });
  m = setTransactionMessageFeePayerSigner(signer(AGENT), m);
  m = setTransactionMessageLifetimeUsingBlockhash({ blockhash: kitAddress(rng(3).bytes(32)) as unknown as Blockhash, lastValidBlockHeight: 1n }, m);
  m = appendTransactionMessageInstructions([{ ...pay(TREASURY, 1n), accounts: [{ address: AGENT, role: 3, signer: signer(AGENT) }, { address: TREASURY, role: 1, lookupTableAddress: table, addressIndex: 0 }] } as any], m);
  const bytes = new Uint8Array(getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(m) as never));
  denied((await guardWith()).check({ message: bytes, at: tick() }), "lookup-table-unpinned");
});

// --- rules 5 to 13 ---------------------------------------------------------------------------------

test("rule 5: a durable nonce, even paying an allowed destination, denies as durable-nonce-denied", async () => {
  const g = await guardWith();
  denied(check(g, [getAdvanceNonceAccountInstruction({ nonceAccount: NONCE, nonceAuthority: signer(AGENT) }), pay(TREASURY, 1n)]), "durable-nonce-denied", "advance first");
  denied(check(g, [getWithdrawNonceAccountInstruction({ nonceAccount: NONCE, recipientAccount: TREASURY, nonceAuthority: signer(AGENT), withdrawAmount: 1n })]), "durable-nonce-denied", "withdraw (D10)");
});

test("rule 6: a required signer outside the principal denies as other-signer", async () => {
  denied(check(await guardWith(), [pay(TREASURY, 1n, ATTACKER)]), "other-signer");
});

test("rule 7: a program off the allowlist denies as program-not-allowed", async () => {
  denied(check(await guardWith(), [pay(TREASURY, 1n), { programAddress: UNLISTED_PROGRAM, accounts: [], data: Uint8Array.of(1) } as Instruction]), "program-not-allowed");
});

test("rule 8: an allowlisted program the guard does not decode denies while opaque is deny, and passes when allow", async () => {
  const call = { programAddress: OPAQUE, accounts: [{ address: AGENT, role: 3 }], data: Uint8Array.of(9) } as Instruction;
  denied(check(await guardWith(), [call]), "opaque-program");
  allowed(check(await guardWith({ opaque: "allow" }), [call]), "opaque allowed");
});

test("rule 9: Approve, an unknown System instruction and a v1 ComputeBudget decoy deny as instruction-denied (D6, D10)", async () => {
  const g = await guardWith();
  denied(check(g, [getApproveInstruction({ source: await ata(AGENT, USDC), delegate: ATTACKER, owner: signer(AGENT), amount: 1n })]), "instruction-denied", "Approve");
  denied(check(g, [{ programAddress: PROGRAMS.system as Address, accounts: [{ address: AGENT, role: 3 }], data: Uint8Array.of(14, 0, 0, 0) } as Instruction]), "instruction-denied", "System 14");
  denied(check(g, [getSetComputeUnitPriceInstruction({ microLamports: 1n }), pay(TREASURY, 1n)], { version: 1, priorityFee: 10n }), "instruction-denied", "v1 decoy");
});

test("rule 10: SOL or tokens to an address the policy does not allow deny as destination-not-allowed", async () => {
  const g = await guardWith();
  denied(check(g, [pay(ATTACKER, 1n)]), "destination-not-allowed", "SOL");
  denied(check(g, [getCreateAccountWithSeedInstruction({ payer: signer(AGENT), newAccount: ATTACKER, base: AGENT, seed: "x", amount: 5n, space: 0, programAddress: OPAQUE })]), "destination-not-allowed", "CreateAccountWithSeed funding a stranger (D10)");
  denied(check(g, [getTransferInstruction({ source: await ata(AGENT, USDC), destination: await ata(ATTACKER, USDC), authority: signer(AGENT), amount: 1n })]), "destination-not-allowed", "a token to the attacker's account");
  denied(check(g, [getTransferInstruction({ source: await ata(AGENT, USDC), destination: ATTACKER, authority: signer(AGENT), amount: 1n })]), "destination-not-allowed", "a token to a non-associated account");
  allowed(check(g, [getTransferInstruction({ source: await ata(AGENT, USDC), destination: await ata(TREASURY, USDC), authority: signer(AGENT), amount: 1n })]), "a token to an allowed owner's associated account");
  allowed(check(g, [pay(SHOP, 2n)]), "SOL to an allowed destination");
});

test("rule 11: an unlisted mint denies as mint-not-allowed; a plain Transfer from an unknown account as token-mint-unknown", async () => {
  const g = await guardWith();
  denied(check(g, [getTransferCheckedInstruction({ source: await ata(AGENT, UNLISTED_MINT), mint: UNLISTED_MINT, destination: await ata(TREASURY, UNLISTED_MINT), authority: signer(AGENT), amount: 1n, decimals: 6 })]), "mint-not-allowed", "unlisted");
  denied(check(g, [getTransferCheckedInstruction({ source: await ata(AGENT, PYUSD), mint: PYUSD, destination: await ata(TREASURY, PYUSD), authority: signer(AGENT), amount: 1n, decimals: 6 })]), "mint-not-allowed", "a Token-2022 mint moved by the Token program");
  denied(check(g, [getTransferInstruction({ source: randomAddress(r), destination: TREASURY, authority: signer(AGENT), amount: 1n })]), "token-mint-unknown", "plain Transfer, unknown source");
});

test("rule 12: SOL or a mint over its per-transaction cap denies as over-per-tx-cap, summed over the message", async () => {
  const g = await guardWith();
  denied(check(g, [pay(TREASURY, SOL + 1n)]), "over-per-tx-cap", "one transfer");
  denied(check(g, [pay(TREASURY, SOL / 2n), pay(SHOP, SOL / 2n + 1n)]), "over-per-tx-cap", "two transfers");
  denied(check(g, [getTransferCheckedInstruction({ source: await ata(AGENT, USDC), mint: USDC, destination: await ata(TREASURY, USDC), authority: signer(AGENT), amount: 5_000_001n, decimals: 6 })]), "over-per-tx-cap", "USDC");
  allowed(check(g, [pay(TREASURY, SOL)]), "exactly the cap");
});

test("rule 13: a priority fee over the cap denies as over-fee-cap, in legacy and in v1", async () => {
  const g = await guardWith();
  denied(check(g, [getSetComputeUnitLimitInstruction({ units: 200_000 }), getSetComputeUnitPriceInstruction({ microLamports: 500_001n }), pay(TREASURY, 1n)]), "over-fee-cap", "legacy: 100,000.2 lamports");
  denied(check(g, [pay(TREASURY, 2n)], { version: 1, priorityFee: 100_001n }), "over-fee-cap", "v1");
  allowed(check(g, [pay(TREASURY, 3n)], { version: 1, priorityFee: 100_000n }), "v1 at the cap");
});

// --- rules 14 and 15: intents -----------------------------------------------------------------------

test("rules 14 and 15, the double-send battery: in flight until reported failed or expired; attempts are counted", async () => {
  const g = await guardWith();
  const send = (seed: number, blockHeight: bigint, intent?: string) =>
    check(g, [pay(TREASURY, 5n)], { seed, blockHeight, lastValidBlockHeight: blockHeight + 150n, intent, at: tick(1_000) });

  const first = send(1, 1_000n);
  allowed(first, "attempt 1");
  denied(send(2, 1_010n), "intent-in-flight", "re-sign before expiry");
  denied(send(3, 1_020n, "a new caller key"), "intent-in-flight", "the same effects under another caller intent");
  g.report(first.hash, "unknown");
  denied(send(4, 1_100n), "intent-in-flight", "re-sign after an unknown outcome");

  denied(send(41, 1_150n), "intent-in-flight", "at exactly attempt 1's last valid height, it can still land");
  denied(send(42, 1_151n), "intent-in-flight", "past its expiry, attempt 1's outcome is still unknown: it may have landed (D14)");
  g.report(first.hash, "expired");
  const second = send(5, 1_151n);
  allowed(second, "re-sign after expiry, once attempt 1 is reported expired");
  g.report(second.hash, "failed");
  const third = send(6, 1_160n);
  allowed(third, "attempt 3, after a reported failure");
  g.report(third.hash, "failed");
  denied(send(7, 1_170n), "intent-attempts-exhausted", "attempt 4 of 3");

  allowed(check(g, [pay(TREASURY, 6n)], { blockHeight: 1_170n, lastValidBlockHeight: 1_320n, at: tick(1_000) }), "a different amount is a different intent");
  tick(60_000);
  allowed(send(8, 1_180n), "an exhausted intent may try again once its window has passed since its first attempt");
});

test("D14: an attempt nobody reported may have landed, so past its expiry it still holds its intent, until reported or until the window passes", async () => {
  const g = await guardWith();
  const pay9 = (seed: number, blockHeight: bigint, at = tick(1_000)) => check(g, [pay(SHOP, 9n)], { seed, blockHeight, lastValidBlockHeight: blockHeight + 150n, at });
  const first = pay9(1, 1_000n);
  allowed(first, "signed; the caller sends it; nobody reports");
  const past = pay9(2, 1_151n);
  denied(past, "intent-in-flight", "past the first attempt's expiry, unreported");
  assert.match(past.reason, /never reported/, "the reason says why: not that it could still land, but that nobody said whether it did");
  g.report(first.hash, "landed");
  allowed(pay9(3, 1_160n), "reported landed: that intent is done, and the same payment again is a new one");

  // Unreported, the intent is held only for its window since the first attempt. The window cap counted it all along.
  const g2 = await guardWith();
  const once = check(g2, [pay(SHOP, 10n)], { seed: 1, blockHeight: 1_000n, lastValidBlockHeight: 1_150n, at: tick(1_000) });
  allowed(once);
  denied(check(g2, [pay(SHOP, 10n)], { seed: 2, blockHeight: 1_200n, lastValidBlockHeight: 1_350n, at: tick(1_000) }), "intent-in-flight", "within the window");
  tick(60_000);
  allowed(check(g2, [pay(SHOP, 10n)], { seed: 3, blockHeight: 1_400n, lastValidBlockHeight: 1_550n, at: tick(1_000) }), "a window after the first attempt, a new intent");
});

test("intents: a landed intent is done, and the same payment again is a new intent", async () => {
  const g = await guardWith();
  const d = check(g, [pay(SHOP, 7n)], { blockHeight: 10n, lastValidBlockHeight: 160n });
  allowed(d);
  g.report(d.hash, "landed");
  allowed(check(g, [pay(SHOP, 7n)], { seed: 9, blockHeight: 20n, lastValidBlockHeight: 170n }), "a new intent");
});

test("intents: without block heights, only a report ends an attempt", async () => {
  const g = await guardWith();
  const d = check(g, [pay(SHOP, 8n)]);
  allowed(d);
  denied(check(g, [pay(SHOP, 8n)], { at: tick(3_600_000) }), "intent-in-flight", "an hour later, still unknown");
  g.report(d.hash, "expired");
  allowed(check(g, [pay(SHOP, 8n)]), "after a reported expiry");
});

test("reports: only for allowed decisions this guard made", async () => {
  const g = await guardWith();
  const no = check(g, [pay(ATTACKER, 1n)]);
  assert.throws(() => g.report(no.hash, "landed"), /allowed/);
  assert.throws(() => g.report("0".repeat(64), "landed"), /no allowed decision/);
  const yes = check(g, [pay(SHOP, 1n)]);
  assert.throws(() => g.report(yes.hash, "won" as never), /outcome/);
});

// --- rule 16: windows -------------------------------------------------------------------------------

test("rule 16: the window counts what was allowed; a failed report releases it, an unknown one keeps it; it slides", async () => {
  const g = await guardWith();
  const at = () => ({ at: tick(1_000) });
  const d = [0n, 1n, 2n].map((i) => check(g, [pay(TREASURY, 900_000_000n + i)], at()));
  d.forEach((x) => allowed(x));
  denied(check(g, [pay(TREASURY, 900_000_003n)], at()), "over-window-cap", "a fourth 0.9 SOL would make 3.6");
  g.report(d[0]!.hash, "unknown");
  denied(check(g, [pay(TREASURY, 900_000_004n)], at()), "over-window-cap", "an unknown outcome keeps its reservation");
  g.report(d[1]!.hash, "failed");
  allowed(check(g, [pay(TREASURY, 900_000_005n)], at()), "a failed one releases it");
  denied(check(g, [pay(TREASURY, 900_000_006n)], at()), "over-window-cap");
  allowed(check(g, [pay(TREASURY, 900_000_007n)], { at: tick(61_000) }), "the window slid past every earlier payment");
});

test("rule 16: each mint and the fees have their own window", async () => {
  const g = await guardWith({ feeWindow: 12_000n });
  const usdc = async (amount: bigint) => check(g, [getTransferCheckedInstruction({ source: await ata(AGENT, USDC), mint: USDC, destination: await ata(TREASURY, USDC), authority: signer(AGENT), amount, decimals: 6 })], { at: tick(1_000) });
  allowed(await usdc(5_000_000n));
  allowed(check(g, [pay(TIP, 1_000n), pay(SHOP, 1n)], { at: tick(1_000) }), "fees so far: 5,000 + 1,000 tip + 5,000");
  denied(check(g, [pay(SHOP, 2n)], { at: tick(1_000) }), "over-window-cap", "another 5,000 base fee would make 16,000 of 12,000");
});

test("rule 16, the boundaries: a payment exactly one window later is outside it, one millisecond earlier is inside", async () => {
  const g = await guardWith({ maxPerWindow: SOL });
  const t0 = tick();
  allowed(g.check({ message: build([pay(TREASURY, 900_000_000n)]), at: t0 }));
  denied(g.check({ message: build([pay(TREASURY, 200_000_000n)]), at: t0 + 59_999 }), "over-window-cap", "inside the window");
  allowed(g.check({ message: build([pay(TREASURY, 200_000_001n)]), at: t0 + 60_000 }), "exactly one window later");
  clock = t0 + 60_000;
});

test("rule 16: a mint's window is its own", async () => {
  const g = await guardWith();
  const usdc = async (amount: bigint) => check(g, [getTransferCheckedInstruction({ source: await ata(AGENT, USDC), mint: USDC, destination: await ata(TREASURY, USDC), authority: signer(AGENT), amount, decimals: 6 })], { at: tick(1_000) });
  for (const i of [0n, 1n, 2n, 3n]) allowed(await usdc(5_000_000n - i), `USDC payment ${i}`);
  denied(await usdc(5_000_000n - 4n), "over-window-cap", "a fifth would pass 20,000,000 per window");
  allowed(check(g, [pay(TREASURY, 1n)], { at: tick(1_000) }), "SOL has its own window");
});

test("the concurrency battery: 50 proposals in one tick admit exactly what fits the window", async () => {
  const g = await guardWith({ maxPerWindow: SOL });
  const at = tick();
  const ds = Array.from({ length: 50 }, (_, i) => g.check({ message: build([pay(TREASURY, 100_000_000n + BigInt(i))]), at }));
  const admitted = ds.filter((d) => d.allow);
  assert.equal(admitted.length, 9, "9 × 0.1 SOL fit in 1 SOL; a 10th would not");
  assert.ok(ds.slice(9).every((d) => d.rule === "over-window-cap"));
});

// --- rules 17 and 18: Keel --------------------------------------------------------------------------

test("rule 17: an identical failing retry loop is stopped by Keel as loop-reground, and the turn is measured", async () => {
  const g = await createGuard({ policy: policyInput() });
  const decisions: Decision[] = [];
  for (let turn = 1; turn <= 12; turn++) {
    const d = check(g, [pay(TREASURY, 250_000_000n)], { seed: turn, at: tick(400) });
    decisions.push(d);
    if (!d.allow) break;
    g.report(d.hash, "failed");
  }
  const stoppedAt = decisions.findIndex((d) => !d.allow) + 1;
  console.log(`  retry loop stopped at turn ${stoppedAt}: ${decisions.map((d) => d.posture).join(" -> ")} (${decisions.at(-1)!.rule})`);
  assert.equal(decisions[0]!.allow, true);
  assert.equal(decisions.at(-1)!.rule, "loop-reground");
  assert.ok(g.status().latched, "REGROUND trips the latch");
});

test("rule 18: under INHIBIT, an amount over the per-transaction cap times Keel's clamp (0.30) denies as inhibit-cap", async () => {
  const g = await guardWith({}, { sensor: () => ({ intensity: 0.9, valence: -0.8, repetition: 0 }) });
  const over = check(g, [pay(TREASURY, 300_000_001n)]);
  assert.equal(over.posture, "INHIBIT");
  denied(over, "inhibit-cap");
  allowed(check(g, [pay(TREASURY, 300_000_000n)]), "exactly 0.30 of the cap");
});

test("varied, successful payments at a realistic pace are not stopped", async () => {
  const g = await createGuard({ policy: policyInput({ maxPerWindow: 100n * SOL }) });
  for (let turn = 1; turn <= 20; turn++) {
    const d = check(g, [pay(TREASURY, 10_000_000n + BigInt((turn * 7_919_993) % 90_000_000))], { seed: turn, at: tick(30_000) });
    allowed(d, `turn ${turn}`);
    g.report(d.hash, "landed");
  }
});

test("every parsed proposal reaches Keel, allowed or denied; a malformed one does not", async () => {
  let ticks = 0;
  const g = await guardWith({}, { sensor: () => (ticks++, { intensity: 0, valence: 0, repetition: 0 }) });
  g.check({ message: Uint8Array.of(9), at: tick() });
  check(g, [pay(ATTACKER, 1n)]);
  check(g, [pay(TREASURY, 1n)]);
  assert.equal(ticks, 2);
});

// --- rule 19, and rule order ------------------------------------------------------------------------

test("rule 19: anything that throws denies as fail-closed, and check never throws", async () => {
  const g = await guardWith({}, { sensor: () => { throw new Error("sensor broke"); } });
  denied(check(g, [pay(TREASURY, 1n)]), "fail-closed", "a sensor that throws");
  const h = await guardWith({}, { sensor: () => ({ intensity: Number.NaN, valence: 0, repetition: 0 }) });
  denied(check(h, [pay(TREASURY, 1n)]), "fail-closed", "telemetry Keel refuses");
});

test("rule order: a proposal that breaks several rules is denied by the first", async () => {
  const approve = getApproveInstruction({ source: await ata(AGENT, USDC), delegate: ATTACKER, owner: signer(AGENT), amount: 1n });
  const unlisted = { programAddress: UNLISTED_PROGRAM, accounts: [], data: Uint8Array.of(1) } as Instruction;
  const opaque = { programAddress: OPAQUE, accounts: [], data: Uint8Array.of(1) } as Instruction;
  const nonce = getAdvanceNonceAccountInstruction({ nonceAccount: NONCE, nonceAuthority: signer(AGENT) });
  const badMint = getTransferCheckedInstruction({ source: await ata(AGENT, UNLISTED_MINT), mint: UNLISTED_MINT, destination: await ata(TREASURY, UNLISTED_MINT), authority: signer(AGENT), amount: 1n, decimals: 6 });
  const highFee = [getSetComputeUnitLimitInstruction({ units: 200_000 }), getSetComputeUnitPriceInstruction({ microLamports: 10_000_000n })];
  const cases: [Instruction[], string][] = [
    [[nonce, pay(TREASURY, 1n, ATTACKER), unlisted], "durable-nonce-denied"],
    [[pay(TREASURY, 1n, ATTACKER), unlisted], "other-signer"],
    [[unlisted, opaque, approve], "program-not-allowed"],
    [[opaque, approve], "opaque-program"],
    [[approve, pay(ATTACKER, 1n)], "instruction-denied"],
    [[pay(ATTACKER, 1n), badMint], "destination-not-allowed"],
    [[badMint, pay(TREASURY, 2n * SOL)], "mint-not-allowed"],
    [[...highFee, pay(TREASURY, 2n * SOL)], "over-per-tx-cap"],
  ];
  for (const [ixs, rule] of cases) denied(check(await guardWith(), ixs), rule, rule);

  const g = await guardWith({ afterDenials: 1 });
  check(g, [pay(ATTACKER, 1n)]);
  assert.ok(g.status().latched);
  denied(g.check({ message: Uint8Array.of(1), at: tick() }), "malformed-proposal", "malformed comes before latched");
  denied(check(g, [pay(TREASURY, 1n)]), "latched", "a good payment while latched");
});

// --- the latch --------------------------------------------------------------------------------------

test("the latch battery: it trips after the set run of denials; only a fresh, exact operator release frees it", async () => {
  const g = await guardWith({ afterDenials: 3 });
  check(g, [pay(ATTACKER, 1n)]);
  check(g, [pay(ATTACKER, 2n)]);
  assert.equal(g.status().latched, false);
  const third = check(g, [pay(ATTACKER, 3n)]);
  assert.deepEqual([g.status().latched, g.status().latchSeq], [true, third.seq]);
  denied(check(g, [pay(TREASURY, 1n)]), "latched", "a good payment");

  const at = tick();
  const expires = new Date(at + 10 * 60_000).toISOString();
  const text = g.releaseText(expires);
  assert.equal(text, ["solanaut latch release", "guard: test-guard", "cluster: localnet", `policy: ${g.policyHash}`, `seq: ${third.seq}`, `expires: ${expires}`].join("\n"));

  const refused = (t: string, key: KeyObject, label: string, when = at) => {
    const res = g.release(t, signText(t, key), when);
    assert.equal(res.released, false, label);
    assert.equal(g.status().latched, true, label);
  };
  refused(text, agentKey.privateKey, "signed by the agent's key");
  refused(text.replace(`seq: ${third.seq}`, `seq: ${third.seq + 1}`), operator.privateKey, "a wrong seq");
  refused(text.replace("guard: test-guard", "guard: other"), operator.privateKey, "another guard");
  refused(text.replace("cluster: localnet", "cluster: devnet"), operator.privateKey, "another cluster");
  refused(text.replace(g.policyHash, "f".repeat(64)), operator.privateKey, "another policy");
  refused(text, operator.privateKey, "expired", at + 11 * 60_000);
  refused(`${text}\n`, operator.privateKey, "an extra line");
  assert.equal(g.release(text, signText(text.replace("seq:", "seq: "), operator.privateKey), at).released, false, "a signature over other text");

  const ok = g.release(text, signText(text, operator.privateKey), at);
  assert.deepEqual(ok, { released: true, reason: "" });
  allowed(check(g, [pay(TREASURY, 1n)]), "after release");

  check(g, [pay(ATTACKER, 4n)]);
  check(g, [pay(ATTACKER, 5n)]);
  check(g, [pay(ATTACKER, 6n)]);
  assert.equal(g.status().latched, true, "latched again");
  assert.equal(g.release(text, signText(text, operator.privateKey), at).released, false, "the old release cannot be reused");
});

// --- receipts and the record ------------------------------------------------------------------------

test("receipts (D7): an allowed decision binds the message hash, expiry and policy; redeemed once, for those bytes only", async () => {
  const g = await guardWith();
  const bytes = build([pay(TREASURY, 11n)]);
  const d = g.check({ message: bytes, at: tick(), blockHeight: 500n, lastValidBlockHeight: 650n });
  allowed(d);
  assert.equal(d.messageHash, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(d.policyHash, g.policyHash);
  assert.deepEqual(d.expires, { lastValidBlockHeight: "650" });

  assert.equal(g.redeem(build([pay(TREASURY, 12n)]), d.hash, 600n).ok, false, "other bytes");
  assert.equal(g.redeem(bytes, d.hash, 651n).ok, false, "past its expiry");
  assert.equal(g.redeem(bytes, d.hash).ok, false, "no height to check the expiry against");
  assert.equal(g.redeem(bytes, "0".repeat(64), 600n).ok, false, "not a decision of this guard");
  assert.deepEqual(g.redeem(bytes, d.hash, 600n), { ok: true, reason: "" });
  assert.equal(g.redeem(bytes, d.hash, 600n).ok, false, "a second use");

  const no = check(g, [pay(ATTACKER, 1n)]);
  assert.equal(g.redeem(build([pay(ATTACKER, 1n)]), no.hash, 1n).ok, false, "a denial is not a receipt");
});

test("decisions are a hash chain, and each carries its bytes, so the record replays on its own", async () => {
  const g = await guardWith();
  const bytes = build([pay(TREASURY, 13n)]);
  g.check({ message: bytes, at: tick() });
  check(g, [pay(ATTACKER, 1n)]);
  const entries = g.entries();
  assert.equal(entries.length, 2);
  entries.forEach((e, i) => {
    assert.equal(e.seq, i);
    assert.equal(e.prev, i === 0 ? "" : entries[i - 1]!.hash);
    const { hash, ...body } = e;
    assert.equal(hash, createHash("sha256").update(canonicalJSON(body)).digest("hex"), `entry ${i}`);
    assert.ok(Object.isFrozen(e));
  });
  assert.deepEqual(new Uint8Array(Buffer.from((entries[0] as Decision).message, "base64")), bytes);
});

test("D1: guard.policy is frozen, and changing it is refused", async () => {
  const g = await guardWith();
  assert.throws(() => (g.policy.destinations.allow as string[]).push(ATTACKER), TypeError);
  denied(check(g, [pay(ATTACKER, 1n)]), "destination-not-allowed");
});

test("a controller that is not the verified binary is refused at creation", async () => {
  await assert.rejects(createGuard({ policy: policyInput(), expectedDigest: "0".repeat(64) }), /digest/);
});

// --- found by the independent evaluator (evals/independent/e2-state) ------------------------------

test("S36: a receipt reported expired, failed or landed no longer redeems", async () => {
  for (const outcome of ["expired", "failed", "landed"] as const) {
    const g = await guardWith();
    const message = build([pay(TREASURY, SOL / 10n)], { seed: 900 });
    const d = g.check({ message, at: tick(), blockHeight: 50n, lastValidBlockHeight: 100n });
    allowed(d, outcome);
    g.report(d.hash, outcome);
    const r = g.redeem(message, d.hash, 60n);
    assert.equal(r.ok, false, `after ${outcome}, the receipt redeemed: ${r.reason}`);
  }
});

test("S80: a release's expiry is judged on the latest recorded time, so a clock that steps back cannot revive an expired release", async () => {
  const g = await guardWith({ afterDenials: 2 });
  const t0 = tick();
  check(g, [pay(ATTACKER, 1n)], { at: t0, seed: 903 });
  check(g, [pay(ATTACKER, 2n)], { at: t0 + 100_000, seed: 904 });
  assert.equal(g.status().latched, true);
  const text = g.releaseText(new Date(t0 + 50_000).toISOString());
  const res = g.release(text, signText(text, operator.privateKey), t0 + 10_000);
  assert.equal(res.released, false, "expired at t0 + 50 s, against a record already at t0 + 100 s");
  assert.match(res.reason, /expired/);
});

test("S82: an attempt a trusted height shows can still land stays in the window past windowMs; reported expired, it leaves", async () => {
  const g = await guardWith({ windowMs: 10_000, maxPerWindow: SOL });
  const t0 = tick();
  const first = check(g, [pay(TREASURY, SOL)], { at: t0, blockHeight: 100n, lastValidBlockHeight: 250n, seed: 901 });
  allowed(first, "the first payment");
  denied(check(g, [pay(SHOP, SOL)], { at: t0 + 10_001, blockHeight: 125n, lastValidBlockHeight: 275n, seed: 902 }), "over-window-cap", "beside an attempt that can still land");
  g.report(first.hash, "expired");
  allowed(check(g, [pay(SHOP, SOL)], { at: t0 + 10_002, blockHeight: 126n, lastValidBlockHeight: 276n, seed: 902 }), "once the first is reported expired");
});
