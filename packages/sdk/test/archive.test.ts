import { strict as assert } from "node:assert";
import { after, test } from "node:test";
import fs from "node:fs/promises";
import { mkdtempSync, writeFileSync, symlinkSync, appendFileSync, linkSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { ArchiveError, verifyArchive, type ArchiveErrorCode } from "../src/archive.ts";
import { seal, type Entry } from "../src/log.ts";
const directories: string[] = [];
const scratch = () => { const directory = mkdtempSync(join(tmpdir(), "solanaut-archive-")); directories.push(directory); return join(directory, "archive.jsonl"); };
after(() => directories.forEach((directory) => rmSync(directory, { recursive: true, force: true })));
function history(count: number) { const entries: Entry[] = []; let prev = "";
  for (let seq = 0; seq < count; seq++) { const entry = seal({ v: 1, kind: "report", seq, prev, at: seq, decision: "a".repeat(64), outcome: "unknown", source: "caller" } as never); entries.push(entry); prev = entry.hash; }
  return entries;
}
const encoded = (entries: readonly Entry[]) => entries.map((entry) => JSON.stringify(entry) + "\n").join("");
const refuses = (promise: Promise<unknown>, code: ArchiveErrorCode) => assert.rejects(promise, (error: unknown) => error instanceof ArchiveError && error.code === code);
test("SNP-1: a FIFO without a writer is refused without blocking on open", () => {
  const path = scratch(); const made = spawnSync("mkfifo", [path], { encoding: "utf8" });
  assert.equal(made.status, 0, made.stderr);
  const script = `import {verifyArchive,ArchiveError} from './packages/sdk/src/archive.ts';
    try { await verifyArchive(process.argv[1]); process.exitCode=2; }
    catch(e) { if (!(e instanceof ArchiveError) || e.code!=='source') process.exitCode=3; }`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, path], { encoding: "utf8", timeout: 1000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});
test("SNP-1: full and continuation archives match head, digest, sequence and byte count", async () => {
  const entries = history(200); const path = scratch(); const bytes = encoded(entries); writeFileSync(path, bytes);
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.deepEqual(await verifyArchive(path, { expectedHead: entries.at(-1)!.hash, expectedDigest: digest }), { entries: 200, firstSeq: 0, nextSeq: 200, head: entries.at(-1)!.hash, sha256: digest, bytes: Buffer.byteLength(bytes) });
  writeFileSync(path, encoded(entries.slice(100)));
  assert.equal((await verifyArchive(path, { firstSeq: 100, previousHead: entries[99]!.hash })).entries, 100);
  await refuses(verifyArchive(path), "chain");
});
test("SNP-1: empty archive is structural empty history, not proof of an established guard", async () => {
  const path = scratch(); writeFileSync(path, ""); const result = await verifyArchive(path);
  assert.equal(result.entries, 0); assert.equal(result.head, ""); assert.equal(result.nextSeq, 0);
  await refuses(verifyArchive(path, { expectedHead: "a".repeat(64) }), "head");
});
test("SNP-1: line bound accepts the exact UTF-8 length and refuses one byte less", async () => {
  const path = scratch(); const bytes = encoded(history(1)); writeFileSync(path, bytes); const length = Buffer.byteLength(bytes) - 1;
  assert.equal((await verifyArchive(path, { maxLineBytes: length })).entries, 1);
  await refuses(verifyArchive(path, { maxLineBytes: length - 1 }), "framing");
});
test("SNP-1: invalid options reject before source reads", async () => {
  for (const options of [{ maxLineBytes: 0 }, { maxLineBytes: NaN }, { maxLineBytes: 16_777_217 }, { firstSeq: 1 }, { firstSeq: -1 }, { previousHead: "wrong" }, { expectedHead: "wrong" }, { expectedDigest: "wrong" }]) await refuses(verifyArchive("missing", options), "input");
});
test("SNP-1: missing, symlink and directory sources refuse", async () => {
  const path = scratch(); await refuses(verifyArchive(path), "source"); writeFileSync(path, encoded(history(1))); symlinkSync(path, path + ".alias");
  await refuses(verifyArchive(path + ".alias"), "source"); await refuses(verifyArchive(join(path, "..")), "source");
});
test("SNP-1: incomplete/blank and invalid UTF-8 frames refuse", async () => {
  const path = scratch();
  for (const bytes of [encoded(history(1)).trimEnd(), "\n", Buffer.from([0xff, 0x0a])]) { writeFileSync(path, bytes); await refuses(verifyArchive(path), "framing"); }
});
test("SNP-1: malformed JSON and unsupported record envelopes refuse", async () => {
  const path = scratch();
  const { hash: _hash, ...body } = history(1)[0]!;
  for (const bytes of ["{\n", "[]\n", "null\n", encoded([seal({ ...body, v: 2 } as never)]), encoded([seal({ ...body, kind: "foreign" } as never)])]) { writeFileSync(path, bytes); await refuses(verifyArchive(path), "record"); }
});
test("SNP-1: altered hash, sequence and predecessor refuse", async () => {
  const path = scratch(); const bytes = encoded(history(1));
  const { hash: _hash, ...body } = history(1)[0]!;
  for (const altered of [bytes.replace('"at":0', '"at":1'), encoded([seal({ ...body, seq: 1 } as never)]), encoded([seal({ ...body, prev: "a".repeat(64) } as never)])]) { writeFileSync(path, altered); await refuses(verifyArchive(path), "chain"); }
});
test("SNP-1: external head and raw digest pins refuse rewritten or truncated archives", async () => {
  const path = scratch(); writeFileSync(path, encoded(history(1)));
  await refuses(verifyArchive(path, { expectedHead: "a".repeat(64) }), "head");
  await refuses(verifyArchive(path, { expectedDigest: "a".repeat(64) }), "digest");
});
test("SNP-1: competing source changes refuse and descriptors close on success and failure", async (t) => {
  const path = scratch(); writeFileSync(path, encoded(history(1))); const original = fs.open; let closed = 0; let mutate = false;
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args); const close = handle.close.bind(handle); const stat = handle.stat.bind(handle); let calls = 0;
    t.mock.method(handle, "close", async () => { closed++; await close(); });
    t.mock.method(handle, "stat", async (options: Parameters<typeof stat>[0]) => { if (++calls === 2 && mutate) appendFileSync(path, " "); return stat(options); });
    return handle;
  });
  await verifyArchive(path); assert.equal(closed, 1);
  mutate = true; await refuses(verifyArchive(path), "changed-source"); assert.equal(closed, 2);
  mutate = false; writeFileSync(path, "{\n"); await refuses(verifyArchive(path), "record"); assert.equal(closed, 3);
});
test("SNP-1: fractional signer timestamps remain supported and unsafe sequence overflow refuses", async () => {
  const path = scratch(); const { hash: _hash, ...base } = history(1)[0]!;
  const fractional = seal({ ...base, at: 1.25 } as never); writeFileSync(path, encoded([fractional]));
  assert.equal((await verifyArchive(path)).entries, 1);
  const overflow = seal({ ...base, seq: Number.MAX_SAFE_INTEGER, prev: "a".repeat(64) } as never); writeFileSync(path, encoded([overflow]));
  await refuses(verifyArchive(path, { firstSeq: Number.MAX_SAFE_INTEGER, previousHead: "a".repeat(64) }), "chain");
});
test("SNP-1: hardlinks and pathname replacement during verification refuse", async (t) => {
  const path = scratch(); const bytes = encoded(history(1)); writeFileSync(path, bytes); linkSync(path, path + ".link");
  await refuses(verifyArchive(path), "source");
  const replacement = scratch(); writeFileSync(replacement, bytes); const original = fs.open;
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args); const stat = handle.stat.bind(handle); let calls = 0;
    t.mock.method(handle, "stat", async (options: Parameters<typeof stat>[0]) => {
      const observed = await stat(options);
      if (++calls === 2) { renameSync(replacement, replacement + ".old"); writeFileSync(replacement, bytes); }
      return observed;
    }); return handle;
  });
  await refuses(verifyArchive(replacement), "changed-source");
});
test("SNP-1: malformed/unknown options refuse and pins are captured before asynchronous reads", async (t) => {
  const path = scratch(); const entries = history(1); writeFileSync(path, encoded(entries));
  for (const options of [null, [], 1, { expectedhead: "a".repeat(64) }]) await refuses(verifyArchive(path, options as never), "input");
  const options = { expectedHead: "a".repeat(64) }; const original = fs.open;
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => { options.expectedHead = entries[0]!.hash; return original(...args); });
  await refuses(verifyArchive(path, options), "head");
});
test("SNP-1: multibyte frames cross chunks and oversized unfinished lines stop after one read", async (t) => {
  const path = scratch(); const { hash: _hash, ...body } = history(1)[0]!;
  const bytes = encoded([seal({ ...body, padding: "£".repeat(70_000) } as never)]); writeFileSync(path, bytes);
  assert.equal((await verifyArchive(path)).entries, 1);
  writeFileSync(path, "x".repeat(140_000)); const original = fs.open; let reads = 0;
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args); const read = handle.read.bind(handle);
    t.mock.method(handle, "read", async (...args: Parameters<typeof read>) => { reads++; return read(...args); }); return handle;
  });
  await refuses(verifyArchive(path, { maxLineBytes: 1024 }), "framing"); assert.equal(reads, 1);
});
test("SNP-1: changed length refuses even when source timestamps do not reveal it", async (t) => {
  const path = scratch(); writeFileSync(path, encoded(history(1))); const original = fs.open;
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args); const stat = handle.stat.bind(handle); let calls = 0;
    t.mock.method(handle, "stat", async (options: Parameters<typeof stat>[0]) => {
      const observed = await stat(options);
      if (++calls === 2 && typeof observed.size === "bigint") return Object.assign(Object.create(Object.getPrototypeOf(observed)), observed, { size: observed.size + 1n });
      return observed;
    }); return handle;
  });
  await refuses(verifyArchive(path), "changed-source");
});
