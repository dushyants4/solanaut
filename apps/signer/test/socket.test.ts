// SIG-1/2/3/10: real Unix sockets, no signing keys or chain sends.
import { strict as assert } from "node:assert";
import { connect, createServer } from "node:net";
import { chmodSync, lstatSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { startSocket } from "../src/socket.ts";
const request = (method = "status") => ({ method, clientId: "agent", id: "request", deadline: Date.now() + 1000, ...(method === "propose" ? { message: "AA==" } : {}), ...(method === "report" ? { decision: "a".repeat(64) } : {}) });
const location = () => { const dir = mkdtempSync(join(tmpdir(), "solanaut-socket-")); chmodSync(dir, 0o750); return { dir, path: join(dir, "signer.sock") }; };
function exchange(path: string, bytes: string | Buffer | null) {
  return new Promise<any>((resolve, reject) => {
    const socket = connect(path); let body = "";
    socket.setTimeout(2000, () => { socket.destroy(); reject(new Error("test socket timeout")); });
    socket.on("error", reject); socket.on("data", (b) => { body += b.toString(); });
    socket.once("connect", () => { if (bytes !== null) socket.write(bytes); });
    socket.once("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
  });
}
test("SIG-2: only propose/report/status dispatch, with one bounded response and request identity", async () => {
  const { path } = location(); const seen: string[] = [];
  const service = await startSocket(path, async (r) => { seen.push(String(r.method)); return { mode: "same-user", status: "ready" }; });
  try {
    for (const method of ["propose", "report", "status"]) {
      const r = await exchange(path, JSON.stringify(request(method)) + "\n");
      assert.equal(r.ok, true); assert.equal(r.id, "request"); assert.equal(r.result.mode, "same-user");
    }
    const denied = await exchange(path, JSON.stringify({ ...request(), method: "release" }) + "\n");
    assert.equal(denied.ok, false); assert.equal(denied.error.code, "method");
    assert.deepEqual(seen, ["propose", "report", "status"]);
  } finally { await service.close(); }
});
test("SIG-10: socket permissions restrict its group and parent must be protected", async () => {
  const { path, dir } = location(); const service = await startSocket(path, async () => ({}));
  try { assert.equal(lstatSync(path).mode & 0o777, 0o660); }
  finally { await service.close(); }
  chmodSync(dir, 0o777);
  let unexpected: Awaited<ReturnType<typeof startSocket>> | undefined;
  try { await assert.rejects(async () => { unexpected = await startSocket(path, async () => ({})); }, /directory|permission/); }
  finally { await unexpected?.close(); }
});
test("SIG-2/3: malformed JSON, unknown fields, bad IDs/deadlines and multiple frames never dispatch", async () => {
  const { path } = location(); let calls = 0;
  const service = await startSocket(path, async () => { calls++; return {}; });
  try {
    for (const frame of ["{bad}\n", "[]\n", JSON.stringify({ ...request(), id: "" }) + "\n", JSON.stringify({ ...request(), deadline: "tomorrow" }) + "\n", JSON.stringify({ ...request(), key: "forbidden" }) + "\n", JSON.stringify(request()) + "\n" + JSON.stringify(request()) + "\n"]) {
      const r = await exchange(path, frame); assert.equal(r.ok, false); assert.equal(r.error.code, "protocol");
    }
    assert.equal(calls, 0);
  } finally { await service.close(); }
});
test("SIG-2: oversized or invalid UTF-8 frames refuse before dispatch", async () => {
  const { path } = location(); let calls = 0;
  const service = await startSocket(path, async () => { calls++; return {}; });
  try {
    for (const bytes of [Buffer.from(JSON.stringify({ ...request("propose"), message: "x".repeat(16_384) }) + "\n"), Buffer.from([0xff, 0x0a])]) {
      const r = await exchange(path, bytes); assert.equal(r.ok, false); assert.equal(r.error.code, "protocol");
    }
    assert.equal(calls, 0);
  } finally { await service.close(); }
});
test("SIG-3: idle and unfinished requests end within the configured bounded read timeout", async () => {
  const { path } = location(); const service = await startSocket(path, async () => ({}), { timeoutMs: 30 });
  try { for (const bytes of [null, "{"]) { const r = await exchange(path, bytes); assert.equal(r.error.code, "timeout"); } }
  finally { await service.close(); }
});
test("SIG-1: handler errors return a fixed code without exposing internal exception text", async () => {
  const { path } = location(); const service = await startSocket(path, async () => { throw new Error("internal-marker-must-not-leave"); });
  try { const r = await exchange(path, JSON.stringify(request()) + "\n"); assert.equal(r.error.code, "internal"); assert.equal(JSON.stringify(r).includes("internal-marker"), false); }
  finally { await service.close(); }
});
test("SIG-10: existing non-socket and symlink paths are never removed", async () => {
  for (const link of [false, true]) {
    const { path, dir } = location(); const target = join(dir, "target"); writeFileSync(target, "keep");
    if (link) symlinkSync(target, path); else writeFileSync(path, "keep");
    await assert.rejects(startSocket(path, async () => ({})), /socket|existing|path/);
    assert.equal(lstatSync(path).isSymbolicLink(), link);
  }
});
test("SIG-10: a live listener cannot be replaced", async () => {
  const { path } = location(); const live = createServer((s) => s.end());
  await new Promise<void>((resolve) => live.listen(path, resolve));
  let unexpected: Awaited<ReturnType<typeof startSocket>> | undefined;
  try { await assert.rejects(async () => { unexpected = await startSocket(path, async () => ({})); }, /live|socket|EADDRINUSE/); }
  finally { await unexpected?.close(); await new Promise<void>((resolve) => live.close(() => resolve())); }
});
test("SIG-3: trickling bytes cannot extend the absolute connection deadline", async () => {
  const { path } = location(); const service = await startSocket(path, async () => ({}), { timeoutMs: 40 });
  try {
    const result = await new Promise<any>((resolve, reject) => {
      const socket = connect(path); let body = ""; let count = 0; let error: Error | undefined;
      const timer = setInterval(() => { if (++count < 15) socket.write(" "); else clearInterval(timer); }, 10);
      socket.on("error", (e) => { error = e; }); socket.on("data", (b) => { body += b.toString(); clearInterval(timer); });
      socket.on("close", () => { clearInterval(timer); try { resolve({ body: JSON.parse(body), count }); } catch (e) { reject(error ?? e); } });
    });
    assert.equal(result.body.error.code, "timeout"); assert.ok(result.count < 15, "trickle extended deadline");
  } finally { await service.close(); }
});
test("SIG-1/2: oversized or unserialisable handler responses become fixed internal errors", async () => {
  for (const result of [{ huge: "x".repeat(16_384) }, { bigint: 1n }]) {
    const { path } = location(); const service = await startSocket(path, async () => result, { timeoutMs: 100 });
    try { const r = await exchange(path, JSON.stringify(request()) + "\n"); assert.equal(r.ok, false); assert.equal(r.error.code, "internal"); }
    finally { await service.close(); }
  }
});
test("SIG-8/10: an abandoned socket is recovered after its process exits", async () => {
  const { path } = location();
  const child = spawn(process.execPath, ["--input-type=module", "-e", 'import {createServer} from "node:net"; createServer().listen(process.argv[1], () => console.log("ready"));', path], { stdio: ["ignore", "pipe", "pipe"] });
  try {
    await new Promise<void>((resolve, reject) => { child.stdout.once("data", () => resolve()); child.once("error", reject); child.once("exit", () => reject(new Error("child exited before listening"))); });
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve())); child.kill("SIGKILL"); await exited;
    assert.equal(lstatSync(path).isSocket(), true);
    const service = await startSocket(path, async () => ({ recovered: true }));
    try { const r = await exchange(path, JSON.stringify(request()) + "\n"); assert.equal(r.result.recovered, true); }
    finally { await service.close(); }
  } finally { child.kill("SIGKILL"); }
});
test("SIG-2/3: clients holding their half open cannot exhaust completed connection slots", async () => {
  const { path } = location(); const held: ReturnType<typeof connect>[] = [];
  const service = await startSocket(path, async () => ({ ready: true }));
  try {
    for (let i = 0; i < 65; i++) {
      const r = await new Promise<any>((resolve, reject) => {
        const s = connect({ path, allowHalfOpen: true }); held.push(s); let body = "";
        const timer = setTimeout(() => { s.destroy(); reject(new Error("half-open fixture read timeout")); }, 2000);
        s.on("error", reject); s.on("data", (b) => {
          body += b.toString(); if (!body.endsWith("\n")) return;
          clearTimeout(timer); try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
        });
        s.on("connect", () => s.write(JSON.stringify(request()) + "\n"));
      });
      try { assert.equal(r.ok, true, `completed connections occupied slot ${i}`); }
      catch (error) { console.error(error); throw error; }
    }
  } finally { for (const s of held) s.destroy(); await service.close(); }
});
