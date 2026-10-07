// The drain battery (docs/SPEC.md §11, milestone 2b.1): forty transactions shaped like the ways a
// fooled, confused or hostile agent could move value it should not, each tagged with the threat
// it is shaped like (docs/papers/THREAT-MODEL.md). Every one must be denied, before signing, by the
// rule named. The honest claim is "a transaction shaped like X is denied by rule Y", never that a
// named incident would have been prevented (docs/CLAIMS.md).

import { strict as assert } from "node:assert";
import { generateKeyPairSync } from "node:crypto";
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
  getAllocateInstruction,
  getAssignInstruction,
  getAuthorizeNonceAccountInstruction,
  getCreateAccountAllowPrefundInstruction,
  getCreateAccountInstruction,
  getCreateAccountWithSeedInstruction,
  getTransferSolInstruction,
  getTransferSolWithSeedInstruction,
  getWithdrawNonceAccountInstruction,
} from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getApproveCheckedInstruction,
  getApproveInstruction,
  getBurnInstruction,
  getCloseAccountInstruction,
  getSetAuthorityInstruction,
  getTransferCheckedInstruction,
  getTransferInstruction,
  AuthorityType,
} from "@solana-program/token";
import { getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { encodeBase58 } from "../src/base58.ts";
import { PROGRAMS } from "../src/classify.ts";
import { createGuard } from "../src/guard.ts";
import type { PolicyInput } from "../src/policy.ts";
import { craftV1 } from "./support/craft.ts";
import { kitAddress, randomAddress, rng, type Version } from "./support/kit.ts";

const r = rng(4040);
const [AGENT, TREASURY, ATTACKER, COUNTERPARTY, USDC, PYUSD, ODD_MINT, NONCE, DRAINER, SWAP, TABLE, UNPINNED, NEW] = Array.from({ length: 13 }, () => randomAddress(r));
const TOKEN = PROGRAMS.token as Address;
const TOKEN_2022 = PROGRAMS.token2022 as Address;
const operator = encodeBase58(Buffer.from(generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x!, "base64url"));

const policy: PolicyInput = {
  version: 1,
  principal: [AGENT!],
  programs: { allow: [PROGRAMS.system, PROGRAMS.token, PROGRAMS.token2022, PROGRAMS.computeBudget, PROGRAMS.memo, SWAP!], opaque: "deny" },
  destinations: { allow: [TREASURY!] },
  sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 3_000_000_000n },
  tokens: [
    { mint: USDC!, program: "token", maxPerTx: 5_000_000n, maxPerWindow: 20_000_000n },
    { mint: PYUSD!, program: "token-2022", maxPerTx: 5_000_000n, maxPerWindow: 20_000_000n },
  ],
  fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 10_000_000n, tipAccounts: [] },
  // The operator pinned a table that happens to hold the attacker's address too: pinning is not allowing.
  lookupTables: [{ address: TABLE!, entries: [TREASURY!, ATTACKER!] }],
  windowMs: 86_400_000,
  intents: { maxAttempts: 3 },
  latch: { afterDenials: 1_000, releaseKey: operator, guardId: "drain-battery", cluster: "localnet" },
  messages: { allow: false },
  cosign: { allow: false },
  sensor: { expectedPerMinute: 6 },
};

const signer = (a: Address) => createNoopSigner(a);
const ata = async (owner: Address, mint: Address, program: Address = TOKEN) => (await findAssociatedTokenPda({ owner, mint, tokenProgram: program }))[0];
const raw = (program: Address, data: number[], accounts: { address: Address; role: number }[] = [{ address: AGENT!, role: 3 }]) =>
  ({ programAddress: program, accounts, data: Uint8Array.from(data) }) as Instruction;

