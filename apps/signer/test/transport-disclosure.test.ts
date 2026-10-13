// DISC-1/SIG-2: framing failures carry the class channel, not diagnostic codes.
import { strict as assert } from "node:assert";
import { mkdtempSync, chmodSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSendingClient, SignerClientError } from "@solanaut/sdk";
import { startSocket } from "../src/socket.ts";
async function exchange(path: string, frame: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = connect(path); let body = "";
    socket.setTimeout(2000, () => { socket.destroy(); reject(new Error("fixture timeout")); });
    socket.on("error", reject); socket.on("data", b => { body += b; }); socket.once("connect", () => socket.write(frame));
    socket.once("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
  });
}
test("DISC-1/SIG-2: malformed, unknown-method and handler failures reveal only verdict/reference/class", async () => {
  const root = mkdtempSync(join(tmpdir(), "solanaut-transport-class-")); chmodSync(root, 0o750);
  const path = join(root, "signer.sock"), socket = await startSocket(path, async () => { throw new Error("PRIVATE_HANDLER_191821"); });
  try {
    for (const frame of ['{\n', '{"method":"sign","clientId":"agent","id":"one","deadline":1}\n']) {
      assert.deepEqual(await exchange(path, frame), { ok: false, error: { ref: -1, class: "invalid" } });
    }
    assert.deepEqual(await exchange(path, '{"method":"status","clientId":"agent","id":"one","deadline":1}\n'), { ok: false, error: { ref: -1, class: "refused" } });
  } finally { await socket.close(); }
});
test("DISC-1/CLT-3: client retains uncertainty and the remote class/reference without peer text", async () => {
  const root = mkdtempSync(join(tmpdir(), "solanaut-transport-client-")); chmodSync(root, 0o750);
  const path = join(root, "signer.sock"), socket = await startSocket(path, async () => { throw new Error("PRIVATE_HANDLER_191821"); });
  try {
    await assert.rejects(createSendingClient({ socket: path, clientId: "agent" }).propose({ id: "one", message: Uint8Array.of(255) }),
      (error: unknown) => error instanceof SignerClientError && error.code === "remote" && error.ref === -1 && error.class === "refused" && error.mayHaveExecuted && !error.message.includes("PRIVATE_HANDLER"));
  } finally { await socket.close(); }
});
