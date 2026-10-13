// SIG-1/2/3/6/7/8/10: actual native process, solana-keygen key and fake loopback providers.
// Requires the existing local Solana toolchain; not an installed isolated-user qualification.
import { strict as assert } from "node:assert";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { once } from "node:events";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createSendingClient, decodeBase58, decodeMessage, encodeBase58, preparePolicyText } from "@solanaut/sdk";
import { canonicalJSON } from "../../packages/sdk/src/canonical.ts";
import { WORKLOAD_POLICY } from "../../packages/sdk/test/support/workload.ts";
import { craftLegacy, key } from "../../packages/sdk/test/support/craft.ts";
import { DEVNET_GENESIS } from "../../apps/signer/src/rpc.ts";
const entrypoint = resolve("apps/signer/src/main.ts");
async function stop(child: ChildProcess, signal: NodeJS.Signals = "SIGTERM") {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, "exit"); child.kill(signal);
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  try { await closed; } finally { clearTimeout(timer); }
}
test("SIG-1/2/3/6/7/8/10: keygen-backed process restores an interrupted send without another signature or send", async () => {
  const keyDirectory = mkdtempSync(resolve("keys/devnet-process-")); chmodSync(keyDirectory, 0o700);
  mkdirSync(".sandbox/process", { recursive: true }); const root = mkdtempSync(resolve(".sandbox/process/run-")); chmodSync(root, 0o700);
  const keypair = join(keyDirectory, "devnet-agent.json");
  execFileSync("solana-keygen", ["new", "--silent", "--no-bip39-passphrase", "--outfile", keypair], { stdio: "ignore" }); chmodSync(keypair, 0o400);
  const address = execFileSync("solana-keygen", ["pubkey", keypair], { encoding: "utf8" }).trim();
  const publicBytes = decodeBase58(address), operator = generateKeyPairSync("ed25519");
  const operatorKey = encodeBase58(Buffer.from(operator.publicKey.export({ format: "jwk" }).x!, "base64url"));
  const policy = { ...WORKLOAD_POLICY, principal: [address], latch: { ...WORKLOAD_POLICY.latch, cluster: "devnet", releaseKey: operatorKey } };
  const issued = "2026-10-13T00:00:00.000Z", text = preparePolicyText(policy, 1, issued);
  const authorization = { operatorKey, guardId: policy.latch.guardId, cluster: "devnet", version: 1, issued, text, signature: sign(null, Buffer.from(text), operator.privateKey).toString("base64") };
  mkdirSync(join(root, "history"), { mode: 0o700 }); mkdirSync(join(root, "socket"), { mode: 0o750 });
  const record = join(root, "history", "record.jsonl"), socket = join(root, "socket", "signer.sock"), config = join(root, "config.json");
  writeFileSync(config, canonicalJSON({ cluster: "devnet", keypair, record, socket, policy, authorization }), { mode: 0o600 });
  const message = craftLegacy({ header: [1, 0, 1], keys: [[...publicBytes], key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
  let sends = 0, landed = false, sending!: () => void;
  const entered = new Promise<void>(r => { sending = r; });
  const servers = [0, 1].map(() => createServer(async (request, response) => {
    let body = ""; for await (const chunk of request) body += chunk;
    const r = JSON.parse(body);
    if (r.method === "sendTransaction") { sends++; sending(); return; } // Deliberately lose the HTTP response.
    const result = ({ getGenesisHash: DEVNET_GENESIS, getSlot: 100, getBlockHeight: 10,
      getLatestBlockhash: { context: { slot: 100 }, value: { blockhash: decodeMessage(message).lifetimeToken, lastValidBlockHeight: 100 } },
      isBlockhashValid: { context: { slot: 100 }, value: true },
      getSignatureStatuses: { context: { slot: 100 }, value: [landed ? { slot: 90, err: null, confirmationStatus: "confirmed" } : null] } } as Record<string, unknown>)[r.method];
    response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ jsonrpc: "2.0", id: r.id, result }));
  }));
  for (const server of servers) { server.listen(0, "127.0.0.1"); await once(server, "listening"); }
  const urls = servers.map(server => `http://127.0.0.1:${(server.address() as { port: number }).port}`);
  const env = { ...process.env, SOLANAUT_RPC_A: urls[0], SOLANAUT_RPC_B: urls[1] };
  let child: ChildProcess | undefined;
  const entries = () => readFileSync(record, "utf8").trim().split("\n").map(line => JSON.parse(line));
  async function start() {
    const process = spawn(globalThis.process.execPath, [entrypoint, "--same-user", "--config", config], { env, stdio: ["ignore", "pipe", "pipe"] });
    child = process;
    await new Promise<void>((ready, reject) => {
      let output = "", error = ""; const timer = setTimeout(() => reject(new Error("process startup deadline")), 5000);
      process.stderr!.on("data", b => { error += b; });
      process.stdout!.on("data", b => { output += b; if (output.includes('"status":"ready"')) { clearTimeout(timer); ready(); } });
      process.once("error", reject); process.once("exit", () => { clearTimeout(timer); reject(new Error("process exited before ready: " + error)); });
    });
    return process;
  }
  try {
    execFileSync(process.execPath, [entrypoint, "--same-user", "--config", config, "--init"], { env, stdio: "pipe", timeout: 5000 });
    await start(); const client = createSendingClient({ socket, clientId: "agent", timeoutMs: 5000 });
    const pending = client.propose({ id: "payment", message }).catch(error => error);
    const deadline = setTimeout(() => sending(), 5000); await entered; clearTimeout(deadline); assert.equal(sends, 1);
    await stop(child!, "SIGKILL"); const failure = await pending; assert.equal(failure.mayHaveExecuted, true);
    await start();
    const result = await client.propose({ id: "payment", message, deadline: 0 }); assert.equal(result.status, "uncertain");
    assert.equal(sends, 1); assert.equal(entries().filter(e => e.kind === "signing" && e.event.stage === "signed").length, 1);
    assert.equal(entries().filter(e => e.kind === "signing" && e.event.stage === "send-started").length, 1);
    landed = true; const until = Date.now() + 4000;
    while (!entries().some(e => e.kind === "report") && Date.now() < until) await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(entries().filter(e => e.kind === "report").map(e => [e.outcome, e.source]), [["landed", "signer"]]);
    assert.equal(sends, 1); await stop(child!);
  } finally {
    if (child) await stop(child);
    for (const server of servers) { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
    rmSync(keyDirectory, { recursive: true });
  }
});
