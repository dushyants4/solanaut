// LIF-4/SIG-2/3: real journal, fake host actions; no key or chain send.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createGuard, memoryStore, type Guard } from "@solanaut/sdk";
import { createRequestHandler } from "../src/handler.ts";
import type { Proposal } from "../src/core.ts";
import { createSignerCore } from "../src/core.ts";
import { WORKLOAD_POLICY } from "../../../packages/sdk/test/support/workload.ts";
import { craftLegacy, key } from "../../../packages/sdk/test/support/craft.ts";
import type { ControlMethod } from "../../../packages/sdk/src/control-request.ts";
const request = (method = "status", id = "status-a") => ({ method, clientId: "agent", id, deadline: 2000, ...(method === "propose" ? { message: "AA==" } : {}), ...(method === "report" ? { decision: "a".repeat(64) } : {}) });
const core = () => ({ propose: async (_proposal: Proposal) => ({ stage: "response" as const, decision: "a".repeat(64), status: "denied" as const }), report: async (_decision: string, _deadline?: number) => {} });
test("LIF-4: status starts before reading, and completed retries preserve the first snapshot after deadline", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); let calls = 0;
  const handle = createRequestHandler({ guard: g, core: core(), now: () => 1000, status() { calls++; assert.equal(g.entries().at(-1)?.kind, "request"); return { mode: "same-user", ready: true }; } });
  try {
    const first = await handle(request()); assert.deepEqual(first, { mode: "same-user", ready: true });
    let retry: unknown; await assert.doesNotReject(async () => { retry = await handle({ ...request(), deadline: 0 }); });
    assert.deepEqual(retry, first); assert.equal(calls, 1); assert.equal(g.entries().length, 2);
  } finally { g.close(); }
});
test("LIF-4: concurrent retries coalesce and differing methods refuse before actions", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); let calls = 0;
  let release!: () => void; const waiting = new Promise<void>((resolve) => { release = resolve; });
  const handle = createRequestHandler({ guard: g, core: core(), now: () => 1000, status: async () => { calls++; await waiting; return { ready: true }; } });
  try {
    const first = handle(request()); const next = handle({ ...request(), deadline: 2100 });
    const changed = handle(request("report")); release();
    await assert.rejects(changed, /identity|payload/);
    assert.deepEqual(await first, await next); assert.equal(calls, 1); assert.equal(g.entries().length, 2);
  } finally { release(); g.close(); }
});
test("SIG-4/LIF-4: report replies reflect recorded host evidence and a retry never repeats the hint", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); let calls = 0;
  const message = craftLegacy({ header: [1, 0, 1], keys: [key(1), key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
  const d = g.check({ message, at: 1000 }); assert.equal(d.allow, true);
  const host = core(); host.report = async (decision) => { calls++; g.report(decision, "landed"); };
  const handle = createRequestHandler({ guard: g, core: host, now: () => 1000, status: () => ({}) });
  const r = { ...request("report"), decision: d.hash };
  try { assert.deepEqual(await handle(r), { decision: d.hash, outcome: "landed" }); assert.deepEqual(await handle({ ...r, deadline: 0 }), { decision: d.hash, outcome: "landed" }); assert.equal(calls, 1); }
  finally { g.close(); }
});
test("SIG-3: a late status read cannot become a successful new answer", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); let clock = 1000;
  const handle = createRequestHandler({ guard: g, core: core(), now: () => clock, status() { clock = 2000; return { ready: true }; } });
  try { assert.deepEqual(await handle(request()), { status: "denied", code: "deadline" }); }
  finally { g.close(); }
});
test("LIF-4: a control request cannot steal a concurrent proposal's identity", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); const host = core();
  let release!: () => void; const waiting = new Promise<void>((resolve) => { release = resolve; });
  host.propose = async () => { await waiting; return { stage: "response", decision: "a".repeat(64), status: "denied" }; };
  const handle = createRequestHandler({ guard: g, core: host, now: () => 1000, status: () => ({}) });
  try { const proposal = handle(request("propose")); const collision = handle(request()); release(); await assert.rejects(collision, /identity|payload/); await proposal; assert.equal(g.entries().length, 0); }
  finally { release(); g.close(); }
});
test("SIG-3/LIF-4: expired or overlong new control requests persist a denial and perform no work", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); let calls = 0;
  const handle = createRequestHandler({ guard: g, core: core(), now: () => 1000, status() { calls++; return {}; } });
  try {
    for (const [i, deadline] of [1000, 31_001, NaN].entries()) {
      const r = { ...request("status", `expired-${i}`), deadline };
      assert.deepEqual(await handle(r), { status: "denied", code: "deadline" });
      assert.deepEqual(await handle({ ...r, deadline: 2000 }), { status: "denied", code: "deadline" });
    }
    assert.equal(calls, 0); assert.equal(g.entries().length, 6);
  } finally { g.close(); }
});
test("LIF-4/SIG-3: report hints use the request deadline and failures persist fixed answers", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); let calls = 0; let observed: unknown;
  const host = core(); host.report = async (decision, deadline) => { calls++; observed = deadline; assert.equal(decision, "a".repeat(64)); assert.equal(g.entries().at(-1)?.kind, "request"); throw new Error("private-error-marker"); };
  const handle = createRequestHandler({ guard: g, core: host, now: () => 1000, status: () => ({}) });
  try {
    assert.deepEqual(await handle(request("report")), { status: "denied", code: "unavailable" });
    assert.equal(observed, 2000);
    assert.deepEqual(await handle({ ...request("report"), deadline: 0 }), { status: "denied", code: "unavailable" });
    assert.equal(calls, 1); assert.equal(JSON.stringify(g.entries()).includes("private-error-marker"), false);
  } finally { g.close(); }
});
test("LIF-4: pending control request resumes on restart; stored response then prevents re-execution", async () => {
  const store = memoryStore(); const old = await createGuard({ policy: WORKLOAD_POLICY, log: store });
  old.beginRequest(request(), "status", {}, 1000); old.close(); let calls = 0;
  for (const deadline of [2000, 0]) {
    const g = await createGuard({ policy: WORKLOAD_POLICY, log: store });
    const handle = createRequestHandler({ guard: g, core: core(), now: () => 1000, status() { calls++; return { ready: true }; } });
    try { assert.deepEqual(await handle({ ...request(), deadline }), { ready: true }); }
    finally { g.close(); }
  }
  assert.equal(calls, 1); assert.equal(store.entries.length, 2);
});
test("LIF-4: control/proposal identity reuse refuses before calling the proposal executor", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); let calls = 0; const host = core();
  host.propose = async () => { calls++; return { stage: "response", decision: "a".repeat(64), status: "denied" }; };
  const handle = createRequestHandler({ guard: g, core: host, now: () => 1000, status: () => ({}) });
  try { await handle(request()); await assert.rejects(handle(request("propose")), /identity|payload/); assert.equal(calls, 0); }
  finally { g.close(); }
});
test("SIG-2/LIF-4: unknown methods never dispatch, and response write failure throws and closes admission", async () => {
  const store = memoryStore(); let fail = false;
  const g: Guard = await createGuard({ policy: WORKLOAD_POLICY, log: { entries: store.entries, append(e) { if (fail) throw new Error("ENOSPC"); store.append(e); }, close() {} } });
  const handle = createRequestHandler({ guard: g, core: core(), now: () => 1000, status() { fail = true; return {}; } });
  try {
    await assert.rejects(handle(request("release")), /method/); assert.equal(g.entries().length, 0);
    await assert.rejects(handle(request()), /record|ENOSPC/); assert.equal(g.entries().length, 1);
    assert.equal(g.check({ message: new Uint8Array(), at: 1000 }).seq, -1);
  } finally { g.close(); }
});
test("LIF-5: pre-admission proposal failure persists a fixed refusal and binds the exact payload", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); const host = core(); let calls = 0;
  host.propose = async () => { calls++; throw new Error("private-provider-detail"); };
  const handle = createRequestHandler({ guard: g, core: host, now: () => 1000, status: () => ({}) });
  try {
    assert.deepEqual(await handle(request("propose")), { status: "denied", code: "unavailable" });
    assert.deepEqual(await handle({ ...request("propose"), deadline: 0 }), { status: "denied", code: "unavailable" });
    await assert.rejects(handle({ ...request("propose"), message: "AQ==" }), /identity|payload/);
    await assert.rejects(handle({ ...request("propose"), group: "changed" }), /identity|payload/);
    assert.equal(calls, 1); assert.equal(g.entries().length, 2);
    assert.equal(g.entries().filter((e) => e.kind === "decision").length, 0);
    assert.equal(JSON.stringify(g.entries()).includes("private-provider-detail"), false);
  } finally { g.close(); }
});
test("LIF-5: a refusal start interrupted before its response completes conservatively without new proposal work", async () => {
  const store = memoryStore(); const g = await createGuard({ policy: WORKLOAD_POLICY, log: store });
  g.beginRequest(request("propose"), "propose" as ControlMethod, { message: "AA==", group: null }, 1000); g.close();
  let calls = 0; const host = core(); host.propose = async () => { calls++; throw new Error("must not run"); };
  for (const deadline of [2000, 0]) {
    const next = await createGuard({ policy: WORKLOAD_POLICY, log: store });
    const handle = createRequestHandler({ guard: next, core: host, now: () => 1000, status: () => ({}) });
    try { assert.deepEqual(await handle({ ...request("propose"), deadline }), { status: "denied", code: "unavailable" }); }
    finally { next.close(); }
  }
  assert.equal(calls, 0); assert.equal(store.entries.length, 2);
});
test("LIF-5: an error after a recorded admission cannot become a non-admission refusal", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); const host = core();
  host.propose = async (r) => { g.check({ message: Buffer.from(r.message, "base64"), at: 1000 }, r); throw new Error("after-admission"); };
  const handle = createRequestHandler({ guard: g, core: host, now: () => 1000, status: () => ({}) });
  try { await assert.rejects(handle(request("propose")), /after-admission/); assert.equal(g.entries().length, 1); assert.equal(g.entries()[0]?.kind, "decision"); }
  finally { g.close(); }
});
test("LIF-5/SIG-3: a proposal expiring before admission keeps its refusal when retried with a fresh deadline", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); const host = core(); let clock = 1000; let calls = 0;
  host.propose = async () => { calls++; clock = 2000; throw new Error("deadline"); };
  const handle = createRequestHandler({ guard: g, core: host, now: () => clock, status: () => ({}) });
  try { assert.deepEqual(await handle(request("propose")), { status: "denied", code: "deadline" }); assert.deepEqual(await handle({ ...request("propose"), deadline: 3000 }), { status: "denied", code: "deadline" }); assert.equal(calls, 1); }
  finally { g.close(); }
});
test("LIF-5: the real executor's malformed-message and RPC failures reach durable refusal history", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY }); let reads = 0; let signs = 0;
  const host = createSignerCore({ guard: g, now: () => 1000, sign: async () => { signs++; throw new Error("must not sign"); }, rpc: {
    observe: async () => { reads++; throw new Error("provider unavailable"); }, height: async () => 1n, send: async () => "", outcome: async () => null,
  } });
  const handle = createRequestHandler({ guard: g, core: host, now: () => 1000, status: () => ({}) });
  try {
    for (const [id, message] of [["malformed", "!!!"], ["rpc", "AA=="]]) {
      const r = { ...request("propose", id), message };
      assert.deepEqual(await handle(r), { status: "denied", code: "unavailable" });
      assert.deepEqual(await handle({ ...r, deadline: 0 }), { status: "denied", code: "unavailable" });
    }
    assert.equal(signs, 0); assert.equal(reads, 1); assert.equal(g.entries().length, 4);
    assert.equal(g.entries().filter((e) => e.kind === "decision").length, 0);
  } finally { g.close(); }
});
