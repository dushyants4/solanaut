// The latch's release message (docs/SPEC.md §7). A latched guard denies everything until the
// operator signs this exact text with the latch's release key, which policy v1 keeps outside the
// principal. Plain UTF-8, so Phantom's signMessage can sign it and the operator can read it:
//
//   solanaut latch release
//   guard: <latch.guardId>
//   cluster: <latch.cluster>
//   policy: <policyHash>
//   seq: <the seq of the decision that latched>
//   expires: <ISO 8601 time, UTC>
//
// The seq ties a release to one latching, so a signed release cannot be replayed later; the
// expiry bounds how long a signed but unused one stays good.

import { createPublicKey, verify } from "node:crypto";
import { decodeBase58 } from "./base58.ts";

export interface ReleaseFields {
  guardId: string;
  cluster: string;
  policyHash: string;
  seq: number;
  expires: string;
}

export function releaseText(f: ReleaseFields): string {
  return ["solanaut latch release", `guard: ${f.guardId}`, `cluster: ${f.cluster}`, `policy: ${f.policyHash}`, `seq: ${f.seq}`, `expires: ${f.expires}`].join("\n");
}

const SHAPE =
  /^solanaut latch release\nguard: ([\x20-\x7e]{1,64})\ncluster: (localnet|devnet|mainnet-beta)\npolicy: ([0-9a-f]{64})\nseq: (0|[1-9][0-9]{0,15})\nexpires: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)$/;

/** The fields of a release text, or null unless the text is exactly in the form above. */
export function parseReleaseText(text: string): ReleaseFields | null {
  if (typeof text !== "string") return null;
  const m = SHAPE.exec(text);
  if (!m) return null;
  const f = { guardId: m[1]!, cluster: m[2]!, policyHash: m[3]!, seq: Number(m[4]), expires: m[5]! };
  return releaseText(f) === text ? f : null;
}

// An ed25519 public key in DER SubjectPublicKeyInfo form is this 12-byte prefix, then the raw 32 bytes.
const SPKI_ED25519 = Uint8Array.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);

/** An ed25519 signature by a base58 public key over these bytes. Anything malformed is false. */
export function verifyEd25519(publicKey: string, message: Uint8Array, signature: Uint8Array): boolean {
  try {
    const raw = decodeBase58(publicKey);
    if (raw.length !== 32 || !(signature instanceof Uint8Array) || signature.length !== 64) return false;
    const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, raw]), format: "der", type: "spki" });
    return verify(null, message, key, signature);
  } catch {
    return false;
  }
}
