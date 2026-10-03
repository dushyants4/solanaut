// §4 "Message versions", v0 tables, v1; §5 rules 1 to 3; §11 fail-closed battery.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuard } from "@solanaut/sdk";
import {
  P, cast, compile, sys, cb, decide, effects, rawV0, rawV1, u32, u64, cat, newKey, randomHash, basePolicy, neutralSensor,
} from "./lib.mjs";
import { denied, allowed } from "./assert-helpers.mjs";

const c = await cast();
const transferData = (lamports) => cat(u32(2), u64(lamports));

test("D01 garbage: a legacy transfer cut short inside its blockhash is malformed-proposal", async () => {
  const m = compile({ payer: c.A, ixs: [sys.transfer(c.A, c.B, 1000n)] });
  const cut = m.slice(0, 3 + 1 + 32 * 3 + 10); // header, count, three keys, ten bytes of the blockhash
  denied(await decide(c, cut), "malformed-proposal");
});

test("D02 version byte 0x82 (v2) on an otherwise well-formed v0 body is unsupported-version", async () => {
  const m = rawV0({ header: [1, 0, 1], keys: [c.A, c.B, P.system], blockhash: randomHash(),
    ixs: [{ p: 2, a: [0, 1], d: transferData(1000n) }], lookups: [] });
  m[0] = 0x82;
  denied(await decide(c, m), "unsupported-version");
});

test("D03 one trailing byte after a complete legacy message is malformed-proposal", async () => {
  const m = compile({ payer: c.A, ixs: [sys.transfer(c.A, c.B, 1000n)] });
  allowed(await decide(c, m)); // precondition: the message itself is admitted
  denied(await decide(c, cat(m, Uint8Array.of(0))), "malformed-proposal");
});

test("D04 a proposal whose `at` is a string, not a number, is malformed-proposal", async () => {
  const m = compile({ payer: c.A, ixs: [sys.transfer(c.A, c.B, 1000n)] });
  const guard = await createGuard({ policy: basePolicy(c), sensor: neutralSensor });
  const d = guard.check({ message: m, at: "1700000000000" });
  guard.close();
  denied(d, "malformed-proposal");
});

test("D05 a v0 message loading its destination from an unpinned table is lookup-table-unpinned", async () => {
  const m = rawV0({ header: [1, 0, 1], keys: [c.A, P.system], blockhash: randomHash(),
    ixs: [{ p: 1, a: [0, 2], d: transferData(1000n) }], lookups: [{ table: c.LT2, w: [0], r: [] }] });
  denied(await decide(c, m, (p) => { p.lookupTables = [{ address: c.LT, entries: [c.B] }]; }), "lookup-table-unpinned");
});

test("D06 v0 pin boundary: index length-1 resolves and is admitted; index == pinned length is lookup-table-unpinned", async () => {
  const pin = (p) => { p.lookupTables = [{ address: c.LT, entries: [c.K2, c.B] }]; };
  const at = (i) => rawV0({ header: [1, 0, 1], keys: [c.A, P.system], blockhash: randomHash(),
    ixs: [{ p: 1, a: [0, 2], d: transferData(1000n) }], lookups: [{ table: c.LT, w: [i], r: [] }] });
  allowed(await decide(c, at(1), pin));
  denied(await decide(c, at(2), pin), "lookup-table-unpinned");
});

test("D07 v0 account order across two tables: all writable entries, then all read-only; the index lands on the attacker", async () => {
  // Pinned: LT = [B], LT2 = [C]. LT contributes B read-only, LT2 contributes C writable.
  // Correct order: [A, System, C (LT2 writable), B (LT read-only)], so index 2 is C.
  // A table-by-table order would put B at index 2 and admit the drain.
  const pin = (p) => { p.lookupTables = [{ address: c.LT, entries: [c.B] }, { address: c.LT2, entries: [c.C] }]; };
  const m = rawV0({ header: [1, 0, 1], keys: [c.A, P.system], blockhash: randomHash(),
    ixs: [{ p: 1, a: [0, 2], d: transferData(1000n) }],
    lookups: [{ table: c.LT, w: [], r: [0] }, { table: c.LT2, w: [0], r: [] }] });
  const d = await decide(c, m, pin);
  denied(d, "destination-not-allowed");
});

test("D08 v1: the priority fee is the config's lamport total and the CU limit is the config's; a plain transfer is admitted", async () => {
  const m = rawV1({ header: [1, 0, 1], keys: [c.A, c.B, P.system], blockhash: randomHash(),
    config: { priorityFee: 7777n, cuLimit: 450 }, ixs: [{ p: 2, a: [0, 1], d: transferData(1000n) }] });
  const e = effects(c, m);
  assert.equal(e.version, 1);
  assert.equal(e.priorityFee, 7777n);
  assert.equal(e.computeUnitLimit, 450);
  assert.equal(e.baseFee, 5000n);
  const d = await decide(c, m);
  allowed(d);
  assert.equal(d.amounts.fees, "12777");
});

test("D09 v1 with no CU limit in its config: computeUnitLimit is 0, not a default", async () => {
  const m = rawV1({ header: [1, 0, 1], keys: [c.A, c.B, P.system], blockhash: randomHash(),
    config: { priorityFee: 10n }, ixs: [{ p: 2, a: [0, 1], d: transferData(1000n) }] });
  const e = effects(c, m);
  assert.equal(e.computeUnitLimit, 0);
  assert.equal(e.priorityFee, 10n);
});

test("D10 v1 with a ComputeBudget SetComputeUnitPrice decoy is instruction-denied", async () => {
  const m = rawV1({ header: [1, 0, 2], keys: [c.A, c.B, P.system, P.cb], blockhash: randomHash(),
    config: { cuLimit: 450 },
    ixs: [{ p: 3, a: [], d: cb.price(1n).data }, { p: 2, a: [0, 1], d: transferData(1000n) }] });
  denied(await decide(c, m), "instruction-denied");
});

test("D11 v1 with SetComputeUnitLimit, benign in legacy, is instruction-denied", async () => {
  const m = rawV1({ header: [1, 0, 2], keys: [c.A, c.B, P.system, P.cb], blockhash: randomHash(),
    config: { cuLimit: 450 },
    ixs: [{ p: 3, a: [], d: cb.limit(450).data }, { p: 2, a: [0, 1], d: transferData(1000n) }] });
  denied(await decide(c, m), "instruction-denied");
});

test("D12 v1 inline-account boundary: 64 accounts admitted, 65 is malformed-proposal", async () => {
  const build = (n) => {
    const fillers = Array.from({ length: n - 3 }, () => newKey());
    const keys = [c.A, c.B, ...fillers, P.system];
    return rawV1({ header: [1, 0, 1], keys, blockhash: randomHash(), config: { cuLimit: 450 },
      ixs: [{ p: keys.length - 1, a: [0, 1], d: transferData(1000n) }] });
  };
  allowed(await decide(c, build(64)));
  denied(await decide(c, build(65)), "malformed-proposal");
});

test("D13 v1 whose first instruction advances a durable nonce is durable-nonce-denied", async () => {
  const nonce = newKey();
  const keys = [c.A, nonce, c.B, P.system, P.sysvarRecentBlockhashes];
  const m = rawV1({ header: [1, 0, 2], keys, blockhash: randomHash(), config: { cuLimit: 900 },
    ixs: [{ p: 3, a: [1, 4, 0], d: u32(4) }, { p: 3, a: [0, 2], d: transferData(1000n) }] });
  denied(await decide(c, m), "durable-nonce-denied");
});
