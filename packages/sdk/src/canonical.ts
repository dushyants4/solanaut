// Canonical JSON (docs/SPEC.md §3): sorted keys, no whitespace, bigints as decimal strings. Two
// equal values always serialize to the same bytes, so their hashes can be compared and replayed.

import { createHash } from "node:crypto";

export function canonicalJSON(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (value === null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`canonical JSON has no form for ${value}`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (value instanceof Uint8Array) throw new Error("canonical JSON takes bytes as base64 or hex strings, never raw");
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(",")}}`;
  }
  throw new Error(`canonical JSON has no form for a ${typeof value}`);
}

export const sha256hex = (data: Uint8Array | string): string => createHash("sha256").update(data).digest("hex");
