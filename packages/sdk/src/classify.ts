// What a message does, derived from its bytes alone (docs/SPEC.md §3 and §4, ADR-009). Every
// instruction of a decoded program is in exactly one class:
//
//   value-moving   its destination and amount are counted, and checked by the policy
//   benign         it moves nothing and grants nothing
//   denied         it grants authority, uses a durable nonce, or is not on the list at all
//
// Programs the guard does not decode are listed as opaque, and the policy decides about them as a
// whole. This file decides nothing: it reports. The rules in their order are applied at admission.

import { decodeMessage, resolveMessage, type AccountMeta, type PinnedTable, type ResolvedMessage } from "./message.ts";
import { associatedTokenAddress } from "./pda.ts";
import { canonicalJSON, sha256hex } from "./canonical.ts";

export const PROGRAMS = {
  system: "11111111111111111111111111111111",
  token: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  token2022: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  computeBudget: "ComputeBudget111111111111111111111111111111",
  memo: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  memoV1: "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
  associatedToken: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
} as const;

/** The programs whose instructions this file reads. Any other program is opaque. */
export const DECODED_PROGRAMS: ReadonlySet<string> = new Set([
  PROGRAMS.system,
  PROGRAMS.token,
  PROGRAMS.token2022,
  PROGRAMS.computeBudget,
  PROGRAMS.memo,
  PROGRAMS.memoV1,
]);

/** Signature-verification programs: each signature they check costs a base fee too. */
const PRECOMPILES = new Set([
  "Ed25519SigVerify111111111111111111111111111",
  "KeccakSecp256k11111111111111111111111111111",
  "Secp256r1SigVerify1111111111111111111111111",
]);

/**
 * The runtime's default compute-unit limit, when a legacy or v0 message sets none: 3,000 per
 * builtin instruction and 200,000 per other instruction, capped at 1,400,000. Only System and
 * ComputeBudget are counted as builtins here; treating any other program as a 200,000-unit
 * program can only over-estimate the priority fee, so the fee cap errs toward denying.
 */
const BUILTIN_UNITS = 3_000;
const DEFAULT_UNITS = 200_000;
const MAX_UNITS = 1_400_000;
const BASE_FEE_PER_SIGNATURE = 5_000n;

export interface ClassifyContext {
  /** The guarded keys. */
  principal: readonly string[];
  /** Owners that may receive SOL or tokens. Used here only to name a token account's owner. */
  destinations: readonly string[];
  /** Listed mints. Used here only to infer the mint of a plain Transfer from the principal's account. */
  tokens: readonly { mint: string; program: "token" | "token-2022" }[];
  /** SOL sent here is a tip, counted with fees. */
  tipAccounts: readonly string[];
  lookupTables: readonly PinnedTable[];
}

export interface SolOutflow {
  from: string;
  to: string;
  lamports: bigint;
  kind: "transfer" | "new-account";
}

export interface TokenOutflow {
  program: "token" | "token-2022";
  /** Named by TransferChecked; inferred for Transfer from the principal's associated account; else null. */
  mint: string | null;
  fromAccount: string;
  authority: string;
  toAccount: string;
  /** The allowed owner whose associated account `toAccount` is, if any. */
  toOwner: string | null;
  amount: bigint;
  decimals: number | null;
}

export interface DeniedInstruction {
  index: number;
  program: string;
  /** "System.Assign", "Token.Approve", "ComputeBudget.SetComputeUnitPrice", "System.unknown(14)". */
  instruction: string;
  rule: "instruction-denied" | "durable-nonce-denied";
  reason: string;
}

export interface EffectsV1 {
  version: "legacy" | 0 | 1;
  /** SHA-256 of the message bytes, hex: what a receipt binds. */
  messageHash: string;
  feePayer: string;
  /** Every required signer, in message order. */
  signers: string[];
  /** Required signers outside the principal: rule 6 denies while co-signing is off. */
  otherSigners: string[];
  /** Every program called, in order of first call. */
  programs: string[];
  /** Called programs this file does not decode. */
  opaque: string[];
  sol: SolOutflow[];
  tokens: TokenOutflow[];
  denied: DeniedInstruction[];
  /** The first instruction advances a durable nonce. */
  nonce: boolean;
  computeUnitLimit: number;
  priorityFee: bigint;
  baseFee: bigint;
  tips: bigint;
  /** SHA-256 of the canonical effects without fees, version, blockhash or memos: "the same payment". */
  intentKey: string;
}

