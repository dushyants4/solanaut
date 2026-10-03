// Shared helpers for the decode evaluation. Built only from the Solana wire format and SPEC.md.
// Nothing here reads the SDK's implementation; ATAs and seeded addresses come from kit, not the SDK.
import crypto from "node:crypto";
import bs58 from "bs58";
import { getProgramDerivedAddress, createAddressWithSeed } from "@solana/addresses";
import { createGuard, createPolicy, contextOf, effectsOf } from "@solanaut/sdk";

export const P = {
  system: "11111111111111111111111111111111",
  token: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  token2022: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  cb: "ComputeBudget111111111111111111111111111111",
  memo: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  memoV1: "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
  ata: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  ed25519: "Ed25519SigVerify111111111111111111111111111",
  secp256k1: "KeccakSecp256k11111111111111111111111111111",
  secp256r1: "Secp256r1SigVerify1111111111111111111111111",
  sysvarRecentBlockhashes: "SysvarRecentB1ockHashes11111111111111111111",
};

// ---------- keys ----------
export function newKey() {
  const { publicKey } = crypto.generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
  return bs58.encode(raw);
}
export const randomHash = () => bs58.encode(crypto.randomBytes(32));
export const addrBytes = (a) => {
  const b = bs58.decode(a);
  if (b.length !== 32) throw new Error(`bad address ${a}`);
  return b;
};

export async function ata(owner, mint, program = "token") {
  const tp = program === "token" ? P.token : P.token2022;
  const [a] = await getProgramDerivedAddress({ programAddress: P.ata, seeds: [addrBytes(owner), addrBytes(tp), addrBytes(mint)] });
  return a;
}
export const withSeed = (base, seed, owner) => createAddressWithSeed({ baseAddress: base, programAddress: owner, seed });

