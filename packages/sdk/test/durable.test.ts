// Milestone 2a.6, durable state (docs/SPEC.md §7, ADR-010): the record is written and synced to
// disk before the guard answers; on start the guard verifies the chain and rebuilds its state by
// applying every entry again, Keel included; one guard writes a record at a time; and replay()
// recomputes every decision from its bytes. Closes defect D11: a restart reset the caps.

import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createGuard, replay, type Entry, type EntryStore } from "../src/guard.ts";
import { seal } from "../src/log.ts";
import { craftLegacy, key } from "./support/craft.ts";
import { rng } from "./support/kit.ts";
import { runFrom, step, TOTAL_STEPS, WORKLOAD_POLICY } from "./support/workload.ts";

const scratch = () => mkdtempSync(join(tmpdir(), "solanaut-record-"));
const lines = (path: string) => readFileSync(path, "utf8").split("\n").filter(Boolean);
const hashes = (es: readonly Entry[]) => es.map((e) => e.hash);

/** Edit entry `at` and re-seal the chain from there, as someone rewriting the record would. */
function reseal(es: readonly Entry[], at: number, edit: (e: Entry) => Entry): Entry[] {
  const out: Entry[] = es.slice(0, at);
  for (let i = at; i < es.length; i++) {
    const { hash: _h, ...body } = i === at ? edit(es[i]!) : es[i]!;
    out.push(seal({ ...body, prev: i === 0 ? "" : out[i - 1]!.hash } as never));
  }
  return out;
}

/** The uninterrupted run, in memory: what every restarted run must reproduce, entry for entry. */
const reference = (async () => {
  const g = await createGuard({ policy: WORKLOAD_POLICY });
  runFrom(g);
  return g;
})();

test("the reference workload exercises what a restart must restore", async () => {
  const g = await reference;
  const kinds = new Map<string, number>();
  for (const e of g.entries()) {
    const k = e.kind === "decision" ? (e.allow ? "allow" : `deny:${e.rule}`) : e.kind;
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
  }
  console.log(`  workload: ${TOTAL_STEPS} entries: ${[...kinds].map(([k, n]) => `${k} ${n}`).join(", ")}`);
  for (const k of ["allow", "deny:destination-not-allowed", "deny:malformed-proposal", "deny:latched", "deny:intent-in-flight", "deny:over-window-cap", "report", "release", "redeem"]) {
    assert.ok((kinds.get(k) ?? 0) > 0, `the workload never produced ${k}`);
  }
});

test("the record is synced to disk entry by entry, and a guard reopened on it has every entry", async () => {
  const path = join(scratch(), "guard.jsonl");
  const a = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  for (let i = 0; i < 40; i++) step(a, i);
  assert.equal(lines(path).length, 40, "one line per entry, on disk before the answer");
  a.close();
  const b = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  assert.deepEqual(hashes(b.entries()), hashes(a.entries()));
  assert.deepEqual(b.status(), a.status());
  b.close();
});

test("D11: a reopened guard decides as the uninterrupted one would: windows, intents, the latch and Keel survive", async () => {
  const ref = await reference;
  const path = join(scratch(), "guard.jsonl");
  for (const stopAt of [17, 63, 101, TOTAL_STEPS]) {
    const g = await createGuard({ policy: WORKLOAD_POLICY, log: path });
    for (let i = g.status().seq; i < stopAt; i++) step(g, i);
    g.close();
  }
  assert.deepEqual(lines(path).map((l) => JSON.parse(l).hash), hashes(ref.entries()), "the same record, entry for entry");
});

test("the restart battery: SIGKILLed at 20 random points and restarted each time, the record ends identical to an uninterrupted run", async () => {
  const ref = await reference;
  const path = join(scratch(), "guard.jsonl");
  const r = rng(2026);
  let kills = 0;
  while (kills < 20) {
    const target = r.int(1, 5);
    const child = spawn(process.execPath, ["packages/sdk/test/support/workload-child.ts", path], { stdio: ["ignore", "pipe", "inherit"] });
    let acks = 0;
    let done = false;
    child.stdout.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.startsWith("ack ")) acks++;
        if (line === "done") done = true;
      }
      if (acks >= target && !child.killed) child.kill("SIGKILL");
    });
    await new Promise((resolve) => child.on("exit", resolve));
    if (done) break;
    kills++;
  }
  const last = spawnSync(process.execPath, ["packages/sdk/test/support/workload-child.ts", path], { encoding: "utf8" });
  assert.equal(last.status, 0, last.stderr);
  console.log(`  restart battery: ${kills} kills; the record has ${lines(path).length} entries`);
  assert.ok(kills >= 20, `only ${kills} kills before the workload finished`);
  assert.deepEqual(lines(path).map((l) => JSON.parse(l).hash), hashes(ref.entries()), "identical to the uninterrupted run");
  const replayed = await replay(lines(path).map((l) => JSON.parse(l)), WORKLOAD_POLICY);
  assert.deepEqual([replayed.ok, replayed.decisions], [true, ref.entries().filter((e) => e.kind === "decision").length]);
});