export type InstructionClass = "value-moving" | "benign" | "denied" | "opaque";

const SYSTEM_NAMES = [
  "CreateAccount",
  "Assign",
  "Transfer",
  "CreateAccountWithSeed",
  "AdvanceNonceAccount",
  "WithdrawNonceAccount",
  "InitializeNonceAccount",
  "AuthorizeNonceAccount",
  "Allocate",
  "AllocateWithSeed",
  "AssignWithSeed",
  "TransferWithSeed",
  "UpgradeNonceAccount",
  "CreateAccountAllowPrefund",
];
const SYSTEM_MOVING = new Set([
  "Transfer",
  "TransferWithSeed",
  "CreateAccount",
  "CreateAccountWithSeed",
  "CreateAccountAllowPrefund",
]);
const NONCE = new Set([
  "AdvanceNonceAccount",
  "WithdrawNonceAccount",
  "InitializeNonceAccount",
  "AuthorizeNonceAccount",
  "UpgradeNonceAccount",
]);

// SPL Token's instructions 0 to 24 are shared with Token-2022. 38, 45 and 255 are p-token's
// additions (SIMD-0266) to the Token program: all three are denied by not being listed.
const TOKEN_NAMES = [
  "InitializeMint",
  "InitializeAccount",
  "InitializeMultisig",
  "Transfer",
  "Approve",
  "Revoke",
  "SetAuthority",
  "MintTo",
  "Burn",
  "CloseAccount",
  "FreezeAccount",
  "ThawAccount",
  "TransferChecked",
  "ApproveChecked",
  "MintToChecked",
  "BurnChecked",
  "InitializeAccount2",
  "SyncNative",
  "InitializeAccount3",
  "InitializeMultisig2",
  "InitializeMint2",
  "GetAccountDataSize",
  "InitializeImmutableOwner",
  "AmountToUiAmount",
  "UiAmountToAmount",
];
// Token-2022's instruction 26 is its transfer-fee extension, and the second byte names which of these it is.
// Only TransferCheckedWithFee moves value; the others configure, withdraw or harvest fees, and are denied.
const TRANSFER_FEE_NAMES = [
  "InitializeTransferFeeConfig",
  "TransferCheckedWithFee",
  "WithdrawWithheldTokensFromMint",
  "WithdrawWithheldTokensFromAccounts",
  "HarvestWithheldTokensToMint",
  "SetTransferFee",
];
const TOKEN_EXTRA: Record<number, string> = { 38: "WithdrawExcessLamports", 45: "UnwrapLamports", 255: "Batch" };
const TOKEN_MOVING = new Set(["Transfer", "TransferChecked"]);
const TOKEN_BENIGN = new Set(["Revoke", "SyncNative", "InitializeAccount", "InitializeAccount2", "InitializeAccount3"]);

const COMPUTE_NAMES = [
  "RequestUnits",
  "RequestHeapFrame",
  "SetComputeUnitLimit",
  "SetComputeUnitPrice",
  "SetLoadedAccountsDataSizeLimit",
];
const COMPUTE_BENIGN = new Set([
  "RequestHeapFrame",
  "SetComputeUnitLimit",
  "SetComputeUnitPrice",
  "SetLoadedAccountsDataSizeLimit",
]);

