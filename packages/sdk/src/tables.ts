// Address lookup table accounts, read from their bytes, so an operator can pin a table's entries
// in the policy (ADR-009). A pin is the table's address and a prefix of its entries: tables are
// append-only and a closed table's address cannot be re-created, so a pinned prefix stays true
// (kb/sources/2026-09-30_anza-lookup-table-properties.md).
//
// Layout, from the address-lookup-table program: a 56-byte meta (u32 type, which is 1 for an
// initialized table; u64 deactivation slot; u64 last-extended slot; u8 start index; an optional
// 32-byte authority; padding), then 32 bytes per entry.

import { encodeBase58, isAddress } from "./base58.ts";
import type { PinnedTable } from "./message.ts";

const META_SIZE = 56;
const ACTIVE = 0xffffffffffffffffn;

export interface LookupTableState {
  entries: string[];
  /** u64::MAX while the table is active. */
  deactivationSlot: bigint;
  authority: string | null;
}

export function decodeLookupTableAccount(data: Uint8Array): LookupTableState {
  if (data.length < META_SIZE)
    throw new Error(
      `a lookup table account is at least ${META_SIZE} bytes; this one is shorter than that (${data.length})`,
    );
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const type = view.getUint32(0, true);
  if (type !== 1) throw new Error(`the account is not an initialized lookup table (type ${type})`);
  if ((data.length - META_SIZE) % 32 !== 0)
    throw new Error(`the entries are not a whole number of addresses (${data.length - META_SIZE} bytes)`);
  const deactivationSlot = view.getBigUint64(4, true);
  const hasAuthority = data[21] === 1;
  const entries: string[] = [];
  for (let o = META_SIZE; o < data.length; o += 32) entries.push(encodeBase58(data.subarray(o, o + 32)));
  return { entries, deactivationSlot, authority: hasAuthority ? encodeBase58(data.subarray(22, 54)) : null };
}

/** The pin for `policy.lookupTables`: every entry the table holds now. A table being closed is refused. */
export function pinFromAccount(address: string, data: Uint8Array): PinnedTable & { entries: string[] } {
  if (!isAddress(address)) throw new Error(`${JSON.stringify(address)} is not a base58 address`);
  const state = decodeLookupTableAccount(data);
  if (state.deactivationSlot !== ACTIVE) {
    throw new Error(`lookup table ${address} was deactivated at slot ${state.deactivationSlot}; pin an active table`);
  }
  return { address, entries: state.entries };
}
