import { connect, createServer, type Socket } from "node:net";
import { chmodSync, lstatSync, realpathSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
export async function startSocket(path: string, handler: (request: Record<string, unknown>) => Promise<unknown>, options: { timeoutMs?: number } = {}) {
  if (process.platform !== "linux") throw new Error("signer socket requires Linux");
  const directory = dirname(resolve(path)); const parent = lstatSync(directory);
  if (!parent.isDirectory() || parent.uid !== process.getuid?.() || (parent.mode & 0o777) !== 0o750 || realpathSync(directory) !== directory) throw new Error("socket directory must be owned, real and mode 0750");
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) throw new Error("invalid socket timeout");
  let existing: ReturnType<typeof lstatSync> | undefined;
  try { existing = lstatSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (existing) {
    if (!existing.isSocket() || existing.uid !== process.getuid?.()) throw new Error("existing socket path is not an owned socket");
    await new Promise<void>((resolve, reject) => {
      const probe = connect(path);
      probe.setTimeout(1000, () => { probe.destroy(); reject(new Error("socket owner check timed out")); });
      probe.once("connect", () => { probe.destroy(); reject(new Error("socket has a live listener")); });
      probe.once("error", (error: NodeJS.ErrnoException) => error.code === "ECONNREFUSED" ? resolve() : reject(error));
    });
    const current = lstatSync(path);
    if (current.ino !== existing.ino || current.dev !== existing.dev) throw new Error("socket path changed during recovery");
    unlinkSync(path); // Only after the caller holds the record's kernel ownership.
  }
  const sockets = new Set<Socket>();
  const server = createServer((s) => {
    s.on("error", () => s.destroy());
    if (sockets.size >= 64) { s.end('{"ok":false,"error":{"code":"busy"}}\n', () => s.destroy()); return; }
    sockets.add(s);
    let buffer = Buffer.alloc(0); let dispatched = false; let done = false;
    const finish = (body: unknown) => {
      if (done) return; let wire: string;
      try { wire = JSON.stringify(body); if (Buffer.byteLength(wire) > 16_383) throw new Error("response too large"); }
      catch { wire = '{"ok":false,"error":{"code":"internal"}}'; }
      done = true; clearTimeout(timer); s.end(wire + "\n", () => s.destroy());
    };
    const fail = (code: string) => finish({ ok: false, error: { code } });
    const timer = setTimeout(() => fail("timeout"), timeoutMs);
    s.on("close", () => { clearTimeout(timer); sockets.delete(s); });
    s.on("data", (chunk) => {
      if (dispatched) { fail("protocol"); return; }
      const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      if (buffer.length + bytes.length > 16_384) { fail("protocol"); return; }
      buffer = Buffer.concat([buffer, bytes]); const end = buffer.indexOf(10); if (end === -1) return;
      dispatched = true;
      if (end !== buffer.length - 1) { fail("protocol"); return; }
      let r: Record<string, unknown>;
      try {
        const frame = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, end));
        r = JSON.parse(frame);
        if (!r || Array.isArray(r) || typeof r !== "object" || JSON.stringify(r) !== frame) throw new Error("invalid canonical request");
        if (!["propose", "report", "status"].includes(String(r.method))) { fail("method"); return; }
        const fields = ["method", "clientId", "id", "deadline", ...(r.method === "propose" ? ["message", "group"] : r.method === "report" ? ["decision"] : [])];
        if (Object.keys(r).some((k) => !fields.includes(k)) || ![r.clientId, r.id].every((v) => typeof v === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(v)) || typeof r.deadline !== "number" || !Number.isFinite(r.deadline)) throw new Error("invalid request identity/deadline");
        if (r.method === "propose" && (typeof r.message !== "string" || r.message.length > 8192 || (r.group !== undefined && (typeof r.group !== "string" || r.group.length > 256)))) throw new Error("invalid proposal payload");
        if (r.method === "report" && (typeof r.decision !== "string" || !/^[0-9a-f]{64}$/.test(r.decision))) throw new Error("invalid report payload");
      } catch { fail("protocol"); return; }
      Promise.resolve().then(() => handler(r)).then((result) => finish({ ok: true, id: r.id, result }), () => fail("internal"));
    });
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(path, resolve); });
  try { chmodSync(path, 0o660); } catch (error) { server.close(); throw error; }
  return { async close() { for (const s of sockets) s.destroy(); await new Promise<void>((resolve) => server.close(() => resolve())); } };
}
