// Test helpers, written from SPEC.md §3 and §4 and the public Solana wire format only.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { encodeBase58, decodeBase58, createGuard } from "@solanaut/sdk";

export const SYSTEM = "11111111111111111111111111111111";
export const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
export const TMP = path.join(HERE, "tmp");

/** An ed25519 key pair made here, with its base58 address and a sign() over bytes. */
export function keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return {
    address: encodeBase58(new Uint8Array(raw)),
    bytes: new Uint8Array(raw),
    sign: (msg) => new Uint8Array(crypto.sign(null, Buffer.from(msg), privateKey)),
  };
}

function compactU16(n) {
  const out = [];
  let v = n;
  for (;;) {
    let b = v & 0x7f;
    v >>= 7;
    if (v === 0) { out.push(b); break; }
    out.push(b | 0x80);
  }
  return out;
}

function u32le(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return [...b]; }
function u64le(n) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return [...b]; }

let blockhashCounter = 0;
/** A fresh 32-byte "blockhash" each call unless one is given. */
export function blockhash() {
  blockhashCounter++;
  return crypto.createHash("sha256").update("bh" + blockhashCounter + Math.random()).digest();
}

/**
 * A legacy message: one System Transfer of `lamports` from `from` (the fee payer, the only signer)
 * to `to`. Accounts: [from (signer, writable), to (writable), System (readonly)].
 * Optional ComputeBudget SetComputeUnitLimit + SetComputeUnitPrice to raise the priority fee.
 */
export function transfer(from, to, lamports, opts = {}) {
  const fromB = typeof from === "string" ? decodeBase58(from) : from.bytes;
  const toB = decodeBase58(to);
  const sys = new Uint8Array(32);
  const keys = [fromB, toB, sys];
  const bh = opts.blockhash ?? blockhash();
  const ixs = [];
  let readonlyUnsigned = 1;
  if (opts.microLamports !== undefined) {
    keys.push(decodeBase58("ComputeBudget111111111111111111111111111111"));
    readonlyUnsigned = 2;
    // SetComputeUnitLimit (2, u32) and SetComputeUnitPrice (3, u64)
    ixs.push([3, ...compactU16(0), ...compactU16(5), 2, ...u32le(opts.units ?? 200000)]);
    ixs.push([3, ...compactU16(0), ...compactU16(9), 3, ...u64le(opts.microLamports)]);
  }
  ixs.push([2, ...compactU16(2), 0, 1, ...compactU16(12), ...u32le(2), ...u64le(lamports)]);
  const bytes = [
    1, 0, readonlyUnsigned,
    ...compactU16(keys.length), ...keys.flatMap((k) => [...k]),
    ...bh,
    ...compactU16(ixs.length), ...ixs.flat(),
  ];
  return new Uint8Array(bytes);
}

export function sha256hex(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

/** A valid PolicyV1 (§3) for one principal, one destination, SOL only. Override any part. */
export function policyFor(principal, dest, release, over = {}) {
  const base = {
    version: 1,
    principal: [principal.address ?? principal],
    programs: { allow: [SYSTEM], opaque: "deny" },
    destinations: { allow: [dest] },
    sol: { maxPerTx: 1_000_000n, maxPerWindow: 10_000_000n },
    tokens: [],
    fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 1_000_000_000n, tipAccounts: [] },
    lookupTables: [],
    windowMs: 60_000,
    intents: { maxAttempts: 3 },
    latch: { afterDenials: 1000, releaseKey: release.address ?? release, guardId: "eval-guard", cluster: "localnet" },
    messages: { allow: false },
    cosign: { allow: false },
    sensor: { expectedPerMinute: 1000 },
  };
  return deepMerge(base, over);
}

function deepMerge(a, b) {
  if (b === undefined) return a;
  if (typeof a !== "object" || a === null || Array.isArray(a) || typeof b !== "object" || b === null || Array.isArray(b)) return b;
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
  return out;
}

/** Telemetry that keeps Keel at DEFAULT on every tick (probed against @gubernaut/core 1.0.1). */
export const calmSensor = () => ({ intensity: 0, valence: 0.2, repetition: 0 });
/** Telemetry that puts Keel at REGROUND from its second tick on (probed likewise). */
export const loopSensor = () => ({ intensity: 0.5, valence: -0.4, repetition: 1 });

/** A fresh setup: keys, destination, policy. */
export function setup(over = {}) {
  const agent = keypair();
  const operator = keypair();
  const dest = keypair().address;
  const policy = policyFor(agent, dest, operator, over);
  return { agent, operator, dest, policy };
}

/** A fresh record path in the folder's tmp/. */
export function logPath(name) {
  fs.mkdirSync(TMP, { recursive: true });
  return path.join(TMP, `${name}-${process.pid}-${crypto.randomBytes(4).toString("hex")}.jsonl`);
}

export function rmLog(p) {
  for (const f of [p, p + ".lock"]) { try { fs.unlinkSync(f); } catch {} }
}

export const ISO = (ms) => new Date(ms).toISOString();
export { os };

/** Canonical JSON (§3): sorted keys, no whitespace, bigints as decimal strings. */
export function canon(v) {
  if (typeof v === "bigint") return JSON.stringify(v.toString());
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

/** Re-seal an entry: hash = sha256(canonicalJSON(entry without hash)) (§3). */
export function reseal(e) {
  const { hash, ...body } = e;
  return { ...body, hash: sha256hex(canon(body)) };
}

/** A guard on a fresh setup, with Keel held at DEFAULT unless a sensor is given (null: the default sensor). */
export async function mk(over = {}, opts = {}) {
  const s = setup(over);
  const guard = await createGuard({ policy: s.policy, sensor: opts.sensor === null ? undefined : (opts.sensor ?? calmSensor), log: opts.log });
  return { ...s, guard };
}

/** A proposal; heights optional. */
export function prop(message, at, bh, lvbh, intent) {
  const p = { message, at };
  if (bh !== undefined) p.blockHeight = BigInt(bh);
  if (lvbh !== undefined) p.lastValidBlockHeight = BigInt(lvbh);
  if (intent !== undefined) p.intent = intent;
  return p;
}

/** Run fn; return the thrown error or null. */
export function throws(fn) {
  try { fn(); return null; } catch (e) { return e; }
}
