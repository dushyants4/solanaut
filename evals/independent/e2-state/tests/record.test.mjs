// §7 "The log is the state", "The file", "Restore", "The lock", "A write that fails shuts the guard".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createGuard } from "@solanaut/sdk";
import { setup, transfer, prop, keypair, calmSensor, logPath, rmLog, reseal, ISO, HERE, throws } from "./lib/helpers.mjs";

const T0 = 5_000_000;
const stranger = keypair().address;
const open = (policy, log) => createGuard({ policy, sensor: calmSensor, log });
const json = (p) => JSON.stringify(p, (k, v) => (typeof v === "bigint" ? v.toString() : v));

async function refuses(policy, log) {
  try { const g = await open(policy, log); g.close(); return false; } catch (e) {
    if (process.env.SHOW_REFUSALS) console.log("refusal:", String(e.message).replace(/\/\S*jsonl/g, "<log>").slice(0, 160));
    return true;
  }
}

function lines(log) { return fs.readFileSync(log, "utf8").split("\n").filter((l) => l.length > 0); }
function writeLines(log, ls) { fs.writeFileSync(log, ls.join("\n") + "\n"); }

/** A record of: allow A, report A unknown, deny, allow B, report B failed, deny. Closed. */
async function sixEntries(over = {}) {
  const s = setup(over);
  const log = logPath("rec");
  const g = await open(s.policy, log);
  const a = g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  g.report(a.hash, "unknown");
  g.check(prop(transfer(s.agent, stranger, 1n), T0 + 1, 100, 250));
  const b = g.check(prop(transfer(s.agent, s.dest, 2000n), T0 + 2, 100, 250));
  g.report(b.hash, "failed");
  g.check(prop(transfer(s.agent, stranger, 2n), T0 + 3, 100, 250));
  const before = g.entries().map((e) => ({ ...e }));
  g.close();
  return { ...s, log, before, a, b };
}

test("S50 §7 restore: reservations survive a restart, the entries are identical, and the chain continues", async () => {
  const s = setup({ sol: { maxPerTx: 1000n, maxPerWindow: 1000n } });
  const d2 = keypair().address;
  const policy = { ...s.policy, destinations: { allow: [s.dest, d2] } };
  const log = logPath("resv");
  try {
    const g = await open(policy, log);
    const a = g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
    g.report(a.hash, "landed");
    const before = g.entries().map((e) => ({ ...e }));
    g.close();
    const g2 = await open(policy, log);
    assert.deepEqual(g2.entries().map((e) => ({ ...e })), before);
    const c = g2.check(prop(transfer(s.agent, d2, 1n), T0 + 10, 100, 250));
    assert.equal(c.rule, "over-window-cap", "the window still holds A's 1000");
    assert.equal(c.seq, before.length);
    assert.equal(c.prev, before.at(-1).hash);
    g2.close();
  } finally { rmLog(log); }
});

test("S51 §7 restore: an in-flight intent survives a restart, and takes its report after it", async () => {
  const { log, policy, agent, dest, a } = await sixEntries();
  try {
    const g = await open(policy, log);
    const again = g.check(prop(transfer(agent, dest, 1000n), T0 + 10, 300, 450)); // A was reported unknown
    assert.equal(again.rule, "intent-in-flight");
    const retryB = g.check(prop(transfer(agent, dest, 2000n), T0 + 11, 120, 270)); // B was reported failed
    assert.equal(retryB.allow, true, `attempt 2 of B: ${retryB.rule}: ${retryB.reason}`);
    assert.equal(throws(() => g.report(a.hash, "landed")), null, "a decision from before the restart is this guard's");
    const after = g.check(prop(transfer(agent, dest, 1000n), T0 + 12, 300, 450));
    assert.equal(after.allow, true, `A landed: the same effects are a new intent: ${after.rule}: ${after.reason}`);
    g.close();
  } finally { rmLog(log); }
});

test("S52 §7 'The latch is a recorded fact': a latch survives a restart under another policy, and releases with its seq", async () => {
  const s = setup({ latch: { afterDenials: 2 } });
  const log = logPath("latch");
  try {
    const g = await open(s.policy, log);
    g.check(prop(transfer(s.agent, stranger, 1n), T0, 100, 250));
    g.check(prop(transfer(s.agent, stranger, 2n), T0 + 1, 100, 250));
    assert.equal(g.status().latched, true);
    g.close();
    const p2 = { ...s.policy, latch: { ...s.policy.latch, afterDenials: 1000 } };
    const g2 = await open(p2, log);
    assert.equal(g2.status().latched, true, "still latched under a policy that would not have latched");
    assert.equal(g2.status().latchSeq, 1);
    assert.equal(g2.check(prop(transfer(s.agent, s.dest, 1000n), T0 + 2, 100, 250)).rule, "latched");
    const text = g2.releaseText(ISO(T0 + 600_000));
    assert.match(text, /\nseq: 1\n/);
    assert.match(text, new RegExp(`\npolicy: ${g2.policyHash}\n`), "the current policy's hash");
    assert.equal(g2.release(text, s.operator.sign(new TextEncoder().encode(text)), T0 + 3).released, true);
    g2.close();
  } finally { rmLog(log); }
});

