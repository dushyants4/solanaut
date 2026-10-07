// Milestone 2a.2, bytes decoded (docs/SPEC.md §4, ADR-009). The decoder reads legacy, v0 and v1
// messages from bytes alone, without @solana/web3.js, and refuses anything it cannot read exactly.
// The reference is @solana/kit 8.4.0's codecs; web3.js is a second, independent encoder for
// legacy and v0. Every refusal names its rule: malformed-proposal, unsupported-version or
// lookup-table-unpinned.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getAddressDecoder, getAddressEncoder, getTransactionEncoder } from "@solana/kit";
import {
  AddressLookupTableAccount,
  Keypair,
  Message,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedMessage,
} from "@solana/web3.js";
import { decodeBase58, encodeBase58, isAddress } from "../src/base58.ts";
import { DecodeError, decodeMessage, decodeTransaction, resolveMessage, type DecodedMessage, type DecodeRule } from "../src/message.ts";
import { decodeLookupTableAccount, pinFromAccount } from "../src/tables.ts";
import { craftLegacy, craftTableAccount, craftV1, enc, key, shortU16 } from "./support/craft.ts";
import { buildMessage, kitDecode, kitResolve, rng, type Version } from "./support/kit.ts";

const VERSIONS: Version[] = ["legacy", 0, 1];
const b58 = (k: number[]) => getAddressDecoder().decode(Uint8Array.from(k)) as string;

/** The decoder's result in kitDecode's shape: plain arrays, and the config only for v1. */
function ours(bytes: Uint8Array) {
  const m: DecodedMessage = decodeMessage(bytes);
  return {
    version: m.version,
    header: m.header,
    staticAccounts: m.staticAccounts,
    lifetimeToken: m.lifetimeToken,
    instructions: m.instructions.map((ix) => ({ programIndex: ix.programIndex, accountIndices: ix.accountIndices, data: [...ix.data] })),
    lookups: m.lookups,
    config: m.config,
  };
}

function refuses(fn: () => unknown, rule: DecodeRule, label = "") {
  assert.throws(fn, (e: unknown) => {
    assert.ok(e instanceof DecodeError, `${label}: expected a DecodeError, got ${(e as Error)?.name}: ${(e as Error)?.message}`);
    assert.equal(e.rule, rule, `${label}: ${e.message}`);
    return true;
  });
}

// --- base58 ---------------------------------------------------------------------------------

test("base58 agrees with kit's address codec on 500 random keys and on known program ids", () => {
  const r = rng(58);
  const enc32 = getAddressEncoder();
  for (let i = 0; i < 500; i++) {
    const bytes = r.bytes(32);
    if (i < 8) bytes.fill(0, 0, i * 4); // leading zero bytes become leading '1's
    const s = encodeBase58(bytes);
    assert.equal(s, getAddressDecoder().decode(bytes));
    assert.deepEqual(decodeBase58(s), bytes);
    assert.deepEqual(new Uint8Array(enc32.encode(s as never)), bytes);
  }
  assert.equal(encodeBase58(new Uint8Array(32)), "11111111111111111111111111111111");
  for (const id of ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "ComputeBudget111111111111111111111111111111", "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"]) {
    assert.equal(encodeBase58(decodeBase58(id)), id);
    assert.equal(new PublicKey(id).toBase58(), encodeBase58(new PublicKey(id).toBytes()));
  }
});

