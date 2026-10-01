// Program-derived addresses, computed offline: the guard checks a token transfer's destination
// against the associated token accounts of the owners the policy allows (docs/SPEC.md §4), and it
// has no RPC to ask.
//
// A PDA is SHA-256(seeds, bump, program id, "ProgramDerivedAddress") for the first bump, from 255
// down, whose hash is not an ed25519 point. The curve check follows the runtime's
// (curve25519-dalek's decompression): y is read mod p with the sign bit ignored, and the bytes are
// a point if (y² - 1) / (d·y² + 1) is a square mod p.

import { createHash } from "node:crypto";
import { decodeBase58, encodeBase58 } from "./base58.ts";

const P = 2n ** 255n - 19n;
const D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;

function modpow(base: bigint, exp: bigint): bigint {
  let result = 1n;
  let b = base % P;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % P;
    b = (b * b) % P;
    e >>= 1n;
  }
  return result;
}

export function isOnCurve(bytes: Uint8Array): boolean {
  if (bytes.length !== 32) return false;
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? bytes[i]! & 0x7f : bytes[i]!);
  y %= P;
  const y2 = (y * y) % P;
  const u = (y2 - 1n + P) % P;
  const v = (D * y2 + 1n) % P;
  if (u === 0n) return true;
  const w = (u * modpow(v, P - 2n)) % P;
  return modpow(w, (P - 1n) / 2n) === 1n;
}

const MARKER = new TextEncoder().encode("ProgramDerivedAddress");

/** [address, bump]. Throws only if no bump works, which does not happen in practice. */
export function findProgramAddress(seeds: Uint8Array[], program: string): [string, number] {
  if (seeds.length > 16 || seeds.some((s) => s.length > 32)) throw new Error("at most 16 seeds of at most 32 bytes each");
  const programBytes = decodeBase58(program);
  for (let bump = 255; bump >= 0; bump--) {
    const h = createHash("sha256");
    for (const s of seeds) h.update(s);
    h.update(Uint8Array.of(bump)).update(programBytes).update(MARKER);
    const out = new Uint8Array(h.digest());
    if (!isOnCurve(out)) return [encodeBase58(out), bump];
  }
  throw new Error("no viable bump seed");
}

const TOKEN_PROGRAM = { token: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "token-2022": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" } as const;
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// Derivation costs a few hash-and-curve rounds; a guard asks about the same owners and mints
// every time, so remember them. Bounded, so a stream of novel inputs cannot grow it without end.
const cache = new Map<string, string>();
const CACHE_MAX = 4096;

/** The associated token account of `owner` for `mint`. Token and Token-2022 derive different addresses. */
export function associatedTokenAddress(owner: string, mint: string, program: "token" | "token-2022"): string {
  const key = `${owner}:${mint}:${program}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [address] = findProgramAddress([decodeBase58(owner), decodeBase58(TOKEN_PROGRAM[program]), decodeBase58(mint)], ASSOCIATED_TOKEN_PROGRAM);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, address);
  return address;
}
