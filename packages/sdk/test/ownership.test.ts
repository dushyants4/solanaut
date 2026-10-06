// OWN: safe SDK stale-lock refusal and kernel-held ownership across processes.
import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileStore } from "../src/record.ts";

const record = () => join(mkdtempSync(join(tmpdir(), "solanaut-ownership-")), "guard.jsonl");
test("OWN-1: SDK refuses stale ownership instead of removing the lock", () => {
  const path = record();
  const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  const marker = JSON.stringify({ pid: Number(dead.stdout), host: hostname(), at: 0 });
  writeFileSync(path + ".lock", marker);
  assert.throws(() => fileStore(path), /stale|locked/);
  assert.equal(readFileSync(path + ".lock", "utf8"), marker);
});
test("OWN-2: kernel lock outlives its acquisition helper, excludes other writers and preserves its inode on close", () => {
  const path = record();
  const owner = fileStore(path, { ownership: "kernel" });
  assert.throws(() => fileStore(path, { ownership: "kernel" }), /locked/);
  assert.throws(() => fileStore(path), /locked/);
  owner.close();
  assert.equal(existsSync(path + ".lock"), true, "a kernel mutex inode must never be unlinked on close");
  const reopened = fileStore(path, { ownership: "kernel" });
  reopened.close();
  assert.throws(() => fileStore(path), /kernel|locked|stale/);
});
test("OWN-2: a crashed kernel owner releases ownership and competing restarts admit exactly one writer", async () => {
  const path = record();
  const owner = spawn(process.execPath, ["packages/sdk/test/support/ownership-child.ts", path], { stdio: ["ignore", "pipe", "pipe"] });
  const ready = new Promise<void>((resolve, reject) => {
    owner.stdout.once("data", () => resolve());
    owner.once("exit", (code) => reject(new Error(`owner exited before readiness: ${code}`)));
  });
  await ready;
  const gone = new Promise((resolve) => owner.once("exit", resolve));
  owner.kill("SIGKILL"); await gone;
  const contenders = Array.from({ length: 8 }, () => spawn(process.execPath, ["packages/sdk/test/support/ownership-child.ts", path], { stdio: ["ignore", "pipe", "pipe"] }));
  try {
    const results = await Promise.all(contenders.map((child) => new Promise<string>((resolve) => {
      child.stdout.once("data", () => resolve("owner"));
      child.once("exit", (code) => resolve(code === 1 ? "locked" : `exit:${code}`));
    })));
    assert.equal(results.filter((r) => r === "owner").length, 1, JSON.stringify(results));
    assert.equal(results.filter((r) => r === "locked").length, 7, JSON.stringify(results));
  } finally {
    await Promise.all(contenders.filter((child) => child.exitCode === null && child.signalCode === null).map((child) => new Promise((resolve) => { child.once("exit", resolve); child.kill("SIGKILL"); })));
  }
});
test("OWN-3: established protected records are not recreated if missing", () => {
  const path = record();
  assert.throws(() => fileStore(path, { ownership: "kernel", create: false }), /ENOENT/);
  assert.equal(existsSync(path), false);
  const initial = fileStore(path, { ownership: "kernel" }); initial.close();
  const existing = fileStore(path, { ownership: "kernel", create: false }); existing.close();
});
