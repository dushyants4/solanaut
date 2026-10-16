import { strict as assert } from "node:assert";
import { test } from "node:test";
const load = () => import("./native-kill-contract.ts");
test("SIG-8/LIF-2: native workload freezes every boundary and the required complete kill population", async () => {
  const { nativeKillPlan, NATIVE_KILL_STAGES } = await load();
  const plan = nativeKillPlan(); assert.equal(plan.length, 100);
  assert.deepEqual([...new Set(plan)].sort(), [...NATIVE_KILL_STAGES].sort());
  assert.deepEqual(nativeKillPlan(), plan);
});
test("SIG-8/LIF-2: partial, non-killed, duplicate and unreplayed case evidence refuses", async () => {
  const { requireNativeKills, nativeKillPlan } = await load();
  const rows = nativeKillPlan().map((stage, index) => ({ index, stage, signal: "SIGKILL", admissions: 1, signatures: 1, sendStarts: 1, sends: 1, replayed: true, decisions: 2, replayDecisions: 2, reservation: true }));
  requireNativeKills(rows);
  for (const change of [(r: any[]) => r.pop(), (r: any[]) => { r[0].signal = null; }, (r: any[]) => { r[0].sends = 2; }, (r: any[]) => { r[0].admissions = 2; }, (r: any[]) => { r[0].replayDecisions = 0; }, (r: any[]) => { r[0].reservation = false; }]) {
    const bad = structuredClone(rows); change(bad); assert.throws(() => requireNativeKills(bad));
  }
});
