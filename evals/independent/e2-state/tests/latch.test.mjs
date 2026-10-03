// §7 The latch and its release, §5 rule 4, §11 latch battery.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuard, releaseText, parseReleaseText } from "@solanaut/sdk";
import { setup, transfer, prop, keypair, calmSensor, loopSensor, ISO } from "./lib/helpers.mjs";

const T0 = 4_000_000;
const stranger = keypair().address;

async function latched(over = { latch: { afterDenials: 3 } }) {
  const s = setup(over);
  const guard = await createGuard({ policy: s.policy, sensor: calmSensor });
  for (let i = 0; i < 3; i++) guard.check(prop(transfer(s.agent, stranger, 10n + BigInt(i)), T0 + i, 100, 250));
  assert.equal(guard.status().latched, true, "precondition: latched after 3 denials");
  return { ...s, guard };
}

const okPayment = (s, at, amt = 1000n) => s.guard.check(prop(transfer(s.agent, s.dest, amt), at, 100, 250));

test("S37 §7 latch: trips after latch.afterDenials consecutive denials; the next proposal is denied as latched", async () => {
  const s = await latched();
  const st = s.guard.status();
  assert.equal(st.latchSeq, 2, "the third denial latched");
  const e = s.guard.entries()[2];
  assert.equal(e.latch, true, "§7: the decision that trips it carries latch: true");
  const d = okPayment(s, T0 + 10);
  assert.equal(d.allow, false);
  assert.equal(d.rule, "latched");
});

test("S38 §7 latch: only CONSECUTIVE denials count; an allow in between resets the run", async () => {
  const s = setup({ latch: { afterDenials: 3 } });
  const guard = await createGuard({ policy: s.policy, sensor: calmSensor });
  guard.check(prop(transfer(s.agent, stranger, 1n), T0, 100, 250));
  guard.check(prop(transfer(s.agent, stranger, 2n), T0 + 1, 100, 250));
  assert.equal(guard.check(prop(transfer(s.agent, s.dest, 1000n), T0 + 2, 100, 250)).allow, true);
  guard.check(prop(transfer(s.agent, stranger, 3n), T0 + 3, 100, 250));
  guard.check(prop(transfer(s.agent, stranger, 4n), T0 + 4, 100, 250));
  assert.equal(guard.status().latched, false);
  assert.equal(guard.status().consecutiveDenials, 2);
});

test("S39 §7 latch: trips on any REGROUND (Keel driven by a custom sensor); the next proposal is latched", async () => {
  const s = setup();
  const guard = await createGuard({ policy: s.policy, sensor: loopSensor });
  const d1 = guard.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  assert.equal(d1.posture, "DEFAULT");
  const d2 = guard.check(prop(transfer(s.agent, s.dest, 1001n), T0 + 1, 100, 250));
  assert.equal(d2.posture, "REGROUND");
  assert.equal(d2.rule, "loop-reground");
  assert.equal(guard.status().latched, true);
  const d3 = guard.check(prop(transfer(s.agent, s.dest, 1002n), T0 + 2, 100, 250));
  assert.equal(d3.rule, "latched");
});

test("S40 §11 latch row 1 / §7: a valid operator release frees the guard and starts the stream over", async () => {
  const s = await latched();
  const text = s.guard.releaseText(ISO(T0 + 600_000));
  const r = s.guard.release(text, s.operator.sign(new TextEncoder().encode(text)), T0 + 100);
  assert.equal(r.released, true, r.reason);
  const st = s.guard.status();
  assert.equal(st.latched, false);
  assert.equal(st.consecutiveDenials, 0, "a release clears the run of denials");
  const rel = s.guard.entries().at(-1);
  assert.equal(rel.kind, "release");
  assert.equal(rel.latchSeq, 2);
  assert.equal(okPayment(s, T0 + 101).allow, true);
});

test("S41 §11 latch row 2: the agent's key cannot release the latch", async () => {
  const s = await latched();
  const text = s.guard.releaseText(ISO(T0 + 600_000));
  const r = s.guard.release(text, s.agent.sign(new TextEncoder().encode(text)), T0 + 100);
  assert.equal(r.released, false);
  assert.equal(s.guard.status().latched, true);
});

function variant(s, change) {
  const f = parseReleaseText(s.guard.releaseText(ISO(T0 + 600_000)));
  assert.ok(f, "the guard's own text parses");
  const text = releaseText({ ...f, ...change });
  return { text, sig: s.operator.sign(new TextEncoder().encode(text)) };
}

test("S42 §7: a release naming a wrong guard id, cluster or policy hash is refused", async () => {
  const s = await latched();
  for (const change of [{ guardId: "another-guard" }, { cluster: "devnet" }, { policyHash: "0".repeat(64) }]) {
    const { text, sig } = variant(s, change);
    const r = s.guard.release(text, sig, T0 + 100);
    assert.equal(r.released, false, `wrong ${Object.keys(change)[0]} must be refused`);
  }
  assert.equal(s.guard.status().latched, true);
});