test("S53 §7 restore: the run of denials survives a restart", async () => {
  const s = setup({ latch: { afterDenials: 3 } });
  const log = logPath("run");
  try {
    const g = await open(s.policy, log);
    g.check(prop(transfer(s.agent, stranger, 1n), T0, 100, 250));
    g.check(prop(transfer(s.agent, stranger, 2n), T0 + 1, 100, 250));
    g.close();
    const g2 = await open(s.policy, log);
    assert.equal(g2.status().consecutiveDenials, 2);
    g2.check(prop(transfer(s.agent, stranger, 3n), T0 + 2, 100, 250));
    assert.equal(g2.status().latched, true, "the third denial, after the restart, latches");
    g2.close();
  } finally { rmLog(log); }
});

test("S54 §7 'The file': a changed field refuses to start, with or without its hash recomputed", async () => {
  const r = await sixEntries();
  try {
    const ls = lines(r.log);
    const e = JSON.parse(ls[0]);
    // 1. change the amount A reserved, keep the old hash
    writeLines(r.log, [JSON.stringify({ ...e, amounts: { ...e.amounts, sol: "1" } }), ...ls.slice(1)]);
    assert.equal(await refuses(r.policy, r.log), true, "hash mismatch");
    // 2. the same change, re-sealed: the next line's prev no longer matches
    writeLines(r.log, [JSON.stringify(reseal({ ...e, amounts: { ...e.amounts, sol: "1" } })), ...ls.slice(1)]);
    assert.equal(await refuses(r.policy, r.log), true, "broken chain after a re-sealed change");
    writeLines(r.log, ls);
    assert.equal(await refuses(r.policy, r.log), false, "control: the untouched record opens");
  } finally { rmLog(r.log); }
});

test("S55 §7 'The file': a deleted line refuses to start", async () => {
  const r = await sixEntries();
  try {
    const ls = lines(r.log);
    writeLines(r.log, [...ls.slice(0, 2), ...ls.slice(3)]);
    assert.equal(await refuses(r.policy, r.log), true);
  } finally { rmLog(r.log); }
});

test("S56 §7 'The file': swapped lines refuse to start", async () => {
  const r = await sixEntries();
  try {
    const ls = lines(r.log);
    writeLines(r.log, [ls[0], ls[2], ls[1], ...ls.slice(3)]);
    assert.equal(await refuses(r.policy, r.log), true);
  } finally { rmLog(r.log); }
});

test("S57 §7 'The file': a broken prev (entry re-sealed so its own hash matches) refuses to start", async () => {
  const r = await sixEntries();
  try {
    const ls = lines(r.log);
    const last = JSON.parse(ls.at(-1));
    const forged = reseal({ ...last, prev: "0".repeat(64) });
    writeLines(r.log, [...ls.slice(0, -1), JSON.stringify(forged)]);
    assert.equal(await refuses(r.policy, r.log), true);
  } finally { rmLog(r.log); }
});

test("S58 §7 'The file': a last line cut short with no newline is cut off; its effect is undone and the file stays sound", async () => {
  const r = await sixEntries();
  try {
    // Drop the trailing deny, so the last line is B's "failed" report; then cut that line in half.
    const ls = lines(r.log).slice(0, 5);
    const cut = ls[4].slice(0, Math.floor(ls[4].length / 2));
    fs.writeFileSync(r.log, ls.slice(0, 4).join("\n") + "\n" + cut);
    const g = await open(r.policy, r.log);
    assert.equal(g.entries().length, 4, "the cut line is not an entry");
    const retryB = g.check(prop(transfer(r.agent, r.dest, 2000n), T0 + 10, 120, 270));
    assert.equal(retryB.rule, "intent-in-flight", "B's failed report was cut, so B is pending again");
    g.close();
    assert.equal(await refuses(r.policy, r.log), false, "after appending, the record reopens");
    const g2 = await open(r.policy, r.log);
    assert.equal(g2.entries().length, 5);
    g2.close();
  } finally { rmLog(r.log); }
});

