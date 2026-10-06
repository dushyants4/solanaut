// LIF-3/SIG: fake RPC only. No key file and no real transaction send.
import { strict as assert } from "node:assert";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { createGuard, encodeBase58, type Entry, type Guard } from "@solanaut/sdk";
import { createSignerCore, type CoreOptions, type Proposal } from "../src/core.ts";
import { WORKLOAD_POLICY } from "../../../packages/sdk/test/support/workload.ts";
import { craftLegacy, key } from "../../../packages/sdk/test/support/craft.ts";

const agent = generateKeyPairSync("ed25519");
const publicBytes = Buffer.from(agent.publicKey.export({ format: "jwk" }).x!, "base64url");
const policy = { ...WORKLOAD_POLICY, principal: [encodeBase58(publicBytes)] };
const message = craftLegacy({ header: [1, 0, 1], keys: [[...publicBytes], key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
const request: Proposal = { clientId: "agent", id: "payment", deadline: 2000, message: Buffer.from(message).toString("base64") };
test("SIG-3/4: caller report deadline bounds the chain read and refuses a late outcome", async () => {
  let observed = 0; let finish!: () => void;
  const waiting = new Promise<void>((resolve) => { finish = resolve; });
  const f = await fixture([], (o) => { o.rpc.outcome = async (_signature, deadline) => { observed = deadline; await waiting; return "landed"; }; });
  try {
    const sent = await f.core.propose(request);
    const report = (f.core.report as (decision: string, deadline: number) => Promise<void>)(sent.decision, 1500);
    await new Promise<void>((resolve) => setImmediate(resolve)); assert.equal(observed, 1500);
    f.clock(1600); finish(); await assert.rejects(report, /deadline/);
    assert.equal(f.g.entries().filter((e) => e.kind === "report").length, 0);
  } finally { finish(); f.g.close(); }
});
async function fixture(entries: Entry[] = [], change?: (options: CoreOptions) => void, appendFault?: (entry: Entry) => void) {
  let clock = 1000; let signed = 0; let sends = 0; let observations = 0; let outcome: "landed" | "failed" | "expired" | "unknown" | null = null;
  const g = await createGuard({ policy, log: { entries, append(e) { appendFault?.(e); entries.push(e); }, close() {} } });
  const options: CoreOptions = { guard: g, now: () => clock, sign: async (bytes) => { signed++; return sign(null, bytes, agent.privateKey); }, rpc: {
    observe: async () => { observations++; return { height: 10n, lastValidBlockHeight: 100n }; }, height: async () => 11n,
    send: async (wire) => { sends++; assert.equal(entries.at(-1)?.kind, "signing"); assert.equal((entries.at(-1) as { event: { stage: string } }).event.stage, "send-started"); return encodeBase58(wire.subarray(1, 65)); },
    outcome: async () => outcome,
  } }; change?.(options); const core = createSignerCore(options);
  return { g, core, entries, counts: () => ({ signed, sends, observations }), clock: (n: number) => { clock = n; }, outcome: (o: typeof outcome) => { outcome = o; } };
}
test("LIF-3/SIG-3: same concurrent and completed request signs/sends only once; expired retry returns response", async () => {
  const f = await fixture();
  try {
    const answers = await Promise.all(Array.from({ length: 20 }, () => f.core.propose(request)));
    assert.equal((answers[0] as { status: string }).status, "sent");
    assert.ok(answers.every((a) => JSON.stringify(a) === JSON.stringify(answers[0])));
    f.clock(5000); let retry: unknown;
    await assert.doesNotReject(async () => { retry = await f.core.propose(request); });
    assert.deepEqual(retry, answers[0]);
    assert.deepEqual(f.counts(), { signed: 1, sends: 1, observations: 1 });
  } finally { f.g.close(); }
});
test("LIF-3/SIG-3: deadlines and changed payloads refuse before signing", async () => {
  const f = await fixture();
  try {
    for (const deadline of [1000, 31_001, Number.NaN]) await assert.rejects(f.core.propose({ ...request, deadline }), /deadline/);
    await f.core.propose(request);
    await assert.rejects(f.core.propose({ ...request, message: "AA==" }), /payload/);
    assert.equal(f.counts().signed, 1);
  } finally { f.g.close(); }
});
test("LIF-3: restart after admission can redeem/sign; restart after redemption cannot sign again", async () => {
  for (const redeemed of [false, true]) {
    const f = await fixture();
    const d = f.g.check({ message, at: 1000, blockHeight: 10n, lastValidBlockHeight: 100n }, request);
    if (redeemed) f.g.redeem(message, d.hash, 10n);
    f.g.close(); const next = await fixture([...f.entries]);
    try {
      const response = await next.core.propose(request) as { status: string };
      assert.equal(response.status, redeemed ? "uncertain" : "sent");
      assert.equal(next.counts().signed, redeemed ? 0 : 1);
      assert.equal(next.counts().sends, redeemed ? 0 : 1);
    } finally { next.g.close(); }
  }
});
test("LIF-3: signed but unsent restart sends once; send-started restart never resends", async () => {
  for (const started of [false, true]) {
    const f = await fixture(); const d = f.g.check({ message, at: 1000, blockHeight: 10n, lastValidBlockHeight: 100n }, request);
    f.g.redeem(message, d.hash, 10n);
    const sig = sign(null, message, agent.privateKey);
    f.g.recordSigning({ stage: "signed", decision: d.hash, wire: Buffer.concat([Buffer.from([1]), sig, message]).toString("base64"), signature: encodeBase58(sig) });
    if (started) f.g.recordSigning({ stage: "send-started", decision: d.hash, blockHeight: "11" });
    f.g.close(); const next = await fixture([...f.entries]);
    try {
      await next.core.recover();
      const response = await next.core.propose(request) as { status: string };
      assert.equal(response.status, started ? "uncertain" : "sent");
      assert.equal(next.counts().signed, 0); assert.equal(next.counts().sends, started ? 0 : 1);
    } finally { next.g.close(); }
  }
});
test("LIF-3/SIG-7: caller hint cannot report outcome; only chain evidence changes reservation", async () => {
  const f = await fixture();
  try {
    const response = await f.core.propose(request) as { decision: string };
    await f.core.report(response.decision);
    assert.equal(f.entries.filter((e) => e.kind === "report").length, 0);
    f.outcome("landed"); await f.core.report(response.decision);
    assert.equal(f.entries.filter((e) => e.kind === "report").length, 1);
    const report = f.entries.find((e) => e.kind === "report"); assert.equal(report?.kind === "report" && report.outcome, "landed");
    await f.core.report(response.decision); assert.equal(f.entries.filter((e) => e.kind === "report").length, 1);
  } finally { f.g.close(); }
});
test("LIF-3: unknown or changed IDs fail closed; malformed base64 is not decoded leniently", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.core.propose({ ...request, id: "" }), /identity/);
    await assert.rejects(f.core.propose({ ...request, message: request.message + "\n" }), /base64/);
    await assert.rejects(f.core.report("unknown"), /decision/);
    assert.equal(f.counts().signed, 0);
  } finally { f.g.close(); }
});
test("LIF-3: send timeout and contradictory signature retain uncertain response; retry never sends", async () => {
  for (const fail of ["timeout", "wrong-signature"]) {
    let sends = 0;
    const f = await fixture([], (o) => { o.rpc.send = async () => { sends++; if (fail === "timeout") throw new Error("lost response"); return "wrong"; }; });
    try {
      const a = await f.core.propose(request) as { status: string };
      assert.equal(a.status, "uncertain"); assert.deepEqual(await f.core.propose(request), a);
      assert.equal(sends, 1); assert.equal(f.entries.filter((e) => e.kind === "report").length, 0);
    } finally { f.g.close(); }
  }
});
test("LIF-3: lost persisted response after successful send is recovered without another send", async () => {
  let sends = 0;
  const f = await fixture([], (o) => { const send = o.rpc.send; o.rpc.send = async (...args) => { sends++; return send(...args); }; }, (e) => {
    if (e.kind === "signing" && e.event.stage === "response") throw new Error("ENOSPC response");
  });
  await assert.rejects(f.core.propose(request), /record|ENOSPC/); f.g.close();
  assert.equal(sends, 1);
  const next = await fixture([...f.entries]);
  try {
    const response = await next.core.propose(request) as { status: string };
    assert.equal(response.status, "uncertain"); assert.equal(next.counts().sends, 0); assert.equal(next.counts().signed, 0);
  } finally { next.g.close(); }
});
for (const boundary of ["redeem", "signed", "send-started"]) test(`LIF-3: failed ${boundary} persistence never crosses its next side-effect boundary`, async () => {
  const f = await fixture([], undefined, (e) => {
    if (e.kind === boundary || (e.kind === "signing" && e.event.stage === boundary)) throw new Error(`ENOSPC ${boundary}`);
  });
  try {
    await assert.rejects(f.core.propose(request), /record|ENOSPC/);
    assert.equal(f.counts().sends, 0); assert.equal(f.counts().signed, boundary === "redeem" ? 0 : 1);
  } finally { f.g.close(); }
});
test("LIF-3: deadline reached while signing persists bytes but never starts a send", async () => {
  let clock = 1000;
  const f = await fixture([], (o) => { const sign = o.sign; o.now = () => clock; o.sign = async (m) => { const result = await sign(m); clock = 3000; return result; }; });
  try {
    await assert.rejects(f.core.propose(request), /deadline/);
    assert.equal(f.counts().sends, 0); assert.ok(f.entries.some((e) => e.kind === "signing" && e.event.stage === "signed"));
    assert.equal(f.entries.some((e) => e.kind === "signing" && e.event.stage === "send-started"), false);
  } finally { f.g.close(); }
});
