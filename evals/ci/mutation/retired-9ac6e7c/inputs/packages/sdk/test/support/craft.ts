// Hand-built message bytes, for the shapes no well-behaved encoder will produce: a program at
// index 0, a non-canonical length, an unknown config bit. Written from the wire format itself
// (legacy and v0: Solana's message layout; v1: SIMD-0385 as @solana/kit 8.4.0 encodes it), with
// no Solanaut code, so a decoder bug cannot hide behind a matching encoder bug.

export const shortU16 = (n: number): number[] => {
  const out: number[] = [];
  let v = n;
  for (;;) {
    const b = v & 0x7f;
    v >>= 7;
    if (v === 0) { out.push(b); return out; }
    out.push(b | 0x80);
  }
};

const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const u64 = (n: bigint) => Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

/** A 32-byte key whose every byte is `n`: distinct, readable, and never the System Program's zeros unless n is 0. */
export const key = (n: number): number[] => Array.from({ length: 32 }, () => n);

export interface CraftIx { program: number; accounts: number[]; data: number[] }

export interface CraftLegacy {
  version?: "legacy" | 0;
  header?: [number, number, number];
  keys?: number[][];
  blockhash?: number[];
  instructions?: CraftIx[];
  lookups?: { table: number[]; writable: number[]; readonly: number[] }[];
  /** Replace the account-count prefix with these raw bytes (for non-canonical encodings). */
  rawKeyCount?: number[];
}

/** A valid two-key, one-instruction legacy message unless the caller overrides a field. */
export function craftLegacy(c: CraftLegacy = {}): Uint8Array {
  const keys = c.keys ?? [key(1), key(2)];
  const header = c.header ?? [1, 0, 1];
  const ixs = c.instructions ?? [{ program: 1, accounts: [0], data: [7] }];
  const out: number[] = [];
  if (c.version === 0) out.push(0x80);
  out.push(...header);
  out.push(...(c.rawKeyCount ?? shortU16(keys.length)));
  for (const k of keys) out.push(...k);
  out.push(...(c.blockhash ?? key(9)));
  out.push(...shortU16(ixs.length));
  for (const ix of ixs) {
    out.push(ix.program, ...shortU16(ix.accounts.length), ...ix.accounts, ...shortU16(ix.data.length), ...ix.data);
  }
  if (c.version === 0) {
    const lookups = c.lookups ?? [];
    out.push(...shortU16(lookups.length));
    for (const l of lookups) {
      out.push(...l.table, ...shortU16(l.writable.length), ...l.writable, ...shortU16(l.readonly.length), ...l.readonly);
    }
  }
  return Uint8Array.from(out);
}

export interface CraftV1 {
  header?: [number, number, number];
  mask?: number;
  keys?: number[][];
  blockhash?: number[];
  /** Raw config values, already encoded, in mask order. */
  configBytes?: number[];
  instructions?: CraftIx[];
}

export function craftV1(c: CraftV1 = {}): Uint8Array {
  const keys = c.keys ?? [key(1), key(2)];
  const ixs = c.instructions ?? [{ program: 1, accounts: [0], data: [7] }];
  const out: number[] = [0x81, ...(c.header ?? [1, 0, 1]), ...u32(c.mask ?? 0), ...(c.blockhash ?? key(9))];
  out.push(ixs.length, keys.length);
  for (const k of keys) out.push(...k);
  out.push(...(c.configBytes ?? []));
  for (const ix of ixs) out.push(ix.program, ix.accounts.length, ...u16(ix.data.length));
  for (const ix of ixs) out.push(...ix.accounts, ...ix.data);
  return Uint8Array.from(out);
}

export const enc = { u16, u32, u64 };

/** A lookup table account: the 56-byte meta, then 32 bytes per entry. */
export function craftTableAccount(o: { typeIndex?: number; deactivationSlot?: bigint; authority?: number[] | null; entries: number[][] }): Uint8Array {
  const out: number[] = [...u32(o.typeIndex ?? 1), ...u64(o.deactivationSlot ?? 0xffffffffffffffffn), ...u64(5n), 0];
  if (o.authority) out.push(1, ...o.authority);
  else out.push(0, ...key(0));
  out.push(0, 0); // padding to 56
  for (const e of o.entries) out.push(...e);
  return Uint8Array.from(out);
}