test("a torn final line, the mark of a crash mid-write, is dropped: it was never acknowledged", async () => {
  const path = join(scratch(), "guard.jsonl");
  const a = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  for (let i = 0; i < 10; i++) step(a, i);
  a.close();
  appendFileSync(path, '{"v":1,"seq":10,"prev":"');
  const b = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  assert.equal(b.status().seq, 10);
  step(b, 10);
  b.close();
  assert.equal(lines(path).length, 11, "the torn line was cut, and the next entry starts on a clean line");
  assert.doesNotThrow(() => lines(path).forEach((l) => JSON.parse(l)));
});

test("a record that is broken before its last line refuses to start: fail closed", async () => {
  const good = join(scratch(), "guard.jsonl");
  const a = await createGuard({ policy: WORKLOAD_POLICY, log: good });
  for (let i = 0; i < 12; i++) step(a, i);
  a.close();
  const original = lines(good);
  const variant = (label: string, edit: (ls: string[]) => string[], why: RegExp) => async () => {
    const path = join(scratch(), "guard.jsonl");
    writeFileSync(path, edit([...original]).join("\n") + "\n");
    await assert.rejects(createGuard({ policy: WORKLOAD_POLICY, log: path }), why, label);
  };
  await variant("a line that does not parse", (ls) => (ls.splice(4, 1, "{not json"), ls), /line 5/)();
  await variant("an entry whose hash does not match it", (ls) => (ls[3] = ls[3]!.replace('"at":', '"at":1,"x":'), ls), /hash/)();
  await variant("an entry removed", (ls) => (ls.splice(6, 1), ls), /breaks at seq/)();
  await variant("two entries swapped", (ls) => ([ls[2], ls[3]] = [ls[3]!, ls[2]!], ls), /breaks at seq/)();
});

test("one writer: a second guard on an open record refuses; a lock left by a dead process is taken over", async () => {
  const path = join(scratch(), "guard.jsonl");
  const a = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  await assert.rejects(createGuard({ policy: WORKLOAD_POLICY, log: path }), /locked/);
  const other = spawnSync(process.execPath, ["packages/sdk/test/support/workload-child.ts", path], { encoding: "utf8" });
  assert.notEqual(other.status, 0, "another process is refused too");
  assert.match(other.stderr, /locked/);
  a.close();

  const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  writeFileSync(`${path}.lock`, JSON.stringify({ pid: Number(dead.stdout), host: hostname(), at: 0 }));
  const b = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  b.close();
});

test("replay recomputes every decision from its bytes and names the first divergence", async () => {
  const ref = (await reference).entries();
  assert.deepEqual((await replay(ref, WORKLOAD_POLICY)).divergence, null);

  // Flip one denial to an allow and re-seal the chain from there.
  const at = ref.findIndex((e) => e.kind === "decision" && e.rule === "destination-not-allowed");
  const forged = reseal(ref, at, (e) => {
    const { rule: _r, ...rest } = e as Entry & { rule?: string };
    return { ...rest, allow: true, reason: "" } as Entry;
  });
  const res = await replay(forged, WORKLOAD_POLICY);
  assert.equal(res.ok, false);
  assert.equal(res.divergence?.seq, at);
  assert.match(res.divergence!.field, /allow|rule/);

  const narrower = { ...WORKLOAD_POLICY, sol: { maxPerTx: 1_000_000n, maxPerWindow: 3_000_000_000n } };
  const under = await replay(ref, narrower);
  assert.equal(under.ok, false, "the same bytes under a narrower policy decide differently");
  assert.ok(under.divergence !== null);
});