test("S59 §7 'The file': a last line cut short WITH its newline is damage, and refuses to start", async () => {
  const r = await sixEntries();
  try {
    const ls = lines(r.log);
    const cut = ls.at(-1).slice(0, Math.floor(ls.at(-1).length / 2));
    writeLines(r.log, [...ls.slice(0, -1), cut]);
    assert.equal(await refuses(r.policy, r.log), true);
  } finally { rmLog(r.log); }
});

test("S60 §7 'The file': a complete last line with no newline was never acknowledged, and is cut off", async () => {
  const r = await sixEntries();
  try {
    const ls = lines(r.log).slice(0, 5); // last: B's failed report, complete, without its newline
    fs.writeFileSync(r.log, ls.join("\n"));
    const g = await open(r.policy, r.log);
    assert.equal(g.entries().length, 4, "a last line with no newline is cut off, however complete");
    g.check(prop(transfer(r.agent, r.dest, 5000n), T0 + 10, 100, 250));
    g.close();
    const g2 = await open(r.policy, r.log);
    assert.equal(g2.entries().length, 5, "after an append, the record reopens: the unterminated line is gone from the file");
    g2.close();
  } finally { rmLog(r.log); }
});

test("S61 §7 'One writer': a second guard on the same record refuses while the first holds it; after close() it opens", async () => {
  const r = await sixEntries();
  try {
    const g1 = await open(r.policy, r.log);
    assert.equal(await refuses(r.policy, r.log), true);
    g1.close();
    assert.equal(await refuses(r.policy, r.log), false);
  } finally { rmLog(r.log); }
});

function holdInChild(policy, log) {
  const child = spawn(process.execPath, [path.join(HERE, "tests/child/hold.mjs"), log], {
    env: { ...process.env, POLICY: json(policy) }, stdio: ["ignore", "pipe", "inherit"], cwd: HERE,
  });
  const first = new Promise((resolve) => {
    let buf = "";
    child.stdout.on("data", (d) => { buf += d; if (buf.includes("\n")) resolve(buf.split("\n")[0]); });
    child.on("exit", () => resolve(buf || "exit"));
  });
  return { child, first, exited: new Promise((r) => child.on("exit", r)) };
}

test("S62 §7 'The lock': a live holder in another process makes a guard refuse; a SIGKILLed holder's lock is taken over", async () => {
  const r = await sixEntries();
  try {
    const h = holdInChild(r.policy, r.log);
    assert.match(await h.first, /^ready/);
    assert.equal(await refuses(r.policy, r.log), true, "the holder is alive");
    h.child.kill("SIGKILL");
    await h.exited;
    assert.ok(fs.existsSync(r.log + ".lock"), "the dead holder left its lock");
    const g = await open(r.policy, r.log);
    assert.equal(g.entries().length, r.before.length);
    g.close();
  } finally { rmLog(r.log); }
});

test("S63 §7 'A write that fails shuts the guard': it denies everything, unrecorded, until restarted", async () => {
  const s = setup();
  const store = { entries: [], fail: false, append(e) { if (this.fail) throw new Error("disk full"); this.entries.push(e); }, close() {} };
  const g = await createGuard({ policy: s.policy, sensor: calmSensor, log: store });
  assert.equal(g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250)).allow, true);
  store.fail = true;
  const b = g.check(prop(transfer(s.agent, s.dest, 1001n), T0 + 1, 100, 250));
  assert.equal(b.allow, false, "the decision the record could not hold is not an allow");
  store.fail = false;
  const c = g.check(prop(transfer(s.agent, s.dest, 1002n), T0 + 2, 100, 250));
  assert.equal(c.allow, false, "still shut after the store recovers");
  assert.equal(store.entries.length, 1, "nothing after the failure is recorded");
});

test("S64 §7 'Restore': a record whose Keel posture differs from Keel re-ticked on its telemetry refuses to start", async () => {
  const r = await sixEntries();
  try {
    const es = lines(r.log).map((l) => JSON.parse(l));
    // Rewrite decision 2's posture (Keel ticked on calm telemetry says DEFAULT), then re-seal the whole chain.
    es[2] = { ...es[2], posture: "INHIBIT" };
    for (let i = 0; i < es.length; i++) es[i] = reseal({ ...es[i], prev: i === 0 ? "" : es[i - 1].hash });
    writeLines(r.log, es.map((e) => JSON.stringify(e)));
    assert.equal(await refuses(r.policy, r.log), true);
  } finally { rmLog(r.log); }
});