/** An instruction's name and class, from its program and the discriminator at the start of its data. */
export function classifyInstruction(program: string, data: Uint8Array): { name: string; class: InstructionClass } {
  switch (program) {
    case PROGRAMS.system: {
      if (data.length < 4) return { name: "unknown", class: "denied" };
      const discriminator = readU32(data, 0);
      const name = SYSTEM_NAMES[discriminator] ?? `unknown(${discriminator})`;
      return { name, class: SYSTEM_MOVING.has(name) ? "value-moving" : "denied" };
    }
    case PROGRAMS.token:
    case PROGRAMS.token2022: {
      if (data.length < 1) return { name: "unknown", class: "denied" };
      const discriminator = data[0]!;
      if (program === PROGRAMS.token2022 && discriminator === 26) return transferFeeInstruction(data);
      const name =
        TOKEN_NAMES[discriminator] ??
        (program === PROGRAMS.token ? TOKEN_EXTRA[discriminator] : undefined) ??
        `unknown(${discriminator})`;
      return { name, class: tokenClass(name) };
    }
    case PROGRAMS.computeBudget: {
      if (data.length < 1) return { name: "unknown", class: "denied" };
      const name = COMPUTE_NAMES[data[0]!] ?? `unknown(${data[0]})`;
      return { name, class: COMPUTE_BENIGN.has(name) ? "benign" : "denied" };
    }
    case PROGRAMS.memo:
    case PROGRAMS.memoV1:
      return { name: "Memo", class: "benign" };
    default:
      return { name: "opaque", class: "opaque" };
  }
}

/** Token-2022's transfer-fee extension: its second byte names the sub-instruction, and only one of them moves value. */
function transferFeeInstruction(data: Uint8Array): { name: string; class: InstructionClass } {
  const name = data.length < 2 ? "unknown(26)" : (TRANSFER_FEE_NAMES[data[1]!] ?? `unknown(26.${data[1]})`);
  return { name, class: name === "TransferCheckedWithFee" ? "value-moving" : "denied" };
}

function tokenClass(name: string): InstructionClass {
  if (TOKEN_MOVING.has(name)) return "value-moving";
  if (TOKEN_BENIGN.has(name)) return "benign";
  return "denied";
}

const LABEL: Record<string, string> = {
  [PROGRAMS.system]: "System",
  [PROGRAMS.token]: "Token",
  [PROGRAMS.token2022]: "Token-2022",
  [PROGRAMS.computeBudget]: "ComputeBudget",
};

/** Decode, resolve against the pinned tables, and classify. Throws a DecodeError for rules 1 to 3. */
export function effectsOf(message: Uint8Array, ctx: ClassifyContext): EffectsV1 {
  const resolved = resolveMessage(decodeMessage(message), ctx.lookupTables);
  return classify(resolved, ctx, sha256hex(message));
}