test("a record that cannot be written denies, and the guard stays shut", async () => {
  let fail = false;
  const store: EntryStore = { entries: [], append(e) { if (fail) throw new Error("disk full"); this.entries.push(e); }, close() {} };
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: store });
  step(g, 0);
  assert.equal(g.entries().length, 1);
  fail = true;
  const pay = craftLegacy({ header: [1, 0, 1], keys: [key(1), key(2), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }] });
  const d = g.check({ message: pay, at: 2_000_000 });
  assert.deepEqual([d.allow, d.rule], [false, "fail-closed"]);
  assert.match(d.reason, /disk full/);
  fail = false;
  const after = g.check({ message: pay, at: 2_000_001 });
  assert.deepEqual([after.allow, after.rule], [false, "fail-closed"], "shut: nothing more is decided after a write failed");
  assert.equal(g.entries().length, 1, "nothing unrecorded was applied");
});

test("npm run replay: exit 0 for a record that replays, 1 with the divergence under a narrower policy, 2 for no policy", async () => {
  const dir = scratch();
  const path = join(dir, "guard.jsonl");
  const g = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  for (let i = 0; i < 30; i++) step(g, i);
  g.close();
  const asJSON = (p: unknown) => JSON.stringify(p, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
  writeFileSync(join(dir, "policy.json"), asJSON(WORKLOAD_POLICY));
  writeFileSync(join(dir, "narrow.json"), asJSON({ ...WORKLOAD_POLICY, destinations: { allow: [WORKLOAD_POLICY.principal[0]] } }));
  const run = (...args: string[]) => spawnSync(process.execPath, ["packages/sdk/bin/replay.ts", ...args], { encoding: "utf8" });
  const ok = run(path, join(dir, "policy.json"));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /replays: 30 entries/);
  const narrow = run(path, join(dir, "narrow.json"));
  assert.equal(narrow.status, 1);
  assert.match(narrow.stdout, /diverges at seq \d+, field (allow|rule)/);
  assert.equal(run(path).status, 2);
});

test("the latch is a fact of the record: restored under a policy with a higher threshold, the guard stays latched", async () => {
  const path = join(scratch(), "guard.jsonl");
  const a = await createGuard({ policy: WORKLOAD_POLICY, log: path });
  // Three different drains, 30 s apart: the run of denials trips the latch, not a loop.
  const drain = (to: number) => craftLegacy({ header: [1, 0, 1], keys: [key(1), key(to), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, to, 0, 0, 0, 0, 0, 0, 0] }] });
  const ds = [3, 4, 5].map((to, i) => a.check({ message: drain(to), at: 3_000_000 + i * 30_000 }));
  assert.ok(ds.every((d) => d.posture !== "REGROUND"), `postures: ${ds.map((d) => d.posture)}`);
  assert.equal(a.status().latched, true);
  a.close();
  const lenient = { ...WORKLOAD_POLICY, latch: { ...WORKLOAD_POLICY.latch, afterDenials: 50 } };
  const b = await createGuard({ policy: lenient, log: path });
  assert.equal(b.status().latched, true, "a policy change does not release a latch; only the operator does");
  b.close();
});

// --- found by the independent evaluator (evals/independent/e2-state) ------------------------------

test("S83: a release in the record is verified on restore and in replay: a forged one refuses to start, and replay names it", async () => {
  const a = await createGuard({ policy: WORKLOAD_POLICY });
  const drain = (to: number) => craftLegacy({ header: [1, 0, 1], keys: [key(1), key(to), key(0)], instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, to, 0, 0, 0, 0, 0, 0, 0] }] });
  [3, 4, 5].forEach((to, i) => a.check({ message: drain(to), at: 3_000_000 + i * 30_000 }));
  assert.equal(a.status().latched, true);
  const es = a.entries();
  const last = es[es.length - 1]!;
  const text = a.releaseText(new Date(4_000_000_000_000).toISOString());
  const forged = seal({ v: 1, kind: "release", seq: es.length, prev: last.hash, at: last.at + 1, latchSeq: a.status().latchSeq!, text, signature: Buffer.alloc(64).toString("base64") } as never) as Entry;
  const store: EntryStore = { entries: [...es, forged], append: () => {}, close: () => {} } as unknown as EntryStore;
  await assert.rejects(createGuard({ policy: WORKLOAD_POLICY, log: store }), /release/);
  const result = await replay([...es, forged], WORKLOAD_POLICY);
  assert.equal(result.ok, false, "replay calls a record with a forged release sound");
  assert.equal(result.divergence?.seq, es.length);
});

test("S81: a lock file that names no process refuses to start, and says so plainly", async () => {
  const path = join(scratch(), "guard.jsonl");
  writeFileSync(`${path}.lock`, "");
  await assert.rejects(createGuard({ policy: WORKLOAD_POLICY, log: path }), (e: Error) => /lock/.test(e.message) && !/undefined/.test(e.message));
});
