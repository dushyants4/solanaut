import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { after, test } from "node:test";
import { seal } from "../src/log.ts";
const directory = mkdtempSync(join(tmpdir(), "solanaut-archive-cli-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const entry = seal({ v: 1, kind: "report", seq: 0, prev: "", at: 0.5, decision: "a".repeat(64), outcome: "unknown", source: "caller" } as never);
const bytes = JSON.stringify(entry) + "\n", path = join(directory, "history.jsonl");
writeFileSync(path, bytes);
const invoke = (...args: string[]) => spawnSync(process.execPath, ["packages/sdk/bin/verify-archive.ts", ...args], { encoding: "utf8", timeout: 3000 });
test("SNP-2: command returns a pinned JSON receipt and leaves source unchanged", () => {
  const digest = createHash("sha256").update(bytes).digest("hex");
  const result = invoke(path, "--head", entry.hash, "--sha256", digest);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { entries: 1, firstSeq: 0, nextSeq: 1, head: entry.hash, sha256: digest, bytes: Buffer.byteLength(bytes) });
  assert.equal(readFileSync(path, "utf8"), bytes); assert.equal(result.stderr, "");
});
test("SNP-2: incorrect pins return typed JSON archive refusal, never success", () => {
  for (const [flag, code] of [["--head", "head"], ["--sha256", "digest"]]) {
    const result = invoke(path, flag!, "0".repeat(64));
    assert.equal(result.status, 1, result.stderr); assert.equal(result.stdout, "");
    assert.equal(JSON.parse(result.stderr).error.code, code);
  }
});
test("SNP-2: explicit continuation identity verifies a segment", () => {
  const { hash: _hash, ...body } = entry;
  const continued = seal({ ...body, seq: 12, prev: "b".repeat(64) });
  const segment = join(directory, "segment.jsonl"); writeFileSync(segment, JSON.stringify(continued) + "\n");
  const result = invoke(segment, "--first-seq", "12", "--previous-head", continued.prev);
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).nextSeq, 13);
  assert.equal(invoke(segment).status, 1);
});
test("SNP-2: line byte limit includes the exact boundary", () => {
  const length = Buffer.byteLength(bytes) - 1;
  assert.equal(invoke(path, "--max-line-bytes", String(length)).status, 0);
  const result = invoke(path, "--max-line-bytes", String(length - 1));
  assert.equal(result.status, 1); assert.equal(JSON.parse(result.stderr).error.code, "framing");
});
test("SNP-2: missing, unknown, duplicate and extra arguments are usage errors", () => {
  for (const args of [[], [path,"--head"], [path,"--hed","0".repeat(64)], [path,"--head",entry.hash,"--head",entry.hash], [path,"extra"], [path,"--first-seq","1.5"], [path,"--first-seq","1e2"], [path,"--first-seq","-1"], [path,"--first-seq","9007199254740992"], [path,"--max-line-bytes","0"], [path,"--head","bad"], [path,"--previous-head","b".repeat(64)]]) {
    const result = invoke(...args); assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, ""); assert.match(result.stderr, /usage:/);
  }
});
test("SNP-2: help is explicit success and extra help arguments are refused", () => {
  const result = invoke("--help"); assert.equal(result.status, 0); assert.match(result.stdout, /usage:/);
  assert.equal(invoke("--help",path).status, 2);
});
test("SNP-2: numeric spelling is canonical even when the value would otherwise pass", () => {
  for (const value of ["1e3", "01000", " 1000", "+1000", "1000.0"]) {
    const result = invoke(path,"--max-line-bytes",value);
    assert.equal(result.status,2,result.stderr); assert.match(result.stderr,/usage:/);
  }
});
test("SNP-2: missing and symlink sources fail with redacted typed errors", () => {
  const link = join(directory,"link"); symlinkSync(path,link);
  for (const source of [join(directory,"confidential-name-missing"), link]) {
    const result=invoke(source); assert.equal(result.status,1);
    assert.equal(JSON.parse(result.stderr).error.code,"source"); assert.ok(!result.stderr.includes(source));
  }
});
