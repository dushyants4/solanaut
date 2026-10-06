// SIG-4/10: attribution is host configuration, never caller telemetry.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createGuard, replay, type GuardOptions } from "../src/guard.ts";
import { WORKLOAD_POLICY } from "./support/workload.ts";
import { craftLegacy, key } from "./support/craft.ts";

const policy = { ...WORKLOAD_POLICY, latch: { ...WORKLOAD_POLICY.latch, cluster: "devnet" } };
const authority = { mode: "same-user", clock: { wall: 1000, monotonicNs: "1234" } };
const message = craftLegacy({ header: [1, 0, 1], keys: [key(1), key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
const options = (a: unknown = authority): GuardOptions => ({ policy, authority: a } as GuardOptions);
test("SIG-4/10: host attribution and clock anchor appear in decisions and reports", async () => {
  const g = await createGuard(options());
  try {
    const d = g.check({ message, at: 1000 }); assert.equal(d.allow, true);
    assert.equal(d.source, "signer"); assert.deepEqual((d as unknown as { deployment: unknown }).deployment, authority);
    g.report(d.hash, "unknown"); const r = g.entries().at(-1)!;
    assert.equal(r.kind === "report" && r.source, "signer");
    assert.equal((await replay(g.entries(), policy)).ok, true);
  } finally { g.close(); }
});
test("SIG-4/10: host attribution is copied before asynchronous initialization", async () => {
  const mutable = { mode: "same-user", clock: { wall: 1000, monotonicNs: "1234" } };
  const initializing = createGuard(options(mutable)); mutable.mode = "isolated"; mutable.clock.wall = 9999;
  const g = await initializing;
  try { const d = g.check({ message, at: 1000 }); assert.deepEqual((d as unknown as { deployment: unknown }).deployment, authority); }
  finally { g.close(); }
});
test("SIG-4/10: invalid host modes or clock anchors and non-devnet authority refuse startup", async () => {
  for (const a of [{ ...authority, mode: "hidden" }, { ...authority, clock: { wall: -1, monotonicNs: "1" } }, { ...authority, clock: { wall: 1, monotonicNs: "x" } }]) await assert.rejects(createGuard(options(a)), /authority|mode|clock/);
  await assert.rejects(createGuard({ ...options(), policy: WORKLOAD_POLICY }), /devnet/);
});
test("SIG-4/10: ordinary trusted SDK mode still records caller attribution", async () => {
  const g = await createGuard({ policy });
  try { const d = g.check({ message, at: 1000 }); assert.equal(d.source, "caller"); assert.equal("deployment" in d, false); }
  finally { g.close(); }
});
