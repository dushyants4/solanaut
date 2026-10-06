// RPC-1–4: protocol-shaped fake providers; no real send.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decodeMessage, encodeBase58 } from "@solanaut/sdk";
import { createTrustedRpc, DEVNET_GENESIS } from "../src/rpc.ts";
import { craftLegacy, key } from "../../../packages/sdk/test/support/craft.ts";
const urls = ["https://rpc-a.invalid", "https://rpc-b.invalid"];
const message = craftLegacy({ header: [1, 0, 1], keys: [key(1), key(2), key(0)], instructions: [] });
const hash = decodeMessage(message).lifetimeToken;
const signature = encodeBase58(Buffer.alloc(64, 1));
const deadline = () => Date.now() + 2000;
type Call = { url: string; method: string; params: unknown[]; id: number };
function fixture(change?: (c: Call, result: unknown) => unknown, failure?: (c: Call) => Response | undefined) {
  const calls: Call[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const request = JSON.parse(String(init?.body)) as Call;
    const call = { ...request, url: String(url) }; calls.push(call);
    const fail = failure?.(call); if (fail) return fail;
    const result = ({ getGenesisHash: DEVNET_GENESIS, getSlot: 100, getBlockHeight: 10,
      getLatestBlockhash: { context: { slot: 100 }, value: { blockhash: hash, lastValidBlockHeight: 100 } },
      isBlockhashValid: { context: { slot: 100 }, value: true },
      getSignatureStatuses: { context: { slot: 100 }, value: [{ slot: 90, confirmations: 1, err: null, confirmationStatus: "confirmed" }] }, sendTransaction: signature } as Record<string, unknown>)[call.method];
    return Response.json({ jsonrpc: "2.0", id: request.id, result: change ? change(call, result) : result });
  };
  return { rpc: createTrustedRpc(urls, { fetch: fetcher, backoffMs: 1, timeoutMs: 100 }), calls };
}
test("RPC-1: pins devnet identity and validates observed blockhash/lifetime with confirmed context", async () => {
  const f = fixture(); const observed = await f.rpc.observe(message, deadline());
  assert.deepEqual(observed, { height: 10n, lastValidBlockHeight: 100n });
  assert.equal(f.calls.filter((c) => c.method === "getGenesisHash").length >= 2, true);
  for (const c of f.calls.filter((c) => ["getLatestBlockhash", "getBlockHeight", "getSlot", "isBlockhashValid"].includes(c.method))) assert.equal((c.params.at(-1) as { commitment: string }).commitment, "confirmed");
});
test("RPC-1: cross-cluster substitution denies; blockhash mismatch or invalidity denies", async () => {
  for (const fault of ["network", "hash", "validity"]) {
    const f = fixture((c, result) => c.method === "getGenesisHash" && fault === "network" ? "foreign" : c.method === "getLatestBlockhash" && fault === "hash" ? { context: { slot: 100 }, value: { blockhash: encodeBase58(Buffer.alloc(32, 2)), lastValidBlockHeight: 100 } } : c.method === "isBlockhashValid" && fault === "validity" ? { context: { slot: 100 }, value: false } : result);
    await assert.rejects(f.rpc.observe(message, deadline()), /network|blockhash|provider/);
  }
});
test("RPC-2: malformed and non-integral heights or context cannot become authority", async () => {
  for (const method of ["getBlockHeight", "getLatestBlockhash", "isBlockhashValid"]) {
    const f = fixture((c, result) => c.method === method ? (method === "getBlockHeight" ? 1.5 : { context: { slot: -1 }, value: true }) : result);
    await assert.rejects(f.rpc.observe(message, deadline()), /shape|height|context|provider/);
  }
  const fractional = fixture((c, result) => c.method === "getSlot" ? 100.5 : ["getLatestBlockhash", "isBlockhashValid"].includes(c.method) ? { ...(result as object), context: { slot: 100.5 } } : result);
  await assert.rejects(fractional.rpc.observe(message, deadline()), /shape|context|provider/);
});
test("RPC-2: response ID/version, missing result, and oversized body refuse", async () => {
  for (const body of [{ jsonrpc: "2.0", id: -1, result: DEVNET_GENESIS }, { jsonrpc: "1.0", id: 1, result: DEVNET_GENESIS }, { jsonrpc: "2.0", id: 1 }, { padding: "x".repeat(300_000) }]) {
    const f = fixture(undefined, () => Response.json(body));
    await assert.rejects(f.rpc.height(deadline()), /response|provider/);
  }
  const wrongId = fixture(undefined, (c) => Response.json({ jsonrpc: "2.0", id: c.id + 1, result: c.method === "getGenesisHash" ? DEVNET_GENESIS : c.method === "getSlot" ? 100 : 10 }));
  await assert.rejects(wrongId.rpc.height(deadline()), /response|provider/);
});
test("RPC-3: one-provider outage permits conservative reads; total outage reports degraded", async () => {
  const single = fixture(undefined, (c) => c.url === urls[0] ? new Response("outage", { status: 503 }) : undefined);
  assert.equal(await single.rpc.height(deadline()), 10n);
  const all = fixture(undefined, () => new Response("outage", { status: 503 }));
  await assert.rejects(all.rpc.height(deadline()), /provider/);
  assert.equal((all.rpc.health() as { degraded: boolean }).degraded, true);
});
test("RPC-3: stale or conflicting observations cannot authorize a new proposal", async () => {
  const f = fixture((c, result) => c.method === "getLatestBlockhash" && c.url === urls[1] ? { context: { slot: 100 }, value: { blockhash: hash, lastValidBlockHeight: 99 } } : result);
  await assert.rejects(f.rpc.observe(message, deadline()), /conflict/);
  const stale = fixture((c, result) => c.method === "isBlockhashValid" ? { context: { slot: 99 }, value: true } : result);
  await assert.rejects(stale.rpc.observe(message, deadline()), /context|provider/);
});
test("RPC-4: chain outcome requires agreeing committed evidence; missing/stale/conflicting stays unresolved", async () => {
  assert.equal(await fixture().rpc.outcome(signature, deadline()), "landed");
  for (const fault of ["missing", "stale", "conflict", "processed", "outage"]) {
    const f = fixture((c, result) => c.method === "getSignatureStatuses" && (c.url === urls[1] || fault === "processed") ? { context: { slot: fault === "stale" ? 99 : 100 }, value: [fault === "missing" ? null : { slot: 90, err: fault === "conflict" ? { InstructionError: [0, "Custom"] } : null, confirmationStatus: fault === "processed" ? "processed" : "confirmed" }] } : result, (c) => fault === "outage" && c.url === urls[1] ? new Response("outage", { status: 503 }) : undefined);
    assert.equal(await f.rpc.outcome(signature, deadline()), null, fault);
  }
});
test("RPC-4: failed outcome needs matching committed failure from both providers", async () => {
  const f = fixture((c, result) => c.method === "getSignatureStatuses" ? { context: { slot: 100 }, value: [{ slot: 90, err: { InstructionError: [0, "Custom"] }, confirmationStatus: "finalized" }] } : result);
  assert.equal(await f.rpc.outcome(signature, deadline()), "failed");
});
test("RPC-2/SIG-9: rate-limited reads back off, but send has exactly one attempt with node retries disabled", async () => {
  let limits = 0; const f = fixture(undefined, (c) => c.method === "getBlockHeight" && limits++ === 0 ? new Response("limited", { status: 429 }) : undefined);
  assert.equal(await f.rpc.height(deadline()), 10n);
  assert.equal(f.calls.filter((c) => c.method === "getBlockHeight").length >= 2, true);
  let sends = 0; const sending = fixture(undefined, (c) => c.method === "sendTransaction" ? (sends++, new Response("lost", { status: 503 })) : undefined);
  await assert.rejects(sending.rpc.send(Uint8Array.of(1), deadline())); assert.equal(sends, 1);
  const send = sending.calls.find((c) => c.method === "sendTransaction")!;
  assert.equal((send.params[1] as { maxRetries: number }).maxRetries, 0);
  assert.equal((send.params[1] as { skipPreflight: boolean }).skipPreflight, false);
});
test("RPC-2: hung reads end at their deadline and expired calls make no network request", async () => {
  let calls = 0;
  const rpc = createTrustedRpc(urls, { timeoutMs: 30, fetch: async (_url, init) => {
    calls++; return await new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("deadline abort")), { once: true }));
  } });
  await assert.rejects(rpc.height(Date.now() - 1), /deadline|provider/); assert.equal(calls, 0);
  await assert.rejects(rpc.height(Date.now() + 80), /deadline|provider/); assert.ok(calls > 0);
});
