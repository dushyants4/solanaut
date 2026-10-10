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
  { name: "facade-report-fifo", path: "dist/src/owned-guard.js", caught: "installed private trusted report", damage: (text: string) => text.replace("report(decisionHash, outcome) {\n            return captured(() => {", "report(decisionHash, outcome) {\n            return (capture => capture()())(() => {") },
  { name: "facade-report-commit", path: "dist/src/owned-guard.js", caught: "installed private trusted report", damage: (text: string) => text.replace("guard.report(decisionHash, outcome);", "void decisionHash; void outcome;") },
  { name: "facade-report-outcome", path: "dist/src/owned-guard.js", caught: "installed private trusted report", damage: (text: string) => text.replace("guard.report(decisionHash, outcome);", 'guard.report(decisionHash, "unknown");') },
  { name: "facade-report-decision", path: "dist/src/owned-guard.js", caught: "installed private trusted report", damage: (text: string) => text.replace("guard.report(decisionHash, outcome);", 'guard.report("f".repeat(64), outcome);') },
  { name: "facade-report-primitives", path: "dist/src/owned-guard.js", caught: "installed private trusted report", damage: (text: string) => text.replace('typeof decisionHash !== "string" || typeof outcome !== "string" || !OUTCOMES.includes(outcome)', "false") },
  { name: "facade-report-storage", path: "dist/src/owned-guard.js", caught: "installed private trusted report", damage: (text: string) => text.replace("guard.report(decisionHash, outcome);", "try { guard.report(decisionHash, outcome); } catch {}") },
  { name: "record-post-append-owner", path: "dist/src/record.js", caught: "installed writer refuses journal", damage: (text: string) => text.replace("fsyncSync(fd);\n                owner.held();\n                sameFile(fd, path);", "fsyncSync(fd);\n                sameFile(fd, path);") },
  { name: "record-post-append-inode", path: "dist/src/record.js", caught: "installed writer refuses journal", damage: (text: string) => text.replace("fsyncSync(fd);\n                owner.held();\n                sameFile(fd, path);", "fsyncSync(fd);\n                owner.held();") },
  { name: "record-append-completion", path: "dist/src/record.js", caught: "installed writer refuses inconsistent", damage: (text: string) => text.replace("synced.size !== current.size + BigInt(bytes.length)", "false") },
  { name: "record-append-base", path: "dist/src/record.js", caught: "installed writer refuses inconsistent", damage: (text: string) => text.replace("synced.size !== current.size + BigInt(bytes.length)", "synced.size !== BigInt(bytes.length)") },
  { name: "record-read-completion", path: "dist/src/record.js", caught: "installed record rejects inconsistent", damage: (text: string) => text.replace("BigInt(bytes.length) !== before.size", "false") },
  { name: "record-decoded-read-count", path: "dist/src/record.js", caught: "installed record rejects inconsistent", damage: (text: string) => text.replace("BigInt(bytes.length) !== before.size", 'BigInt(Buffer.byteLength(bytes.toString("utf8"))) !== before.size') },
  { name: "record-read-stability", path: "dist/src/record.js", caught: "installed record rejects", damage: (text: string) => text.replace("before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs", "false") },
  { name: "record-single-link", path: "dist/src/record.js", caught: "installed record refuses", damage: (text: string) => text.replace("held.nlink !== 1n || named.nlink !== 1n", "false") },
  { name: "record-live-evidence", path: "dist/src/record.js", caught: "installed writer", damage: (text: string) => text.replace("current.size !== expected.size || current.mtimeNs !== expected.mtimeNs || current.ctimeNs !== expected.ctimeNs", "false") },
  { name: "record-live-times", path: "dist/src/record.js", caught: "installed writer", damage: (text: string) => text.replace("current.mtimeNs !== expected.mtimeNs || current.ctimeNs !== expected.ctimeNs", "false") },
  { name: "record-live-failure", path: "dist/src/record.js", caught: "installed writer", damage: (text: string) => text.replace("failed = true;", "failed = false;") },
  { name: "facade-release-bytes", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("const signatureBytes = new Uint8Array(signature);", "const signatureBytes = signature;") },
  { name: "facade-release-refusal", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("if (!released.released)", "if (false)") },
  { name: "facade-release-reply", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("return detached(released);", "return released;") },
  { name: "facade-release-prompt", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("if (!parseReleaseText(text) || !Number.isFinite(Date.parse(expires)))", "if (false)") },
  { name: "facade-release-text-fifo", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace(/releaseText\(expires\) \{\s+return captured\(\(\) =>/, "releaseText(expires) { return (capture => capture()().catch(() => { throw new OwnedGuardError(); }))(() =>") },
  { name: "facade-redemption-bytes", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("const bytes = new Uint8Array(message);", "const bytes = message;") },
  { name: "facade-redemption-refusal", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("if (!result.ok)", "if (false)") },
  { name: "facade-redemption-reply", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("return detached(result);", "return result;") },
  { name: "facade-unrecorded-admission", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("if (decision.seq < 0)", "if (false)") },
  { name: "facade-export", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("export async function openOwnedGuard", "async function openOwnedGuard") },
  { name: "facade-fresh-history", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("ownership: \"kernel\", create: false", "ownership: \"kernel\", create: true") },
  { name: "facade-config-capture", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("const options = structuredClone(input);", "const options = input;") },
  { name: "facade-upgrade", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("lastPolicy.version !== options.authorization.version || lastPolicy.text !== options.authorization.text", "false") },
  { name: "facade-index", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace('await lookupOwnedRequestIndex(store, { clientId: "owned-startup", id: "validation" }, { policyTrust: options.authorization })', '({seq:guard.status().seq,head:store.entries.at(-1)?.hash})') },
  { name: "facade-freeze", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("return Object.freeze({", "return ({") },
  { name: "facade-payload", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("const id = structuredClone(identity), value = structuredClone(payload);", "const id = structuredClone(identity), value = payload;") },
  { name: "facade-response", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("const id = structuredClone(identity), value = structuredClone(result);", "const id = structuredClone(identity), value = result;") },
  { name: "facade-shared-bytes", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("p.message = new Uint8Array(p.message);", "void p;") },
  { name: "facade-close-drain", path: "dist/src/owned-guard.js", caught: "private owned facade", damage: (text: string) => text.replace("closing = queue.then", "closing = Promise.resolve().then") },
  { name: "owned-control-export", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("export function beginOwnedRequest", "function beginOwnedRequest") },
  { name: "owned-control-code", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('code = "owned-control-request"', 'code = "foreign"') },
  { name: "owned-control-head", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("controlEvidence.seq !== state.seq || controlEvidence.head !== state.head", "false") },
  { name: "owned-control-start-capture", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("startControl(id, method, JSON.parse(payload), at)", "startControl(id, method, input, at)") },
  { name: "owned-control-answer-capture", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("completeControl(startHash, JSON.parse(result))", "completeControl(startHash, input)") },
  { name: "owned-control-immutable", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('row.response.kind !== "response" || row.response.result !== result', 'row.response.kind !== "response"') },
  { name: "owned-control-freeze", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("freezeReply(reply);", "void 0;") },
  { name: "owned-control-private-start", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("startControl(id, method, JSON.parse(payload), at)", "guard.beginRequest(id, method, JSON.parse(payload), at)") },
  { name: "owned-control-private-response", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("completeControl(startHash, JSON.parse(result))", "guard.finishRequest(startHash, JSON.parse(result))") },
  { name: "replay-cli-trust", path: "dist/bin/replay.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("replayStream(open, policy, undefined, trust)", "replayStream(open, policy, undefined)") },
  { name: "replay-cli-divergence", path: "dist/bin/replay.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("if (res.ok)", "if (true)") },
  { name: "replay-cli-public-ceiling", path: "dist/bin/replay.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("limit = 1_048_576", "limit = 16_777_216") },
  { name: "replay-cli-line-ceiling", path: "dist/bin/replay.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("streamArchive(recordPath)", "streamArchive(recordPath, {maxLineBytes:16_777_216})") },
  { name: "replay-cli-fields", path: "dist/bin/replay.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("keys.length !== 3 || keys.some", "false && keys.some") },
  { name: "replay-cli-detail", path: "dist/bin/replay.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('console.log("  recorded: [redacted]");', 'console.log(`  recorded: ${JSON.stringify(d.recorded)}`);') },
  { name: "replay-cli-input-error", path: "dist/bin/replay.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('catch {\n    console.error("replay: public policy or trust input could not be read safely");', 'catch (error) {\n    console.error(String(error));') },
  { name: "replay-cli-utf8", path: "dist/bin/replay.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("{ fatal: true }", "{ fatal: false }") },
  { name: "owned-admission-export", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("export async function checkOwnedRequest", "async function checkOwnedRequest") },
  { name: "owned-admission-error", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('code = "owned-request-admission"', 'code = "foreign"') },
  { name: "owned-admission-shared-bytes", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("captured.message = new Uint8Array(captured.message);", "void 0;") },
  { name: "owned-admission-reply-detachment", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("const reply = structuredClone(decision);", "const reply = decision;") },
  { name: "owned-admission-reply-freeze", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("freeze(reply);", "void 0;") },
  { name: "owned-admission-head", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("evidence.seq !== state.seq || evidence.head !== state.head", "false") },
  { name: "owned-admission-fifo", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("const pending = queue.then(run);", "const pending = run();") },
  { name: "owned-admission-disk", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("await lookupOwnedRequestIndex(store, id, { policyTrust: authorization })", "({seq:state.seq,head:state.head,row:null})") },
  { name: "owned-admission-payload", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('historical.kind !== "decision" || historical.request.digest !== binding.digest', "false") },
  { name: "owned-lookup-capability", path: "dist/src/record.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("indexLookups.get(store)", "indexLookups.get(store) ?? (async () => ({}))") },
  { name: "owned-lookup-error", path: "dist/src/record.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('code = "request-index-lookup"', 'code = "foreign"') },
  { name: "owned-lookup-tail", path: "dist/src/request-index-publication.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("captured.slice(prefix.seq)", "[]") },
  { name: "owned-lookup-endpoint", path: "dist/src/request-index-publication.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("return freeze({ seq: validated.seq, head: validated.head, indexSeq: prefix.seq", "return freeze({ seq: prefix.seq, head: prefix.head, indexSeq: prefix.seq") },
  { name: "owned-lookup-immutable", path: "dist/src/request-index-publication.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("return freeze({ seq: validated.seq", "return ({ seq: validated.seq") },
  { name: "owned-index-module", path: "dist/src/request-index-publication.js", caught: "compiled checkpoint payloads", damage: () => undefined },
  { name: "owned-index-digest", path: "dist/src/request-index-publication.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("digest: prepared.digest, directory, root: prepared.root", 'digest: "0".repeat(64), directory, root: prepared.root') },
  { name: "owned-index-capability", path: "dist/src/record.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("indexPublishers.get(store)", "indexPublishers.get(store) ?? (async () => ({}))") },
  { name: "client-options-container", path: "dist/src/adapters/sending-client.js", caught: "installed sending client", damage: (text: string) => text.replace('    if (!record(options))\n        throw new SignerClientError("input", "options must be an object");', "") },
  { name: "client-status-container", path: "dist/src/adapters/sending-client.js", caught: "installed sending client", damage: (text: string) => text.replace('if (!record(input) || !identity(input.id))', 'if (!identity(input.id))') },
  { name: "client-propose-container", path: "dist/src/adapters/sending-client.js", caught: "installed sending client", damage: (text: string) => text.replace('if (!record(input) || !(input.message instanceof Uint8Array) || input.message.length > 6144)', 'if (!(input.message instanceof Uint8Array) || input.message.length > 6144)') },
  { name: "client-report-container", path: "dist/src/adapters/sending-client.js", caught: "installed sending client", damage: (text: string) => text.replace('if (!record(input) || !hash(input.decision))', 'if (!hash(input.decision))') },
  { name: "client-array-container", path: "dist/src/adapters/sending-client.js", caught: "installed sending client", damage: (text: string) => text.replace(' && !Array.isArray(value)', "") },
  { name: "client-function-container", path: "dist/src/adapters/sending-client.js", caught: "installed sending client", damage: (text: string) => text.replace(' && typeof value === "object"', "") },
  { name: "client-null-container", path: "dist/src/adapters/sending-client.js", caught: "installed sending client", damage: (text: string) => text.replace('value !== null && ', "") },
  { name: "index-module", path: "dist/src/request-index.js", caught: "compiled checkpoint payloads", damage: () => undefined },
  { name: "index-replay", path: "dist/src/request-index.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("const result = await replay(entries, policySeed, sensorV1, pins);", "const result = {ok:true};") },
  { name: "index-root-provenance", path: "dist/src/request-index.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("const root = roots.get(expected);", "const root = {manifest:JSON.parse(expected.text),text:expected.text};") },
  { name: "index-digest", path: "dist/src/request-index.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('if (digest.digest("hex") !== expected.sha256)', 'if (false)') },
  { name: "index-complete-buckets", path: "dist/src/request-index.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("const shards = buckets.map(bucket => {", "const shards = buckets.slice(0,-1).map(bucket => {") },
  { name: "index-control-reply", path: "dist/src/request-index.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("row.response = entry;", "row.response = null;") },
  { name: "index-error-code", path: "dist/src/request-index.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('code = "request-index"', 'code = "foreign"') },
  { name: "index-immutable", path: "dist/src/request-index.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("Object.freeze(value);", "void value;") },
  { name: "replay-report-boundary", path: "dist/src/state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('if (e.kind === "report")', 'if (false)') },
  { name: "replay-report-source", path: "dist/src/state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('if (e.source !== "caller" && e.source !== "signer")', 'if (false)') },
  { name: "replay-report-finality", path: "dist/src/state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('if (!unresolved(attempt))\n        throw new Error("recorded report names an attempt with a final outcome");', 'if (false)\n        throw new Error("recorded report names an attempt with a final outcome");') },
  { name: "replay-redemption-boundary", path: "dist/src/state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('if (e.kind === "redeem")', 'if (false)') },
  { name: "replay-redemption-single-use", path: "dist/src/state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('if (s.redeemed.has(e.decision))', 'if (false)') },
  { name: "replay-redemption-lifetime", path: "dist/src/state.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace('if (d.expires && (height === null || height > BigInt(d.expires.lastValidBlockHeight)))', 'if (false)') },
  { name: "record-eager-publication", path: "dist/src/record.js", caught: "installed record-only", damage: (text: string) => 'import "./checkpoint-publication.js";\n'+text },
  { name: "record-eager-recovery", path: "dist/src/record.js", caught: "installed record-only", damage: (text: string) => 'import "./checkpoint-recovery.js";\n'+text },
  { name: "record-publication-capture", path: "dist/src/record.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("const pins = structuredClone(options), candidate = text;", "const pins = options, candidate = text;") },
  { name: "record-publication-code", path: "dist/src/checkpoint-errors.js", caught: "installed record-only", damage: (text: string) => text.replace('code = "checkpoint-publication"', 'code = "foreign"') },
  { name: "record-recovery-code", path: "dist/src/checkpoint-errors.js", caught: "installed record-only", damage: (text: string) => text.replace('code = "checkpoint-recovery"', 'code = "foreign"') },
  { name: "stream-replay-export", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("export async function replayStream", "async function replayStream") },
  { name: "stream-replay-source", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("checked !== count || checkedFingerprint !== fingerprint", "false") },
  { name: "stream-replay-decisions", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("const result = await recompute(env, records());", "const result = {ok:true,decisions:0,divergence:null}; for await(const entry of records())void 0;") },
  { name: "stream-replay-trust", path: "dist/src/guard.js", caught: "compiled checkpoint payloads", damage: (text: string) => text.replace("pins = structuredClone(trust)", "pins = trust") },
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
    assert.match(output, /tests 19\b/, "a harness setup failure is not a caught product fault");
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
