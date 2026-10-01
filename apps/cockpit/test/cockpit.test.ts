// Milestone 2a.10, dashboard v0 (ADR-011): on localhost only, it holds no keys and writes nothing.
// It shows the guard's live decisions from the record, spend against caps, intents and the latch,
// and, from the chain, the Squads limit remaining; every transaction it reads opts in to v1.

import { strict as assert } from "node:assert";
import { once } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, request, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { createGuard, inspectRecord, type Entry } from "@solanaut/sdk";
import { createCockpit, type CockpitOptions } from "../src/server.ts";
import { step, WORKLOAD_POLICY } from "../../../packages/sdk/test/support/workload.ts";

const asJSON = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return (server.address() as { port: number }).port;
}

function get(port: number, path: string, o: { method?: string; host?: string } = {}): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method: o.method ?? "GET", headers: { host: o.host ?? `127.0.0.1:${port}` } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** Run `fn` against a cockpit, and close it whatever happens, so a failing test cannot leave a server open. */
async function withCockpit(opts: CockpitOptions, fn: (port: number, server: Server) => Promise<void>) {
  let server: Server | undefined;
  try {
    server = createCockpit(opts);
    await fn(await listen(server), server);
  } finally {
    server?.close();
  }
}

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "solanaut-cockpit-"));
  const record = join(dir, "guard.jsonl");
  const policy = join(dir, "policy.json");
  writeFileSync(policy, asJSON(WORKLOAD_POLICY));
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: record });
  return { dir, record, policy, g };
}

test("the cockpit binds to 127.0.0.1 only, and refuses a request for any other host name", async () => {
  const f = await fixture();
  try {
    await withCockpit({ record: f.record, policy: f.policy }, async (port, server) => {
      assert.equal((server.address() as { address: string }).address, "127.0.0.1");
      assert.equal((await get(port, "/api/state")).status, 200);
      assert.equal((await get(port, "/api/state", { host: `localhost:${port}` })).status, 200);
      assert.equal((await get(port, "/api/state", { host: "attacker.example" })).status, 421, "a rebound DNS name is refused");
    });
  } finally {
    f.g.close();
  }
});

test("/api/state is the record, inspected fresh on every request", async () => {
  const f = await fixture();
  for (let i = 0; i < 12; i++) step(f.g, i);
  try {
    await withCockpit({ record: f.record, policy: f.policy }, async (port, server) => {
      const first = JSON.parse((await get(port, "/api/state")).body);
      assert.deepEqual(first, JSON.parse(asJSON(inspectRecord(f.g.entries(), WORKLOAD_POLICY))));
      for (let i = 12; i < 20; i++) step(f.g, i);
      const second = JSON.parse((await get(port, "/api/state")).body);
      assert.equal(second.entries, 20, "a new decision shows on the next request");
    });
  } finally {
    f.g.close();
  }
});

test("the cockpit writes nothing: every method but GET is refused, and unknown paths are not found", async () => {
  const f = await fixture();
  try {
    await withCockpit({ record: f.record, policy: f.policy }, async (port, server) => {
      for (const method of ["POST", "PUT", "DELETE", "PATCH"]) assert.equal((await get(port, "/api/state", { method })).status, 405, method);
      assert.equal((await get(port, "/../../keys/devnet-operator.json")).status, 404);
      assert.equal((await get(port, "/api/keys")).status, 404);
    });
  } finally {
    f.g.close();
  }
});

test("the page is served with a strict content security policy, its script from its own origin", async () => {
  const f = await fixture();
  try {
    await withCockpit({ record: f.record, policy: f.policy }, async (port, server) => {
      const page = await get(port, "/");
      assert.equal(page.status, 200);
      assert.match(String(page.headers["content-security-policy"]), /default-src 'self'/);
      assert.doesNotMatch(String(page.headers["content-security-policy"]), /unsafe-inline|unsafe-eval/);
      assert.equal(page.headers["x-content-type-options"], "nosniff");
      assert.match(page.body, /<script src="\/cockpit\.js"><\/script>/);
      assert.doesNotMatch(page.body, /<script>[^<]/, "no inline script");
      assert.equal((await get(port, "/cockpit.js")).status, 200);
    });
  } finally {
    f.g.close();
  }
});

test("/api/chain reads the Squads limit remaining, and every transaction read opts in to v1", async () => {
  const f = await fixture();
  const agent = Keypair.generate().publicKey;
  const treasury = Keypair.generate().publicKey;
  const [multisigPda] = multisig.getMultisigPda({ createKey: Keypair.generate().publicKey });
  const spendingLimit = Keypair.generate().publicKey;
  const vault = Keypair.generate().publicKey;
  const [limitData] = multisig.generated.SpendingLimit.fromArgs({
    multisig: multisigPda, createKey: Keypair.generate().publicKey, vaultIndex: 0, mint: PublicKey.default, amount: 20_000_000, period: multisig.types.Period.Day,
    remainingAmount: 5_000_000, lastReset: 1_700_000_000, bump: 255, members: [agent], destinations: [treasury],
  }).serialize();
  const seen: { method: string; params: unknown[] }[] = [];
  const rpc = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const { id, method, params } = JSON.parse(raw);
    seen.push({ method, params });
    const result =
      method === "getAccountInfo" ? { context: { slot: 1 }, value: { data: [limitData.toString("base64"), "base64"], owner: multisig.PROGRAM_ADDRESS, lamports: 1, executable: false, rentEpoch: 0 } } :
      method === "getBalance" ? { context: { slot: 1 }, value: 90_000_000 } :
      method === "getSignaturesForAddress" ? [{ signature: "sig1", slot: 9, err: null, blockTime: 1 }] :
      method === "getTransaction" ? { slot: 9, version: 1, meta: { err: null, fee: 5000 } } : null;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
  });
  const rpcPort = await listen(rpc);
  const squads = join(f.dir, "squads.json");
  writeFileSync(squads, JSON.stringify({ multisig: multisigPda.toBase58(), vault: vault.toBase58(), spendingLimit: spendingLimit.toBase58(), agent: agent.toBase58() }));
  try {
    await withCockpit({ record: f.record, policy: f.policy, rpc: `http://127.0.0.1:${rpcPort}`, squads }, async (port, server) => {
      const chain = JSON.parse((await get(port, "/api/chain")).body);
      assert.deepEqual(chain.limit, { amount: "20000000", remaining: "5000000", period: "Day", lastReset: "1700000000", members: [agent.toBase58()], destinations: [treasury.toBase58()] });
      assert.equal(chain.vault, "90000000");
      assert.deepEqual(chain.recent, [{ signature: "sig1", slot: 9, ok: true, fee: 5000, version: 1 }]);
      const txReads = seen.filter((c) => c.method === "getTransaction");
      assert.ok(txReads.length > 0);
      for (const c of txReads) assert.equal((c.params[1] as { maxSupportedTransactionVersion: number }).maxSupportedTransactionVersion, 1);
    });
  } finally {
    rpc.close();
    f.g.close();
  }
});

test("without a chain configured, /api/chain says so instead of guessing", async () => {
  const f = await fixture();
  try {
    await withCockpit({ record: f.record, policy: f.policy }, async (port, server) => {
      assert.deepEqual(JSON.parse((await get(port, "/api/chain")).body), { configured: false });
    });
  } finally {
    f.g.close();
  }
});

// Keep the import used for its type in fixtures that build records by hand.
export type { Entry };
