// SIG-1/8: descriptor races and cleanup use public JSON fixtures, never key material.
import { strict as assert } from "node:assert";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readProtectedJSON } from "../src/protected-file.ts";
function fixture() {
  const root = fs.mkdtempSync(join(tmpdir(), "solanaut-protected-public-")); fs.chmodSync(root, 0o700);
  const path = join(root, "public.json"); fs.writeFileSync(path, '{"public":true}', { mode: 0o600 }); return { root, path };
}
test("SIG-1/8: bounded reads finish short progress and refuse an invalid UTF-8 public source", () => {
  const f = fixture(), original = fs.readSync;
  fs.readSync = ((...args: any[]) => { args[3] = Math.min(args[3], 1); return Reflect.apply(original, fs, args); }) as typeof fs.readSync;
  syncBuiltinESMExports();
  try { assert.deepEqual(readProtectedJSON(f.path, 0o600, 15), { public: true }); }
  finally { fs.readSync = original; syncBuiltinESMExports(); }
  fs.writeFileSync(f.path, '{"public":true} '); assert.throws(() => readProtectedJSON(f.path, 0o600, 15), /protected input unavailable/);
  fs.writeFileSync(f.path, Buffer.from([255])); assert.throws(() => readProtectedJSON(f.path, 0o600, 15), /protected input unavailable/);
});
test("SIG-1/8: descriptor substitution and changed source refuse before returning public JSON", () => {
  const f = fixture(), other = join(f.root, "other.json"), originalOpen = fs.openSync, originalRead = fs.readSync;
  fs.writeFileSync(other, '{"public":true}', { mode: 0o600 });
  fs.openSync = ((...args: any[]) => Reflect.apply(originalOpen, fs, [other, ...args.slice(1)])) as typeof fs.openSync; syncBuiltinESMExports();
  try { assert.throws(() => readProtectedJSON(f.path, 0o600, 15), /protected input unavailable/); }
  finally { fs.openSync = originalOpen; syncBuiltinESMExports(); }
  let altered = false;
  fs.readSync = ((...args: any[]) => { const n = Reflect.apply(originalRead, fs, args); if (!altered) { altered = true; fs.writeFileSync(f.path, "changed"); } return n; }) as typeof fs.readSync; syncBuiltinESMExports();
  try { assert.throws(() => readProtectedJSON(f.path, 0o600, 15), /protected input unavailable/); }
  finally { fs.readSync = originalRead; syncBuiltinESMExports(); }
});
test("SIG-1/8: descriptor close failures remain fixed-category and discard underlying private text", () => {
  const f = fixture(), original = fs.closeSync;
  fs.closeSync = ((fd: number) => { original(fd); throw new Error("PRIVATE_CLOSE_918213"); }) as typeof fs.closeSync; syncBuiltinESMExports();
  try { assert.throws(() => readProtectedJSON(f.path, 0o600, 15), (error: unknown) => error instanceof Error && error.message === "protected input unavailable" && !("cause" in error)); }
  finally { fs.closeSync = original; syncBuiltinESMExports(); }
});
test("SIG-1/8: parent permission loss during the descriptor read refuses acknowledgement", () => {
  const f = fixture(), original = fs.readSync; let changed = false;
  fs.readSync = ((...args: any[]) => { const n = Reflect.apply(original, fs, args); if (!changed) { changed = true; fs.chmodSync(f.root, 0o750); } return n; }) as typeof fs.readSync; syncBuiltinESMExports();
  try { assert.throws(() => readProtectedJSON(f.path, 0o600, 15), /protected input unavailable/); }
  finally { fs.readSync = original; syncBuiltinESMExports(); }
});
test("SIG-1/8: wrong file permissions refuse before reading any bytes, independently of JSON validation", () => {
  const f = fixture(), original = fs.readSync; let reads = 0;
  fs.chmodSync(f.path, 0o644);
  fs.readSync = ((...args: any[]) => { reads++; return Reflect.apply(original, fs, args); }) as typeof fs.readSync; syncBuiltinESMExports();
  try { assert.throws(() => readProtectedJSON(f.path, 0o600, 15), /protected input unavailable/); assert.equal(reads, 0); }
  finally { fs.readSync = original; syncBuiltinESMExports(); }
});
test("SIG-1/8: valid public descriptors use no-follow/nonblocking flags and a bounded buffer", () => {
  const f = fixture(), originalOpen = fs.openSync, originalAllocate = Buffer.alloc;
  let flags = 0, allocated = 0;
  fs.openSync = ((...args: any[]) => { flags = args[1]; return Reflect.apply(originalOpen, fs, args); }) as typeof fs.openSync;
  Buffer.alloc = ((...args: any[]) => { allocated = args[0]; return Reflect.apply(originalAllocate, Buffer, args); }) as typeof Buffer.alloc;
  syncBuiltinESMExports();
  try {
    assert.deepEqual(readProtectedJSON(f.path, 0o600, 15), { public: true });
    assert.ok(flags & fs.constants.O_NOFOLLOW); assert.ok(flags & fs.constants.O_NONBLOCK); assert.equal(allocated, 16);
  } finally { fs.openSync = originalOpen; Buffer.alloc = originalAllocate; syncBuiltinESMExports(); }
});