export function classify(resolved: ResolvedMessage, ctx: ClassifyContext, messageHash: string): EffectsV1 {
  const message = resolved.message;
  const principal = new Set(ctx.principal);
  const tips = new Set(ctx.tipAccounts);
  const sol: SolOutflow[] = [];
  const tokens: TokenOutflow[] = [];
  const denied: DeniedInstruction[] = [];
  const programs: string[] = [];
  const computeSeen = new Set<string>();
  let explicitLimit: number | null = null;
  let price = 0n;
  let defaultUnits = 0;
  let precompileSignatures = 0;

  for (const [index, instruction] of resolved.instructions.entries()) {
    const { program, data, accounts } = instruction;
    if (!programs.includes(program)) programs.push(program);
    const { name, class: instructionClass } = classifyInstruction(program, data);
    const deny = (reason: string, rule: DeniedInstruction["rule"] = "instruction-denied") => {
      denied.push({ index, program, instruction: `${LABEL[program]}.${name}`, rule, reason });
    };

    defaultUnits += program === PROGRAMS.system || program === PROGRAMS.computeBudget ? BUILTIN_UNITS : DEFAULT_UNITS;
    if (PRECOMPILES.has(program) && data.length > 0) precompileSignatures += data[0]!;

    if (program === PROGRAMS.system) {
      if (NONCE.has(name)) {
        deny(
          `${name} is a durable-nonce instruction; nonce transactions never expire, so intents cannot reason about them`,
          "durable-nonce-denied",
        );
        continue;
      }
      if (instructionClass === "denied") {
        deny(
          name.startsWith("unknown")
            ? "not a System instruction this guard knows"
            : `${name} hands an account to another program`,
        );
        continue;
      }
      const outflow = systemOutflow(name, data, accounts, principal);
      if (typeof outflow === "string") deny(outflow);
      else if (outflow) sol.push(outflow);
      continue;
    }
    if (program === PROGRAMS.token || program === PROGRAMS.token2022) {
      if (instructionClass === "denied") {
        deny(
          name.startsWith("unknown")
            ? "not on the instruction allowlist"
            : `${name} grants authority or destroys value, and is never signed`,
        );
        continue;
      }
      if (instructionClass === "benign") continue;
      const outflow = tokenOutflow(name, program === PROGRAMS.token ? "token" : "token-2022", data, accounts, ctx);
      if (typeof outflow === "string") deny(outflow);
      else tokens.push(outflow);
      continue;
    }
    if (program === PROGRAMS.computeBudget) {
      if (message.version === 1) {
        deny(
          "a v1 message takes its compute budget from its config; a ComputeBudget instruction in it runs as a no-op and would mislead any reader",
        );
        continue;
      }
      if (instructionClass === "denied") {
        deny(
          name === "RequestUnits" ? "RequestUnits is deprecated" : "not a ComputeBudget instruction this guard knows",
        );
        continue;
      }
      const size = name === "SetComputeUnitPrice" ? 9 : 5;
      if (data.length !== size) {
        deny(`${name} takes ${size} bytes of data, not ${data.length}`);
        continue;
      }
      if (computeSeen.has(name)) {
        deny(`a second ${name}: the runtime refuses the transaction, and the fee would be ambiguous`);
        continue;
      }
      computeSeen.add(name);
      if (name === "SetComputeUnitLimit") explicitLimit = readU32(data, 1);
      if (name === "SetComputeUnitPrice") price = readU64(data, 1);
      continue;
    }
    // Memo is benign; any other program is opaque, decided by the policy as a whole.
  }

  let computeUnitLimit: number;
  let priorityFee: bigint;
  if (message.version === 1) {
    computeUnitLimit = message.config?.computeUnitLimit ?? 0;
    priorityFee = message.config?.priorityFeeLamports ?? 0n;
  } else {
    computeUnitLimit = Math.min(explicitLimit ?? defaultUnits, MAX_UNITS);
    priorityFee = (price * BigInt(computeUnitLimit) + 999_999n) / 1_000_000n;
  }

  let tipTotal = 0n;
  const payments = sol.filter((outflow) => {
    if (!tips.has(outflow.to)) return true;
    tipTotal += outflow.lamports;
    return false;
  });

  const signers = resolved.accounts.filter((account) => account.signer).map((account) => account.address);
  const opaque = programs.filter((program) => !DECODED_PROGRAMS.has(program));
  const first = resolved.instructions[0];
  const nonce =
    first !== undefined &&
    first.program === PROGRAMS.system &&
    classifyInstruction(first.program, first.data).name === "AdvanceNonceAccount";

  const sorted = (values: unknown[]) => values.map(canonicalJSON).sort();
  const intentKey = sha256hex(
    canonicalJSON({
      feePayer: resolved.accounts[0]!.address,
      signers: [...signers].sort(),
      opaque: [...opaque].sort(),
      sol: sorted(payments),
      tokens: sorted(tokens),
      nonce,
    }),
  );

  return {
    version: message.version,
    messageHash,
    feePayer: resolved.accounts[0]!.address,
    signers,
    otherSigners: signers.filter((signer) => !principal.has(signer)),
    programs,
    opaque,
    sol: payments,
    tokens,
    denied,
    nonce,
    computeUnitLimit,
    priorityFee,
    baseFee: BASE_FEE_PER_SIGNATURE * BigInt(message.header.numRequiredSignatures + precompileSignatures),
    tips: tipTotal,
    intentKey,
  };
}

