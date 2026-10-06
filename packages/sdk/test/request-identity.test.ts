// LIF-1: an identity is committed with its admission, including denials.
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createGuard, replay, type Guard } from "../src/guard.ts";
import { seal, type DecisionEntry } from "../src/log.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";

const message = (destination = 2, amount = 1) => craftLegacy({ header: [1, 0, 1], keys: [key(1), key(destination), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, amount, 0, 0, 0, 0, 0, 0, 0] }] });
const id = { clientId: "agent-a", id: "request-a" };
// Test against the old API first without changing the production signature.
const check = (g: Guard, bytes: Uint8Array, at: number, identity = id, intent?: string) =>
  (g.check as (p: { message: Uint8Array; at: number; intent?: string }, request: typeof id) => DecisionEntry)({ message: bytes, at, ...(intent === undefined ? {} : { intent }) }, identity);

test("LIF-1: duplicate admission returns the original entry without another reservation or controller tick", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  try {
    const d = check(g, message(), 1000);
    assert.equal(d.allow, true); assert.ok(d.request);
    assert.equal(check(g, message(), 2000), d);
    assert.equal(g.entries().length, 1); assert.equal(g.status().seq, 1);
    assert.equal(g.redeem(message(), d.hash).ok, true);
    assert.equal(check(g, message(), 3000), d);
    assert.equal(g.redeem(message(), d.hash).ok, false, "retry returns no fresh receipt");
  } finally { g.close(); }
});
test("LIF-1: duplicate denied request returns the same denial without accumulating latch denials", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  try {
    const d = check(g, message(3), 1000);
    assert.equal(d.rule, "destination-not-allowed");
    assert.equal(check(g, message(3), 2000), d);
    assert.equal(g.status().consecutiveDenials, 1);
  } finally { g.close(); }
});
test("LIF-1: changed bytes or grouping under the same identity are refused", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  try {
    check(g, message(), 1000, id, "group-a");
    for (const [bytes, intent] of [[message(2, 2), "group-a"], [message(), "group-b"]] as const) {
      const d = check(g, bytes, 2000, id, intent);
      assert.equal(d.allow, false); assert.match(d.reason, /identity.*payload/);
    }
    assert.equal(g.entries().length, 1);
  } finally { g.close(); }
});
test("LIF-1: client identities are separate namespaces and invalid identities fail closed", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  try {
    check(g, message(3), 1000);
    assert.equal(check(g, message(3), 2000, { ...id, clientId: "agent-b" }).seq, 1);
    for (const invalid of [{ ...id, id: "" }, { ...id, clientId: "x".repeat(129) }]) assert.equal(check(g, message(), 3000, invalid).allow, false);
    assert.equal(g.entries().length, 2);
  } finally { g.close(); }
});
test("LIF-1: identity and original decision survive durable restart", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "solanaut-request-")), "guard.jsonl");
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  const d = check(g, message(), 1000); g.close();
  const next = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  try {
    assert.equal(check(next, message(), 9000).hash, d.hash);
    assert.equal(next.entries().length, 1);
    assert.equal((await replay(next.entries(), WORKLOAD_POLICY)).ok, true);
  } finally { next.close(); }
});
for (const fault of ["digest", "guard", "duplicate"]) test(`LIF-1: resealed ${fault} request evidence refuses restore and replay`, async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  const d = check(g, message(), 1000); g.close();
  assert.ok(d.request);
  const { hash: _hash, ...body } = d;
  const entries = fault === "duplicate" ? [d, seal<DecisionEntry>({ ...body, seq: 1, prev: d.hash })] :
    [seal<DecisionEntry>({ ...body, request: { ...d.request, ...(fault === "digest" ? { digest: "0".repeat(64) } : { guardId: "foreign" }) } })];
  await assert.rejects(createGuard({ policy: WORKLOAD_POLICY, log: { entries, append() {}, close() {} } }), /request/);
  assert.equal((await replay(entries, WORKLOAD_POLICY)).ok, false);
});