test("S43 §11 latch row 3: a release for the wrong seq is refused", async () => {
  const s = await latched();
  for (const seq of [1, 3]) {
    const { text, sig } = variant(s, { seq });
    assert.equal(s.guard.release(text, sig, T0 + 100).released, false, `seq ${seq}`);
  }
  assert.equal(s.guard.status().latched, true);
});

test("S44 §11 latch row 4: an expired release message is refused", async () => {
  const s = await latched();
  const text = s.guard.releaseText(ISO(T0 + 50));
  const r = s.guard.release(text, s.operator.sign(new TextEncoder().encode(text)), T0 + 100);
  assert.equal(r.released, false);
  assert.equal(s.guard.status().latched, true);
});

test("S45 §7: a valid operator signature over OTHER text is refused", async () => {
  const s = await latched();
  const text = s.guard.releaseText(ISO(T0 + 600_000));
  const otherText = s.guard.releaseText(ISO(T0 + 700_000));
  const r = s.guard.release(text, s.operator.sign(new TextEncoder().encode(otherText)), T0 + 100);
  assert.equal(r.released, false);
  const r2 = s.guard.release(text + "\n", s.operator.sign(new TextEncoder().encode(text + "\n")), T0 + 100);
  assert.equal(r2.released, false, "a trailing newline is not 'exactly in the form'");
  assert.equal(s.guard.status().latched, true);
});

test("S46 §7: a release replayed against a later latch is refused", async () => {
  const s = await latched();
  const text = s.guard.releaseText(ISO(T0 + 600_000));
  const sig = s.operator.sign(new TextEncoder().encode(text));
  assert.equal(s.guard.release(text, sig, T0 + 100).released, true);
  for (let i = 0; i < 3; i++) s.guard.check(prop(transfer(s.agent, stranger, 50n + BigInt(i)), T0 + 200 + i, 100, 250));
  assert.equal(s.guard.status().latched, true, "latched again");
  assert.equal(s.guard.release(text, sig, T0 + 300).released, false, "the first release does not free the second latch");
  assert.equal(s.guard.status().latched, true);
});

test("S47 §5 rule order: latched is rule 4, so rules 1 to 3 still name their own rule and rule 10 does not", async () => {
  const s = await latched();
  const garbage = s.guard.check({ message: new Uint8Array([1, 2, 3]), at: T0 + 10 });
  assert.equal(garbage.rule, "malformed-proposal");
  const v = transfer(s.agent, s.dest, 1000n); v[0] = 0x82; // version byte 0x82: neither legacy, v0 nor v1
  assert.equal(s.guard.check(prop(v, T0 + 11, 100, 250)).rule, "unsupported-version");
  assert.equal(s.guard.check(prop(transfer(s.agent, stranger, 1n), T0 + 12, 100, 250)).rule, "latched");
});

test("S48 §7 'A release starts the stream over ... The windows and intents stand'", async () => {
  const s = setup({ latch: { afterDenials: 3 } });
  const guard = await createGuard({ policy: s.policy, sensor: calmSensor });
  const a = guard.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  assert.equal(a.allow, true);
  for (let i = 0; i < 3; i++) guard.check(prop(transfer(s.agent, stranger, 10n + BigInt(i)), T0 + 1 + i, 100, 250));
  const text = guard.releaseText(ISO(T0 + 600_000));
  assert.equal(guard.release(text, s.operator.sign(new TextEncoder().encode(text)), T0 + 10).released, true);
  const again = guard.check(prop(transfer(s.agent, s.dest, 1000n), T0 + 11, 101, 251));
  assert.equal(again.rule, "intent-in-flight", "the intent stands across a release");
});

test("S49 §7 'A release ... resets Keel': after a REGROUND latch and a release, Keel starts from DEFAULT", async () => {
  // loopSensor: Keel answers DEFAULT on a fresh state's first tick and REGROUND from the second on.
  const s = setup();
  const guard = await createGuard({ policy: s.policy, sensor: loopSensor });
  guard.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  guard.check(prop(transfer(s.agent, s.dest, 1001n), T0 + 1, 100, 250));
  assert.equal(guard.status().latched, true);
  const text = guard.releaseText(ISO(T0 + 600_000));
  assert.equal(guard.release(text, s.operator.sign(new TextEncoder().encode(text)), T0 + 10).released, true);
  const d = guard.check(prop(transfer(s.agent, s.dest, 1002n), T0 + 11, 100, 250));
  assert.equal(d.posture, "DEFAULT", "a reset Keel's first tick");
  assert.equal(d.allow, true, `${d.rule}: ${d.reason}`);
});
