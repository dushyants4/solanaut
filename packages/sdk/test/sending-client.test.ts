// CLT-1–4: real local transport, no keys or chain execution.
import { strict as assert } from "node:assert";
import { createServer, type Socket } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSendingClient, SignerClientError } from "../src/adapters/sending-client.ts";
import { encodeBase58 } from "../src/base58.ts";
const decision = "a".repeat(64); const signature = encodeBase58(Buffer.alloc(64, 1));
const sent = { stage: "response", decision, status: "sent", signature };
async function server(reply: (request: any, socket: Socket) => void) {
  const path = join(mkdtempSync(join(tmpdir(), "solanaut-client-")), "signer.sock"); const connections = new Set<Socket>(); let calls = 0;
  const listener = createServer((socket) => {
    connections.add(socket); socket.on("error", () => socket.destroy()); socket.on("close", () => connections.delete(socket));
    let buffer = ""; socket.on("data", (chunk) => { buffer += chunk.toString(); if (buffer.includes("\n")) { calls++; reply(JSON.parse(buffer.trim()), socket); } });
  });
  await new Promise<void>((resolve, reject) => { listener.once("error", reject); listener.listen(path, resolve); });
  return { path, calls: () => calls, close: async () => { for (const socket of connections) socket.destroy(); await new Promise<void>((resolve) => listener.close(() => resolve())); } };
}
const answer = (r: any, result: unknown) => JSON.stringify({ ok: true, id: r.id, result }) + "\n";
test("CLT-1: distinct sending client exposes only three methods and preserves explicit identities/payloads", async () => {
  const seen: any[] = [];
  const host = await server((r, socket) => { seen.push(r); socket.end(answer(r, r.method === "propose" ? sent : r.method === "report" ? { decision, outcome: "unresolved" } : { mode: "same-user" })); });
  try {
    const client = createSendingClient({ socket: host.path, clientId: "agent" });
    assert.deepEqual(Object.keys(client).sort(), ["propose", "report", "status"]);
    const bytes = Uint8Array.of(1, 2, 3);
    assert.deepEqual(await client.propose({ id: "payment", message: bytes, group: "rent", deadline: 0 }), sent);
    assert.deepEqual(await client.report({ id: "hint", decision }), { decision, outcome: "unresolved" });
    assert.deepEqual(await client.status({ id: "health" }), { mode: "same-user" });
    assert.deepEqual(seen[0], { method: "propose", clientId: "agent", id: "payment", deadline: 0, message: "AQID", group: "rent" });
    assert.equal(seen[1].decision, decision); assert.equal(seen[2].method, "status");
  } finally { await host.close(); }
});
test("CLT-2: lost proposal reply is explicitly uncertain and never automatically retried", async () => {
  const host = await server((_r, socket) => socket.destroy());
  try {
    const client = createSendingClient({ socket: host.path, clientId: "agent", timeoutMs: 100 });
    await assert.rejects(client.propose({ id: "payment", message: Uint8Array.of(1) }), (e: unknown) => e instanceof SignerClientError && e.mayHaveExecuted);
    assert.equal(host.calls(), 1);
    await assert.rejects(client.status({ id: "health" }), (e: unknown) => e instanceof SignerClientError && !e.mayHaveExecuted);
    assert.equal(host.calls(), 2);
  } finally { await host.close(); }
});
test("CLT-3: malformed, oversized, duplicate, mismatched and extra response frames refuse", async () => {
  for (const corrupt of [
    (_r: any) => "not json\n",
    (r: any) => JSON.stringify({ ok: true, id: r.id + "wrong", result: sent }) + "\n",
    (r: any) => answer(r, sent) + answer(r, sent),
    (r: any) => `{"ok":true,"id":"wrong","id":"${r.id}","result":${JSON.stringify(sent)}}\n`,
    (_r: any) => "x".repeat(16_385),
  ]) {
    const host = await server((r, socket) => socket.end(corrupt(r)));
    try {
      const client = createSendingClient({ socket: host.path, clientId: "agent" });
      await assert.rejects(client.propose({ id: "one", message: Uint8Array.of(1) }), (e: unknown) => e instanceof SignerClientError && e.code === "protocol" && e.mayHaveExecuted);
    } finally { await host.close(); }
  }
});
test("CLT-3: sending/report result shapes are validated before consumers receive them", async () => {
  for (const result of [{ ...sent, signature: "wrong" }, { ...sent, decision: "wrong" }, { ...sent, status: "denied" }, { ...sent, status: "unknown" }]) {
    const host = await server((r, socket) => socket.end(answer(r, result)));
    try { await assert.rejects(createSendingClient({ socket: host.path, clientId: "a" }).propose({ id: "one", message: Uint8Array.of(1) }), (e: unknown) => e instanceof SignerClientError && e.code === "protocol"); }
    finally { await host.close(); }
  }
  const host = await server((r, socket) => socket.end(answer(r, { decision, outcome: "pending" })));
  try { await assert.rejects(createSendingClient({ socket: host.path, clientId: "a" }).report({ id: "hint", decision }), (e: unknown) => e instanceof SignerClientError && e.code === "protocol"); }
  finally { await host.close(); }
});
test("CLT-4: absolute timeout is not extended by response activity", async () => {
  const host = await server((_r, socket) => {
    const trickle = setInterval(() => socket.write(" "), 2); socket.once("close", () => clearInterval(trickle));
    const ceiling = setTimeout(() => socket.destroy(), 200); socket.once("close", () => clearTimeout(ceiling)); // Bound a broken client during fault injection.
  });
  try {
    const client = createSendingClient({ socket: host.path, clientId: "a", timeoutMs: 30 });
    await assert.rejects(client.propose({ id: "one", message: Uint8Array.of(1) }), (e: unknown) => e instanceof SignerClientError && e.code === "timeout" && e.mayHaveExecuted);
    assert.equal(host.calls(), 1);
  } finally { await host.close(); }
});
test("CLT-1/3: invalid configuration and payloads refuse before connecting", async () => {
  const host = await server((_r, socket) => socket.destroy());
  try {
    const inputError = (error: unknown) => error instanceof SignerClientError && error.code === "input" && !error.mayHaveExecuted;
    const configure = createSendingClient as (options?: unknown) => unknown;
    const invalidContainers = [undefined, null, false, 0, "input", 1n, Symbol("input"), [] as unknown, (() => {}) as unknown];
    const configuration = { socket: host.path, clientId: "a" };
    assert.throws(() => configure(), inputError, "missing options");
    for (const options of [...invalidContainers, Object.assign([], configuration), Object.assign(() => {}, configuration)]) {
      assert.throws(() => configure(options), inputError, "invalid options container");
    }
    for (const options of [{ socket: "relative", clientId: "a" }, { socket: "/socket", clientId: "" }, { socket: "/socket", clientId: "a", timeoutMs: 30_001 }, { ...configuration, timeoutMs: NaN }]) {
      assert.throws(() => configure(options), inputError, "invalid configuration field");
    }
    const client = createSendingClient({ socket: host.path, clientId: "a" });
    for (const name of ["propose", "report", "status"] as const) {
      const method = client[name] as (input?: unknown) => Promise<unknown>;
      const request = name === "propose" ? { id: "one", message: Uint8Array.of(1) } : name === "report" ? { id: "one", decision } : { id: "one" };
      await assert.rejects(async () => await method(), inputError, `${name}: missing payload`);
      for (const input of [...invalidContainers, Object.assign([], request), Object.assign(() => {}, request)]) {
        await assert.rejects(async () => await method(input), inputError, `${name}: invalid payload container`);
      }
      for (const input of [{ ...request, id: "" }, { ...request, deadline: NaN }]) {
        await assert.rejects(async () => await method(input), inputError, `${name}: invalid identity/deadline`);
      }
    }
    for (const request of [{ id: "", message: Uint8Array.of(1) }, { id: "one", message: new Uint8Array(6145) }, { id: "one", message: Uint8Array.of(1), group: "x".repeat(257) }, { id: "one", message: Uint8Array.of(1), deadline: NaN }]) {
      await assert.rejects(client.propose(request), inputError, "invalid proposal field");
    }
    await assert.rejects(client.propose({ id: "one", message: [] } as any), inputError, "message must remain bytes");
    await assert.rejects(client.propose({ id: "one", message: Uint8Array.of(1), group: 1 } as any), inputError, "group must remain text");
    await assert.rejects(client.report({ id: "one", decision: "invalid" }), inputError, "invalid decision hash");
    assert.equal(host.calls(), 0);
  } finally { await host.close(); }
});
test("CLT-1: caller byte mutations cannot change the serialized proposal", async () => {
  let seen = ""; const host = await server((r, socket) => { seen = r.message; socket.end(answer(r, sent)); });
  try {
    const bytes = Uint8Array.of(1); const client = createSendingClient({ socket: host.path, clientId: "a" });
    const request = client.propose({ id: "one", message: bytes }); bytes[0] = 9;
    await request; assert.equal(seen, "AQ==");
  } finally { await host.close(); }
});
test("CLT-2/3: remote refusals use fixed typed codes without exposing peer messages", async () => {
  const host = await server((_r, socket) => socket.end('{"ok":false,"error":{"code":"busy","message":"private detail"}}\n'));
  try {
    await assert.rejects(createSendingClient({ socket: host.path, clientId: "a" }).status({ id: "one" }), (e: unknown) => e instanceof SignerClientError && e.code === "remote" && !e.message.includes("private detail"));
  } finally { await host.close(); }
});
test("CLT-1/3: durable denied, uncertain and pre-admission refusal answers remain distinct", async () => {
  for (const result of [{ stage: "response", decision, status: "denied" }, { stage: "response", decision, status: "uncertain", signature }, { stage: "response", decision, status: "uncertain" }, { status: "denied", code: "unavailable" }, { status: "denied", code: "deadline" }]) {
    const host = await server((r, socket) => socket.end(answer(r, result)));
    try { assert.deepEqual(await createSendingClient({ socket: host.path, clientId: "a" }).propose({ id: "one", message: Uint8Array.of(1) }), result); }
    finally { await host.close(); }
  }
});
test("CLT-1: request identity is captured before caller mutation", async () => {
  const host = await server((r, socket) => socket.end(answer(r, sent)));
  try {
    const client = createSendingClient({ socket: host.path, clientId: "a" }); const input = { id: "one", message: Uint8Array.of(1) };
    const operation = client.propose(input); input.id = "different"; assert.deepEqual(await operation, sent);
  } finally { await host.close(); }
});
test("CLT-2: a connection failure before transmission cannot claim proposal execution", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "solanaut-client-missing-")), "missing.sock");
  await assert.rejects(createSendingClient({ socket: path, clientId: "a" }).propose({ id: "one", message: Uint8Array.of(1) }), (e: unknown) => e instanceof SignerClientError && e.code === "connection" && !e.mayHaveExecuted);
});
