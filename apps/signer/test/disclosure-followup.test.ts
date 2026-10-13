// DISC-1/SIG-2/3/7/8/10: actual sockets, persistent journals and automatic chain hints.
import { strict as assert } from "node:assert";
import { generateKeyPairSync, sign } from "node:crypto";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createGuard, createSendingClient, encodeBase58, fileStore, preparePolicyText, type Entry } from "@solanaut/sdk";
import { startSigner, type ServiceOptions } from "../src/service.ts";
import { WORKLOAD_POLICY } from "../../../packages/sdk/test/support/workload.ts";
import { craftLegacy, key } from "../../../packages/sdk/test/support/craft.ts";

async function fixture(full = false) {
  const agent = generateKeyPairSync("ed25519"), operator = generateKeyPairSync("ed25519");
  const bytes = Buffer.from(agent.publicKey.export({ format: "jwk" }).x!, "base64url");
  const operatorKey = encodeBase58(Buffer.from(operator.publicKey.export({ format: "jwk" }).x!, "base64url"));
  const policy = { ...WORKLOAD_POLICY, ...(full ? { disclosure: "full" as const } : {}), principal: [encodeBase58(bytes)], latch: { ...WORKLOAD_POLICY.latch, cluster: "devnet", releaseKey: operatorKey } };
  const issued = "2026-10-13T00:00:00.000Z", text = preparePolicyText(policy, 1, issued);
  const authorization = { operatorKey, guardId: policy.latch.guardId, cluster: "devnet", version: 1, issued, text, signature: sign(null, Buffer.from(text), operator.privateKey).toString("base64") };
  const root = mkdtempSync(join(tmpdir(), "solanaut-followup-"));
  mkdirSync(join(root, "history"), { mode: 0o700 }); mkdirSync(join(root, "socket"), { mode: 0o750 });
  const record = join(root, "history", "record.jsonl"), socket = join(root, "socket", "signer.sock");
  const bootstrap = await createGuard({ policy, authorization, log: fileStore(record, { ownership: "kernel" }) }); bootstrap.close(); chmodSync(record, 0o600);
  let sends = 0, reads = 0, outcome: "landed" | null = null;
  const options: ServiceOptions = { mode: "same-user", policy, authorization, record, socket,
    sign: async message => sign(null, message, agent.privateKey), rpc: {
      observe: async () => ({ height: 10n, lastValidBlockHeight: 100n }), height: async () => 11n,
      send: async wire => { sends++; return encodeBase58(wire.subarray(1, 65)); },
      outcome: async () => { reads++; return outcome; },
    } };
  const request = (destination: number, id = "pay") => ({ method: "propose", clientId: "agent", id, deadline: Date.now() + 2000,
    message: Buffer.from(craftLegacy({ header: [1, 0, 1], keys: [[...bytes], key(destination), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] })).toString("base64") });
  return { options, request, sends: () => sends, reads: () => reads, landed: () => { outcome = "landed"; },
    entries: () => readFileSync(record, "utf8").trim().split("\n").map(line => JSON.parse(line) as Entry) };
}
async function exchange(path: string, request: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = connect(path); let body = "";
    socket.setTimeout(3000, () => { socket.destroy(); reject(new Error("fixture timeout")); });
    socket.on("error", reject); socket.on("data", b => { body += b; });
    socket.once("connect", () => socket.write(JSON.stringify(request) + "\n"));
    socket.once("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
  });
}
test("DISC-1/SIG-2/3: denied socket replies remain class-only under full policy and after restart", async () => {
  const f = await fixture(true); let service = await startSigner(f.options);
  try {
    const proposal = f.request(3), response = await exchange(f.options.socket, proposal);
    const d = f.entries().find(e => e.kind === "decision")!;
    assert.deepEqual(response.result, { status: "denied", ref: d.seq, class: "refused" });
    assert.equal(d.kind === "decision" && d.rule, "destination-not-allowed");
    assert.equal(f.sends(), 0);
    await service.close(); service = await startSigner(f.options);
    assert.deepEqual((await exchange(f.options.socket, { ...proposal, deadline: 0 })).result, response.result);
    assert.equal(f.entries().filter(e => e.kind === "decision").length, 1);
  } finally { await service.close(); }
});
test("DISC-1/SIG-2: status hides policy identity/version and denial counters", async () => {
  const f = await fixture(), service = await startSigner(f.options);
  try {
    const response = await exchange(f.options.socket, { method: "status", clientId: "agent", id: "status", deadline: Date.now() + 2000 });
    assert.deepEqual(response.result, { mode: "same-user", keyIsolation: false, recoveryIncomplete: false, degraded: false });
    assert.equal(service.status().policyVersion, 1, "operator status retains private diagnostics");
  } finally { await service.close(); }
});
test("DISC-1/SIG-2: agent status does not reveal the rule-named latch state", async () => {
  const f = await fixture(), service = await startSigner(f.options);
  try {
    for (let i = 0; i < WORKLOAD_POLICY.latch.afterDenials; i++) await exchange(f.options.socket, f.request(3, "deny-" + i));
    assert.equal(service.status().latched, true);
    const result = (await exchange(f.options.socket, { method: "status", clientId: "agent", id: "status", deadline: Date.now() + 2000 })).result;
    assert.equal("latched" in result, false); assert.equal("policyHash" in result, false);
    assert.equal(f.sends(), 0);
  } finally { await service.close(); }
});
test("DISC-1/SIG-2/3: pre-admission provider refusal is durably class-projected", async () => {
  const f = await fixture(); f.options.rpc.observe = async () => { throw new Error("PRIVATE_RPC_448192"); };
  const service = await startSigner(f.options);
  try {
    const proposal = f.request(2), result = (await exchange(f.options.socket, proposal)).result;
    assert.deepEqual(result, { status: "denied", ref: -1, class: "retry-later" });
    assert.deepEqual((await exchange(f.options.socket, { ...proposal, deadline: 0 })).result, result);
    assert.equal(f.sends(), 0); assert.equal(f.entries().filter(e => e.kind === "decision").length, 0);
  } finally { await service.close(); }
});
test("SIG-7/8: automatic follow-up records chain evidence without caller report or resend and stops on close", async () => {
  const f = await fixture(), service = await startSigner(f.options);
  try {
    await exchange(f.options.socket, f.request(2)); f.landed();
    const until = Date.now() + 3500;
    while (!f.entries().some(e => e.kind === "report") && Date.now() < until) await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(f.entries().filter(e => e.kind === "report").map(e => e.outcome), ["landed"]);
    assert.equal(f.sends(), 1); await service.close();
    const reads = f.reads(), closed = service.status(); await new Promise(r => setTimeout(r, 1100)); assert.equal(f.reads(), reads); assert.deepEqual(service.status(), closed);
    const owner = fileStore(f.options.record, { ownership: "kernel", create: false }); owner.close();
  } finally { await service.close(); }
});
test("DISC-1/CLT-1: sending client consumes the class-only denial from the running service", async () => {
  const f = await fixture(), service = await startSigner(f.options);
  try {
    const client = createSendingClient({ socket: f.options.socket, clientId: "agent" });
    const result = await client.propose({ id: "denied", message: Buffer.from(f.request(3).message, "base64") });
    assert.deepEqual(result, { status: "denied", ref: f.entries().find(e => e.kind === "decision")!.seq, class: "refused" });
  } finally { await service.close(); }
});
test("DISC-1/SIG-2: malformed proposals are invalid and RPC degradation exposes no provider detail", async () => {
  const f = await fixture(); f.options.rpc.health = () => ({ degraded: true });
  const service = await startSigner(f.options);
  try {
    const request = { ...f.request(2), message: Buffer.from([255]).toString("base64") };
    const result = (await exchange(f.options.socket, request)).result;
    assert.deepEqual(result, { status: "denied", ref: f.entries().find(e => e.kind === "decision")!.seq, class: "invalid" });
    const status = await exchange(f.options.socket, { method: "status", clientId: "agent", id: "health", deadline: Date.now() + 2000 });
    assert.equal(status.result.degraded, true); assert.equal(f.sends(), 0);
  } finally { await service.close(); }
});
test("SIG-7/8: background reconciliation drains before releasing ownership and shares concurrent recovery", async () => {
  const f = await fixture(); let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>(r => { release = r; }), reading = new Promise<void>(r => { entered = r; });
  const service = await startSigner(f.options);
  try {
    await exchange(f.options.socket, f.request(2));
    f.options.rpc.outcome = async () => { entered(); await waiting; return null; };
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([reading, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("background follow-up did not start")), 5000); })]); }
    finally { clearTimeout(timeout); }
    const one = service.recover(), two = service.recover(); assert.equal(one, two);
    const closing = service.close();
    assert.throws(() => fileStore(f.options.record, { ownership: "kernel", create: false }), /lock|owner/);
    release(); await one; await closing;
    const owner = fileStore(f.options.record, { ownership: "kernel", create: false }); owner.close();
  } finally { release(); await service.close(); }
});
test("SIG-7/9: incomplete automatic reconciliation backs off without releasing or resending", async t => {
  const f = await fixture(); t.mock.timers.enable({ apis: ["setTimeout"] });
  const service = await startSigner(f.options); let reads = 0;
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise<void>(r => setImmediate(r)); };
  try {
    await exchange(f.options.socket, f.request(2));
    f.options.rpc.outcome = async () => { reads++; throw new Error("PRIVATE_OUTAGE_912318"); };
    t.mock.timers.tick(1000); await settle(); assert.equal(reads, 1); assert.equal(service.status().recoveryIncomplete, true);
    t.mock.timers.tick(1000); await settle(); assert.equal(reads, 1, "first failed pass doubles the wait");
    t.mock.timers.tick(1000); await settle(); assert.equal(reads, 2);
    t.mock.timers.tick(3000); await settle(); assert.equal(reads, 2, "next failed pass doubles it again");
    t.mock.timers.tick(1000); await settle(); assert.equal(reads, 3);
    assert.equal(f.sends(), 1); assert.equal(f.entries().filter(e => e.kind === "report").length, 0);
  } finally { await service.close(); }
});
