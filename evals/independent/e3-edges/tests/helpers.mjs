// Test helpers: keys, legacy messages built byte by byte, a policy, fakes. Written from SPEC.md and API.md only.
import crypto from "node:crypto";
import { encodeBase58, decodeBase58, createGuard } from "@solanaut/sdk";

export const SYSTEM = "11111111111111111111111111111111";
export const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
export const MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

/** An ed25519 key made here, in the test. */
export function makeKey() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
  const address = encodeBase58(new Uint8Array(raw));
  return {
    address,
    publicKeyBytes: new Uint8Array(raw),
    sign: (msg) => new Uint8Array(crypto.sign(null, Buffer.from(msg), privateKey)),
  };
}

export function verifyBy(address, msg, sig) {
  if (!sig) return false;
  const raw = Buffer.from(decodeBase58(address));
  const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]);
  const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
  return crypto.verify(null, Buffer.from(msg), key, Buffer.from(sig));
}

export function randomAddress() {
  return encodeBase58(new Uint8Array(crypto.randomBytes(32)));
}

function compactU16(n) {
  const out = [];
  let v = n;
  for (;;) {
    const b = v & 0x7f;
    v >>= 7;
    if (v === 0) { out.push(b); break; }
    out.push(b | 0x80);
  }
  return out;
}

function u32le(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return [...b]; }
function u64le(n) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return [...b]; }

/**
 * A legacy message: one System transfer from `from` to `to`, optionally preceded by ComputeBudget
 * SetComputeUnitLimit / SetComputeUnitPrice, optionally followed by a Memo.
 * Accounts: [from (signer, writable), to (writable), System, (ComputeBudget), (Memo)].
 */
export function transferMessage({ from, to, lamports, blockhash, cuPrice, cuLimit, memo }) {
  const accounts = [from, to, SYSTEM];
  const useCb = cuPrice !== undefined || cuLimit !== undefined;
  if (useCb) accounts.push(COMPUTE_BUDGET);
  if (memo !== undefined) accounts.push(MEMO);
  const readonlyUnsigned = accounts.length - 2;
  const header = [1, 0, readonlyUnsigned];
  const bh = blockhash ? decodeBase58(blockhash) : crypto.randomBytes(32);
  const ixs = [];
  const cbIndex = accounts.indexOf(COMPUTE_BUDGET);
  if (cuLimit !== undefined) ixs.push([cbIndex, [], [2, ...u32le(cuLimit)]]);
  if (cuPrice !== undefined) ixs.push([cbIndex, [], [3, ...u64le(cuPrice)]]);
  ixs.push([2, [0, 1], [...u32le(2), ...u64le(lamports)]]);
  if (memo !== undefined) ixs.push([accounts.indexOf(MEMO), [], [...Buffer.from(memo)]]);
  const bytes = [
    ...header,
    ...compactU16(accounts.length),
    ...accounts.flatMap((a) => [...decodeBase58(a)]),
    ...bh,
    ...compactU16(ixs.length),
    ...ixs.flatMap(([p, accs, data]) => [p, ...compactU16(accs.length), ...accs, ...compactU16(data.length), ...data]),
  ];
  return new Uint8Array(bytes);
}

export function makePolicy({ principal, destinations, releaseKey, overrides = {} }) {
  const base = {
    version: 1,
    principal: [principal],
    programs: { allow: [SYSTEM, COMPUTE_BUDGET, MEMO], opaque: "deny" },
    destinations: { allow: destinations },
    sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 1_000_000_000_000n },
    tokens: [],
    fees: { maxPriorityPerTx: 10_000_000n, maxPerWindow: 1_000_000_000n, tipAccounts: [] },
    lookupTables: [],
    windowMs: 3_600_000,
    intents: { maxAttempts: 3 },
    latch: { afterDenials: 5, releaseKey, guardId: "eval-e3", cluster: "localnet" },
    messages: { allow: false },
    cosign: { allow: false },
    sensor: { expectedPerMinute: 6 },
  };
  return deepMerge(base, overrides);
}

function deepMerge(a, b) {
  if (b === undefined) return a;
  if (typeof a !== "object" || a === null || Array.isArray(a) || typeof b !== "object" || b === null || Array.isArray(b)) return b;
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
  return out;
}

/** A world: an agent key, an operator key, N allowed destinations, a guard. */
export async function world({ nDest = 4, overrides = {}, sensor, expectedDigest } = {}) {
  const agent = makeKey();
  const operator = makeKey();
  const dests = Array.from({ length: nDest }, () => randomAddress());
  const policy = makePolicy({ principal: agent.address, destinations: dests, releaseKey: operator.address, overrides });
  const opts = { policy };
  if (sensor) opts.sensor = sensor;
  if (expectedDigest) opts.expectedDigest = expectedDigest;
  const guard = await createGuard(opts);
  const pay = (i, lamports, extra = {}) => transferMessage({ from: agent.address, to: dests[i], lamports, ...extra });
  return { agent, operator, dests, policy, guard, pay };
}

export function decisionsOf(guard) { return guard.entries().filter((e) => e.kind === "decision"); }
export function reportsOf(guard) { return guard.entries().filter((e) => e.kind === "report"); }

/** Wilson score interval, 95%. */
export function wilson(k, n, z = 1.959963984540054) {
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** Deterministic PRNG (mulberry32). */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
