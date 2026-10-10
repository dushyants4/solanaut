// SIG-8/STO: only complete synced writes can produce a usable admission.
import { strict as assert } from "node:assert";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock, test } from "node:test";
import { createGuard } from "../src/guard.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";

const payment = () => craftLegacy({ header: [1, 0, 1], keys: [key(1), key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
const record = () => join(fs.mkdtempSync(join(tmpdir(), "solanaut-storage-")), "guard.jsonl");
const restore = () => { mock.restoreAll(); syncBuiltinESMExports(); };
test("STO-1/SIG-8: short writes complete before an admission is acknowledged", async () => {
  const path = record();
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  const write = fs.writeSync;
  mock.method(fs, "writeSync", (fd: number, data: string | Uint8Array, offset = 0, length?: number) => {
    if (typeof data === "string") return write(fd, data.slice(0, 7));
    return write(fd, data, offset, Math.min(7, length ?? data.length));
  });
  syncBuiltinESMExports();
  try {
    const d = g.check({ message: payment(), at: 1000 });
    assert.equal(d.allow, true);
    const bytes = fs.readFileSync(path, "utf8");
    assert.ok(bytes.endsWith("\n"), "the entire line must exist before admission");
    assert.equal(JSON.parse(bytes).hash, d.hash);
  } finally { restore(); g.close(); }
});
for (const ownership of ["manual", "kernel"] as const) for (const fault of ["missing-write", "extra-write"]) test(`STO-2/SIG-8/OWN-2: ${ownership} refuses ${fault} physical append evidence before acknowledgement`, async () => {
  const path = record(), { fileStore } = await import("../src/record.ts"), store = fileStore(path, { ownership });
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: store }), inode = fs.statSync(path).ino, write = fs.writeSync;
  let changed = false;
  mock.method(fs, "writeSync", (...args: unknown[]) => {
    if (!changed && typeof args[0] === "number" && fs.fstatSync(args[0]).ino === inode) {
      changed = true;
      if (fault === "missing-write") return args[3];
      const count = Reflect.apply(write, fs, args); write(args[0], Buffer.from("{}\n")); return count;
    }
    return Reflect.apply(write, fs, args);
  });
  syncBuiltinESMExports();
  try {
    const first = g.check({ message: payment(), at: 1000 });
    assert.equal(changed, true); assert.equal(first.seq, -1, "physical append disagreement must not acknowledge a decision");
    assert.equal(first.rule, "fail-closed"); assert.equal(g.entries().length, 0);
    const evidence = fs.readFileSync(path); restore();
    assert.equal(g.check({ message: payment(), at: 2000 }).seq, -1);
    assert.deepEqual(fs.readFileSync(path), evidence, "failed writer must retain physical evidence without another append");
    assert.throws(() => store.append(undefined!), /closed or failed/);
  } finally { restore(); g.close(); store.close(); }
});
for (const ownership of ["manual", "kernel"] as const) for (const target of ["record", "lock"]) test(`OWN-2/STO-2/SIG-8: ${ownership} refuses ${target} replacement during append before acknowledgement`, async () => {
  const path = record(), { fileStore } = await import("../src/record.ts"), store = fileStore(path, { ownership });
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: store }), inode = fs.statSync(path).ino, write = fs.writeSync;
  const replaced = path + (target === "lock" ? ".lock" : ""), original = fs.readFileSync(replaced);
  let changed = false;
  mock.method(fs, "writeSync", (...args: unknown[]) => {
    const count = Reflect.apply(write, fs, args);
    if (!changed && typeof args[0] === "number" && fs.fstatSync(args[0]).ino === inode) {
      changed = true; fs.renameSync(replaced, replaced + ".moved"); fs.writeFileSync(replaced, original);
    }
    return count;
  });
  syncBuiltinESMExports();
  try {
    const first = g.check({ message: payment(), at: 1000 });
    assert.equal(changed, true); assert.equal(first.seq, -1, "a replaced journal or mutex cannot acknowledge a transition");
    assert.equal(first.rule, "fail-closed"); assert.equal(g.entries().length, 0);
    restore(); const evidence = fs.readFileSync(replaced), moved = fs.readFileSync(replaced + ".moved");
    assert.equal(g.check({ message: payment(), at: 2000 }).seq, -1);
    assert.deepEqual(fs.readFileSync(replaced), evidence); assert.deepEqual(fs.readFileSync(replaced + ".moved"), moved);
    assert.throws(() => store.append(undefined!), /closed or failed/);
  } finally {
    restore();
    if (ownership === "manual" && target === "lock") assert.throws(() => g.close(), /inode was replaced/);
    else g.close();
    store.close(); assert.deepEqual(fs.readFileSync(replaced), original, "never remove or repair another inode");
  }
});
for (const ownership of ["manual", "kernel"] as const) test(`STO-1/SIG-8: ${ownership} acknowledges complete appends to a nonempty journal`, async () => {
  const path = record(), { fileStore } = await import("../src/record.ts"), store = fileStore(path, { ownership });
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: store });
  try {
    assert.equal(g.check({ message: payment(), at: 1000 }).seq, 0);
    assert.equal(g.check({ message: payment(), at: 1001 }).seq, 1);
    const lines = fs.readFileSync(path, "utf8").trimEnd().split("\n");
    assert.equal(lines.length, 2); assert.equal(store.entries.length, 2);
    assert.deepEqual(lines.map(line => JSON.parse(line).hash), store.entries.map(entry => entry.hash));
  } finally { g.close(); store.close(); }
});
for (const failure of ["ENOSPC", "EACCES", "zero-progress", "fsync"]) test(`STO-2/SIG-8: ${failure} denies and permanently shuts this writer`, async () => {
  const path = record();
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  let calls = 0;
  if (failure === "fsync") mock.method(fs, "fsyncSync", () => { calls++; throw new Error("sync failure"); });
  else mock.method(fs, "writeSync", () => {
    calls++;
    if (failure === "zero-progress") return 0;
    throw Object.assign(new Error(failure), { code: failure });
  });
  syncBuiltinESMExports();
  try {
    const first = g.check({ message: payment(), at: 1000 });
    assert.equal(first.allow, false); assert.equal(first.rule, "fail-closed"); assert.equal(first.seq, -1);
    const after = calls;
    assert.equal(g.check({ message: payment(), at: 2000 }).rule, "fail-closed");
    assert.equal(calls, after, "a failed writer performs no more append attempts");
    assert.equal(g.entries().length, 0);
  } finally { restore(); g.close(); }
});
for (const ownership of ["manual", "kernel"] as const) for (const damage of ["append", "truncate", "overwrite"]) test(`STO-2/3/SIG-8/OWN-2: ${ownership} writer refuses external ${damage} on its held inode`, async () => {
  const path = record();
  const { fileStore } = await import("../src/record.ts");
  const store = fileStore(path, { ownership });
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: store });
  try {
    assert.equal(g.check({ message: payment(), at: 1000 }).allow, true);
    const before = fs.statSync(path, { bigint: true }), original = fs.readFileSync(path, "utf8");
    if (damage === "append") {
      fs.appendFileSync(path, "{}\n");
      // A coarse or stale timestamp must not hide a changed byte count.
      const stat = fs.fstatSync;
      mock.method(fs, "fstatSync", (...args: unknown[]) => {
        const value = Reflect.apply(stat, fs, args);
        return typeof value.size === "bigint" && value.ino === before.ino ? Object.assign(value, { mtimeNs: before.mtimeNs, ctimeNs: before.ctimeNs }) : value;
      });
      syncBuiltinESMExports();
    }
    else if (damage === "truncate") fs.truncateSync(path, 0);
    else {
      assert.ok(original.includes('"at":1000'));
      fs.writeFileSync(path, original.replace('"at":1000', '"at":9000'));
      fs.utimesSync(path, before.atime, before.mtime);
    }
    const damaged = fs.readFileSync(path, "utf8");
    const denied = g.check({ message: payment(), at: 2000 });
    assert.equal(denied.allow, false); assert.equal(denied.rule, "fail-closed"); assert.equal(denied.seq, -1);
    assert.equal(fs.readFileSync(path, "utf8"), damaged, "no line may follow unverified external bytes");
    assert.equal(g.entries().length, 1, "no uncommitted transition enters the cache");
    fs.writeFileSync(path, original);
    assert.equal(g.check({ message: payment(), at: 3000 }).seq, -1, "repair cannot revive this failed writer");
    assert.equal(fs.readFileSync(path, "utf8"), original);
    assert.throws(() => store.append(store.entries[0]!), /closed or failed/, "the store itself remains failed even behind another guard");
  } finally { restore(); g.close(); store.close(); }
});
for (const ownership of ["manual", "kernel"] as const) for (const damage of ["append", "truncate", "overwrite"]) test(`STO-4/SIG-8/OWN-2: ${ownership} refuses journal ${damage} during startup read and releases ownership`, async () => {
  const path = record(), seed = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  assert.equal(seed.check({ message: payment(), at: 1000 }).allow, true); seed.close();
  const original = fs.readFileSync(path, "utf8"), inode = fs.statSync(path).ino, read = fs.readFileSync;
  const { fileStore } = await import("../src/record.ts");
  let changed = false;
  mock.method(fs, "readFileSync", (...args: unknown[]) => {
    const value = Reflect.apply(read, fs, args);
    if (!changed && typeof args[0] === "number" && (typeof value === "string" || Buffer.isBuffer(value)) && fs.fstatSync(args[0]).ino === inode) {
      changed = true;
      if (damage === "append") fs.appendFileSync(path, "{}\n");
      else if (damage === "truncate") fs.truncateSync(path, 0);
      else fs.writeFileSync(path, original.replace('"at":1000', '"at":9000'));
    }
    return value;
  });
  syncBuiltinESMExports();
  try {
    assert.throws(() => { const store = fileStore(path, { ownership, create: false }); store.close(); }, /record changed during read/);
    assert.equal(changed, true, "the actual descriptor read must cross the injected change");
  } finally { restore(); }
  const damaged = fs.readFileSync(path, "utf8"); assert.notEqual(damaged, original);
  fs.writeFileSync(path, original);
  const restored = fileStore(path, { ownership, create: false }); restored.close();
});
for (const ownership of ["manual", "kernel"] as const) for (const fault of ["short", "oversized"]) test(`STO-5/SIG-8/OWN-2: ${ownership} rejects ${fault} startup reads without truncating acknowledged entries`, async () => {
  const path = record(), seed = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  assert.equal(seed.check({ message: payment(), at: 1000 }).allow, true); seed.close();
  const original = fs.readFileSync(path), inode = fs.statSync(path).ino, read = fs.readFileSync;
  const { fileStore } = await import("../src/record.ts");
  let changed = false, failure: Error | undefined;
  mock.method(fs, "readFileSync", (...args: unknown[]) => {
    const value = Reflect.apply(read, fs, args);
    if (!changed && typeof args[0] === "number" && fs.fstatSync(args[0]).ino === inode) {
      changed = true;
      if (typeof value === "string") return fault === "short" ? value.slice(0, -2) : value + "{";
      return fault === "short" ? value.subarray(0, value.length - 2) : Buffer.concat([value, Buffer.from("{")]);
    }
    return value;
  });
  syncBuiltinESMExports();
  try { try { fileStore(path, { ownership, create: false }).close(); } catch (error) { failure = error as Error; } }
  finally { restore(); }
  assert.equal(changed, true); assert.deepEqual(fs.readFileSync(path), original, "an incomplete read cannot repair or discard an acknowledged line");
  assert.match(failure?.message ?? "", /record read was incomplete/);
  const restored = fileStore(path, { ownership, create: false }); assert.equal(restored.entries.length, 1); restored.close();
});
for (const ownership of ["manual", "kernel"] as const) test(`STO-5/SIG-8: ${ownership} repairs a genuinely torn UTF-8 tail using byte boundaries`, async () => {
  const path = record(), seed = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  assert.equal(seed.check({ message: payment(), at: 1000 }).allow, true); seed.close();
  const original = fs.readFileSync(path); fs.appendFileSync(path, Buffer.from([0xf0, 0x9f]));
  const { fileStore } = await import("../src/record.ts");
  let restored: ReturnType<typeof fileStore> | undefined;
  assert.doesNotThrow(() => { restored = fileStore(path, { ownership, create: false }); }, "a genuinely torn UTF-8 tail must remain recoverable");
  assert.ok(restored);
  try { assert.equal(restored.entries.length, 1); assert.deepEqual(fs.readFileSync(path), original); } finally { restored.close(); }
});
