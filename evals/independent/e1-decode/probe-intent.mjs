// Black-box probe: which fields of the effects object, canonically hashed, give the guard's intent key?
import crypto from "node:crypto";
import { cast, compile, sys, effects } from "./tests/lib.mjs";

const c = await cast();
const m = compile({ payer: c.A, ixs: [sys.transfer(c.A, c.B, 1000n)] });
const e = effects(c, m);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const canon = (v, numBig) => {
  if (typeof v === "bigint") return numBig ? v.toString() : JSON.stringify(v.toString());
  if (Array.isArray(v)) return `[${v.map((x) => canon(x, numBig)).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k], numBig)}`).join(",")}}`;
  return JSON.stringify(v);
};
const fields = Object.keys(e).filter((k) => k !== "intentKey");
console.log("effects fields:", fields.join(","));
let hits = 0;
for (let bits = 1; bits < 1 << fields.length; bits++) {
  const o = {};
  fields.forEach((f, i) => { if (bits & (1 << i)) o[f] = e[f]; });
  for (const nb of [false, true]) {
    if (sha(canon(o, nb)) === e.intentKey) { console.log("MATCH", Object.keys(o).join(","), nb ? "bigint as number" : "bigint as string"); hits++; }
  }
}
// A few framings around the spec's six fields.
const six = { feePayer: e.feePayer, signers: e.signers, opaque: e.opaque, sol: e.sol, tokens: e.tokens, nonce: e.nonce };
for (const [label, s] of [
  ["six, plain", canon(six, false)],
  ["six + v:1", canon({ ...six, v: 1 }, false)],
  ["six + version:1", canon({ ...six, version: 1 }, false)],
  ["six, pretty", JSON.stringify(JSON.parse(canon(six, false)), null, 2)],
  ["six + newline", canon(six, false) + "\n"],
  ["ordered array", canon([e.feePayer, e.signers, e.opaque, e.sol, e.tokens, e.nonce], false)],
  ["six, lamports as number", canon(six, true)],
]) console.log(label, sha(s) === e.intentKey);
const again = effects(c, m).intentKey;
console.log("stable across calls:", again === e.intentKey);
console.log("hits", hits);