function build(ixs: Instruction[], o: { version?: Version; priorityFee?: bigint; lookups?: boolean } = {}): Uint8Array {
  let m: any = createTransactionMessage({ version: o.version ?? "legacy" });
  m = setTransactionMessageFeePayerSigner(signer(AGENT!), m);
  m = setTransactionMessageLifetimeUsingBlockhash({ blockhash: kitAddress(rng(7).bytes(32)) as unknown as Blockhash, lastValidBlockHeight: 100n }, m);
  m = appendTransactionMessageInstructions(ixs, m);
  if (o.priorityFee !== undefined) m = setTransactionMessagePriorityFeeLamports(o.priorityFee, m);
  return new Uint8Array(getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(m) as never));
}
const pay = (to: Address, lamports: bigint, from: Address = AGENT!) => getTransferSolInstruction({ source: signer(from), destination: to, amount: lamports });
/** A v0 transfer whose destination is loaded from a lookup table at `index`. */
const viaTable = (table: Address, index: number, to: Address) =>
  ({ ...pay(to, 1_000n), accounts: [{ address: AGENT, role: 3, signer: signer(AGENT!) }, { address: to, role: 1, lookupTableAddress: table, addressIndex: index }] }) as unknown as Instruction;

type Case = [threat: string, shape: string, bytes: () => Promise<Uint8Array> | Uint8Array, rule: string];

