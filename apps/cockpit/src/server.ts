// The cockpit, dashboard v0 (milestone 2a.10, ADR-011). It shows a guard as the guard will rebuild
// itself: its record, inspected with the SDK's inspectRecord, and from the chain, the Squads
// spending limit remaining. It holds no keys and writes nothing.
//
//   npm run cockpit -- --record <guard.jsonl> --policy <policy.json> [--rpc <url> --squads <squads.json>] [--port 8787]
//
// Localhost only, until it passes ASVS L2 and Phantom's domain review (ADR-011):
//   - it binds 127.0.0.1, and answers only requests addressed to 127.0.0.1 or localhost, so a
//     page on another site cannot reach it through a rebound DNS name;
//   - GET only; every other method is refused;
//   - its page carries a strict content security policy, and loads its one script from itself.
// Every transaction it reads from the chain opts in to v1 (maxSupportedTransactionVersion: 1).

import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { inspectRecord, type Entry } from "@solanaut/sdk";
import * as multisig from "@sqds/multisig";

export interface CockpitOptions {
  /** The guard's record: one JSON entry per line. Read on every request; never written. */
  record: string;
  /** The guard's policy, as JSON with amounts as decimal strings. */
  policy: string;
  /** Optional: an RPC for chain reads. */
  rpc?: string;
  /** Optional: the Squads addresses to show, as `apps/onchain/src/squads.ts --out` writes them. */
  squads?: string;
}

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const PAGE = {
  "/": ["page.html", "text/html; charset=utf-8"],
  "/cockpit.js": ["cockpit.js", "text/javascript; charset=utf-8"],
  "/cockpit.css": ["cockpit.css", "text/css; charset=utf-8"],
} as const;

const HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "cache-control": "no-store",
};

function send(res: ServerResponse, status: number, body: string, type = "application/json; charset=utf-8") {
  res.writeHead(status, { ...HEADERS, "content-type": type });
  res.end(body);
}
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

function readRecord(path: string): Entry[] {
  const text = readFileSync(path, "utf8");
  // A last line without its newline is a write in progress: the guard has not answered on it yet.
  return text
    .slice(0, text.lastIndexOf("\n") + 1)
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Entry);
}

async function rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result as T;
}

interface Recent {
  signature: string;
  slot: number;
  ok: boolean;
  /** The program's own name for the error (Anchor's "Error Code"), else the runtime's, else null. */
  error: string | null;
  fee: number | null;
  version: number | "legacy" | null;
}

/** The error a failed transaction's logs name, as Anchor programs such as Squads log it. */
export function programError(err: unknown, logs: readonly string[]): string | null {
  if (err === null || err === undefined) return null;
  for (const l of logs) {
    const m = /Error Code: (\w+)/.exec(l);
    if (m) return m[1]!;
  }
  return JSON.stringify(err);
}

async function chain(o: CockpitOptions, cache: Map<string, Recent>) {
  if (!o.rpc || !o.squads) return { configured: false };
  const s = JSON.parse(readFileSync(o.squads, "utf8")) as {
    multisig: string;
    vault: string;
    spendingLimit: string;
    agent: string;
  };
  const info = await rpcCall<{ value: { data: [string, string] } | null }>(o.rpc, "getAccountInfo", [
    s.spendingLimit,
    { encoding: "base64", commitment: "confirmed" },
  ]);
  let limit = null;
  if (info.value) {
    const [sl] = multisig.generated.SpendingLimit.deserialize(Buffer.from(info.value.data[0], "base64"));
    limit = {
      amount: sl.amount.toString(),
      remaining: sl.remainingAmount.toString(),
      period: multisig.types.Period[sl.period],
      lastReset: sl.lastReset.toString(),
      members: sl.members.map((k) => k.toBase58()),
      destinations: sl.destinations.map((k) => k.toBase58()),
    };
  }
  const vault = await rpcCall<{ value: number }>(o.rpc, "getBalance", [s.vault, { commitment: "confirmed" }]);
  const sigs = await rpcCall<{ signature: string; slot: number; err: unknown; confirmationStatus?: string }[]>(
    o.rpc,
    "getSignaturesForAddress",
    [s.agent, { limit: 10, commitment: "confirmed" }],
  );
  const recent: Recent[] = [];
  for (const x of sigs) {
    const known = cache.get(x.signature);
    if (known) {
      recent.push(known);
      continue;
    }
    // v1 transactions have been live since 2026-09-15: a read that does not opt in fails on them.
    const tx = await rpcCall<{
      slot: number;
      version: number | "legacy";
      meta: { err: unknown; fee: number; logMessages?: string[] } | null;
    } | null>(o.rpc, "getTransaction", [
      x.signature,
      { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 1 },
    ]);
    const err = tx?.meta ? tx.meta.err : x.err;
    const r: Recent = {
      signature: x.signature,
      slot: x.slot,
      ok: err === null,
      error: programError(err, tx?.meta?.logMessages ?? []),
      fee: tx?.meta?.fee ?? null,
      version: tx?.version ?? null,
    };
    // A finalized transaction never changes, so it is read once; a public RPC limits each method's rate.
    if (tx && x.confirmationStatus === "finalized") {
      cache.set(x.signature, r);
      if (cache.size > 256) cache.delete(cache.keys().next().value!);
    }
    recent.push(r);
  }
  return {
    configured: true,
    multisig: s.multisig,
    spendingLimit: s.spendingLimit,
    limit,
    vault: String(vault.value),
    recent,
  };
}

export function createCockpit(o: CockpitOptions): Server {
  const policy = () => JSON.parse(readFileSync(o.policy, "utf8"));
  const finalized = new Map<string, Recent>();
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const port = (server.address() as { port: number } | null)?.port;
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`)
      return send(res, 421, json({ error: "this cockpit answers only on 127.0.0.1 and localhost" }));
    if (req.method !== "GET") return send(res, 405, json({ error: "the cockpit is read-only" }));
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    try {
      if (path in PAGE) {
        const [file, type] = PAGE[path as keyof typeof PAGE];
        return send(res, 200, readFileSync(here(file), "utf8"), type);
      }
      if (path === "/api/state") return send(res, 200, json(inspectRecord(readRecord(o.record), policy())));
      if (path === "/api/chain") return send(res, 200, json(await chain(o, finalized)));
      return send(res, 404, json({ error: "not found" }));
    } catch (e) {
      return send(res, 500, json({ error: (e as Error).message }));
    }
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const record = arg("record");
  const policyPath = arg("policy");
  if (!record || !policyPath) {
    console.error(
      "usage: npm run cockpit -- --record <guard.jsonl> --policy <policy.json> [--rpc <url> --squads <squads.json>] [--port 8787]",
    );
    process.exit(2);
  }
  const port = Number(arg("port") ?? 8787);
  createCockpit({ record, policy: policyPath, rpc: arg("rpc"), squads: arg("squads") }).listen(
    port,
    "127.0.0.1",
    () => {
      console.log(`cockpit: http://127.0.0.1:${port}  (read-only; no keys; record ${record})`);
    },
  );
}
