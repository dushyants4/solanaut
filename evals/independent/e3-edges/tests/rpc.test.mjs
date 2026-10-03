// jsonRpc against a local HTTP server on 127.0.0.1. Expectations from SPEC.md §8 ("jsonRpc(url)") and §10 (D13, D14).
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { jsonRpc, RpcRefused } from "@solanaut/sdk";
import { sleep } from "./helpers.mjs";

/** A JSON-RPC server whose answers come from `handler(method, params, req, res, n)`; it records every request. */
async function server(handler) {
  const seen = [];
  const counts = {};
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let j;
      try { j = JSON.parse(body); } catch { res.writeHead(400).end(); return; }
      seen.push(j);
      counts[j.method] = (counts[j.method] ?? 0) + 1;
      const out = await handler(j.method, j.params, req, res, counts[j.method]);
      if (out === undefined) return; // handler answered or dropped
      if (out.status) { res.writeHead(out.status, { "content-type": "application/json" }).end(out.body ?? ""); return; }
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: j.id, ...out }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  return { url, seen, counts, close: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(r); }) };
}

/** Resolve to {state, value}: settled within ms, or still pending. */
async function within(p, ms) {
  let timer;
  const r = await Promise.race([
    p.then((value) => ({ state: "resolved", value }), (e) => ({ state: "rejected", value: e })),
    new Promise((res) => { timer = setTimeout(() => res({ state: "pending" }), ms); }),
  ]);
  clearTimeout(timer);
  return r;
}

const WIRE = new Uint8Array([1, ...new Array(64).fill(7), 1, 0, 1, 2, ...new Array(96).fill(3), 0]);
const SIG = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";

test("E25 §8 jsonRpc reads back off and retry through HTTP 429: getBlockHeight answers after two 429s", { timeout: 30_000 }, async () => {
  const s = await server((m, p, req, res, n) => (n <= 2 ? { status: 429, body: "Too Many Requests" } : { result: 4242 }));
  try {
    const h = await jsonRpc(s.url).getBlockHeight();
    assert.equal(h, 4242n);
    assert.equal(s.counts.getBlockHeight, 3);
  } finally { await s.close(); }
});

test("E26 §8 jsonRpc reads retry through a dropped connection: getBlockHeight answers after one drop", { timeout: 30_000 }, async () => {
  const s = await server((m, p, req, res, n) => { if (n === 1) { req.socket.destroy(); return undefined; } return { result: 77 }; });
  try {
    assert.equal(await jsonRpc(s.url).getBlockHeight(), 77n);
    assert.equal(s.counts.getBlockHeight, 2);
  } finally { await s.close(); }
});

test("E27 §8 D13 a JSON-RPC error answer to sendTransaction rejects with RpcRefused, sent once", { timeout: 30_000 }, async () => {
  const s = await server(() => ({ error: { code: -32002, message: "Transaction simulation failed: Attempt to debit an account but found no record of a prior credit." } }));
  try {
    await assert.rejects(jsonRpc(s.url).sendRawTransaction(WIRE), (e) => e instanceof RpcRefused && e.refused === true);
    await sleep(1500);
    assert.equal(s.counts.sendTransaction, 1);
  } finally { await s.close(); }
});

test("E28 §8 D13 HTTP 429 on sendTransaction: a plain error (not refused), and the send is never retried", { timeout: 30_000 }, async () => {
  const s = await server((m) => (m === "sendTransaction" ? { status: 429, body: "Too Many Requests" } : { result: 1 }));
  try {
    await assert.rejects(jsonRpc(s.url).sendRawTransaction(WIRE), (e) => !(e instanceof RpcRefused) && e.refused !== true);
    await sleep(1500);
    assert.equal(s.counts.sendTransaction, 1, `sent ${s.counts.sendTransaction} times`);
  } finally { await s.close(); }
});

test("E29 §8 D13 a dropped connection on sendTransaction: a plain error (not refused), never retried", { timeout: 30_000 }, async () => {
  const s = await server((m, p, req) => { req.socket.destroy(); return undefined; });
  try {
    await assert.rejects(jsonRpc(s.url).sendRawTransaction(WIRE), (e) => !(e instanceof RpcRefused) && e.refused !== true);
    await sleep(1500);
    assert.equal(s.counts.sendTransaction, 1, `sent ${s.counts.sendTransaction} times`);
  } finally { await s.close(); }
});

test("E30 §8 sendTransaction carries the wire bytes as base64 and resolves to the RPC's signature", { timeout: 30_000 }, async () => {
  const s = await server(() => ({ result: SIG }));
  try {
    const sig = await jsonRpc(s.url).sendRawTransaction(WIRE);
    assert.equal(sig, SIG);
    const [req] = s.seen;
    assert.equal(req.method, "sendTransaction");
    assert.equal(req.params[0], Buffer.from(WIRE).toString("base64"));
    assert.equal(req.params[1]?.encoding, "base64");
  } finally { await s.close(); }
});

test("E31 §8 §10 D14 confirm reads the height before the status: a tx landing at its last valid height is landed, not expired", { timeout: 30_000 }, async () => {
  let statusReads = 0;
  const s = await server((m) => {
    if (m === "getBlockHeight") return { result: statusReads === 0 ? 1150 : 1151 };
    if (m === "getSignatureStatuses") {
      statusReads++;
      const v = statusReads === 1 ? null : { slot: 9, confirmations: null, err: null, confirmationStatus: "finalized", status: { Ok: null } };
      return { result: { context: { slot: 9 }, value: [v] } };
    }
    return { result: null };
  });
  try {
    const out = await jsonRpc(s.url, { pollMs: 50, timeoutMs: 5_000 }).confirm(SIG, 1150n);
    assert.equal(out, "landed");
  } finally { await s.close(); }
});