const cases: Case[] = [
  ["T1", "SOL to a new recipient", () => build([pay(ATTACKER!, 500_000_000n)]), "destination-not-allowed"],
  ["T1", "SOL to a new recipient, as v0", () => build([pay(ATTACKER!, 500_000_000n)], { version: 0 }), "destination-not-allowed"],
  ["T1", "SOL to a new recipient, as v1", () => build([pay(ATTACKER!, 500_000_000n)], { version: 1 }), "destination-not-allowed"],
  ["T1", "an allowed payment with a second, hidden transfer to the attacker", () => build([pay(TREASURY!, 1_000n), pay(ATTACKER!, 400_000_000n)]), "destination-not-allowed"],
  ["T1", "a tip-shaped transfer to an address the policy does not name as a tip account", () => build([pay(TREASURY!, 1_000n), pay(ATTACKER!, 10_000n)]), "destination-not-allowed"],
  ["T1", "TransferWithSeed out of a seed-derived account, to the attacker", () => build([getTransferSolWithSeedInstruction({ source: NEW!, baseAccount: signer(AGENT!), destination: ATTACKER!, amount: 9n, fromSeed: "x", fromOwner: SWAP! })]), "destination-not-allowed"],
  ["T27", "CreateAccountWithSeed funding an account at the attacker's address", () => build([getCreateAccountWithSeedInstruction({ payer: signer(AGENT!), newAccount: ATTACKER!, base: AGENT!, seed: "s", amount: 50_000_000n, space: 0, programAddress: SWAP! })]), "destination-not-allowed"],
  ["T26", "CreateAccount funding a counterparty's fresh key, which must sign", () => build([getCreateAccountInstruction({ payer: signer(AGENT!), newAccount: signer(NEW!), lamports: 50_000_000n, space: 0, programAddress: SWAP! })]), "other-signer"],
  ["T26", "CreateAccountAllowPrefund funding an account the counterparty holds", () => build([getCreateAccountAllowPrefundInstruction({ newAccount: signer(COUNTERPARTY!), payer: signer(AGENT!), lamports: 50_000_000n, space: 0, programAddress: SWAP! })]), "other-signer"],
  ["T2", "Token Approve: the attacker as delegate", async () => build([getApproveInstruction({ source: await ata(AGENT!, USDC!), delegate: ATTACKER!, owner: signer(AGENT!), amount: 1_000_000n })]), "instruction-denied"],
  ["T2", "Token ApproveChecked", async () => build([getApproveCheckedInstruction({ source: await ata(AGENT!, USDC!), mint: USDC!, delegate: ATTACKER!, owner: signer(AGENT!), amount: 1n, decimals: 6 })]), "instruction-denied"],
  ["T2", "Token SetAuthority: the account's owner changed to the attacker", async () => build([getSetAuthorityInstruction({ owned: await ata(AGENT!, USDC!), owner: signer(AGENT!), authorityType: AuthorityType.AccountOwner, newAuthority: ATTACKER! })]), "instruction-denied"],
  ["T2", "Token CloseAccount: the rent to the attacker", async () => build([getCloseAccountInstruction({ account: await ata(AGENT!, USDC!), destination: ATTACKER!, owner: signer(AGENT!) })]), "instruction-denied"],
  ["T2", "Token-2022 Approve", async () => build([getApproveInstruction({ source: await ata(AGENT!, PYUSD!, TOKEN_2022), delegate: ATTACKER!, owner: signer(AGENT!), amount: 1n }, { programAddress: TOKEN_2022 })]), "instruction-denied"],
  ["T2", "Token Burn: value destroyed", async () => build([getBurnInstruction({ account: await ata(AGENT!, USDC!), mint: USDC!, authority: signer(AGENT!), amount: 1n })]), "instruction-denied"],
  ["T2", "System Assign: the agent's account handed to a program", () => build([getAssignInstruction({ account: signer(AGENT!), programAddress: DRAINER! })]), "instruction-denied"],
  ["T2", "System Allocate on the agent's account", () => build([getAllocateInstruction({ newAccount: signer(AGENT!), space: 100 })]), "instruction-denied"],
  ["T22", "p-token Batch, which could carry a transfer the guard would not see", () => build([raw(TOKEN, [255, 3, 9])]), "instruction-denied"],
  ["T22", "a System instruction the guard does not know", () => build([raw(PROGRAMS.system as Address, [99, 0, 0, 0])]), "instruction-denied"],
  ["T15", "Token-2022 TransferCheckedWithFee, an extension instruction", () => build([raw(TOKEN_2022, [26, 1, 0, 0, 0, 0, 0, 0, 0, 0])]), "instruction-denied"],
  ["T5", "an oversized send of a listed mint", async () => build([getTransferCheckedInstruction({ source: await ata(AGENT!, USDC!), mint: USDC!, destination: await ata(TREASURY!, USDC!), authority: signer(AGENT!), amount: 5_000_001n, decimals: 6 })]), "over-per-tx-cap"],
  ["T1", "a listed token to the attacker's associated account", async () => build([getTransferCheckedInstruction({ source: await ata(AGENT!, USDC!), mint: USDC!, destination: await ata(ATTACKER!, USDC!), authority: signer(AGENT!), amount: 1n, decimals: 6 })]), "destination-not-allowed"],
  ["T1", "a listed token to an account that is no one's associated account", async () => build([getTransferInstruction({ source: await ata(AGENT!, USDC!), destination: ATTACKER!, authority: signer(AGENT!), amount: 1n })]), "destination-not-allowed"],
  ["T5", "an unlisted mint", async () => build([getTransferCheckedInstruction({ source: await ata(AGENT!, ODD_MINT!), mint: ODD_MINT!, destination: await ata(TREASURY!, ODD_MINT!), authority: signer(AGENT!), amount: 1n, decimals: 6 })]), "mint-not-allowed"],
  ["T5", "a plain Transfer out of an account the guard cannot tie to a mint", () => build([getTransferInstruction({ source: NEW!, destination: TREASURY!, authority: signer(AGENT!), amount: 1n })]), "token-mint-unknown"],
  ["T15", "a Token-2022 mint moved by the Token program", async () => build([getTransferCheckedInstruction({ source: await ata(AGENT!, PYUSD!), mint: PYUSD!, destination: await ata(TREASURY!, PYUSD!), authority: signer(AGENT!), amount: 1n, decimals: 6 })]), "mint-not-allowed"],
  ["T3", "a program off the allowlist", () => build([raw(DRAINER!, [1, 2, 3])]), "program-not-allowed"],
  ["T3", "an allowlisted swap program the guard cannot read", () => build([raw(SWAP!, [1, 2, 3])]), "opaque-program"],
  ["T19", "a durable-nonce transfer, valid forever", () => build([getAdvanceNonceAccountInstruction({ nonceAccount: NONCE!, nonceAuthority: signer(AGENT!) }), pay(TREASURY!, 1_000n)]), "durable-nonce-denied"],
  ["T19", "WithdrawNonceAccount to the attacker", () => build([getWithdrawNonceAccountInstruction({ nonceAccount: NONCE!, recipientAccount: ATTACKER!, nonceAuthority: signer(AGENT!), withdrawAmount: 1n })]), "durable-nonce-denied"],
  ["T19", "AuthorizeNonceAccount: the nonce handed to the attacker", () => build([getAuthorizeNonceAccountInstruction({ nonceAccount: NONCE!, nonceAuthority: signer(AGENT!), newNonceAuthority: ATTACKER! })]), "durable-nonce-denied"],
  ["T14", "a destination loaded from a table the policy does not pin", () => build([viaTable(UNPINNED!, 0, ATTACKER!)], { version: 0 }), "lookup-table-unpinned"],
  ["T14", "a destination at an index past the pinned prefix", () => build([viaTable(TABLE!, 5, ATTACKER!)], { version: 0 }), "lookup-table-unpinned"],
  ["T14", "a pinned table's entry that is the attacker's address", () => build([viaTable(TABLE!, 1, ATTACKER!)], { version: 0 }), "destination-not-allowed"],
  ["T23", "a compute-unit price with no limit, so the default limit sets the fee", () => build([getSetComputeUnitPriceInstruction({ microLamports: 50_000_000n }), pay(TREASURY!, 1_000n)]), "over-fee-cap"],
  ["T23", "a v1 config's priority fee over the cap", () => build([pay(TREASURY!, 1_000n)], { version: 1, priorityFee: 5_000_000n }), "over-fee-cap"],
  ["T23", "a v1 message with a ComputeBudget decoy beside a large config fee", () => build([getSetComputeUnitPriceInstruction({ microLamports: 1n }), pay(TREASURY!, 1_000n)], { version: 1, priorityFee: 5_000_000n }), "instruction-denied"],
  ["T26", "a counterparty's co-signed instruction alongside the agent's payment", () => build([pay(TREASURY!, 1_000n), pay(TREASURY!, 7n, COUNTERPARTY!)]), "other-signer"],
  ["T22", "an unknown message version", () => {
    const bytes = craftV1();
    bytes[0] = 0x82;
    return bytes;
  }, "unsupported-version"],
  ["T8", "a valid message with bytes hidden after its end", () => Uint8Array.from([...build([pay(TREASURY!, 1_000n)]), ...build([pay(ATTACKER!, 1n)])]), "malformed-proposal"],
];

