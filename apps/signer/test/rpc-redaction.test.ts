// RPC-2/OPR-2 diagnostic: synthetic provider text must not become operator output.
// Fake fetch never reaches a network provider.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createTrustedRpc, DEVNET_GENESIS } from "../src/rpc.ts";

const marker = "PRIVATE_FIXTURE";
const endpoints = ["https://redaction-a.invalid", "https://redaction-b.invalid"];
function fixture(fault: "none" | "read" | "send") {
  let sends = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    if (request.method === "sendTransaction") sends++;
    if ((fault === "read" && request.method === "getGenesisHash") ||
        (fault === "send" && request.method === "sendTransaction")) return new Response(marker);
    const result = request.method === "getGenesisHash" ? DEVNET_GENESIS :
      request.method === "getSlot" ? 100 : request.method === "getBlockHeight" ? 10 : null;
    return Response.json({ jsonrpc: "2.0", id: request.id, result });
  };
  const rpc = createTrustedRpc(endpoints, { fetch: fetcher, backoffMs: 0, timeoutMs: 1000 });
  return { rpc, sends: () => sends };
}
test("RPC-3/OPR-2: healthy provider diagnostic control has no synthetic private text", async () => {
  const f = fixture("none");
  assert.equal(await f.rpc.height(Date.now() + 5000), 10n);
  const health = f.rpc.health() as { degraded: boolean; providers: { healthy: boolean; reason: string }[] };
  assert.equal(health.degraded, false);
  assert.equal(health.providers.every(p => p.healthy && p.reason === ""), true);
  assert.equal(f.sends(), 0);
});
for (const fault of ["read", "send"] as const) {
  test(`RPC-2/OPR-2: ${fault} refusal and health must redact provider-controlled error text`, async () => {
    const f = fixture(fault);
    let error: unknown;
    try {
      if (fault === "read") await f.rpc.height(Date.now() + 5000);
      else await f.rpc.send(Uint8Array.of(1), Date.now() + 5000);
    } catch (caught) { error = caught; }
    assert.equal(error instanceof Error, true, "operation must refuse");
    assert.equal(f.sends(), fault === "send" ? 1 : 0, "no retry or unintended send");
    const leaked = { refusal: String((error as Error).message).includes(marker),
      health: JSON.stringify(f.rpc.health()).includes(marker) };
    assert.deepEqual(leaked, { refusal: false, health: false }, "synthetic private detail must be absent from both diagnostic surfaces");
  });
}
