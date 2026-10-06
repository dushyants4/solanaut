// SIG-1/2/8/10, POL-2: local persistent service composition; fake RPC, memory-only keys.
import { strict as assert } from "node:assert";
import { generateKeyPairSync, sign } from "node:crypto";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createGuard, createSendingClient, encodeBase58, fileStore, preparePolicyText, replay, type Entry } from "@solanaut/sdk";
import { startSigner, type ServiceOptions } from "../src/service.ts";
import { WORKLOAD_POLICY } from "../../../packages/sdk/test/support/workload.ts";
import { craftLegacy, key } from "../../../packages/sdk/test/support/craft.ts";
const agent = generateKeyPairSync("ed25519"); const operator = generateKeyPairSync("ed25519");
const publicBytes = Buffer.from(agent.publicKey.export({ format: "jwk" }).x!, "base64url");
const operatorKey = encodeBase58(Buffer.from(operator.publicKey.export({ format: "jwk" }).x!, "base64url"));
const policy = { ...WORKLOAD_POLICY, principal: [encodeBase58(publicBytes)], latch: { ...WORKLOAD_POLICY.latch, cluster: "devnet", releaseKey: operatorKey } };
const issued = "2026-10-06T00:00:00.000Z"; const text = preparePolicyText(policy, 1, issued);
const authorization = { operatorKey, guardId: policy.latch.guardId, cluster: "devnet", version: 1, issued, text, signature: sign(null, Buffer.from(text), operator.privateKey).toString("base64") };
const message = craftLegacy({ header: [1, 0, 1], keys: [[...publicBytes], key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
function exchange(path: string, request: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = connect(path); let body = "";
    socket.setTimeout(2000, () => { socket.destroy(); reject(new Error("fixture timeout")); });
    socket.on("error", reject); socket.on("data", (b) => { body += b.toString(); });
    socket.once("connect", () => socket.write(JSON.stringify(request) + "\n"));
    socket.once("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
  });
}
const request = (method: string, id: string) => ({ method, clientId: "agent", id, deadline: Date.now() + 1000, ...(method === "propose" ? { message: Buffer.from(message).toString("base64") } : {}) });
const refused = (options: ServiceOptions, pattern: RegExp) => assert.rejects(startSigner(options).then(async (unexpected) => { await unexpected.close(); return unexpected; }), pattern);
async function fixture(bootstrap = true) {
  const root = mkdtempSync(join(tmpdir(), "solanaut-service-")); const directory = join(root, "history"); const sockets = join(root, "socket");
  mkdirSync(directory, { mode: 0o700 }); mkdirSync(sockets, { mode: 0o750 });
  const record = join(directory, "history.jsonl"); const socket = join(sockets, "signer.sock");
  if (bootstrap) { const g = await createGuard({ policy, authorization, log: fileStore(record, { ownership: "kernel" }) }); g.close(); chmodSync(record, 0o600); }
  let sends = 0;
  const options: ServiceOptions = { mode: "same-user", policy, authorization, record, socket, sign: async (m) => sign(null, m, agent.privateKey), rpc: {
    observe: async () => ({ height: 10n, lastValidBlockHeight: 100n }), height: async () => 11n,
    send: async (wire) => { sends++; return encodeBase58(wire.subarray(1, 65)); }, outcome: async () => null,
  } };
  return { options, sends: () => sends, entries: () => readFileSync(record, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Entry) };
}
test("SIG-1/2/10: same-user startup wires signed guard, clock, socket and durable retry", async () => {
  const f = await fixture(); const service = await startSigner(f.options);
  const pay = request("propose", "payment");
  try {
    const status = await exchange(f.options.socket, request("status", "status"));
    assert.equal(status.ok, true); assert.equal(status.result.mode, "same-user");
    assert.equal(status.result.keyIsolation, false); assert.equal(status.result.policyVersion, 1);
    const sent = await exchange(f.options.socket, pay); assert.equal(sent.result.status, "sent");
    const decision = f.entries().find((e) => e.kind === "decision");
    assert.equal(decision?.kind === "decision" && decision.source, "signer");
    assert.equal(decision?.kind === "decision" && decision.deployment?.mode, "same-user");
    assert.equal((await replay(f.entries(), undefined, undefined, authorization)).ok, true);
  } finally { await service.close(); }
  const next = await startSigner(f.options);
  try {
    const retry = await exchange(f.options.socket, { ...pay, deadline: 0 }); assert.equal(retry.result.status, "sent");
    assert.equal(f.sends(), 1);
  } finally { await next.close(); }
});
test("POL-2/SIG-8: startup requires valid authorization and existing history, leaving ownership reusable on refusal", async () => {
  const missing = await fixture(false); await refused(missing.options, /history|exist|ENOENT/);
  writeFileSync(missing.options.record, "", { mode: 0o600 });
  await refused({ ...missing.options, authorization: undefined as never }, /authoriz|sign|policy/);
  const f = await fixture();
  for (const bad of [undefined, { ...authorization, signature: "" }]) await refused({ ...f.options, authorization: bad as never }, /authoriz|sign|policy/);
  const store = fileStore(f.options.record, { ownership: "kernel", create: false }); store.close();
  await refused({ ...f.options, mode: "isolated" as never }, /same-user|mode/);
});
test("SIG-8: protected history permissions and symlink paths are checked before serving", async () => {
  const f = await fixture(); chmodSync(f.options.record, 0o644);
  await refused(f.options, /protect|permission|mode/); chmodSync(f.options.record, 0o600);
  const alias = f.options.record + ".alias"; symlinkSync(f.options.record, alias);
  await refused({ ...f.options, record: alias }, /protect|real|symlink/);
  chmodSync(join(f.options.record, ".."), 0o750);
  await refused(f.options, /protect|permission|mode/);
});
test("SIG-8: ownership is acquired before serving and released after a socket-start failure", async () => {
  const f = await fixture(); const store = fileStore(f.options.record, { ownership: "kernel", create: false });
  try { await refused(f.options, /lock|owner/); } finally { store.close(); }
  writeFileSync(f.options.socket, "existing ordinary file"); await refused(f.options, /socket/);
  const next = fileStore(f.options.record, { ownership: "kernel", create: false }); next.close();
});
test("SIG-8/LIF-6: startup exposes incomplete recovery rather than discarding pending history", async () => {
  const f = await fixture(); const g = await createGuard({ policy, authorization, log: fileStore(f.options.record, { ownership: "kernel", create: false }) });
  const d = g.check({ message, at: Date.now(), blockHeight: 10n, lastValidBlockHeight: 100n }, { clientId: "agent", id: "pending" }); assert.equal(d.allow, true); g.close();
  f.options.rpc.height = async () => { throw new Error("private provider detail"); };
  const service = await startSigner(f.options);
  try {
    const response = await exchange(f.options.socket, request("status", "status"));
    assert.equal(response.result.recoveryIncomplete, true); assert.equal(JSON.stringify(response).includes("private provider"), false);
    assert.equal(f.entries().some((e) => e.kind === "report"), false); assert.equal(f.sends(), 0);
  } finally { await service.close(); }
});
test("SIG-8: close drains dispatched send before releasing ownership and is idempotent", async () => {
  const f = await fixture(); let release!: () => void; let sending!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const entered = new Promise<void>((resolve) => { sending = resolve; }); const send = f.options.rpc.send;
  f.options.rpc.send = async (...args) => { sending(); await waiting; return send(...args); };
  const service = await startSigner(f.options); const client = exchange(f.options.socket, request("propose", "held")).catch(() => null);
  try {
    await entered; const stopping = service.close();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.throws(() => fileStore(f.options.record, { ownership: "kernel", create: false }), /lock|owner/);
    release(); await stopping; await service.close(); await client;
    const store = fileStore(f.options.record, { ownership: "kernel", create: false }); store.close();
    assert.equal(f.entries().some((e) => e.kind === "signing" && e.event.stage === "response" && e.event.status === "sent"), true);
  } finally { release(); await service.close(); await client; }
});
test("SIG-8: close also drains host recovery and refuses recovery after stop", async () => {
  const f = await fixture(); let release!: () => void; let reading!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; }); const entered = new Promise<void>((resolve) => { reading = resolve; });
  const service = await startSigner(f.options);
  try {
    await exchange(f.options.socket, request("propose", "payment"));
    f.options.rpc.outcome = async () => { reading(); await waiting; return null; };
    const recovery = service.recover(); await entered; const stopping = service.close();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.throws(() => fileStore(f.options.record, { ownership: "kernel", create: false }), /lock|owner/);
    release(); await recovery; await stopping;
    await assert.rejects(service.recover(), /stopping|closed/);
  } finally { release(); await service.close(); }
});
test("CLT-1/SIG-2: SDK sending client consumes actual service replies and durable proposal retries", async () => {
  const f = await fixture(); const service = await startSigner(f.options);
  try {
    const client = createSendingClient({ socket: f.options.socket, clientId: "agent", timeoutMs: 1000 });
    const result = await client.propose({ id: "payment", message }); assert.equal(result.status, "sent");
    assert.deepEqual(await client.propose({ id: "payment", message, deadline: 0 }), result);
    assert.ok("decision" in result);
    if ("decision" in result) assert.deepEqual(await client.report({ id: "hint", decision: result.decision }), { decision: result.decision, outcome: "unresolved" });
    assert.equal((await client.status({ id: "status" })).mode, "same-user"); assert.equal(f.sends(), 1);
  } finally { await service.close(); }
});