/** A value-moving System instruction's outflow, null if it moves nothing, or why it is denied. */
function systemOutflow(
  name: string,
  data: Uint8Array,
  accounts: AccountMeta[],
  principal: Set<string>,
): SolOutflow | null | string {
  const mismatch = `data or accounts do not match ${name}'s layout`;
  switch (name) {
    case "Transfer":
      if (data.length !== 12 || accounts.length < 2) return mismatch;
      return { from: accounts[0]!.address, to: accounts[1]!.address, lamports: readU64(data, 4), kind: "transfer" };
    case "TransferWithSeed": {
      // u32 11, u64 lamports, seed (u64 length, bytes), owner pubkey; accounts: from, base, to.
      if (data.length < 20 || accounts.length < 3) return mismatch;
      const seedLength = readU64(data, 12);
      if (BigInt(data.length) !== 20n + seedLength + 32n) return mismatch;
      return { from: accounts[0]!.address, to: accounts[2]!.address, lamports: readU64(data, 4), kind: "transfer" };
    }
    case "CreateAccount":
      // u32 0, u64 lamports, u64 space, owner pubkey; accounts: from, new.
      if (data.length !== 52 || accounts.length < 2) return mismatch;
      return { from: accounts[0]!.address, to: accounts[1]!.address, lamports: readU64(data, 4), kind: "new-account" };
    case "CreateAccountWithSeed": {
      // u32 3, base pubkey, seed (u64 length, bytes), u64 lamports, u64 space, owner pubkey; accounts: from, new[, base].
      if (data.length < 44 || accounts.length < 2) return mismatch;
      const seedLength = readU64(data, 36);
      if (BigInt(data.length) !== 44n + seedLength + 48n) return mismatch;
      const lamportsAt = 44 + Number(seedLength);
      return {
        from: accounts[0]!.address,
        to: accounts[1]!.address,
        lamports: readU64(data, lamportsAt),
        kind: "new-account",
      };
    }
    case "CreateAccountAllowPrefund": {
      // SIMD-0312: u32 13, u64 lamports, u64 space, owner pubkey; accounts: new, then the funder if lamports > 0.
      if (data.length !== 52 || accounts.length < 1) return mismatch;
      if (principal.has(accounts[0]!.address)) {
        return "CreateAccountAllowPrefund would assign a principal account, with its lamports, to another program";
      }
      const lamports = readU64(data, 4);
      if (lamports === 0n) return null;
      if (accounts.length < 2) return "CreateAccountAllowPrefund moves lamports but names no funding account";
      return { from: accounts[1]!.address, to: accounts[0]!.address, lamports, kind: "new-account" };
    }
  }
  return mismatch;
}

/** A token transfer's outflow, or why it is denied. A plain Transfer's mint is inferred from the principal's associated account. */
function tokenOutflow(
  name: string,
  program: "token" | "token-2022",
  data: Uint8Array,
  accounts: AccountMeta[],
  ctx: ClassifyContext,
): TokenOutflow | string {
  // Transfer: u8 3, u64 amount; accounts: source, destination, authority.
  // TransferChecked: u8 12, u64 amount, u8 decimals; accounts: source, mint, destination, authority.
  // TransferCheckedWithFee (Token-2022): u8 26, u8 1, u64 amount, u8 decimals, u64 fee; accounts as TransferChecked.
  // The amount counted is the gross amount, which is what leaves the source.
  const feeChecked = name === "TransferCheckedWithFee";
  const checked = feeChecked || name === "TransferChecked";
  const amountAt = feeChecked ? 2 : 1;
  const dataLength = feeChecked ? 19 : checked ? 10 : 9;
  if (data.length !== dataLength || accounts.length < (checked ? 4 : 3))
    return `data or accounts do not match ${name}'s layout`;
  const source = accounts[0]!.address;
  const toAccount = accounts[checked ? 2 : 1]!.address;
  const authority = accounts[checked ? 3 : 2]!;
  if (!authority.signer)
    return `the transfer's authority ${authority.address} does not sign: a multisig authority is not supported`;

  let mint: string | null = checked ? accounts[1]!.address : null;
  if (!mint) {
    for (const owner of ctx.principal) {
      const listed = ctx.tokens.find(
        (token) => token.program === program && associatedTokenAddress(owner, token.mint, program) === source,
      );
      if (listed) {
        mint = listed.mint;
        break;
      }
    }
  }
  const toOwner =
    mint === null
      ? null
      : (ctx.destinations.find((destination) => associatedTokenAddress(destination, mint!, program) === toAccount) ??
        null);
  return {
    program,
    mint,
    fromAccount: source,
    authority: authority.address,
    toAccount,
    toOwner,
    amount: readU64(data, amountAt),
    decimals: checked ? data[amountAt + 8]! : null,
  };
}

function readU32(data: Uint8Array, offset: number) {
  return (data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16) | (data[offset + 3]! << 24)) >>> 0;
}

function readU64(data: Uint8Array, offset: number) {
  return BigInt(readU32(data, offset)) | (BigInt(readU32(data, offset + 4)) << 32n);
}
