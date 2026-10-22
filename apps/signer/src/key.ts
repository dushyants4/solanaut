// The devnet signing key: read from a protected file, checked against its own public half, and
// held only inside a signing function. Its raw bytes are wiped once the key object exists.

import { createPrivateKey, createPublicKey, sign, timingSafeEqual } from "node:crypto";
import { encodeBase58 } from "@solanaut/sdk";
import { readProtectedJSON } from "./protected-file.ts";

/** The fixed DER header of a PKCS #8 ed25519 private key; the key's 32-byte seed follows it. */
const ED25519_PKCS8_HEADER = Buffer.from("302e020100300506032b657004220420", "hex");

export function createDevnetSigner(input: Uint8Array) {
  let bytes: Buffer | undefined;
  let encoded: Buffer | undefined;
  try {
    bytes = Buffer.from(input);
    if (bytes.length !== 64) throw new Error();
    encoded = Buffer.concat([ED25519_PKCS8_HEADER, bytes.subarray(0, 32)]);
    const key = createPrivateKey({ key: encoded, type: "pkcs8", format: "der" });
    const publicBytes = createPublicKey(key).export({ type: "spki", format: "der" }).subarray(-32);
    if (!timingSafeEqual(publicBytes, bytes.subarray(32))) throw new Error();
    return Object.freeze({
      address: encodeBase58(publicBytes),
      sign: async (message: Uint8Array) => new Uint8Array(sign(null, new Uint8Array(message), key)),
    });
  } catch {
    throw new Error("devnet key unavailable");
  } finally {
    bytes?.fill(0);
    encoded?.fill(0);
  }
}
export function loadDevnetKey(path: string) {
  let value: unknown;
  try {
    value = readProtectedJSON(path, 0o400, 4096);
    if (!Array.isArray(value) || value.length !== 64 || value.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
      throw new Error();
    return createDevnetSigner(Uint8Array.from(value));
  } catch {
    throw new Error("devnet key unavailable");
  } finally {
    if (Array.isArray(value)) value.fill(0);
  }
}