test("base58 refuses characters outside the alphabet; isAddress accepts only canonical 32-byte keys", () => {
  for (const bad of ["0", "O", "I", "l", "abc+", " 1"]) assert.throws(() => decodeBase58(bad), /base58/);
  assert.equal(isAddress("11111111111111111111111111111111"), true);
  assert.equal(isAddress("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), true);
  assert.equal(isAddress(""), false);
  assert.equal(isAddress("1111111111111111111111111111111"), false, "31 bytes");
  assert.equal(isAddress("111111111111111111111111111111111"), false, "33 bytes");
  assert.equal(isAddress("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5D0"), false, "a 0 is not base58");
  assert.equal(isAddress(42 as unknown as string), false);
});

// --- the golden set ---------------------------------------------------------------------------

test("golden set: 300 kit-built messages, 100 per version, decode exactly as kit decodes them", () => {
  for (const v of VERSIONS) {
    for (let seed = 1; seed <= 100; seed++) {
      const built = buildMessage(seed, v);
      assert.deepEqual(ours(built.bytes), kitDecode(built.bytes), `version ${v}, seed ${seed}`);
    }
  }
});

test("golden set: every instruction's accounts resolve as kit resolves them, v0 tables pinned", () => {
  for (const v of VERSIONS) {
    for (let seed = 1; seed <= 100; seed++) {
      const built = buildMessage(seed, v);
      const resolved = resolveMessage(decodeMessage(built.bytes), built.tables);
      const mine = resolved.instructions.map((ix) => ({
        program: ix.program,
        accounts: ix.accounts.map((a) => ({ address: a.address, signer: a.signer, writable: a.writable })),
        data: [...ix.data],
      }));
      assert.deepEqual(mine, kitResolve(built.bytes, built.tables), `version ${v}, seed ${seed}`);
    }
  }
});

test("golden set: v1 config values are read from the mask, in mask order", () => {
  let seen = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const built = buildMessage(seed, 1);
    assert.deepEqual(decodeMessage(built.bytes).config, built.config, `seed ${seed}`);
    seen += Object.keys(built.config).length;
  }
  assert.ok(seen > 100, "the generator set config values often enough to test them");
});

test("legacy and v0 messages built by web3.js decode as web3.js reads them", () => {
  const payer = Keypair.generate().publicKey;
  const to = Keypair.generate().publicKey;
  const memo = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
  const recentBlockhash = Keypair.generate().publicKey.toBase58();
  const ixs = [
    SystemProgram.transfer({ fromPubkey: payer, toPubkey: to, lamports: 123_456_789 }),
    new TransactionInstruction({ programId: memo, keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from("solanaut") }),
  ];

  const legacy = new Transaction({ feePayer: payer, recentBlockhash }).add(...ixs).compileMessage();
  const lm = decodeMessage(legacy.serialize());
  const ref = Message.from(legacy.serialize());
  assert.equal(lm.version, "legacy");
  assert.deepEqual(lm.staticAccounts, ref.accountKeys.map((k) => k.toBase58()));
  assert.deepEqual(lm.header, {
    numRequiredSignatures: ref.header.numRequiredSignatures,
    numReadonlySigned: ref.header.numReadonlySignedAccounts,
    numReadonlyUnsigned: ref.header.numReadonlyUnsignedAccounts,
  });
  assert.equal(lm.lifetimeToken, ref.recentBlockhash);
  assert.deepEqual(
    lm.instructions.map((ix) => [ix.programIndex, ix.accountIndices, encodeBase58(ix.data)]),
    ref.instructions.map((ix) => [ix.programIdIndex, ix.accounts, ix.data]),
  );

  const table = new AddressLookupTableAccount({
    key: Keypair.generate().publicKey,
    state: { deactivationSlot: 2n ** 64n - 1n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, addresses: [Keypair.generate().publicKey, to] },
  });
  const v0 = new TransactionMessage({ payerKey: payer, recentBlockhash, instructions: ixs }).compileToV0Message([table]);
  const vm = decodeMessage(v0.serialize());
  const vref = VersionedMessage.deserialize(v0.serialize());
  assert.equal(vm.version, 0);
  assert.deepEqual(vm.staticAccounts, vref.staticAccountKeys.map((k) => k.toBase58()));
  assert.deepEqual(
    vm.lookups,
    vref.addressTableLookups.map((l) => ({ table: l.accountKey.toBase58(), writableIndexes: l.writableIndexes, readonlyIndexes: l.readonlyIndexes })),
  );
  const pins = [{ address: table.key.toBase58(), entries: table.state.addresses.map((a) => a.toBase58()) }];
  const transfer = resolveMessage(vm, pins).instructions[0]!;
  assert.equal(transfer.accounts[1]!.address, to.toBase58(), "the destination comes from the pinned table");
  assert.deepEqual(transfer.accounts[1]!.lookup, { table: table.key.toBase58(), index: 1 });
  assert.equal(transfer.accounts[1]!.writable, true);
});

// --- refusals ----------------------------------------------------------------------------------

test("versions other than legacy, 0 and 1 are unsupported", () => {
  for (let first = 0x82; first <= 0xff; first++) {
    const bytes = craftV1();
    bytes[0] = first;
    refuses(() => decodeMessage(bytes), "unsupported-version", `first byte 0x${first.toString(16)}`);
  }
});

test("every truncation of a valid message is malformed, in every version", () => {
  for (const v of VERSIONS) {
    for (const seed of [1, 2, 3]) {
      const { bytes } = buildMessage(seed, v);
      for (let len = 0; len < bytes.length; len++) {
        refuses(() => decodeMessage(bytes.subarray(0, len)), "malformed-proposal", `version ${v}, seed ${seed}, ${len} of ${bytes.length} bytes`);
      }
    }
  }
});

test("bytes after the end of a message are malformed", () => {
  for (const v of VERSIONS) {
    const { bytes } = buildMessage(7, v);
    refuses(() => decodeMessage(Uint8Array.from([...bytes, 0])), "malformed-proposal", `version ${v}`);
  }
});

test("a non-canonical compact length is malformed", () => {
  // 2 accounts, written as 0x82 0x00: the same value in two bytes, which the runtime rejects.
  refuses(() => decodeMessage(craftLegacy({ rawKeyCount: [0x82, 0x00] })), "malformed-proposal");
  assert.equal(decodeMessage(craftLegacy({ rawKeyCount: [0x02] })).staticAccounts.length, 2, "the canonical form decodes");
});

test("inconsistent headers are malformed", () => {
  refuses(() => decodeMessage(craftLegacy({ header: [0, 0, 1] })), "malformed-proposal", "no signer");
  refuses(() => decodeMessage(craftLegacy({ header: [1, 1, 1] })), "malformed-proposal", "every signer read-only, the fee payer too");
  refuses(() => decodeMessage(craftLegacy({ header: [2, 0, 1] })), "malformed-proposal", "signers plus read-only past the keys");
  refuses(() => decodeMessage(craftV1({ header: [1, 1, 1] })), "malformed-proposal", "v1, fee payer read-only");
});

test("an instruction may not name the fee payer as its program, or an index past the accounts", () => {
  refuses(() => decodeMessage(craftLegacy({ instructions: [{ program: 0, accounts: [], data: [] }] })), "malformed-proposal", "program 0");
  refuses(() => decodeMessage(craftLegacy({ instructions: [{ program: 2, accounts: [], data: [] }] })), "malformed-proposal", "program past the keys");
  refuses(() => decodeMessage(craftLegacy({ instructions: [{ program: 1, accounts: [0, 2], data: [] }] })), "malformed-proposal", "account past the keys");
  refuses(() => decodeMessage(craftV1({ instructions: [{ program: 0, accounts: [], data: [] }] })), "malformed-proposal", "v1 program 0");
  refuses(() => decodeMessage(craftV1({ instructions: [{ program: 1, accounts: [5], data: [] }] })), "malformed-proposal", "v1 account past the keys");
});

test("an address listed twice is malformed", () => {
  refuses(() => decodeMessage(craftLegacy({ keys: [key(1), key(2), key(1)], header: [1, 0, 2] })), "malformed-proposal");
  refuses(() => decodeMessage(craftV1({ keys: [key(1), key(2), key(2)], header: [1, 0, 2] })), "malformed-proposal");
});

test("v1: an unknown config bit, a half-set priority-fee pair, a short config, or over 64 accounts are malformed", () => {
  refuses(() => decodeMessage(craftV1({ mask: 0b100000 })), "malformed-proposal", "bit 5");
  refuses(() => decodeMessage(craftV1({ mask: 0x80000000 })), "malformed-proposal", "bit 31");
  refuses(() => decodeMessage(craftV1({ mask: 0b01, configBytes: enc.u64(5n) })), "malformed-proposal", "priority bit 0 alone");
  refuses(() => decodeMessage(craftV1({ mask: 0b10, configBytes: enc.u64(5n) })), "malformed-proposal", "priority bit 1 alone");
  refuses(() => decodeMessage(craftV1({ mask: 0b100, configBytes: [1, 2] })), "malformed-proposal", "a u32 cut short");

  const keys = Array.from({ length: 65 }, (_, i) => key(i + 1));
  refuses(() => decodeMessage(craftV1({ keys, header: [1, 0, 64] })), "malformed-proposal", "65 accounts");
  const ok = decodeMessage(craftV1({ keys: keys.slice(0, 64), header: [1, 0, 63] }));
  assert.equal(ok.staticAccounts.length, 64, "64 accounts are allowed");

  const full = decodeMessage(craftV1({ mask: 0b11111, configBytes: [...enc.u64(9_000n), ...enc.u32(300_000), ...enc.u32(65_536), ...enc.u32(262_144)] }));
  assert.deepEqual(full.config, { priorityFeeLamports: 9_000n, computeUnitLimit: 300_000, loadedAccountsDataSizeLimit: 65_536, heapSize: 262_144 });
});

test("a message too large to land is malformed: 1,232 bytes for legacy and v0 with signatures, 4,096 for v1", () => {
  // One signature: 1 + 64 + message <= 1232, so a message may be at most 1167 bytes.
  const legacyOf = (n: number) => craftLegacy({ instructions: [{ program: 1, accounts: [0], data: Array(n).fill(1) }] });
  const sized = (target: number) => {
    const n = target - legacyOf(0).length - 1; // the data's length prefix grows to 2 bytes past 127
    assert.equal(legacyOf(n).length, target);
    return legacyOf(n);
  };
  assert.equal(decodeMessage(sized(1167)).version, "legacy", "exactly at the limit");
  refuses(() => decodeMessage(sized(1168)), "malformed-proposal", "one byte over");

  const v1Of = (n: number) => craftV1({ instructions: [{ program: 1, accounts: [0], data: Array(n).fill(1) }] });
  const vbase = v1Of(0).length;
  assert.equal(decodeMessage(v1Of(4096 - 64 - vbase)).version, 1, "exactly at the limit");
  refuses(() => decodeMessage(v1Of(4096 - 64 - vbase + 1)), "malformed-proposal", "one byte over");
});

// --- v0 lookup tables --------------------------------------------------------------------------

const v0With = (lookups: { table: number[]; writable: number[]; readonly: number[] }[], instructions = [{ program: 1, accounts: [0, 2, 3], data: [] }]) =>
  craftLegacy({ version: 0, keys: [key(1), key(2)], header: [1, 0, 1], instructions, lookups });

test("v0: an unpinned table, or an index past its pin, is lookup-table-unpinned", () => {
  const msg = decodeMessage(v0With([{ table: key(50), writable: [1], readonly: [3] }]));
  refuses(() => resolveMessage(msg, []), "lookup-table-unpinned", "no pins");
  refuses(() => resolveMessage(msg, [{ address: b58(key(51)), entries: [b58(key(60)), b58(key(61)), b58(key(62)), b58(key(63))] }]), "lookup-table-unpinned", "another table pinned");
  refuses(() => resolveMessage(msg, [{ address: b58(key(50)), entries: [b58(key(60)), b58(key(61)), b58(key(62))] }]), "lookup-table-unpinned", "index 3 of a 3-entry pin");

  const r = resolveMessage(msg, [{ address: b58(key(50)), entries: [b58(key(60)), b58(key(61)), b58(key(62)), b58(key(63))] }]);
  assert.deepEqual(
    r.accounts.map((a) => [a.address, a.signer, a.writable, a.lookup]),
    [
      [b58(key(1)), true, true, null],
      [b58(key(2)), false, false, null],
      [b58(key(61)), false, true, { table: b58(key(50)), index: 1 }],
      [b58(key(63)), false, false, { table: b58(key(50)), index: 3 }],
    ],
    "static accounts, then every table's writable entries, then every table's read-only entries",
  );
});

test("v0: writable entries of all tables come before read-only entries of any table", () => {
  const msg = decodeMessage(
    v0With([{ table: key(50), writable: [0], readonly: [1] }, { table: key(51), writable: [0], readonly: [] }], [{ program: 1, accounts: [2, 3, 4], data: [] }]),
  );
  const pins = [
    { address: b58(key(50)), entries: [b58(key(70)), b58(key(71))] },
    { address: b58(key(51)), entries: [b58(key(80))] },
  ];
  assert.deepEqual(resolveMessage(msg, pins).accounts.slice(2).map((a) => [a.address, a.writable]), [
    [b58(key(70)), true],
    [b58(key(80)), true],
    [b58(key(71)), false],
  ]);
});

test("v0: a program loaded from a table, a table that loads nothing, or an address both static and looked up is malformed", () => {
  refuses(() => decodeMessage(v0With([{ table: key(50), writable: [0], readonly: [] }], [{ program: 2, accounts: [], data: [] }])), "malformed-proposal", "program from a table");
  refuses(() => decodeMessage(v0With([{ table: key(50), writable: [], readonly: [] }], [{ program: 1, accounts: [0], data: [] }])), "malformed-proposal", "an empty lookup");
  const msg = decodeMessage(v0With([{ table: key(50), writable: [0], readonly: [] }], [{ program: 1, accounts: [2], data: [] }]));
  refuses(() => resolveMessage(msg, [{ address: b58(key(50)), entries: [b58(key(1))] }]), "malformed-proposal", "the fee payer again, from a table");
  refuses(() => decodeMessage(v0With(Array.from({ length: 2 }, () => ({ table: key(50), writable: [0], readonly: [] })), [{ program: 1, accounts: [2, 3], data: [] }])), "malformed-proposal", "a table listed twice");
});

test("legacy and v1 messages resolve from their static accounts alone", () => {
  for (const v of ["legacy", 1] as const) {
    const built = buildMessage(11, v);
    const r = resolveMessage(decodeMessage(built.bytes), []);
    assert.equal(r.accounts.length, decodeMessage(built.bytes).staticAccounts.length);
    assert.ok(r.accounts.every((a) => a.lookup === null));
  }
});

// --- whole transactions ------------------------------------------------------------------------

test("transactions: wire bytes split into the exact message and its signatures, in every version", () => {
  const r = rng(77);
  for (const v of VERSIONS) {
    for (let seed = 1; seed <= 20; seed++) {
      const built = buildMessage(seed, v);
      const n = decodeMessage(built.bytes).header.numRequiredSignatures;
      const signatures = Object.fromEntries(decodeMessage(built.bytes).staticAccounts.slice(0, n).map((a) => [a, r.bytes(64)]));
      const wire = new Uint8Array(getTransactionEncoder().encode({ messageBytes: built.bytes, signatures } as never));
      const split = decodeTransaction(wire);
      assert.deepEqual(split.message, built.bytes, `version ${v}, seed ${seed}`);
      assert.deepEqual(split.signatures, Object.values(signatures), `version ${v}, seed ${seed}`);
      if (v === 1) assert.equal(wire[0], 0x81, "v1 puts the message first");
    }
  }
});

test("transactions: a wrong signature count, a short or long tail, or a v0 message first is malformed", () => {
  const legacy = buildMessage(3, "legacy").bytes;
  const n = decodeMessage(legacy).header.numRequiredSignatures;
  const sigs = (k: number) => Array.from({ length: k * 64 }, () => 1);
  refuses(() => decodeTransaction(Uint8Array.from([...shortU16(n + 1), ...sigs(n + 1), ...legacy])), "malformed-proposal", "one signature too many");
  refuses(() => decodeTransaction(Uint8Array.from([...shortU16(n), ...sigs(n), ...legacy, 0])), "malformed-proposal", "a trailing byte");
  const v1 = buildMessage(3, 1).bytes;
  const n1 = decodeMessage(v1).header.numRequiredSignatures;
  refuses(() => decodeTransaction(Uint8Array.from([...v1, ...sigs(n1 - 1), ...Array(63).fill(1)])), "malformed-proposal", "v1, a short tail");
  refuses(() => decodeTransaction(Uint8Array.from([...v1, ...sigs(n1), 1])), "malformed-proposal", "v1, a long tail");
  refuses(() => decodeTransaction(buildMessage(3, 0).bytes), "malformed-proposal", "a bare v0 message is not a transaction");
  refuses(() => decodeTransaction(new Uint8Array()), "malformed-proposal", "nothing");
});

// --- lookup table accounts ---------------------------------------------------------------------

test("lookup table accounts decode as web3.js decodes them; a bad type or length is refused", () => {
  for (const [entries, authority, deactivationSlot] of [
    [[], null, 0xffffffffffffffffn],
    [[key(3), key(4), key(5)], key(8), 0xffffffffffffffffn],
    [Array.from({ length: 40 }, (_, i) => key(i + 10)), null, 1234n],
  ] as const) {
    const data = craftTableAccount({ entries: entries.map((e) => [...e]), authority: authority ? [...authority] : null, deactivationSlot });
    const ref = AddressLookupTableAccount.deserialize(Buffer.from(data));
    const mine = decodeLookupTableAccount(data);
    assert.deepEqual(mine.entries, ref.addresses.map((a) => a.toBase58()));
    assert.equal(mine.authority, ref.authority ? ref.authority.toBase58() : null);
    assert.equal(mine.deactivationSlot, BigInt(ref.deactivationSlot));
  }
  assert.throws(() => decodeLookupTableAccount(craftTableAccount({ typeIndex: 0, entries: [] })), /not an initialized lookup table/);
  assert.throws(() => decodeLookupTableAccount(craftTableAccount({ entries: [key(3)] }).subarray(0, 56 + 31)), /whole number of addresses/);
  assert.throws(() => decodeLookupTableAccount(new Uint8Array(40)), /shorter than/);
});

test("a table pin is the table's address and its entries, and a deactivated table is refused", () => {
  const data = craftTableAccount({ entries: [key(3), key(4)] });
  assert.deepEqual(pinFromAccount(b58(key(50)), data), { address: b58(key(50)), entries: [b58(key(3)), b58(key(4))] });
  assert.throws(() => pinFromAccount(b58(key(50)), craftTableAccount({ entries: [key(3)], deactivationSlot: 99n })), /deactivated/);
  assert.throws(() => pinFromAccount("not-an-address", data), /address/);
});

// --- fuzz ---------------------------------------------------------------------------------------

const RUNS = Number(process.env.FUZZ_RUNS ?? 5_000);

test(`fuzz: ${RUNS} mutated messages either decode exactly as kit does, or are refused with a DecodeError`, () => {
  const r = rng(Number(process.env.FUZZ_SEED ?? 0x5a17));
  const seeds = VERSIONS.flatMap((v) => [1, 2, 3, 4, 5].map((s) => buildMessage(s, v).bytes));
  let accepted = 0;
  for (let i = 0; i < RUNS; i++) {
    const input = mutate(r, r.pick(seeds), r.pick(seeds));
    let mine;
    try {
      mine = ours(input);
    } catch (e) {
      assert.ok(e instanceof DecodeError, `run ${i}: threw ${(e as Error).name}: ${(e as Error).message}`);
      continue;
    }
    accepted++;
    assert.deepEqual(mine, kitDecode(input), `run ${i}: accepted, but kit reads it differently`);
  }
  console.log(`  fuzz: ${RUNS} inputs, ${accepted} accepted and matched kit, ${RUNS - accepted} refused with a named rule`);
  assert.ok(accepted > 0 && accepted < RUNS, "the mutations reach both outcomes");
});

function mutate(r: ReturnType<typeof rng>, a: Uint8Array, b: Uint8Array): Uint8Array {
  const x = [...a];
  const n = r.int(1, 4);
  for (let k = 0; k < n; k++) {
    const at = r.int(0, Math.max(0, x.length - 1));
    switch (r.int(0, 7)) {
      case 0: x[at] = x[at]! ^ (1 << r.int(0, 7)); break; // flip a bit
      case 1: x[at] = r.int(0, 255); break; // set a byte
      case 2: x.splice(at, 0, r.int(0, 255)); break; // insert
      case 3: x.splice(at, 1); break; // delete
      case 4: x.length = at; break; // truncate
      case 5: x.splice(at, 0, ...b.subarray(r.int(0, b.length - 1), r.int(0, b.length))); break; // splice in another message
      case 6: return r.bytes(r.int(0, 300)); // noise
      case 7: break; // unchanged: valid inputs must still match
    }
  }
  return Uint8Array.from(x);
}
