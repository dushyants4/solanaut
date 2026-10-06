// LIF-4: durable status/report identities, before operational socket wiring.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createGuard, replay, type Guard } from "../src/guard.ts";
import { hashOf, seal, type Entry } from "../src/log.ts";
import { memoryStore } from "../src/record.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";
const identity = { clientId: "agent", id: "status-a" };
const control = (g: Guard) => g as Guard & {
  beginRequest(id: typeof identity, method: "status" | "report", payload: unknown, at: number): Entry;
  finishRequest(start: string, result: unknown): Entry;
  requestResult(start: string): unknown;
};
const message = craftLegacy({ header: [1, 0, 1], keys: [key(1), key(3), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
test("LIF-4: start and first answer are immutable, copied and reused without new entries", async () => {
  const g = control(await createGuard({ policy: WORKLOAD_POLICY }));
  try {
    const start = g.beginRequest(identity, "status", {}, 1000); assert.equal(g.entries().length, 1);
    assert.equal(g.beginRequest(identity, "status", {}, 2000), start);
    const result = { mode: "same-user", nested: { ready: true } }; const end = g.finishRequest(start.hash, result);
    result.nested.ready = false;
    assert.deepEqual(g.requestResult(start.hash), { mode: "same-user", nested: { ready: true } });
    const returned = g.requestResult(start.hash) as typeof result; returned.nested.ready = false;
    assert.equal((g.requestResult(start.hash) as typeof result).nested.ready, true);
    assert.equal(g.finishRequest(start.hash, { mode: "same-user", nested: { ready: true } }), end);
    assert.throws(() => g.finishRequest(start.hash, { changed: true }), /answer|response/);
    assert.equal(g.entries().length, 2); assert.equal(g.status().consecutiveDenials, 0);
  } finally { g.close(); }
});
test("LIF-4: changed method/payload and invalid identity or payload refuse before recording", async () => {
  const g = control(await createGuard({ policy: WORKLOAD_POLICY }));
  try {
    g.beginRequest(identity, "report", { decision: "a".repeat(64) }, 1000);
    assert.throws(() => g.beginRequest(identity, "report", { decision: "b".repeat(64) }, 1000), /identity|payload/);
    assert.throws(() => g.beginRequest(identity, "status", {}, 1000), /identity|payload/);
    for (const [id, method, payload, at] of [[{ ...identity, id: "" }, "status", {}, 1000], [{ ...identity, id: "new" }, "status", { extra: true }, 1000], [{ ...identity, id: "new" }, "report", { decision: "not-hash" }, 1000], [{ ...identity, id: "new" }, "status", {}, NaN]] as const) {
      assert.throws(() => g.beginRequest(id, method, payload, at));
    }
    assert.equal(g.entries().length, 1);
  } finally { g.close(); }
});
test("LIF-4: proposal and control methods share one request namespace in both orders", async () => {
  for (const first of ["proposal", "control"]) {
    const g = control(await createGuard({ policy: WORKLOAD_POLICY }));
    try {
      if (first === "proposal") { g.check({ message, at: 1000 }, identity); assert.throws(() => g.beginRequest(identity, "status", {}, 1000), /identity|payload/); }
      else { g.beginRequest(identity, "status", {}, 1000); const d = g.check({ message, at: 1000 }, identity); assert.equal(d.seq, -1); assert.match(d.reason, /identity|payload/); }
      assert.equal(g.entries().length, 1);
    } finally { g.close(); }
  }
});
test("LIF-4: pending and completed control requests restore and replay without admissions", async () => {
  const store = memoryStore(); const g = control(await createGuard({ policy: WORKLOAD_POLICY, log: store }));
  const pending = g.beginRequest(identity, "report", { decision: "a".repeat(64) }, 1000);
  const done = g.beginRequest({ ...identity, id: "done" }, "status", {}, 1000); g.finishRequest(done.hash, { ready: true }); g.close();
  const next = control(await createGuard({ policy: WORKLOAD_POLICY, log: store }));
  try {
    assert.equal(next.beginRequest(identity, "report", { decision: "a".repeat(64) }, 2000).hash, pending.hash);
    assert.equal(next.requestResult(pending.hash), undefined); assert.deepEqual(next.requestResult(done.hash), { ready: true });
    const r = await replay(next.entries(), WORKLOAD_POLICY); assert.equal(r.ok, true); assert.equal(r.decisions, 0);
  } finally { next.close(); }
});
test("LIF-4: unknown, oversized and invalid responses refuse, and write failure closes the guard", async () => {
  const store = memoryStore(); let fail = false;
  const g = control(await createGuard({ policy: WORKLOAD_POLICY, log: { entries: store.entries, append(e) { if (fail) throw new Error("ENOSPC"); store.append(e); }, close() {} } }));
  try {
    const start = g.beginRequest(identity, "status", {}, 1000);
    assert.throws(() => g.finishRequest("a".repeat(64), {}), /request/);
    assert.throws(() => g.finishRequest(start.hash, { oversized: "x".repeat(16_384) }), /bound|large/);
    assert.throws(() => g.finishRequest(start.hash, { invalid: NaN }));
    fail = true; assert.throws(() => g.finishRequest(start.hash, {}), /record|ENOSPC/);
    assert.equal(g.check({ message, at: 1000 }).allow, false);
    assert.equal(g.entries().length, 1); assert.equal(g.requestResult(start.hash), undefined);
  } finally { g.close(); }
});
for (const fault of ["digest", "duplicate", "response-before-start", "changed-response"]) test(`LIF-4: resealed ${fault} control evidence refuses restore/replay`, async () => {
  const g = control(await createGuard({ policy: WORKLOAD_POLICY }));
  const start = g.beginRequest(identity, "status", {}, 1000); const end = g.finishRequest(start.hash, { ready: true }); g.close();
  const reseal = (entry: Entry, changes: Record<string, unknown>) => { const { hash: _, ...body } = entry; return seal({ ...body, ...changes } as any) as Entry; };
  const entries = fault === "digest" ? [reseal(start, { request: { ...(start as any).request, digest: "0".repeat(64) } })] :
    fault === "duplicate" ? [start, reseal(start, { seq: 1, prev: start.hash })] :
    fault === "response-before-start" ? [reseal(end, { seq: 0, prev: "" })] :
    [start, end, reseal(end, { seq: 2, prev: end.hash, result: '{"changed":true}' })];
  for (const e of entries) assert.equal(hashOf(e), e.hash);
  await assert.rejects(createGuard({ policy: WORKLOAD_POLICY, log: { entries, append() {}, close() {} } }), /request|response/);
  assert.equal((await replay(entries, WORKLOAD_POLICY)).ok, false);
});
