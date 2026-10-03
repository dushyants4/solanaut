// §7 "replay(entries, policy)" and "Replay".
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuard, replay } from "@solanaut/sdk";
import { setup, transfer, prop, keypair, calmSensor, reseal, ISO } from "./lib/helpers.mjs";

const T0 = 6_000_000;
const stranger = keypair().address;

/** A record holding every entry kind: decisions (allowed, denied, ill-formed, latched), reports, a redeem, a release. */
async function mixed() {
  const s = setup({ latch: { afterDenials: 2 } });
  const g = await createGuard({ policy: s.policy, sensor: calmSensor });
  const msgA = transfer(s.agent, s.dest, 1000n);
  const a = g.check(prop(msgA, T0, 100, 250, "grp"));
  g.redeem(msgA, a.hash, 100n);
  g.report(a.hash, "unknown");
  const b = g.check(prop(transfer(s.agent, s.dest, 2000n), T0 + 1, 100, 250));
  g.report(b.hash, "failed");
  g.check({ message: "not bytes", at: T0 + 2 });                           // ill-formed: rule 1
  g.check(prop(transfer(s.agent, stranger, 1n), T0 + 3, 100, 250));       // second denial in a row: latches
  g.check(prop(transfer(s.agent, s.dest, 3000n), T0 + 4, 100, 250));      // latched
  const text = g.releaseText(ISO(T0 + 600_000));
  g.release(text, s.operator.sign(new TextEncoder().encode(text)), T0 + 5);
  g.check(prop(transfer(s.agent, s.dest, 2000n), T0 + 6, 101, 251));      // B, attempt 2
  return { ...s, g, entries: g.entries().map((e) => ({ ...e })) };
}

test("S65 §7 replay: an untouched record, holding all four entry kinds, replays exactly under its policy", async () => {
  const { entries, policy } = await mixed();
  const kinds = new Set(entries.map((e) => e.kind));
  assert.deepEqual([...kinds].sort(), ["decision", "redeem", "release", "report"]);
  assert.ok(entries.some((e) => e.latch === true), "precondition: a latch in the record");
  const r = await replay(entries, policy, calmSensor);
  assert.equal(r.ok, true, JSON.stringify(r.divergence));
  assert.equal(r.decisions, entries.filter((e) => e.kind === "decision").length);
  assert.equal(r.divergence, null);
});

test("S66 §7 replay: a changed decision (allow flipped, entry re-sealed) is the first divergence, on field allow", async () => {
  const { entries, policy } = await mixed();
  const i = entries.findIndex((e) => e.kind === "decision" && e.allow === false && e.rule === "destination-not-allowed");
  const forged = entries.slice();
  forged[i] = reseal({ ...forged[i], allow: true });
  const r = await replay(forged, policy, calmSensor);
  assert.equal(r.ok, false);
  assert.equal(r.divergence.seq, forged[i].seq);
  assert.equal(r.divergence.field, "allow");
});

test("S67 §7 replay: under another policy, replay names where that policy decides differently", async () => {
  const { entries, policy } = await mixed();
  // 1. the destination removed: the first decision would have been denied
  const p1 = { ...policy, destinations: { allow: [keypair().address] } };
  const r1 = await replay(entries, p1, calmSensor);
  assert.equal(r1.ok, false);
  assert.equal(r1.divergence.seq, 0);
  assert.equal(r1.divergence.field, "allow");
  // 2. a higher latch threshold: everything matches until the decision that latched
  const p2 = { ...policy, latch: { ...policy.latch, afterDenials: 50 } };
  const r2 = await replay(entries, p2, calmSensor);
  const latchSeq = entries.find((e) => e.latch === true).seq;
  assert.equal(r2.ok, false);
  assert.equal(r2.divergence.seq, latchSeq);
  assert.equal(r2.divergence.field, "latch");
});

test("S68 §7 restore (unclear): a re-sealed last entry that lowers an allowed decision's reserved amount", async () => {
  const s = setup({ sol: { maxPerTx: 1000n, maxPerWindow: 1000n } });
  const d2 = keypair().address;
  const policy = { ...s.policy, destinations: { allow: [s.dest, d2] } };
  const g = await createGuard({ policy, sensor: calmSensor });
  g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  const es = g.entries().map((e) => ({ ...e }));
  es[0] = reseal({ ...es[0], amounts: { ...es[0].amounts, sol: "0" } });
  const store = { entries: es, append(e) { this.entries.push(e); }, close() {} };
  let observed;
  try {
    const g2 = await createGuard({ policy, sensor: calmSensor, log: store });
    const c = g2.check(prop(transfer(s.agent, d2, 1000n), T0 + 1, 100, 250));
    observed = `restored; a second 1000 under a 1000 window: allow=${c.allow} rule=${c.rule ?? ""}`;
  } catch (e) {
    observed = "refused to start: " + String(e.message).slice(0, 120);
  }
  const r = await replay(es, policy, calmSensor);
  console.log(`S68 observed: ${observed}; replay ok=${r.ok} divergence=${JSON.stringify(r.divergence)}`);
});