test(`the drain battery: ${cases.length} shapes, each denied before signing by its named rule`, async () => {
  assert.ok(cases.length >= 30, "the spec asks for at least 30 cases");
  const rows: string[] = [];
  for (const [threat, shape, bytes, rule] of cases) {
    const g = await createGuard({ policy });
    const d = g.check({ message: await bytes(), at: 1_000_000 });
    assert.equal(d.allow, false, `${threat} ${shape}: ALLOWED`);
    assert.equal(d.rule, rule, `${threat} ${shape}: ${d.reason}`);
    rows.push(`${threat.padEnd(4)} ${rule.padEnd(24)} ${shape}`);
  }
  console.log(`  drain battery, ${cases.length} of ${cases.length} denied:\n${rows.map((r) => `    ${r}`).join("\n")}`);
});

test("the drain battery's control: the same policy allows a plain payment to the treasury", async () => {
  // A fresh guard for each: the two pay the same amount to the same place, so on one guard the second
  // would rightly wait for the first (intent-in-flight).
  const d1 = (await createGuard({ policy })).check({ message: build([pay(TREASURY!, 1_000n)]), at: 1_000_000 });
  assert.equal(d1.allow, true, d1.reason);
  const d2 = (await createGuard({ policy })).check({ message: build([viaTable(TABLE!, 0, TREASURY!)], { version: 0 }), at: 1_000_000 });
  assert.equal(d2.allow, true, `a pinned table's treasury entry: ${d2.reason}`);
});
