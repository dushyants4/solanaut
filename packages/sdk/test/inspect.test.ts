// inspectRecord (milestone 2a.10, ADR-011): what a dashboard shows of a guard, computed from its
// record and policy the same way a restore rebuilds the guard. So the dashboard shows what the
// guard will do, not a second opinion of it. JSON all the way: amounts are decimal strings.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createGuard } from "../src/guard.ts";
import { inspectRecord } from "../src/inspect.ts";
import { runFrom, step, WORKLOAD_POLICY } from "./support/workload.ts";

test("inspectRecord agrees with the live guard: latch, window totals, intents in flight, counts", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  for (let i = 0; i < 37; i++) step(g, i);
  const view = inspectRecord(g.entries(), WORKLOAD_POLICY);
  assert.equal(view.entries, 37);
  assert.equal(view.head, g.entries().at(-1)!.hash);
  assert.deepEqual(view.latched, g.status().latched ? { seq: g.status().latchSeq } : null);
  assert.equal(view.policyHash, g.policyHash);
  assert.equal(view.guardId, "workload");

  const decisions = g.entries().filter((e) => e.kind === "decision");
  assert.equal(view.counts.allow + Object.values(view.counts.deny).reduce((a, b) => a + b, 0), decisions.length);
  assert.equal(view.decisions.length, Math.min(50, decisions.length));
  assert.equal(view.decisions[0]!.seq, decisions.at(-1)!.seq, "newest first");

  // The SOL window: what the guard would add a proposal to, as a decimal string, against the cap.
  assert.equal(view.window.sol.cap, "3000000000");
  assert.match(view.window.sol.used, /^\d+$/);
  assert.ok(BigInt(view.window.sol.used) <= 3_000_000_000n);
  assert.ok(Array.isArray(view.intents));
  for (const i of view.intents) assert.ok(i.attempts.length > 0);
  assert.ok(JSON.stringify(view), "plain JSON: no bigint anywhere");
});

test("inspectRecord shows a latch, the run of denials, and what is still in flight", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  runFrom(g);
  const view = inspectRecord(g.entries(), WORKLOAD_POLICY);
  assert.equal(view.entries, 160);
  assert.equal(view.consecutiveDenials, g.status().consecutiveDenials);
  assert.equal(view.keel?.verified, "bytes");
  // In flight: not landed, and some attempt not final whose last valid height has not passed the latest height recorded.
  const last = [...g.entries()].reverse().find((e) => e.kind === "decision" && e.blockHeight !== null);
  const height = last?.kind === "decision" && last.blockHeight !== null ? BigInt(last.blockHeight) : 0n;
  const inFlight = view.intents.filter((i) => !i.done && i.attempts.some((a) => (a.status === "pending" || a.status === "unknown") && (a.lastValidBlockHeight === null || height <= BigInt(a.lastValidBlockHeight))));
  assert.equal(view.inFlight, inFlight.length);
  assert.ok(view.intents.some((i) => i.attempts.some((a) => a.status === "pending")) , "some attempts were never reported");
});

test("inspectRecord refuses a record that does not chain, as a restore would", async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  for (let i = 0; i < 5; i++) step(g, i);
  const es = [...g.entries()];
  es.splice(2, 1);
  assert.throws(() => inspectRecord(es, WORKLOAD_POLICY), /breaks at seq/);
});
