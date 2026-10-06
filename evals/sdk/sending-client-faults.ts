// CLT: sequential transport faults, restored before any other importing battery runs.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "packages/sdk/src/adapters/sending-client.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["ignore-response-id", "body.id !== id", "false"],
  ["ignore-canonical-envelope", "JSON.stringify(body) !== text", "false"],
  ["unbounded-response", "if (buffer.length + bytes.length > 16_384)", "if (false)"],
  ["hide-execution-ambiguity", 'method === "propose" && written, remoteCode', "false, remoteCode"],
  ["invent-before-connect-execution", "let written = false;", "let written = true;"],
  ["extend-timeout", 'setTimeout(() => fail("timeout"), timeoutMs)', 'setTimeout(() => fail("timeout"), 30_000)'],
  ["allow-oversized-message", "input.message.length > 6144", "false"],
  ["late-caller-identity", "body.id !== id", "body.id !== input.id"],
  ["accept-invalid-signature", 'decodeBase58(value).length === 64', "true"],
  ["automatic-retry", 'socket.on("error", () => fail("connection")); socket.once("end", () => fail("connection")); socket.once("close", () => fail("connection"));', 'socket.on("error", () => fail("connection")); socket.once("end", () => { const again = new Socket(); again.on("error", () => fail("connection")); again.on("data", () => {}); again.once("close", () => fail("connection")); again.once("connect", () => again.write(frame)); again.connect(path); });'],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "packages/sdk/test/sending-client.test.ts"], { encoding: "utf8", timeout: 10_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery(); const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output); assert.match(output, /tests 11/); assert.match(output, /AssertionError|SignerClientError/);
    console.log(`caught sending client fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All sending client faults caught; restored source passes");
