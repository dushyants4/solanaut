// Prove the installed-package gate still detects damaged release candidates.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const stage = join(root, ".sandbox/releases/sdk");
function battery() {
  return spawnSync(process.execPath, ["--test", "evals/packaging/packed-sdk.test.ts"], {
    cwd: root, encoding: "utf8", env: { ...process.env, SOLANAUT_PACKAGE: stage },
  });
}
const baseline = battery();
assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
const faults = [
  { name: "archive-stream-export", path: "dist/src/archive.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("export function streamArchive", "function streamArchive") },
  { name: "archive-stream-entry", path: "dist/src/archive.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("yield immutable(entry);", "yield entry;") },
  { name: "archive-stream-digest", path: "dist/src/archive.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("sha256 !== expectedDigest", "false") },
  { name: "archive-stream-count", path: "dist/src/archive.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("entries: nextSeq - firstSeq", "entries: 0") },
  { name: "owned-recovery-named-path", path: "dist/src/record.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("const named = lstatSync(path, { bigint: true });", "const named = fstatSync(fd, { bigint: true });") },
  { name: "owned-recovery-export", path: "dist/src/record.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("export async function recoverOwnedCheckpoint", "async function recoverOwnedCheckpoint") },
  { name: "owned-recovery-capability", path: "dist/src/record.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("recoverers.get(store)", "recoverers.get(store) ?? (async () => ({mode:'checkpoint'}))") },
  { name: "owned-recovery-result", path: "dist/src/record.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("return recovered;", "return Object.freeze({...recovered,mode:'full-replay'});") },
  { name: "recovery-module", path: "dist/src/checkpoint-recovery.js", caught: "compiled checkpoint payloads", damage: () => undefined },
  { name: "recovery-anchor", path: "dist/src/checkpoint-recovery.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("pins.expectedAnchor && entries[pins.expectedAnchor.seq]?.hash !== pins.expectedAnchor.head", "false") },
  { name: "recovery-mode", path: "dist/src/checkpoint-recovery.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('mode: checkpointSeq === null ? "full-replay" : "checkpoint"', 'mode: "checkpoint"') },
  { name: "recovery-validation", path: "dist/src/checkpoint-recovery.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace(/await validatePublication\(checkpointInput, .*?, prefixHistory\);/, "void 0;") },
  { name: "rebuild-prefix-comparison", path: "dist/src/checkpoint-prefix.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("if (prefixInput !== expected.text)", "if (false)") },
  { name: "rebuild-prefix-events", path: "dist/src/checkpoint-prefix.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("events: prefix.events.length", "events: 0") },
  { name: "publication-module", path: "dist/src/checkpoint-publication.js", caught: "compiled checkpoint payloads", damage: () => undefined },
  { name: "publication-digest", path: "dist/src/checkpoint-publication.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("digest: sha256hex(input)", 'digest: "0".repeat(64)') },
  { name: "publication-ownership", path: "dist/src/record.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("publishers.get(store)", 'publishers.get(store) ?? (async () => ({seq:0,head:"",digest:"",bytes:0}))') },
  { name: "prefix-module", path: "dist/src/checkpoint-prefix.js", caught: "compiled checkpoint payloads", damage: () => undefined },
  { name: "bundle-module", path: "dist/src/checkpoint-bundle.js", caught: "compiled checkpoint payloads", damage: () => undefined },
  { name: "envelope-module", path: "dist/src/checkpoint-envelope.js", caught: "compiled checkpoint payloads", damage: () => undefined },
  { name: "envelope-byte-ceiling", path: "dist/src/checkpoint-envelope.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('Buffer.byteLength(input, "utf8") > maxBytes', "false") },
  { name: "envelope-state-binding", path: "dist/src/checkpoint-envelope.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("stateDigest: sha256hex(state)", 'stateDigest: "0".repeat(64)') },
  { name: "envelope-framing", path: "dist/src/checkpoint-envelope.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('canonicalJSON(body) + "\\n" !== input', "false") },
  { name: "bundle-digest", path: "dist/src/checkpoint-bundle.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("archiveDigest: archives.digest", 'archiveDigest: "0".repeat(64)') },
  { name: "bundle-payload", path: "dist/src/checkpoint-bundle.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("state: state.text", 'state: "{}"') },
  { name: "bundle-domain", path: "dist/src/checkpoint-bundle.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("prefixText = prepareCheckpointPrefixText(binding)", "prefixText = prepareCheckpointText(binding)") },
  { name: "policy-signature-size", path: "dist/src/signed-policy.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("if (signature.length !== 88)", "if (false)") },
  { name: "prefix-digest", path: "dist/src/checkpoint-prefix.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("sha256hex(text)", 'sha256hex("wrong")') },
  { name: "prefix-replay", path: "dist/src/checkpoint-prefix.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("if (!result.ok)", "if (false)") },
  { name: "state-digest", path: "dist/src/checkpoint-state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("sha256hex(text)", 'sha256hex("wrong")') },
  { name: "state-maps", path: "dist/src/checkpoint-state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("return [...value].map(([key, item]) => [key, values(item)]);", "return [];") },
  { name: "state-predecessor", path: "dist/src/checkpoint-state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("previousDecision = entry;", "previousDecision = null;") },
  { name: "state-profile", path: "dist/src/checkpoint-state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("profile: EVALUATION_PROFILE", 'profile: { ...EVALUATION_PROFILE, sensor: "foreign" }') },
  { name: "state-replay", path: "dist/src/checkpoint-state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("await prepareCheckpointPrefix(captured, policySeed, endpoint, pins);", "void 0;") },
  { name: "state-policy", path: "dist/src/checkpoint-state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("version: previous.version", "version: previous.version + 1") },
  { name: "malformed-replay", path: "dist/src/guard.js", caught: "installed JavaScript", damage: (text: string) => text.replace('if (e.kind === "decision" && e.input === "invalid" && (e.posture !== null || e.telemetry !== null || e.temperatureMax !== null))', "if (false)") },
  { name: "checkpoint-archives-export", path: "dist/src/index.js", caught: "installed checkpoint", damage: (text: string) => text.replace(/^export .*from "\.\/checkpoint-archives\.js";\n/m, "") },
  { name: "checkpoint-archives-digest", path: "dist/src/checkpoint-archives.js", caught: "installed checkpoint", damage: (text: string) => text.replace("sha256hex(text)", 'sha256hex("wrong")') },
  { name: "checkpoint-signature-bound", path: "dist/src/checkpoint.js", caught: "installed checkpoint", damage: (text: string) => text.replace(" || value.length !== 88", "") },
  { name: "checkpoint-export", path: "dist/src/index.js", caught: "installed checkpoint", damage: (text: string) => text.replace(/^export .*from "\.\/checkpoint\.js";\n/m, "") },
  { name: "export", path: "package.json", caught: "installed JavaScript", damage: (text: string) => {
    const value = JSON.parse(text);
    value.exports["."].import = "./src/index.ts";
    return JSON.stringify(value);
  } },
  { name: "types", path: "dist/src/index.d.ts", caught: "consumer declarations", damage: () => undefined },
  { name: "dependency", path: "package.json", caught: "installed JavaScript", damage: (text: string) => {
    const value = JSON.parse(text);
    value.dependencies = {};
    return JSON.stringify(value);
  } },
  { name: "cli", path: "dist/bin/replay.js", caught: "installed replay", damage: (text: string) => text.replace(/^#![^\n]*\n/, "") },
];
for (const fault of faults) {
  const path = join(stage, fault.path);
  const original = readFileSync(path);
  try {
    const damaged = fault.damage(original.toString("utf8"));
    if (damaged === undefined) rmSync(path);
    else {
      assert.notEqual(damaged, original.toString("utf8"), "fault must change the candidate");
      writeFileSync(path, damaged);
    }
    const result = battery();
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /tests 10\b/, "a harness setup failure is not a caught product fault");
    const failures = output.split("\n").filter((line) => /[✖]|not ok/.test(line));
    assert.ok(failures.some((line) => line.includes(fault.caught)), output);
    console.log(`caught package fault: ${fault.name}`);
  } finally {
    writeFileSync(path, original);
  }
}
const restored = battery();
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All package faults caught; restored candidate passes");
