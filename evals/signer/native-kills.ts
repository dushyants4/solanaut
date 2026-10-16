// Frozen native SIG-8 programme; keygen-backed key, actual process kills, fake providers.
import { strict as assert } from "node:assert";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { once } from "node:events";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { createSendingClient, decodeBase58, decodeMessage, encodeBase58, preparePolicyText, replay, type Entry } from "@solanaut/sdk";
import { canonicalJSON } from "../../packages/sdk/src/canonical.ts";
import { WORKLOAD_POLICY } from "../../packages/sdk/test/support/workload.ts";
import { craftLegacy, key } from "../../packages/sdk/test/support/craft.ts";
import { DEVNET_GENESIS } from "../../apps/signer/src/rpc.ts";
import { NATIVE_KILL_SEED, NATIVE_KILL_STAGES, nativeKillPlan, requireNativeKills, type NativeKillRow } from "./native-kill-contract.ts";
const pilot = process.argv.slice(2).join(" ") === "--pilot";
if (process.argv.length > (pilot ? 3 : 2)) throw new Error("usage: node evals/signer/native-kills.ts [--pilot]");
mkdirSync(".sandbox/evidence/2026-10-13-development/native-kills", { recursive: true });
const root = mkdtempSync(resolve(".sandbox/evidence/2026-10-13-development/native-kills/run-")); chmodSync(root, 0o700);
const socketDirectory = join(root, "s"); mkdirSync(socketDirectory, { mode: 0o750 });
const keyDirectory = mkdtempSync(resolve("keys/devnet-native-kills-")); chmodSync(keyDirectory, 0o700);
const keypair = join(keyDirectory, "devnet-agent.json");
execFileSync("solana-keygen", ["new", "--silent", "--no-bip39-passphrase", "--outfile", keypair], { stdio: "ignore" }); chmodSync(keypair, 0o400);
const address = execFileSync("solana-keygen", ["pubkey", keypair], { encoding: "utf8" }).trim();
const publicBytes = decodeBase58(address), operator = generateKeyPairSync("ed25519");
const operatorKey = encodeBase58(Buffer.from(operator.publicKey.export({ format: "jwk" }).x!, "base64url"));
const message = craftLegacy({ header: [1, 0, 1], keys: [[...publicBytes], key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
const entrypoint = resolve("apps/signer/src/main.ts"), hook = resolve("evals/signer/native-kill-hook.ts");
let sends = 0, landed = false;
const servers = [0, 1].map(() => createServer(async (request, response) => {
  let body = ""; for await (const chunk of request) body += chunk;
  const r = JSON.parse(body);
  const result = r.method === "sendTransaction" ? (sends++, encodeBase58(Buffer.from(r.params[0], "base64").subarray(1, 65))) :
    ({ getGenesisHash: DEVNET_GENESIS, getSlot: 100, getBlockHeight: 10,
      getLatestBlockhash: { context: { slot: 100 }, value: { blockhash: decodeMessage(message).lifetimeToken, lastValidBlockHeight: 100 } },
      isBlockhashValid: { context: { slot: 100 }, value: true },
      getSignatureStatuses: { context: { slot: 100 }, value: [landed ? { slot: 90, err: null, confirmationStatus: "confirmed" } : null] } } as Record<string, unknown>)[r.method];
  response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ jsonrpc: "2.0", id: r.id, result }));
}));
for (const server of servers) { server.listen(0, "127.0.0.1"); await once(server, "listening"); }
const urls = servers.map(server => `http://127.0.0.1:${(server.address() as { port: number }).port}`);
const env = { ...process.env, SOLANAUT_RPC_A: urls[0], SOLANAUT_RPC_B: urls[1] };
let child: ChildProcess | undefined;
async function stop(signal: NodeJS.Signals = "SIGTERM") {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, "exit"); child.kill(signal); const timer = setTimeout(() => child?.kill("SIGKILL"), 5000);
  try { await closed; } finally { clearTimeout(timer); }
}
async function start(config: string, record: string, stage?: string) {
  const processEnv = { ...env, ...(stage ? { SOLANAUT_NATIVE_KILL_STAGE: stage, SOLANAUT_NATIVE_KILL_RECORD: record } : {}) };
  const current = spawn(process.execPath, [...(stage ? ["--import", hook] : []), entrypoint, "--same-user", "--config", config], { env: processEnv, stdio: ["ignore", "pipe", "pipe"] }); child = current;
  let output = "", error = ""; const watchers: { token: string; resolve(): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }[] = [];
  function wait(token: string): Promise<void> {
    if (output.includes(token)) return Promise.resolve();
    return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("native checkpoint deadline: " + token)), 10000); watchers.push({ token, resolve, reject, timer }); });
  }
  current.stderr!.on("data", b => { error = (error + b).slice(-4096); });
  current.stdout!.on("data", b => {
    output += b; if (output.length > 8192) current.kill("SIGKILL");
    for (const watcher of watchers) if (output.includes(watcher.token)) { clearTimeout(watcher.timer); watcher.resolve(); }
  });
  current.once("error", error => { for (const watcher of watchers) { clearTimeout(watcher.timer); watcher.reject(error); } });
  current.once("exit", () => { for (const watcher of watchers) { clearTimeout(watcher.timer); if (!output.includes(watcher.token)) watcher.reject(new Error("native child exited: " + error + " stdout=" + output)); } });
  await wait('"status":"ready"'); return { process: current, wait };
}
const rows: NativeKillRow[] = [];
const entriesHaveSettled = (text: string) => text.trim().split("\n").map(line => JSON.parse(line)).some((e: Entry) => e.kind === "report" && e.outcome !== "unknown");
try {
  const plan = pilot ? [...NATIVE_KILL_STAGES] : nativeKillPlan();
  for (const [index, stage] of plan.entries()) {
    sends = 0; landed = stage.includes("report");
    const directory = join(root, String(index)); mkdirSync(directory, { mode: 0o700 });
    const record = join(directory, "record.jsonl"), socket = join(socketDirectory, `${index}.sock`), config = join(directory, "config.json");
    const policy = { ...WORKLOAD_POLICY, principal: [address], latch: { ...WORKLOAD_POLICY.latch, cluster: "devnet", releaseKey: operatorKey, guardId: "native-kill-" + index } };
    const issued = "2026-10-13T00:00:00.000Z", text = preparePolicyText(policy, 1, issued);
    const authorization = { operatorKey, guardId: policy.latch.guardId, cluster: "devnet", version: 1, issued, text, signature: sign(null, Buffer.from(text), operator.privateKey).toString("base64") };
    writeFileSync(config, canonicalJSON({ cluster: "devnet", keypair, record, socket, policy, authorization }), { mode: 0o600 });
    execFileSync(process.execPath, [entrypoint, "--same-user", "--config", config, "--init"], { env, timeout: 10000, stdio: "pipe" });
    const started = await start(config, record, stage), client = createSendingClient({ socket, clientId: "agent", timeoutMs: 15000 });
    const proposal = client.propose({ id: "original", message }).catch(error => error);
    await started.wait('"checkpoint":"' + stage + '"'); await stop("SIGKILL"); assert.equal(started.process.signalCode, "SIGKILL"); await proposal;
    await start(config, record);
    await client.propose({ id: "original", message });
    let reservation = entriesHaveSettled(readFileSync(record, "utf8"));
    if (!landed) {
      const probe = await client.propose({ id: "reservation-probe", message });
      assert.equal(probe.status, "denied");
      const captured: Entry[] = readFileSync(record, "utf8").trim().split("\n").map(line => JSON.parse(line));
      reservation = captured.some(e => e.kind === "decision" && e.request?.id === "reservation-probe" && e.rule === "intent-in-flight"); assert.equal(reservation, true);
    }
    assert.equal(reservation, true);
    await stop();
    const entries: Entry[] = readFileSync(record, "utf8").trim().split("\n").map(line => JSON.parse(line));
    const recomputed = await replay(entries, undefined, undefined, authorization), decisions = entries.filter(e => e.kind === "decision").length;
    const row: NativeKillRow = { index, stage, signal: started.process.signalCode,
      admissions: entries.filter(e => e.kind === "decision" && e.allow && e.request?.id === "original").length,
      signatures: entries.filter(e => e.kind === "signing" && e.event.stage === "signed").length,
      sendStarts: entries.filter(e => e.kind === "signing" && e.event.stage === "send-started").length,
      sends, replayed: recomputed.ok, decisions, replayDecisions: recomputed.decisions, reservation };
    rows.push(row); writeFileSync(join(root, "partial.json"), JSON.stringify({ definition: 1, seed: NATIVE_KILL_SEED, pilot, rows }, null, 2) + "\n");
    assert.equal(row.admissions, 1); assert.equal(row.replayed, true); assert.equal(row.replayDecisions, decisions); assert.ok(row.signatures <= 1 && row.sendStarts <= 1 && sends <= 1);
    console.log("verified native kill", index, stage);
  }
  if (!pilot) requireNativeKills(rows);
  writeFileSync(join(root, "result.json"), JSON.stringify({ definition: 1, seed: NATIVE_KILL_SEED, pilot, rows, complete: !pilot }, null, 2) + "\n");
  console.log(pilot ? "pilot only; no complete native qualification" : "complete frozen native kill population verified", root);
} finally {
  await stop("SIGKILL"); for (const server of servers) { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
  rmSync(keyDirectory, { recursive: true });
}