test("E32 §8 confirm: never seen, and the height passes the last valid height: expired", { timeout: 30_000 }, async () => {
  let h = 1149;
  const s = await server((m) => {
    if (m === "getBlockHeight") return { result: h++ };
    if (m === "getSignatureStatuses") return { result: { context: { slot: 9 }, value: [null] } };
    return { result: null };
  });
  try {
    assert.equal(await jsonRpc(s.url, { pollMs: 20, timeoutMs: 10_000 }).confirm(SIG, 1150n), "expired");
  } finally { await s.close(); }
});

test("E33 §8 confirm: a timeout before the last valid height gives unknown", { timeout: 30_000 }, async () => {
  const s = await server((m) => {
    if (m === "getBlockHeight") return { result: 1000 };
    if (m === "getSignatureStatuses") return { result: { context: { slot: 9 }, value: [null] } };
    return { result: null };
  });
  try {
    assert.equal(await jsonRpc(s.url, { pollMs: 20, timeoutMs: 300 }).confirm(SIG, 1150n), "unknown");
  } finally { await s.close(); }
});

test("E34 §8 getSignatureStatus searches history and maps landed / failed / pending / unseen", { timeout: 30_000 }, async () => {
  const table = {
    A: { slot: 1, confirmations: null, err: null, confirmationStatus: "finalized" },
    B: { slot: 1, confirmations: null, err: { InstructionError: [0, { Custom: 1 }] }, confirmationStatus: "finalized" },
    C: { slot: 1, confirmations: 0, err: null, confirmationStatus: "processed" },
    D: null,
  };
  const s = await server((m, p) => {
    if (m !== "getSignatureStatuses") return { result: 1 };
    const history = p?.[1]?.searchTransactionHistory === true;
    return { result: { context: { slot: 9 }, value: p[0].map((sig) => (history ? table[sig[0]] ?? null : null)) } };
  });
  try {
    const rpc = jsonRpc(s.url);
    assert.equal(typeof rpc.getSignatureStatus, "function");
    assert.equal(await rpc.getSignatureStatus("A" + SIG.slice(1)), "landed");
    assert.equal(await rpc.getSignatureStatus("B" + SIG.slice(1)), "failed");
    assert.equal(await rpc.getSignatureStatus("C" + SIG.slice(1)), "pending");
    assert.equal(await rpc.getSignatureStatus("D" + SIG.slice(1)), null);
  } finally { await s.close(); }
});

test("E74 §8 confirm: a status only at processed commitment is not landed; before the last valid height a timeout gives unknown", { timeout: 30_000 }, async () => {
  const s = await server((m) => {
    if (m === "getBlockHeight") return { result: 1000 };
    if (m === "getSignatureStatuses") return { result: { context: { slot: 9 }, value: [{ slot: 9, confirmations: 0, err: null, confirmationStatus: "processed", status: { Ok: null } }] } };
    return { result: null };
  });
  try {
    assert.equal(await jsonRpc(s.url, { pollMs: 20, timeoutMs: 300 }).confirm(SIG, 1150n), "unknown");
  } finally { await s.close(); }
});

test("E75 §7 §8 confirm: never seen at exactly the last valid height is not expired (it can still land); a timeout gives unknown", { timeout: 30_000 }, async () => {
  const s = await server((m) => {
    if (m === "getBlockHeight") return { result: 1150 };
    if (m === "getSignatureStatuses") return { result: { context: { slot: 9 }, value: [null] } };
    return { result: null };
  });
  try {
    assert.equal(await jsonRpc(s.url, { pollMs: 20, timeoutMs: 300 }).confirm(SIG, 1150n), "unknown");
  } finally { await s.close(); }
});

test("E76 §8 D13 sendTransaction answered HTTP 200 with a non-JSON body (a proxy's page): not refused, never retried", { timeout: 30_000 }, async () => {
  const s = await server((m, p, req, res) => { res.writeHead(200, { "content-type": "text/html" }).end("<html><body>502 Bad Gateway</body></html>"); return undefined; });
  try {
    await assert.rejects(jsonRpc(s.url).sendRawTransaction(WIRE), (e) => !(e instanceof RpcRefused) && e.refused !== true);
    await sleep(1500);
    assert.equal(s.counts.sendTransaction, 1);
  } finally { await s.close(); }
});

test("E80 §8 D14 getSignatureStatus through a failing RPC (JSON-RPC errors): never reads as unseen (null)", { timeout: 30_000 }, async (t) => {
  const s = await server((m) => (m === "getSignatureStatuses" ? { error: { code: -32603, message: "Internal error" } } : { result: 1 }));
  try {
    const r = await within(jsonRpc(s.url).getSignatureStatus(SIG), 8_000);
    t.diagnostic(`state=${r.state} value=${r.value}`);
    assert.ok(!(r.state === "resolved" && r.value === null), "a failed read was reported as not seen");
  } finally { await s.close(); }
});

test("E81 §8 D14 confirm past the last valid height while every status read fails: never expired", { timeout: 30_000 }, async (t) => {
  const s = await server((m) => {
    if (m === "getBlockHeight") return { result: 2000 };
    if (m === "getSignatureStatuses") return { status: 503, body: "Service Unavailable" };
    return { result: null };
  });
  try {
    const r = await within(jsonRpc(s.url, { pollMs: 20, timeoutMs: 2_000 }).confirm(SIG, 1150n), 10_000);
    t.diagnostic(`state=${r.state} value=${r.value}`);
    assert.ok(!(r.state === "resolved" && r.value === "expired"), "an unread status past the height was called expired");
  } finally { await s.close(); }
});
