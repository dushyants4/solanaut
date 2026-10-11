import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { inventoryHistory } from "../ci/history.ts";
import { sensitiveHistoryPath, verifyHistoryBytes } from "./history-bytes.mjs";

mkdirSync(".sandbox/history-bytes-fixtures", { recursive: true });
function fixture(format = "sha1") {
  const dir = mkdtempSync(".sandbox/history-bytes-fixtures/repository-");
  const git = (...args) => {
    const result = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr); return result.stdout;
  };
  git("init", "-q", "--object-format=" + format);
  const commit = () => { git("add", "-A"); git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture"); };
  writeFileSync(join(dir, "fixture.txt"), "old text\n"); commit();
  writeFileSync(join(dir, "fixture.txt"), "new text\n");
  writeFileSync(join(dir, "binary.dat"), Buffer.from([0, 255, 128, 10])); commit();
  const manifest = inventoryHistory(dir);
  const read = id => {
    const result = spawnSync("git", ["-C", dir, "cat-file", "blob", id]);
    assert.equal(result.status, 0); return result.stdout;
  };
  return { dir, git, commit, manifest, read, close: () => rmSync(dir, { recursive: true, force: true }) };
}

test("PUB-1: every historical text and binary blob is read and independently hashed", () => {
  const f = fixture(); try {
    const seen = [];
    const result = verifyHistoryBytes(f.dir, f.manifest, id => { seen.push(id); return f.read(id); });
    assert.deepEqual(seen, f.manifest.blobs.map(blob => blob.id));
    assert.equal(result.blobs, 3); assert.equal(result.bytes, 22);
    assert.equal(result.inventoryDigest, f.manifest.digest);
    assert.equal(result.clearance, false); assert.equal(result.skipped, 0);
    assert.ok(result.contentDigest.match(/^[0-9a-f]{64}$/));
  } finally { f.close(); }
});

for (const fault of ["same-size", "short", "nonbytes", "missing"]) test(`PUB-1: ${fault} blob read cannot qualify`, () => {
  const f = fixture(); try {
    assert.throws(() => verifyHistoryBytes(f.dir, f.manifest, id => {
      if (fault === "missing") throw new Error("read unavailable");
      if (fault === "nonbytes") return "not bytes";
      const bytes = f.read(id);
      if (fault === "short") return bytes.subarray(1);
      return Buffer.alloc(bytes.length, 42);
    }), fault === "short" ? /blob size/ : fault === "nonbytes" ? /blob bytes/ : fault === "missing" ? /blob read/ : /blob hash/);
  } finally { f.close(); }
});

test("PUB-1: omitted inventory blobs cannot hide historical bytes", () => {
  const f = fixture(); try {
    const forged = structuredClone(f.manifest); forged.blobs.pop();
    assert.throws(() => verifyHistoryBytes(f.dir, forged, f.read), /inventory/);
  } finally { f.close(); }
});

test("PUB-1: a changed scope during blob reads refuses the receipt", () => {
  const f = fixture(); try {
    let changed = false;
    assert.throws(() => verifyHistoryBytes(f.dir, f.manifest, id => {
      if (!changed) { changed = true; writeFileSync(join(f.dir, "later.txt"), "later\n"); f.commit(); }
      return f.read(id);
    }), /scope changed/);
  } finally { f.close(); }
});

test("PUB-1: key-shaped historical paths require review before their contents are read", () => {
  for (const path of ["keys/devnet.json", "kb/private/note.md", ".env.local", "credentials.json", "operator.pem", "operator.keypair.json"]) assert.equal(sensitiveHistoryPath(path), true);
  for (const path of ["docs/key-management.md", "packages/sdk/src/signing.ts", "README.md"]) assert.equal(sensitiveHistoryPath(path), false);
});

test("PUB-1: sensitive path metadata refuses before any blob reader runs", () => {
  const f = fixture(); try {
    const blob = f.manifest.blobs[0].id;
    // Only an index entry points at existing synthetic text; no private file is created or read.
    f.git("update-index", "--add", "--cacheinfo", `100644,${blob},private/fixture.txt`);
    f.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "metadata fixture");
    const manifest = inventoryHistory(f.dir); let reads = 0;
    assert.throws(() => verifyHistoryBytes(f.dir, manifest, () => { reads++; return Buffer.alloc(0); }), /sensitive historical path/);
    assert.equal(reads, 0);
  } finally { f.close(); }
});

test("PUB-1: gitlink metadata cannot claim complete target content", () => {
  const f = fixture(); try {
    f.git("update-index", "--add", "--cacheinfo", `160000,${f.manifest.head},component`);
    f.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "gitlink fixture");
    assert.throws(() => verifyHistoryBytes(f.dir, inventoryHistory(f.dir), f.read), /gitlink target/);
  } finally { f.close(); }
});

test("PUB-1: SHA-256 Git object framing verifies every binary/text blob", () => {
  const f = fixture("sha256"); try {
    let result;
    assert.doesNotThrow(() => { result = verifyHistoryBytes(f.dir, f.manifest); });
    assert.equal(result.blobs, 3); assert.equal(result.bytes, 22);
    assert.ok(result.rows.every(row => row.id.length === 64));
  } finally { f.close(); }
});

test("PUB-1: the CLI writes complete hashed synthetic evidence without clearance", () => {
  const f = fixture(); try {
    const output = join(f.dir, "evidence");
    const result = spawnSync("node", ["evals/release/history-bytes-run.mjs", f.dir, output], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(readFileSync(join(output, "contents.json"), "utf8"));
    assert.equal(receipt.blobs, 3); assert.equal(receipt.bytes, 22); assert.equal(receipt.clearance, false);
    assert.equal(receipt.inventoryDigest, f.manifest.digest);
    assert.ok(existsSync(join(output, "inputs.json")));
  } finally { f.close(); }
});

test("PUB-1: the CLI retains preflight refusal without a completed content receipt", () => {
  const f = fixture(); try {
    f.git("update-index", "--add", "--cacheinfo", `100644,${f.manifest.blobs[0].id},private/fixture.txt`);
    f.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "metadata fixture");
    const output = join(f.dir, "evidence");
    const result = spawnSync("node", ["evals/release/history-bytes-run.mjs", f.dir, output], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.ok(existsSync(join(output, "refusal.json")));
    const refusal = JSON.parse(readFileSync(join(output, "refusal.json"), "utf8"));
    assert.equal(refusal.reason, "sensitive-path-review-required");
    assert.equal(refusal.contentRead, false); assert.equal(refusal.clearance, false);
    assert.equal(existsSync(join(output, "contents.json")), false);
  } finally { f.close(); }
});
