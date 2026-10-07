// Messages built by @solana/kit, the reference the decoder is checked against. Every message is
// generated from a seed, so a failing case names a seed that reproduces it. Nothing here uses
// Solanaut's own decoder or base58: the reference must not share code with what it checks.

import {
  AccountRole,
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  compressTransactionMessageUsingAddressLookupTables,
  createTransactionMessage,
  decompileTransactionMessage,
  getAddressDecoder,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  setTransactionMessageComputeUnitLimit,
  setTransactionMessageFeePayer,
  setTransactionMessageHeapSize,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessageLoadedAccountsDataSizeLimit,
  setTransactionMessagePriorityFeeLamports,
  type Address,
  type Blockhash,
} from "@solana/kit";

/** mulberry32: small, fast, and the same on every machine. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const bytes = (n: number) => Uint8Array.from({ length: n }, () => int(0, 255));
  const pick = <T>(xs: readonly T[]): T => xs[int(0, xs.length - 1)]!;
  return { next, int, bytes, pick };
}
export type Rng = ReturnType<typeof rng>;

const addressDecoder = getAddressDecoder();
export const kitAddress = (bytes: Uint8Array): Address => addressDecoder.decode(bytes);
export const randomAddress = (r: Rng): Address => kitAddress(r.bytes(32));

export type Version = "legacy" | 0 | 1;

export interface Built {
  seed: number;
  version: Version;
  bytes: Uint8Array;
  /** The lookup tables the message was compressed against (v0 only), as pins. */
  tables: { address: string; entries: string[] }[];
  /** What kit set in the v1 config, if anything. */
  config: { priorityFeeLamports?: bigint; computeUnitLimit?: number; loadedAccountsDataSizeLimit?: number; heapSize?: number };
}

/**
 * One random message. Programs and accounts are disjoint sets, as on chain: a program is never
 * also an instruction account here, which keeps kit's compiler on its documented path.
 */
export function buildMessage(seed: number, version: Version): Built {
  const r = rng(seed);
  const payer = randomAddress(r);
  const signers = Array.from({ length: r.int(0, 2) }, () => randomAddress(r));
  const others = Array.from({ length: r.int(1, version === 1 ? 12 : 10) }, () => randomAddress(r));
  const programs = Array.from({ length: r.int(1, 3) }, () => randomAddress(r));

  const instructions = Array.from({ length: r.int(1, 5) }, () => {
    const accounts = Array.from({ length: r.int(0, 5) }, () => {
      if (signers.length && r.next() < 0.25) {
        return { address: r.pick(signers), role: r.pick([AccountRole.READONLY_SIGNER, AccountRole.WRITABLE_SIGNER]) };
      }
      return { address: r.pick(others), role: r.pick([AccountRole.READONLY, AccountRole.WRITABLE]) };
    });
    return { programAddress: r.pick(programs), accounts, data: r.bytes(r.int(0, 40)) };
  });

  let msg: any = createTransactionMessage({ version });
  msg = setTransactionMessageFeePayer(payer, msg);
  msg = setTransactionMessageLifetimeUsingBlockhash(
    { blockhash: kitAddress(r.bytes(32)) as unknown as Blockhash, lastValidBlockHeight: 1000n },
    msg,
  );
  msg = appendTransactionMessageInstructions(instructions, msg);

  const config: Built["config"] = {};
  if (version === 1) {
    if (r.next() < 0.6) { config.priorityFeeLamports = BigInt(r.int(0, 2_000_000)); msg = setTransactionMessagePriorityFeeLamports(config.priorityFeeLamports, msg); }
    if (r.next() < 0.6) { config.computeUnitLimit = r.int(0, 1_400_000); msg = setTransactionMessageComputeUnitLimit(config.computeUnitLimit, msg); }
    if (r.next() < 0.4) { config.loadedAccountsDataSizeLimit = r.int(0, 64 * 1024 * 1024); msg = setTransactionMessageLoadedAccountsDataSizeLimit(config.loadedAccountsDataSizeLimit, msg); }
    if (r.next() < 0.3) { config.heapSize = 1024 * r.int(32, 256); msg = setTransactionMessageHeapSize(config.heapSize, msg); }
  }

  const tables: Built["tables"] = [];
  if (version === 0) {
    // Two tables, each holding some of the non-signer accounts among unrelated entries.
    const lookup: Record<string, Address[]> = {};
    for (let t = 0; t < 2; t++) {
      const table = randomAddress(r);
      const entries = [...Array.from({ length: r.int(0, 4) }, () => randomAddress(r)), ...others.filter(() => r.next() < 0.5)];
      lookup[table] = entries;
      tables.push({ address: table, entries: [...entries] });
    }
    msg = compressTransactionMessageUsingAddressLookupTables(msg, lookup as any);
  }

  const compiled = compileTransactionMessage(msg);
  const bytes = new Uint8Array(getCompiledTransactionMessageEncoder().encode(compiled as any));
  return { seed, version, bytes, tables, config };
}

/** kit's own reading of message bytes, in the decoder's shape. */
export function kitDecode(bytes: Uint8Array) {
  const c: any = getCompiledTransactionMessageDecoder().decode(bytes);
  const header = {
    numRequiredSignatures: c.header.numSignerAccounts,
    numReadonlySigned: c.header.numReadonlySignerAccounts,
    numReadonlyUnsigned: c.header.numReadonlyNonSignerAccounts,
  };
  const instructions =
    c.version === 1
      ? c.instructionHeaders.map((h: any, i: number) => ({
          programIndex: h.programAccountIndex,
          accountIndices: [...c.instructionPayloads[i].instructionAccountIndices],
          data: [...c.instructionPayloads[i].instructionData],
        }))
      : c.instructions.map((ix: any) => ({
          programIndex: ix.programAddressIndex,
          accountIndices: [...(ix.accountIndices ?? [])],
          data: [...(ix.data ?? [])],
        }));
  const lookups = (c.addressTableLookups ?? []).map((l: any) => ({
    table: l.lookupTableAddress as string,
    writableIndexes: [...l.writableIndexes],
    readonlyIndexes: [...l.readonlyIndexes],
  }));
  let config: Built["config"] | null = null;
  if (c.version === 1) {
    config = {};
    const values = [...c.configValues];
    if ((c.configMask & 0b11) === 0b11) config.priorityFeeLamports = values.shift().value;
    if (c.configMask & 0b100) config.computeUnitLimit = values.shift().value;
    if (c.configMask & 0b1000) config.loadedAccountsDataSizeLimit = values.shift().value;
    if (c.configMask & 0b10000) config.heapSize = values.shift().value;
  }
  return {
    version: c.version as Version,
    header,
    staticAccounts: [...c.staticAccounts] as string[],
    lifetimeToken: c.lifetimeToken as string,
    instructions,
    lookups,
    config,
  };
}

/** kit's resolution of every instruction's accounts, given the tables' contents. */
export function kitResolve(bytes: Uint8Array, tables: { address: string; entries: string[] }[]) {
  const compiled: any = getCompiledTransactionMessageDecoder().decode(bytes);
  const addressesByLookupTableAddress = Object.fromEntries(tables.map((t) => [t.address, t.entries]));
  const m: any = decompileTransactionMessage(compiled, { addressesByLookupTableAddress } as any);
  return m.instructions.map((ix: any) => ({
    program: ix.programAddress as string,
    accounts: (ix.accounts ?? []).map((a: any) => ({
      address: a.address as string,
      signer: (a.role & 0b10) !== 0,
      writable: (a.role & 0b01) !== 0,
    })),
    data: [...(ix.data ?? [])],
  }));
}
