// Base58, Bitcoin's alphabet, which Solana uses for addresses, blockhashes and signatures. The
// guard decodes bytes itself (ADR-009), so it carries its own codec rather than web3.js's.

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

export function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // Base-256 to base-58, little-endian digits; about 138 base-58 digits per 100 bytes.
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]!];
  return out;
}

export function decodeBase58(s: string): Uint8Array {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < s.length; i++) {
    const v = INDEX.get(s[i]!);
    if (v === undefined) throw new Error(`not base58: ${JSON.stringify(s[i])} at position ${i}`);
    let carry = v;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i]!;
  return out;
}

/** A canonical base58 encoding of exactly 32 bytes: the only form an address takes in a policy. */
export function isAddress(s: string): boolean {
  if (typeof s !== "string" || s.length < 32 || s.length > 44) return false;
  try {
    const b = decodeBase58(s);
    return b.length === 32 && encodeBase58(b) === s;
  } catch {
    return false;
  }
}