// ---------- little-endian encoders ----------
export const u8 = (n) => Uint8Array.of(n);
export function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
export function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
export function u64(n) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n), true); return b; }
export function cat(...parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
export function shortvec(n) {
  const out = [];
  let v = n;
  for (;;) {
    let b = v & 0x7f;
    v >>= 7;
    if (v === 0) { out.push(b); break; }
    out.push(b | 0x80);
  }
  return Uint8Array.from(out);
}

// ---------- raw message builders: every field explicit ----------
// header: [numRequiredSignatures, numReadonlySigned, numReadonlyUnsigned]
// ixs: [{ p: programIndex, a: [accountIndex...], d: Uint8Array }]
function legacyBody({ header, keys, blockhash, ixs }) {
  return cat(
    Uint8Array.from(header),
    shortvec(keys.length), ...keys.map(addrBytes),
    addrBytes(blockhash),
    shortvec(ixs.length),
    ...ixs.map((ix) => cat(u8(ix.p), shortvec(ix.a.length), Uint8Array.from(ix.a), shortvec(ix.d.length), ix.d)),
  );
}
export const rawLegacy = (m) => legacyBody(m);
// lookups: [{ table, w: [idx], r: [idx] }]
export const rawV0 = (m) => cat(
  u8(0x80),
  legacyBody(m),
  shortvec(m.lookups.length),
  ...m.lookups.map((l) => cat(addrBytes(l.table), shortvec(l.w.length), Uint8Array.from(l.w), shortvec(l.r.length), Uint8Array.from(l.r))),
);
// v1, per @solana/kit 8.4.0's codec (SIMD-0385): 0x81, header(3), configMask u32, lifetime(32),
// numInstructions u8, numStaticAccounts u8, accounts, config values (fee u64, CU limit u32,
// loaded-data u32, heap u32, in mask order), instruction headers (program u8, nAccounts u8,
// nData u16), then each instruction's account indices and data.
export function rawV1({ header, keys, blockhash, ixs, config = {} }) {
  let mask = 0;
  const vals = [];
  if (config.priorityFee !== undefined) { mask |= 0b11; vals.push(u64(config.priorityFee)); }
  if (config.cuLimit !== undefined) { mask |= 0b100; vals.push(u32(config.cuLimit)); }
  if (config.loadedData !== undefined) { mask |= 0b1000; vals.push(u32(config.loadedData)); }
  if (config.heap !== undefined) { mask |= 0b10000; vals.push(u32(config.heap)); }
  return cat(
    u8(0x81), Uint8Array.from(header), u32(mask), addrBytes(blockhash),
    u8(ixs.length), u8(keys.length), ...keys.map(addrBytes),
    ...vals,
    ...ixs.map((ix) => cat(u8(ix.p), u8(ix.a.length), u16(ix.d.length))),
    ...ixs.map((ix) => cat(Uint8Array.from(ix.a), ix.d)),
  );
}

// ---------- a compiler: orders accounts the way the runtime expects ----------
// ixs: [{ program, accounts: [{ addr, signer?, writable? }], data }]
export function compile({ payer, ixs, version = "legacy", blockhash = randomHash(), config, extraKeys = [] }) {
  const meta = new Map();
  const add = (addr, signer, writable) => {
    const m = meta.get(addr) ?? { signer: false, writable: false, order: meta.size };
    m.signer ||= signer; m.writable ||= writable;
    meta.set(addr, m);
  };
  add(payer, true, true);
  for (const ix of ixs) {
    for (const a of ix.accounts) add(a.addr, !!a.signer, !!a.writable);
    add(ix.program, false, false);
  }
  for (const k of extraKeys) add(k.addr, !!k.signer, !!k.writable);
  const all = [...meta.entries()].map(([addr, m]) => ({ addr, ...m }));
  const rank = (m) => (m.addr === payer ? -1 : m.signer ? (m.writable ? 0 : 1) : m.writable ? 2 : 3);
  all.sort((x, y) => rank(x) - rank(y) || x.order - y.order);
  const keys = all.map((m) => m.addr);
  const header = [
    all.filter((m) => m.signer).length,
    all.filter((m) => m.signer && !m.writable).length,
    all.filter((m) => !m.signer && !m.writable).length,
  ];
  const idx = (a) => keys.indexOf(a);
  const cix = ixs.map((ix) => ({ p: idx(ix.program), a: ix.accounts.map((a) => idx(a.addr)), d: ix.data }));
  const m = { header, keys, blockhash, ixs: cix, lookups: [], config };
  if (version === "legacy") return rawLegacy(m);
  if (version === 0) return rawV0(m);
  if (version === 1) return rawV1(m);
  throw new Error("version");
}

// ---------- instruction builders ----------
const S = (addr) => ({ addr, signer: true, writable: true });
const W = (addr) => ({ addr, writable: true });
const R = (addr) => ({ addr });
export const acct = { S, W, R, SR: (addr) => ({ addr, signer: true }) };

export const sys = {
  transfer: (from, to, lamports) => ({ program: P.system, accounts: [S(from), W(to)], data: cat(u32(2), u64(lamports)) }),
  createAccount: (from, to, lamports, space = 0n, owner = P.system) =>
    ({ program: P.system, accounts: [S(from), S(to)], data: cat(u32(0), u64(lamports), u64(space), addrBytes(owner)) }),
  assign: (acc, owner) => ({ program: P.system, accounts: [S(acc)], data: cat(u32(1), addrBytes(owner)) }),
  allocate: (acc, space) => ({ program: P.system, accounts: [S(acc)], data: cat(u32(8), u64(space)) }),
  advanceNonce: (nonce, authority) =>
    ({ program: P.system, accounts: [W(nonce), R(P.sysvarRecentBlockhashes), acct.SR(authority)], data: u32(4) }),
  withdrawNonce: (nonce, to, authority, lamports) =>
    ({ program: P.system, accounts: [W(nonce), W(to), R(P.sysvarRecentBlockhashes), R("SysvarRent111111111111111111111111111111111"), acct.SR(authority)], data: cat(u32(5), u64(lamports)) }),
};
export function seedBytes(seed) { const b = new TextEncoder().encode(seed); return cat(u64(b.length), b); }

export const tok = {
  transfer: (program, src, dst, auth, amount) =>
    ({ program, accounts: [W(src), W(dst), acct.SR(auth)], data: cat(u8(3), u64(amount)) }),
  transferChecked: (program, src, mint, dst, auth, amount, decimals = 6) =>
    ({ program, accounts: [W(src), R(mint), W(dst), acct.SR(auth)], data: cat(u8(12), u64(amount), u8(decimals)) }),
  approve: (program, src, delegate, owner, amount) =>
    ({ program, accounts: [W(src), R(delegate), acct.SR(owner)], data: cat(u8(4), u64(amount)) }),
  revoke: (program, src, owner) => ({ program, accounts: [W(src), acct.SR(owner)], data: u8(5) }),
  setAuthority: (program, acc, owner, newAuth) =>
    ({ program, accounts: [W(acc), acct.SR(owner)], data: cat(u8(6), u8(2), u8(1), addrBytes(newAuth)) }),
  closeAccount: (program, acc, dst, owner) => ({ program, accounts: [W(acc), W(dst), acct.SR(owner)], data: u8(9) }),
  syncNative: (program, acc) => ({ program, accounts: [W(acc)], data: u8(17) }),
  raw: (program, accounts, data) => ({ program, accounts, data }),
};

export const cb = {
  limit: (units) => ({ program: P.cb, accounts: [], data: cat(u8(2), u32(units)) }),
  price: (microLamports) => ({ program: P.cb, accounts: [], data: cat(u8(3), u64(microLamports)) }),
  heap: (bytes) => ({ program: P.cb, accounts: [], data: cat(u8(1), u32(bytes)) }),
  loaded: (bytes) => ({ program: P.cb, accounts: [], data: cat(u8(4), u32(bytes)) }),
  requestUnits: (units, fee) => ({ program: P.cb, accounts: [], data: cat(u8(0), u32(units), u32(fee)) }),
  raw: (data) => ({ program: P.cb, accounts: [], data }),
};
export const memo = (text = "hi", program = P.memo) => ({ program, accounts: [], data: new TextEncoder().encode(text) });

// ---------- the cast and a base policy ----------
export async function cast() {
  const A = newKey();       // principal, fee payer
  const K2 = newKey();      // second principal key, also an allowed destination
  const B = newKey();       // allowed destination owner
  const C = newKey();       // attacker
  const T = newKey();       // tip account
  const REL = newKey();     // latch release key
  const M = newKey();       // listed mint, Token
  const M22 = newKey();     // listed mint, Token-2022
  const X = newKey();       // unlisted mint
  const OP = newKey();      // an allowlisted opaque program
  const Q = newKey();       // a program not on the allowlist
  const DIRECT = newKey();  // a token account the policy names directly
  const LT = newKey();      // a pinned lookup table
  const LT2 = newKey();     // a second pinned lookup table
  const c = { A, K2, B, C, T, REL, M, M22, X, OP, Q, DIRECT, LT, LT2 };
  c.ataA_M = await ata(A, M, "token");
  c.ataB_M = await ata(B, M, "token");
  c.ataC_M = await ata(C, M, "token");
  c.ataA_X = await ata(A, X, "token");
  c.ataB_X = await ata(B, X, "token");
  c.ataA_M22 = await ata(A, M22, "token-2022");
  c.ataB_M22 = await ata(B, M22, "token-2022");
  c.ataB_M22_classic = await ata(B, M22, "token");
  return c;
}

export function basePolicy(c, edit) {
  const p = {
    version: 1,
    principal: [c.A, c.K2],
    programs: { allow: [P.system, P.token, P.token2022, P.cb, P.memo, P.memoV1, c.OP], opaque: "deny" },
    destinations: { allow: [c.B, c.K2, c.DIRECT] },
    sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 1_000_000_000_000n },
    tokens: [
      { mint: c.M, program: "token", maxPerTx: 1_000_000n, maxPerWindow: 1_000_000_000n },
      { mint: c.M22, program: "token-2022", maxPerTx: 1_000_000n, maxPerWindow: 1_000_000_000n },
    ],
    fees: { maxPriorityPerTx: 10_000n, maxPerWindow: 1_000_000_000n, tipAccounts: [c.T] },
    lookupTables: [],
    windowMs: 3_600_000,
    intents: { maxAttempts: 3 },
    latch: { afterDenials: 1000, releaseKey: c.REL, guardId: "e1-decode", cluster: "localnet" },
    messages: { allow: false },
    cosign: { allow: false },
    sensor: { expectedPerMinute: 60 },
  };
  if (edit) edit(p);
  return p;
}

// Neutral telemetry, so Keel (rules 17 and 18, outside this area) cannot decide a case meant for rules 0 to 13.
export const neutralSensor = () => ({ intensity: 0, valence: 0.2, repetition: 0 });

export async function decide(c, message, edit, { sensor = neutralSensor, extra = {} } = {}) {
  const guard = await createGuard({ policy: basePolicy(c, edit), sensor });
  const d = guard.check({ message, at: 1_700_000_000_000, ...extra });
  guard.close();
  return d;
}
export function effects(c, message, edit) {
  const { policy } = createPolicy(basePolicy(c, edit));
  return effectsOf(message, contextOf(policy));
}
