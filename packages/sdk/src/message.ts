// Message bytes, read without any library in between (ADR-009, docs/SPEC.md §4): legacy, v0 and
// v1. The guard decides on these bytes and nothing the agent says about them.
//
// Strict where the runtime is strict, and stricter where leniency would let two readers see two
// different messages: trailing bytes, a non-canonical length, an unknown v1 config bit, a lookup
// table listed twice. A message this file accepts is one Solana could execute, read one way only.
// Everything it refuses is a DecodeError naming the rule (docs/SPEC.md §5): 1, 2 or 3.

import { encodeBase58 } from "./base58.ts";

export type DecodeRule = "malformed-proposal" | "unsupported-version" | "lookup-table-unpinned";

export class DecodeError extends Error {
  readonly rule: DecodeRule;
  constructor(rule: DecodeRule, message: string) {
    super(message);
    this.name = "DecodeError";
    this.rule = rule;
  }
}

const malformed = (why: string) => new DecodeError("malformed-proposal", why);

export type MessageVersion = "legacy" | 0 | 1;

export interface MessageHeader {
  numRequiredSignatures: number;
  numReadonlySigned: number;
  numReadonlyUnsigned: number;
}

export interface CompiledInstruction {
  programIndex: number;
  accountIndices: number[];
  data: Uint8Array;
}

export interface TableLookup {
  table: string;
  writableIndexes: number[];
  readonlyIndexes: number[];
}

/** v1's config section. An unset field is absent: for limits that means zero, not a default. */
export interface V1Config {
  priorityFeeLamports?: bigint;
  computeUnitLimit?: number;
  loadedAccountsDataSizeLimit?: number;
  heapSize?: number;
}

export interface DecodedMessage {
  version: MessageVersion;
  header: MessageHeader;
  staticAccounts: string[];
  /** The recent blockhash, or a durable nonce's stored value: the bytes do not say which. */
  lifetimeToken: string;
  instructions: CompiledInstruction[];
  /** v0 only; empty otherwise. */
  lookups: TableLookup[];
  /** v1 only; null otherwise. */
  config: V1Config | null;
}

/** A lookup table's address and the prefix of its entries that the policy pins. */
export interface PinnedTable {
  address: string;
  entries: readonly string[];
}

export interface AccountMeta {
  address: string;
  signer: boolean;
  writable: boolean;
  /** Where a v0 account was loaded from; null for a static account. */
  lookup: { table: string; index: number } | null;
}

export interface ResolvedInstruction {
  program: string;
  accounts: AccountMeta[];
  data: Uint8Array;
}

export interface ResolvedMessage {
  message: DecodedMessage;
  /** Static accounts, then every table's writable entries, then every table's read-only entries. */
  accounts: AccountMeta[];
  instructions: ResolvedInstruction[];
}

/** The packet limit for legacy and v0 transactions, signatures included. */
export const MAX_LEGACY_TRANSACTION_BYTES = 1232;
/** The limit for v1 transactions, signatures included (SIMD-0296). */
export const MAX_V1_TRANSACTION_BYTES = 4096;
/** v1 carries every account inline, at most 64 of them (SIMD-0385). */
export const MAX_V1_ACCOUNTS = 64;
/** Account indexes are one byte. */
const MAX_ACCOUNTS = 256;
const V1_KNOWN_CONFIG_BITS = 0b11111;

/** A cursor over bytes that throws on any read past the end, so a short message is malformed, never zero. */
class Reader {
  readonly #b: Uint8Array;
  #o: number;

  constructor(bytes: Uint8Array, offset = 0) {
    this.#b = bytes;
    this.#o = offset;
  }

  get offset() {
    return this.#o;
  }

  #need(n: number, what: string) {
    if (this.#o + n > this.#b.length) throw malformed(`the bytes end inside ${what}, at byte ${this.#o} of ${this.#b.length}`);
  }

  u8(what: string): number {
    this.#need(1, what);
    return this.#b[this.#o++]!;
  }

  u16(what: string): number {
    this.#need(2, what);
    const v = this.#b[this.#o]! | (this.#b[this.#o + 1]! << 8);
    this.#o += 2;
    return v;
  }

  u32(what: string): number {
    this.#need(4, what);
    const b = this.#b, o = this.#o;
    this.#o += 4;
    return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
  }

