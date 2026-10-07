// LIF-2: signed bytes, send intent and responses share the admission's durable chain.
import { strict as assert } from "node:assert";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createGuard, replay, type Guard } from "../src/guard.ts";
import { encodeBase58 } from "../src/base58.ts";
import { seal, type Entry } from "../src/log.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";

const agent = generateKeyPairSync("ed25519");
const publicBytes = Buffer.from(agent.publicKey.export({ format: "jwk" }).x!, "base64url");
const policy = { ...WORKLOAD_POLICY, principal: [encodeBase58(publicBytes)] };
const message = craftLegacy({ header: [1, 0, 1], keys: [[...publicBytes], key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
const bytes = sign(null, message, agent.privateKey);
const signed = { wire: Buffer.concat([Buffer.from([1]), bytes, message]).toString("base64"), signature: encodeBase58(bytes) };
const record = (g: Guard, event: object) => (g as unknown as { recordSigning(event: object): unknown }).recordSigning(event);
async function admitted(log?: string) {
  const g = await createGuard({ policy, ...(log ? { log } : {}) });
  const d = g.check({ message, at: 1000, blockHeight: 10n, lastValidBlockHeight: 100n }, { clientId: "a", id: "one" });
  assert.equal(d.allow, true);
  return { g, d, signed: { stage: "signed", decision: d.hash, ...signed } };
}
for (const outcome of ["landed", "failed", "expired"] as const) test(`LIF-7: final ${outcome} evidence forbids new signing/send intent live and on replay`, async () => {
  for (const alreadySigned of [false, true]) {
    const { g, d, signed } = await admitted();
    try {
      assert.equal(g.redeem(message, d.hash, 10n).ok, true);
      if (alreadySigned) record(g, signed);
      g.report(d.hash, outcome);
      const event = alreadySigned ? { stage: "send-started", decision: d.hash, blockHeight: "11" } : signed;
      const before = g.entries().length;
      assert.throws(() => record(g, event), /final|reported|settled/);
      assert.equal(g.entries().length, before);
      const forged = seal({ kind: "signing", v: 1, seq: before, prev: g.entries().at(-1)!.hash, at: 1000, event } as never);
      assert.equal((await replay([...g.entries(), forged], policy)).ok, false);
    } finally { g.close(); }
  }
});
test("LIF-2: signature evidence requires durable redemption; valid lifecycle replays", async () => {
  const { g, d, signed } = await admitted();
  try {
    assert.throws(() => record(g, signed), /redeem/);
    assert.equal(g.redeem(message, d.hash, 10n).ok, true);
    record(g, signed);
    record(g, { stage: "send-started", decision: d.hash, blockHeight: "11" });
    record(g, { stage: "response", decision: d.hash, status: "sent", signature: signed.signature });
    assert.equal((await replay(g.entries(), policy)).ok, true);
    assert.equal(g.entries().length, 5);
  } finally { g.close(); }
});
test("LIF-7: unknown evidence preserves the admitted signing/send lifecycle", async () => {
  const { g, d, signed } = await admitted();
  try {
    g.report(d.hash, "unknown");
    assert.equal(g.redeem(message, d.hash, 10n).ok, true);
    assert.doesNotThrow(() => record(g, signed));
    assert.doesNotThrow(() => record(g, { stage: "send-started", decision: d.hash, blockHeight: "11" }));
    assert.equal((await replay(g.entries(), policy)).ok, true);
  } finally { g.close(); }
});
for (const fault of ["wrong-bytes", "wrong-signature", "wrong-wire", "noncanonical-base64"]) test(`LIF-2: ${fault} cannot be persisted as signed evidence`, async () => {
  const { g, d, signed } = await admitted();
  try {
    g.redeem(message, d.hash, 10n);
    const altered = { ...signed };
    if (fault === "wrong-signature") { const invalid = Buffer.alloc(64); altered.signature = encodeBase58(invalid); altered.wire = Buffer.concat([Buffer.from([1]), invalid, message]).toString("base64"); }
    if (fault === "wrong-wire") altered.wire = "AA==";
    if (fault === "noncanonical-base64") altered.wire += "\n";
    if (fault === "wrong-bytes") { const other = Buffer.from(message); other[other.length - 1] = 9; const sig = sign(null, other, agent.privateKey); altered.signature = encodeBase58(sig); altered.wire = Buffer.concat([Buffer.from([1]), sig, other]).toString("base64"); }
    assert.throws(() => record(g, altered), /sign|wire|bytes|base64/);
    assert.equal(g.entries().length, 2);
  } finally { g.close(); }
});
test("LIF-2: send-started requires signed bytes and valid lifetime; every stage is single-use", async () => {
  const { g, d, signed } = await admitted();
  try {
    assert.throws(() => record(g, { stage: "send-started", decision: d.hash, blockHeight: "11" }), /signed/);
    g.redeem(message, d.hash, 10n); record(g, signed);
    assert.throws(() => record(g, signed), /already|duplicate/);
    for (const height of ["101", "-1", "x"]) assert.throws(() => record(g, { stage: "send-started", decision: d.hash, blockHeight: height }), /height|expired/);
    record(g, { stage: "send-started", decision: d.hash, blockHeight: "11" });
    assert.throws(() => record(g, { stage: "send-started", decision: d.hash, blockHeight: "11" }), /already|duplicate/);
    assert.throws(() => record(g, { stage: "response", decision: d.hash, status: "sent", signature: "wrong" }), /signature/);
    record(g, { stage: "response", decision: d.hash, status: "uncertain", signature: signed.signature });
    assert.throws(() => record(g, { stage: "response", decision: d.hash, status: "sent", signature: signed.signature }), /already|duplicate/);
  } finally { g.close(); }
});
test("LIF-2: denied response persists; sent response without send intent is refused", async () => {
  const { g, d, signed } = await admitted();
  try {
    assert.throws(() => record(g, { stage: "response", decision: d.hash, status: "sent", signature: signed.signature }), /send/);
    const denied = g.check({ message: Uint8Array.of(255), at: 2000 }, { clientId: "a", id: "two" });
    record(g, { stage: "response", decision: denied.hash, status: "denied" });
    assert.throws(() => record(g, { ...signed, decision: denied.hash }), /allowed|denied/);
    assert.equal((await replay(g.entries(), policy)).ok, true);
  } finally { g.close(); }
});
test("LIF-2: signing and send-started evidence survive durable restart", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "solanaut-signing-")), "guard.jsonl");
  const { g, d, signed } = await admitted(path);
  g.redeem(message, d.hash, 10n); record(g, signed);
  record(g, { stage: "send-started", decision: d.hash, blockHeight: "11" }); g.close();
  const next = await createGuard({ policy, log: path });
  try {
    assert.throws(() => record(next, { stage: "send-started", decision: d.hash, blockHeight: "11" }), /already|duplicate/);
    assert.equal(next.redeem(message, d.hash, 11n).ok, false);
    record(next, { stage: "response", decision: d.hash, status: "uncertain", signature: signed.signature });
    assert.equal((await replay(next.entries(), policy)).ok, true);
  } finally { next.close(); }
});
test("LIF-2: resealed out-of-order and forged signing history refuse restore/replay", async () => {
  const { g, d, signed } = await admitted();
  const prefix = [...g.entries()]; g.close();
  for (const event of [signed, { stage: "send-started", decision: d.hash, blockHeight: "11" }, { stage: "response", decision: d.hash, status: "sent", signature: signed.signature }]) {
    const e = seal<Entry>({ kind: "signing", v: 1, seq: 1, prev: d.hash, at: 1000, event } as never);
    const entries = [...prefix, e];
    await assert.rejects(createGuard({ policy, log: { entries, append() {}, close() {} } }), /sign|redeem|send/);
    assert.equal((await replay(entries, policy)).ok, false);
  }
});
