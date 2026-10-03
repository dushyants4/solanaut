// The record's hash, from SPEC.md §3: hash = sha256(canonicalJSON(entry without hash)); canonical JSON is sorted keys,
// no whitespace, bigints as decimal strings.
import crypto from "node:crypto";

export function canon(v) {
  if (typeof v === "bigint") return JSON.stringify(v.toString());
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
}

export function hashEntry(e) {
  const { hash, ...body } = e;
  return crypto.createHash("sha256").update(canon(body)).digest("hex");
}

/** Re-chain a list of entries (plain copies): fix every prev and hash in order. */
export function rechain(entries) {
  let prev = "";
  return entries.map((e) => {
    const body = { ...e, prev };
    delete body.hash;
    const out = { ...body, hash: hashEntry(body) };
    prev = out.hash;
    return out;
  });
}
