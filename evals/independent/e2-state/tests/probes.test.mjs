// Cases the spec leaves open; each records what the guard does, for the spec questions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuard, replay } from "@solanaut/sdk";
import { setup, transfer, prop, keypair, calmSensor, reseal, ISO } from "./lib/helpers.mjs";

const T0 = 11_000_000;
const stranger = keypair().address;

test("S82 §7 / §5 rule 16 (unclear): an attempt still able to land after its window has rolled — is it still counted?", async () => {
  // windowMs 10 s, shorter than a blockhash's ~150-block life: the realistic case.
  const s = setup({ windowMs: 10_000, sol: { maxPerTx: 1000n, maxPerWindow: 1000n } });
  const d2 = keypair().address;
  const policy = { ...s.policy, destinations: { allow: [s.dest, d2] } };
  const g = await createGuard({ policy, sensor: calmSensor });
  const a = g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  assert.equal(a.allow, true);
  // 10.001 s later, height 125: A can still land (§7: in flight), yet its admission has left the window
  const sameA = g.check(prop(transfer(s.agent, s.dest, 1000n), T0 + 10_001, 125, 275));
  const c = g.check(prop(transfer(s.agent, d2, 1000n), T0 + 10_002, 125, 275));
  console.log(`S82 observed: re-sign of A -> ${sameA.rule ?? "allow"}; another 1000 under a 1000 window while A can still land -> allow=${c.allow} ${c.rule ?? ""}`);
});

test("S83 §7 Restore (unclear): a release entry with no valid operator signature, appended and sealed, then restored", async () => {
  const s = setup({ latch: { afterDenials: 2 } });
  const g = await createGuard({ policy: s.policy, sensor: calmSensor });
  g.check(prop(transfer(s.agent, stranger, 1n), T0, 100, 250));
  g.check(prop(transfer(s.agent, stranger, 2n), T0 + 1, 100, 250));
  assert.equal(g.status().latched, true);
  const es = g.entries().map((e) => ({ ...e }));
  const text = g.releaseText(ISO(T0 + 600_000));
  const last = es.at(-1);
  const forged = reseal({ v: 1, seq: last.seq + 1, prev: last.hash, at: T0 + 2, kind: "release", latchSeq: g.status().latchSeq,
    text, signature: Buffer.from(new Uint8Array(64)).toString("base64") });
  const store = { entries: [...es, forged], append(e) { this.entries.push(e); }, close() {} };
  let observed;
  try {
    const g2 = await createGuard({ policy: s.policy, sensor: calmSensor, log: store });
    const d = g2.check(prop(transfer(s.agent, s.dest, 1000n), T0 + 3, 100, 250));
    observed = `restored, latched=${g2.status().latched}, next payment allow=${d.allow} ${d.rule ?? ""}`;
  } catch (e) {
    observed = "refused to start: " + String(e.message).slice(0, 120);
  }
  const r = await replay([...es, forged], s.policy, calmSensor);
  console.log(`S83 observed: ${observed}; replay ok=${r.ok} ${JSON.stringify(r.divergence)}`);
});
