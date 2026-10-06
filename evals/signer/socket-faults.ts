// Socket boundary faults are sequential; restore exact source even on failure.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "apps/signer/src/socket.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["public-parent", "(parent.mode & 0o777) !== 0o750", "false"],
  ["unknown-method", '!["propose", "report", "status"].includes(String(r.method))', "false"],
  ["empty-identity", 'typeof v === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(v)', "true"],
  ["unbounded-frame", "buffer.length + bytes.length > 16_384", "false"],
  ["unbounded-response", "Buffer.byteLength(wire) > 16_383", "false"],
  ["activity-deadline", 'const timer = setTimeout(() => fail("timeout"), timeoutMs);', 'const timer = setTimeout(() => fail("timeout"), timeoutMs); s.on("data", () => timer.refresh());'],
  ["replace-live-listener", 'probe.once("connect", () => { probe.destroy(); reject(new Error("socket has a live listener")); });', 'probe.once("connect", () => { probe.destroy(); resolve(); });'],
  ["hold-completed-slot", String.raw`s.end(wire + "\n", () => s.destroy());`, String.raw`s.end(wire + "\n");`],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "apps/signer/test/socket.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to));
    const result = battery(); const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output); assert.match(output, /tests 12/); assert.match(output, /AssertionError/);
    console.log(`caught socket fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All socket faults caught; restored source passes");
