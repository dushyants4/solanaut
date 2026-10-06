import { strict as assert } from "node:assert";
import { test } from "node:test";
import { killPrefix, validateExit, validateKills } from "./kills.ts";
import { mkdirSync, mkdtempSync } from "node:fs";
import { createGuard } from "../../packages/sdk/src/guard.ts";
import { fileStore } from "../../packages/sdk/src/record.ts";
import { WORKLOAD_POLICY } from "../../packages/sdk/test/support/workload.ts";
test("CI-2 kill gate requires actual SIGKILL and the exact persisted acknowledgement", () => {
  validateExit("SIGKILL", 10, 10);
  for (const [signal, ack] of [[null, 10], ["SIGTERM", 10], ["SIGKILL", 0], ["SIGKILL", 9]] as const) assert.throws(() => validateExit(signal, ack, 10));
});
test("CI-2 kill gate rejects short and incomplete recovery/replay counts", () => {
  for (const result of [{ kills: 99, completed: 99, replayed: 99 }, { kills: NaN, completed: 100, replayed: 100 }, { kills: 100, completed: 99, replayed: 100 }, { kills: 100, completed: 100, replayed: 99 }]) assert.throws(() => validateKills(result));
});
test("CI-2 kill gate accepts the full verified battery", () => validateKills({ kills: 100, completed: 100, replayed: 100 }));
test("CI-2 kernel recovery: a verified killed owner releases the mutex and restores its persisted state", async () => {
  const base = ".sandbox/solanaut-1/kills/"; mkdirSync(base, { recursive: true });
  const path = mkdtempSync(base + "unit-") + "/record.jsonl";
  await killPrefix(path, 17);
  const guard = await createGuard({ policy: WORKLOAD_POLICY, log: fileStore(path, { ownership: "kernel", create: false }) });
  try { assert.equal(guard.entries().length, 17); assert.equal(guard.status().seq, 17); }
  finally { guard.close(); }
});
