// §11 restart battery: the guard killed at 20 random points, then restarted; the restored state
// equals the state before, checked by replay. §7 "synced to disk before the guard answers",
// "The file", "The lock" (each kill leaves a dead holder's lock to take over).
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { createGuard, replay } from "@solanaut/sdk";
import { calmSensor, logPath, rmLog, HERE } from "./lib/helpers.mjs";

const POINTS = Number(process.env.KILL_POINTS ?? 20);

// Kill once the parent has read `afterAcks` acknowledgements: a point in the stream, whatever the disk's speed.
// The child runs on while the parent reads, so the real kill point is at or after it.
function runAndKill(log, afterAcks) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(HERE, "tests/child/stream.mjs"), log], { stdio: ["ignore", "pipe", "pipe"], cwd: HERE });
    let buf = "", err = "", seen = 0, killed = false;
    child.stdout.on("data", (d) => {
      buf += d;
      if (killed) return;
      seen += (String(d).match(/^ack /gm) ?? []).length;
      if (seen >= afterAcks) { killed = true; child.kill("SIGKILL"); }
    });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (code, signal) => {
      const complete = buf.split("\n").slice(0, -1); // drop a torn (or empty) last stdout line
      const policyLine = complete.find((l) => l.startsWith("policy "));
      if (!policyLine) return reject(new Error("child printed no policy: " + err.slice(0, 300)));
      const acks = complete.filter((l) => l.startsWith("ack ")).map((l) => { const [, seq, hash, kind] = l.split(" "); return { seq: Number(seq), hash, kind }; });
      const sts = complete.filter((l) => l.startsWith("st ")).map((l) => JSON.parse(l.slice(3)));
      resolve({ policy: JSON.parse(policyLine.slice(7)), acks, sts, signal, done: complete.includes("done"), errs: complete.filter((l) => l.startsWith("err ")) });
    });
  });
}

test(`S69 §11 restart battery: SIGKILL at ${POINTS} random points; every acknowledged entry survives, the record reopens, and replays`, { timeout: 180_000 }, async () => {
  const summary = [];
  let mid = 0;
  for (let k = 0; k < POINTS; k++) {
    const log = logPath("kill");
    // the stream writes 3000 entries: kill after the first, then at random points up to 2900
    const delay = k === 0 ? 1 : 1 + Math.floor(Math.random() * 2900);
    try {
      const r = await runAndKill(log, delay);
      assert.equal(r.signal, "SIGKILL", "the child was killed, not finished");
      assert.deepEqual(r.errs, [], "the stream itself raised nothing");
      const g = await createGuard({ policy: r.policy, sensor: calmSensor, log });
      const es = g.entries();
      // every entry the child saw acknowledged is in the restored record, at its seq, with its hash
      for (const a of r.acks) {
        assert.ok(es[a.seq], `acknowledged seq ${a.seq} is missing (record has ${es.length})`);
        assert.equal(es[a.seq].hash, a.hash, `seq ${a.seq} differs`);
      }
      // at most one unacknowledged entry can have reached the disk (the call in progress at the kill)
      assert.ok(es.length - r.acks.length <= 1 && es.length >= r.acks.length, `record ${es.length}, acknowledged ${r.acks.length}`);
      // the restored status is the last acknowledged one when nothing more reached the disk
      const st = g.status();
      assert.equal(st.seq, es.length);
      const lastSt = r.sts.at(-1);
      if (lastSt && es.length === lastSt.seq) assert.deepEqual(st, lastSt, "restored status = status before the kill");
      // the restored record replays exactly under its policy
      const rep = await replay(es, r.policy, calmSensor);
      assert.equal(rep.ok, true, `replay diverged: ${JSON.stringify(rep.divergence)}`);
      // and the guard goes on writing a sound chain
      const before = es.length;
      g.check({ message: new Uint8Array([9, 9, 9]), at: 99_000_000 });
      g.close();
      const g2 = await createGuard({ policy: r.policy, sensor: calmSensor, log });
      assert.equal(g2.entries().length, before + 1);
      g2.close();
      summary.push(`@${delay}:${es.length}/${r.acks.length}${lastSt?.latched ? "L" : ""}${r.done ? "(done)" : ""}`);
      if (!r.done) mid++;
    } finally { rmLog(log); }
  }
  console.log("S69 kill points (@acks read: entries restored/acked, L = latched at the kill):", summary.join(" "));
  assert.ok(mid >= POINTS - 2, `only ${mid} of ${POINTS} kills landed mid-stream`);
});
