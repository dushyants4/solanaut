// §11 double-send battery, row by row, and D14's guard-level rule (§7 Intents, §10 D14).
// Keel is held at DEFAULT (calmSensor) so only the state rules decide, except where stated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mk, transfer, prop } from "./lib/helpers.mjs";

const T0 = 1_000_000;

async function firstAttempt(opts = {}) {
  const ctx = await mk({}, opts);
  const { guard, agent, dest } = ctx;
  const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250));
  assert.equal(a.allow, true, "first attempt must be admitted: " + a.reason);
  return { ...ctx, a };
}

test("S01 §11 double-send row 1: re-sign before expiry -> intent-in-flight", async () => {
  const { guard, agent, dest } = await firstAttempt();
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 1000, 120, 270));
  assert.equal(b.allow, false);
  assert.equal(b.rule, "intent-in-flight");
});

test("S02 §11 double-send row 2: re-sign after an unknown outcome -> intent-in-flight", async () => {
  const { guard, agent, dest, a } = await firstAttempt();
  guard.report(a.hash, "unknown");
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 1000, 120, 270));
  assert.equal(b.allow, false);
  assert.equal(b.rule, "intent-in-flight");
});

test("S03 §11 double-send row 3 (D14): re-sign after expiry, outcome reported unknown -> intent-in-flight", async () => {
  const { guard, agent, dest, a } = await firstAttempt();
  guard.report(a.hash, "unknown");
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 2000, 300, 450)); // 300 > lvbh 250
  assert.equal(b.allow, false);
  assert.equal(b.rule, "intent-in-flight");
});

test("S04 §10 D14 / §7: re-sign after expiry, never reported -> intent-in-flight", async () => {
  const { guard, agent, dest } = await firstAttempt();
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 2000, 300, 450));
  assert.equal(b.allow, false);
  assert.equal(b.rule, "intent-in-flight");
});

test("S05 §11 double-send row 4: re-sign after expiry once reported expired -> allowed", async () => {
  const { guard, agent, dest, a } = await firstAttempt();
  guard.report(a.hash, "expired");
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 2000, 300, 450));
  assert.equal(b.allow, true, `${b.rule}: ${b.reason}`);
});

test("S06 §11 double-send row 4, under the default sensor v1: reported expired, re-sign -> allowed", async () => {
  const { guard, agent, dest, a } = await firstAttempt({ sensor: null });
  guard.report(a.hash, "expired");
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 2000, 300, 450));
  assert.equal(b.allow, true, `${b.rule}: ${b.reason} (posture ${b.posture}, telemetry ${JSON.stringify(b.telemetry)})`);
});

test("S07 §11 double-send row 5: the same effects under a new caller intent key -> intent-in-flight", async () => {
  const { guard, agent, dest } = await mk();
  const a = guard.check(prop(transfer(agent, dest, 1000n), T0, 100, 250, "pay-1"));
  assert.equal(a.allow, true);
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 1000, 120, 270, "pay-2"));
  assert.equal(b.allow, false);
  assert.equal(b.rule, "intent-in-flight");
  assert.equal(b.intentKey, a.intentKey, "the intent key is the effects hash, not the caller's key");
  assert.equal(b.group, "pay-2", "the caller's key is recorded as group");
});

test("S08 §7 Intents / D13 at guard level: re-sign after a reported failed outcome -> allowed (attempt k+1)", async () => {
  const { guard, agent, dest, a } = await firstAttempt();
  guard.report(a.hash, "failed");
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + 1000, 120, 270));
  assert.equal(b.allow, true, `${b.rule}: ${b.reason}`);
});

test("S09 §7 / D14: an unreported attempt past its height holds until a window after the first attempt, not sooner", async () => {
  const { guard, agent, dest, policy } = await firstAttempt();
  const w = policy.windowMs;
  const early = guard.check(prop(transfer(agent, dest, 1000n), T0 + w - 1, 300, 450));
  assert.equal(early.rule, "intent-in-flight", "one ms before the window has passed");
  const later = guard.check(prop(transfer(agent, dest, 1000n), T0 + w + 1, 300, 450));
  assert.equal(later.allow, true, `after the window: ${later.rule}: ${later.reason}`);
});

test("S10 §7 'When an intent ends': a window has passed but the attempt is at its last valid height -> still intent-in-flight", async () => {
  const { guard, agent, dest, policy } = await firstAttempt();
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + policy.windowMs + 1, 250, 400)); // height == lvbh: can still land
  assert.equal(b.allow, false, "an attempt at its last valid height can still land");
  assert.equal(b.rule, "intent-in-flight");
});

test("S11 §7 'No timeout is assumed': without block heights, a window later, an unreported attempt still holds", async () => {
  const { guard, agent, dest, policy } = await mk();
  const a = guard.check(prop(transfer(agent, dest, 1000n), T0));
  assert.equal(a.allow, true);
  const b = guard.check(prop(transfer(agent, dest, 1000n), T0 + policy.windowMs * 3));
  assert.equal(b.allow, false, "only a report ends an attempt without heights");
  assert.equal(b.rule, "intent-in-flight");
});
