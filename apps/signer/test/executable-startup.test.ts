// SIG-1/2/8/10: production composition with memory-only key bytes supplied by a test descriptor shim.
// The physical key fixture is public whitespace, never a persisted synthetic key.
import { strict as assert } from "node:assert";
import { generateKeyPairSync, sign } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSendingClient, encodeBase58, preparePolicyText } from "@solanaut/sdk";
import { canonicalJSON } from "../../../packages/sdk/src/canonical.ts";
import { WORKLOAD_POLICY } from "../../../packages/sdk/test/support/workload.ts";
import { announceSigner, runSigner } from "../src/main.ts";
async function fixture() {
  const root = fs.mkdtempSync(join(tmpdir(), "solanaut-cli-start-")); fs.chmodSync(root, 0o700);
  const agent = generateKeyPairSync("ed25519"), operator = generateKeyPairSync("ed25519"), jwk = agent.privateKey.export({ format: "jwk" });
  const bytes = Buffer.concat([Buffer.from(jwk.d!, "base64url"), Buffer.from(jwk.x!, "base64url")]);
  const raw = Buffer.from(JSON.stringify([...bytes])), address = encodeBase58(Buffer.from(jwk.x!, "base64url"));
  const keypair = join(root, "public-placeholder.json"); fs.writeFileSync(keypair, " ".repeat(raw.length), { mode: 0o400 });
  const inode = fs.lstatSync(keypair), original = fs.readSync;
  fs.readSync = ((...args: any[]) => {
    const stat = fs.fstatSync(args[0]), n = Reflect.apply(original, fs, args);
    if (stat.ino === inode.ino && stat.dev === inode.dev && n > 0) raw.copy(args[1], args[2], args[2], args[2] + n);
    return n;
  }) as typeof fs.readSync; syncBuiltinESMExports();
  const operatorKey = encodeBase58(Buffer.from(operator.publicKey.export({ format: "jwk" }).x!, "base64url"));
  const policy = { ...WORKLOAD_POLICY, principal: [address], latch: { ...WORKLOAD_POLICY.latch, cluster: "devnet", releaseKey: operatorKey } };
  const issued = "2026-10-13T00:00:00.000Z", text = preparePolicyText(policy, 1, issued);
  const authorization = { operatorKey, guardId: policy.latch.guardId, cluster: "devnet", version: 1, issued, text, signature: sign(null, Buffer.from(text), operator.privateKey).toString("base64") };
  fs.mkdirSync(join(root, "history"), { mode: 0o700 }); fs.mkdirSync(join(root, "socket"), { mode: 0o750 });
  const record = join(root, "history", "record.jsonl"), socket = join(root, "socket", "signer.sock"), path = join(root, "config.json");
  const config = { cluster: "devnet", keypair, record, socket, policy, authorization };
  fs.writeFileSync(path, canonicalJSON(config), { mode: 0o600 });
  return { path, config, record, socket, replacePrincipal(address: string) {
    config.policy.principal = [address];
    const text = preparePolicyText(config.policy, 1, issued);
    config.authorization = { ...authorization, text, signature: sign(null, Buffer.from(text), operator.privateKey).toString("base64") };
    fs.writeFileSync(path, canonicalJSON(config));
  }, restore() { fs.readSync = original; syncBuiltinESMExports(); bytes.fill(0); raw.fill(0); } };
}
test("SIG-1/2/8/10: explicit init creates signed history, native composition serves and signal handling drains it", async () => {
  const f = await fixture(); let service: Awaited<ReturnType<typeof runSigner>>;
  try {
    assert.equal(await runSigner(["--same-user", "--config", f.path, "--init"], {}), undefined);
    const output: string[] = [], signals = new EventEmitter(); announceSigner(undefined, signals as NodeJS.Process, text => { output.push(text); });
    assert.deepEqual(output, ['{"status":"initialised"}']);
    const before = fs.readFileSync(f.record);
    await assert.rejects(runSigner(["--same-user", "--config", f.path, "--init"], {})); assert.deepEqual(fs.readFileSync(f.record), before);
    await assert.rejects(runSigner(["--same-user", "--config", f.path], {}));
    service = await runSigner(["--same-user", "--config", f.path], { SOLANAUT_RPC_A: "https://rpc-a.invalid", SOLANAUT_RPC_B: "https://rpc-b.invalid" }); assert.ok(service);
    announceSigner(service, signals as NodeJS.Process, text => { output.push(text); });
    assert.equal(JSON.parse(output.at(-1)!).keyIsolation, false);
    const client = createSendingClient({ socket: f.socket, clientId: "agent" });
    assert.deepEqual(await client.status({ id: "status" }), { mode: "same-user", keyIsolation: false, recoveryIncomplete: false, degraded: true });
    signals.emit("SIGTERM"); await service.close();
    assert.equal(signals.listenerCount("SIGTERM"), 0); assert.equal(signals.listenerCount("SIGINT"), 0);
  } finally { await service?.close(); f.restore(); }
});
test("SIG-1/8: principal substitution, unsafe record directory and duplicate RPC endpoints refuse", async () => {
  const f = await fixture();
  try {
    fs.chmodSync(join(f.record, ".."), 0o750);
    await assert.rejects(runSigner(["--same-user", "--config", f.path, "--init"], {}));
    fs.chmodSync(join(f.record, ".."), 0o700); await runSigner(["--same-user", "--config", f.path, "--init"], {});
    await assert.rejects(runSigner(["--same-user", "--config", f.path], { SOLANAUT_RPC_A: "https://rpc.invalid", SOLANAUT_RPC_B: "https://rpc.invalid" }));
    f.config.record = join(f.record, "..", "other-principal.jsonl");
    f.replacePrincipal(encodeBase58(Buffer.alloc(32, 1)));
    await assert.rejects(runSigner(["--same-user", "--config", f.path, "--init"], {}));
    assert.equal(fs.existsSync(f.config.record), false, "principal mismatch must refuse before creating history");
    f.config.keypair = join(f.config.record, "..", "missing.json");
    fs.writeFileSync(f.path, canonicalJSON(f.config)); await assert.rejects(runSigner(["--same-user", "--config", f.path], {}));
  } finally { f.restore(); }
});
test("SIG-8/10: failed orderly close sets a failure exit code without throwing into the signal handler", async () => {
  const signals = new EventEmitter(), oldCode = process.exitCode;
  try {
    announceSigner({ close: () => Promise.reject(new Error("PRIVATE_SHUTDOWN_192812")) } as never, signals as NodeJS.Process, () => {});
    signals.emit("SIGINT"); await new Promise<void>(r => setImmediate(r)); assert.equal(process.exitCode, 1);
  } finally { process.exitCode = oldCode; signals.removeAllListeners(); }
});
