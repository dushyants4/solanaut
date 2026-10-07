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