  u64(what: string): bigint {
    const lo = BigInt(this.u32(what));
    const hi = BigInt(this.u32(what));
    return (hi << 32n) | lo;
  }

  /** Solana's compact-u16: 1 to 3 bytes, 7 bits each. Only the shortest encoding is accepted, as the runtime does. */
  shortU16(what: string): number {
    let value = 0;
    for (let i = 0; i < 3; i++) {
      const byte = this.u8(what);
      value |= (byte & 0x7f) << (7 * i);
      if ((byte & 0x80) === 0) {
        if (byte === 0 && i > 0) throw malformed(`${what} is not in its shortest form`);
        if (value > 0xffff) throw malformed(`${what} overflows 16 bits`);
        return value;
      }
    }
    throw malformed(`${what} runs past 3 bytes`);
  }

  bytes(n: number, what: string): Uint8Array {
    this.#need(n, what);
    const out = this.#b.slice(this.#o, this.#o + n);
    this.#o += n;
    return out;
  }

  address(what: string): string {
    return encodeBase58(this.bytes(32, what));
  }

  u8s(n: number, what: string): number[] {
    this.#need(n, what);
    const out = Array.from(this.#b.subarray(this.#o, this.#o + n));
    this.#o += n;
    return out;
  }
}

function versionOf(first: number): MessageVersion {
  if ((first & 0x80) === 0) return "legacy";
  const v = first & 0x7f;
  if (v === 0 || v === 1) return v;
  throw new DecodeError("unsupported-version", `message version ${v} (first byte 0x${first.toString(16)}) is not legacy, 0 or 1`);
}

function readHeader(r: Reader): MessageHeader {
  return {
    numRequiredSignatures: r.u8("the header"),
    numReadonlySigned: r.u8("the header"),
    numReadonlyUnsigned: r.u8("the header"),
  };
}

function readLegacyOrV0(r: Reader, version: "legacy" | 0): DecodedMessage {
  if (version === 0) r.u8("the version byte");
  const header = readHeader(r);
  const nKeys = r.shortU16("the account count");
  const staticAccounts: string[] = [];
  for (let i = 0; i < nKeys; i++) staticAccounts.push(r.address(`account ${i}`));
  const lifetimeToken = r.address("the blockhash");
  const nIx = r.shortU16("the instruction count");
  const instructions: CompiledInstruction[] = [];
  for (let i = 0; i < nIx; i++) {
    const programIndex = r.u8(`instruction ${i}'s program`);
    const accountIndices = r.u8s(r.shortU16(`instruction ${i}'s account count`), `instruction ${i}'s accounts`);
    const data = r.bytes(r.shortU16(`instruction ${i}'s data length`), `instruction ${i}'s data`);
    instructions.push({ programIndex, accountIndices, data });
  }
  const lookups: TableLookup[] = [];
  if (version === 0) {
    const nLookups = r.shortU16("the lookup count");
    for (let i = 0; i < nLookups; i++) {
      const table = r.address(`lookup ${i}'s table`);
      const writableIndexes = r.u8s(r.shortU16(`lookup ${i}'s writable count`), `lookup ${i}'s writable indexes`);
      const readonlyIndexes = r.u8s(r.shortU16(`lookup ${i}'s read-only count`), `lookup ${i}'s read-only indexes`);
      lookups.push({ table, writableIndexes, readonlyIndexes });
    }
  }
  return { version, header, staticAccounts, lifetimeToken, instructions, lookups, config: null };
}

/** v1, as SIMD-0385 lays it out: fixed fields, accounts, config values in mask order, instruction headers, then payloads. */
function readV1(r: Reader): DecodedMessage {
  r.u8("the version byte");
  const header = readHeader(r);
  const mask = r.u32("the config mask");
  const lifetimeToken = r.address("the lifetime token");
  const nIx = r.u8("the instruction count");
  const nKeys = r.u8("the account count");
  if (nKeys > MAX_V1_ACCOUNTS) throw malformed(`a v1 message holds at most ${MAX_V1_ACCOUNTS} accounts; this one declares ${nKeys}`);
  const staticAccounts: string[] = [];
  for (let i = 0; i < nKeys; i++) staticAccounts.push(r.address(`account ${i}`));

  if ((mask & ~V1_KNOWN_CONFIG_BITS) !== 0) {
    throw malformed(`the config mask 0x${mask.toString(16)} sets bits this decoder does not know, so it cannot find where the config ends`);
  }
  const fee = mask & 0b11;
  if (fee === 0b01 || fee === 0b10) throw malformed("the config mask sets one of the two priority-fee bits without the other");
  const config: V1Config = {};
  if (fee === 0b11) config.priorityFeeLamports = r.u64("the priority fee");
  if (mask & 0b100) config.computeUnitLimit = r.u32("the compute-unit limit");
  if (mask & 0b1000) config.loadedAccountsDataSizeLimit = r.u32("the loaded-accounts data limit");
  if (mask & 0b10000) config.heapSize = r.u32("the heap size");

  const heads: { programIndex: number; nAccounts: number; nData: number }[] = [];
  for (let i = 0; i < nIx; i++) {
    heads.push({
      programIndex: r.u8(`instruction ${i}'s header`),
      nAccounts: r.u8(`instruction ${i}'s header`),
      nData: r.u16(`instruction ${i}'s header`),
    });
  }
  const instructions = heads.map((h, i) => ({
    programIndex: h.programIndex,
    accountIndices: r.u8s(h.nAccounts, `instruction ${i}'s accounts`),
    data: r.bytes(h.nData, `instruction ${i}'s data`),
  }));
  return { version: 1, header, staticAccounts, lifetimeToken, instructions, lookups: [], config };
}

/** The checks the runtime's sanitizer makes, plus the stricter ones this file's header names. */
function sanitize(m: DecodedMessage): void {
  const { numRequiredSignatures: req, numReadonlySigned: roSigned, numReadonlyUnsigned: roUnsigned } = m.header;
  const nStatic = m.staticAccounts.length;
  if (req === 0) throw malformed("the header requires no signature, so there is no fee payer");
  if (roSigned >= req) throw malformed("the header makes every signer read-only, the fee payer included");
  if (req + roUnsigned > nStatic) throw malformed(`the header counts ${req} signers and ${roUnsigned} read-only accounts, but the message lists ${nStatic} accounts`);
  if (new Set(m.staticAccounts).size !== nStatic) throw malformed("an account is listed twice");

  const tables = new Set<string>();
  let loaded = 0;
  for (const l of m.lookups) {
    if (l.writableIndexes.length + l.readonlyIndexes.length === 0) throw malformed(`lookup table ${l.table} loads no account`);
    if (tables.has(l.table)) throw malformed(`lookup table ${l.table} is listed twice`);
    tables.add(l.table);
    loaded += l.writableIndexes.length + l.readonlyIndexes.length;
  }
  const total = nStatic + loaded;
  if (total > MAX_ACCOUNTS) throw malformed(`the message loads ${total} accounts; one-byte indexes reach ${MAX_ACCOUNTS}`);

  m.instructions.forEach((ix, i) => {
    if (ix.programIndex === 0) throw malformed(`instruction ${i} names the fee payer as its program`);
    if (ix.programIndex >= nStatic) throw malformed(`instruction ${i}'s program index ${ix.programIndex} is not a static account`);
    for (const a of ix.accountIndices) {
      if (a >= total) throw malformed(`instruction ${i}'s account index ${a} is past the ${total} accounts`);
    }
  });
}

function checkSize(m: DecodedMessage, messageBytes: number): void {
  const sigs = m.header.numRequiredSignatures;
  const size = m.version === 1 ? messageBytes + 64 * sigs : (sigs < 0x80 ? 1 : 2) + 64 * sigs + messageBytes;
  const max = m.version === 1 ? MAX_V1_TRANSACTION_BYTES : MAX_LEGACY_TRANSACTION_BYTES;
  if (size > max) throw malformed(`signed, this transaction would be ${size} bytes; a ${m.version === 1 ? "v1" : "legacy or v0"} transaction holds at most ${max}`);
}

function read(bytes: Uint8Array, offset: number): { message: DecodedMessage; end: number } {
  if (!(bytes instanceof Uint8Array)) throw malformed("the message is not a Uint8Array");
  if (offset >= bytes.length) throw malformed("the message is empty");
  const version = versionOf(bytes[offset]!);
  const r = new Reader(bytes, offset);
  const message = version === 1 ? readV1(r) : readLegacyOrV0(r, version);
  sanitize(message);
  return { message, end: r.offset };
}

/** Read one message, exactly: every byte belongs to it. */
export function decodeMessage(bytes: Uint8Array): DecodedMessage {
  const { message, end } = read(bytes, 0);
  if (end !== bytes.length) throw malformed(`${bytes.length - end} bytes follow the end of the message`);
  checkSize(message, bytes.length);
  return message;
}

/**
 * Every account the message's instructions touch, with its role. A v0 message's table entries
 * come only from `pins`, never from a chain read the agent could influence (ADR-009): a table
 * that is not pinned, or an index at or past its pinned prefix, is refused.
 */
export function resolveMessage(m: DecodedMessage, pins: readonly PinnedTable[]): ResolvedMessage {
  const { numRequiredSignatures: req, numReadonlySigned: roSigned, numReadonlyUnsigned: roUnsigned } = m.header;
  const nStatic = m.staticAccounts.length;
  const accounts: AccountMeta[] = m.staticAccounts.map((address, i) => {
    const signer = i < req;
    return { address, signer, writable: signer ? i < req - roSigned : i < nStatic - roUnsigned, lookup: null };
  });

  const byAddress = new Map(pins.map((p) => [p.address, p]));
  const writable: AccountMeta[] = [];
  const readonly: AccountMeta[] = [];
  for (const l of m.lookups) {
    const pin = byAddress.get(l.table);
    if (!pin) throw new DecodeError("lookup-table-unpinned", `lookup table ${l.table} is not pinned in the policy`);
    const load = (index: number, isWritable: boolean) => {
      const address = pin.entries[index];
      if (address === undefined) {
        throw new DecodeError("lookup-table-unpinned", `index ${index} of lookup table ${l.table} is past its ${pin.entries.length} pinned entries`);
      }
      (isWritable ? writable : readonly).push({ address, signer: false, writable: isWritable, lookup: { table: l.table, index } });
    };
    for (const i of l.writableIndexes) load(i, true);
    for (const i of l.readonlyIndexes) load(i, false);
  }
  accounts.push(...writable, ...readonly);

  const seen = new Set<string>();
  for (const a of accounts) {
    if (seen.has(a.address)) throw malformed(`account ${a.address} is loaded twice`);
    seen.add(a.address);
  }

  const instructions = m.instructions.map((ix) => ({
    program: accounts[ix.programIndex]!.address,
    accounts: ix.accountIndices.map((i) => accounts[i]!),
    data: ix.data,
  }));
  return { message: m, accounts, instructions };
}

/**
 * Split a wire transaction into the message its signatures cover and the signatures. Legacy and
 * v0 put a compact count of signatures first; v1 puts the message first and exactly one 64-byte
 * signature per required signer after it.
 */
export function decodeTransaction(wire: Uint8Array): { message: Uint8Array; signatures: Uint8Array[] } {
  if (!(wire instanceof Uint8Array) || wire.length === 0) throw malformed("the transaction is empty");
  const first = wire[0]!;
  if (first & 0x80) {
    const version = versionOf(first);
    if (version === 0) throw malformed("a v0 transaction puts its signatures first; these bytes start with a message");
    const { message, end } = read(wire, 0);
    const n = message.header.numRequiredSignatures;
    if (wire.length - end !== 64 * n) {
      throw malformed(`a v1 message requiring ${n} signatures must be followed by ${64 * n} bytes, not ${wire.length - end}`);
    }
    const messageBytes = wire.slice(0, end);
    checkSize(message, messageBytes.length);
    return { message: messageBytes, signatures: Array.from({ length: n }, (_, i) => wire.slice(end + 64 * i, end + 64 * (i + 1))) };
  }
  const r = new Reader(wire);
  const n = r.shortU16("the signature count");
  const signatures = Array.from({ length: n }, (_, i) => r.bytes(64, `signature ${i}`));
  const messageBytes = wire.slice(r.offset);
  const message = decodeMessage(messageBytes);
  if (message.version === 1) throw malformed("a v1 message is never preceded by its signatures");
  if (message.header.numRequiredSignatures !== n) {
    throw malformed(`the transaction carries ${n} signatures, but its message requires ${message.header.numRequiredSignatures}`);
  }
  return { message: messageBytes, signatures };
}
