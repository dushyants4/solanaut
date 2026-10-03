// Exact statements: §3's hash definitions, §4's principal (delegates), v0 pin edges, the fee formula on v0.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { P, cast, compile, sys, tok, cb, decide, effects, rawV0, u32, u64, cat, randomHash } from "./lib.mjs";
import { denied, allowed } from "./assert-helpers.mjs";

const c = await cast();
const legacy = (...ixs) => compile({ payer: c.A, ixs });
const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
// §3: "Canonical JSON" means sorted keys, no whitespace, and bigints as decimal strings.
function canonical(v) {
  if (typeof v === "bigint") return JSON.stringify(v.toString());
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

test("S01 §3 messageHash is the lowercase hex SHA-256 of the message bytes, in the effects and in the decision", async () => {
  const m = legacy(sys.transfer(c.A, c.B, 1000n));
  assert.equal(effects(c, m).messageHash, sha256(m));
  assert.equal((await decide(c, m)).messageHash, sha256(m));
});

test("S02 §3 intentKey = sha256(canonical {feePayer, signers, opaque, sol, tokens, nonce}), recomputed independently", () => {
  const m = legacy(sys.transfer(c.A, c.B, 1000n));
  const expected = sha256(canonical({
    feePayer: c.A, signers: [c.A], opaque: [], nonce: false, tokens: [],
    sol: [{ from: c.A, to: c.B, lamports: 1000n, kind: "transfer" }],
  }));
  assert.equal(effects(c, m).intentKey, expected);
});

test("S03 §3 DecisionV1: a proposal whose bytes do not parse records intentKey null", async () => {
  const d = await decide(c, Uint8Array.of(1, 0, 1, 5));
  denied(d, "malformed-proposal");
  assert.equal(d.intentKey, null);
});

test("S04 §4 The principal: a delegate transfer (principal authority on an outsider's token account) is counted: over the mint's cap is over-per-tx-cap", async () => {
  denied(await decide(c, legacy(tok.transferChecked(P.token, c.ataC_M, c.M, c.ataB_M, c.A, 2_000_000n))), "over-per-tx-cap");
});

test("S05 §4 v0 pins: an empty pin denies index 0, and a read-only index past a pin is denied: lookup-table-unpinned", async () => {
  const transfer = { p: 1, a: [0, 2], d: cat(u32(2), u64(1000n)) };
  const empty = rawV0({ header: [1, 0, 1], keys: [c.A, P.system], blockhash: randomHash(), ixs: [transfer],
    lookups: [{ table: c.LT, w: [0], r: [] }] });
  denied(await decide(c, empty, (p) => { p.lookupTables = [{ address: c.LT, entries: [] }]; }), "lookup-table-unpinned");
  const ro = rawV0({ header: [1, 0, 1], keys: [c.A, P.system], blockhash: randomHash(), ixs: [transfer],
    lookups: [{ table: c.LT, w: [0], r: [1] }] });
  denied(await decide(c, ro, (p) => { p.lookupTables = [{ address: c.LT, entries: [c.B] }]; }), "lookup-table-unpinned");
});

test("S06 §4 Fees: the legacy-and-v0 formula applies to a v0 message (limit 333,333 at price 3 gives 1)", () => {
  const m = compile({ payer: c.A, version: 0, ixs: [cb.limit(333_333), cb.price(3n), sys.transfer(c.A, c.B, 1n)] });
  const e = effects(c, m);
  assert.equal(e.version, 0);
  assert.equal(e.computeUnitLimit, 333_333);
  assert.equal(e.priorityFee, 1n);
});
