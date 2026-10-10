import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateProfile } from './measure.mjs';
const definition = { decisions: 10_000, head: 'a'.repeat(64) };
const good = () => ({ storage: 'memory', decisions: 10_000, samplesNs: Array(10_000).fill(1), elapsedNs: 10_001,
  replayNs: 1, replay: { ok: true, decisions: 10_000, divergence: null }, head: definition.head,
  kinds: ['decision', 'report', 'redeem', 'release'], entries: 12_000 });
test('CI-2: scoped timings require a complete frozen mixed history', () => {
  assert.doesNotThrow(() => validateProfile(good(), definition));
  for (const field of ['decisions', 'entries']) {
    const bad = good(); bad[field] = 9999; assert.throws(() => validateProfile(bad, definition), /population/);
  }
  const bad = good(); bad.head = 'b'.repeat(64); assert.throws(() => validateProfile(bad, definition), /history/);
});
test('CI-2: every measured decision has a positive integral duration', () => {
  assert.doesNotThrow(() => validateProfile(good(), definition));
  for (const value of [0, -1, NaN, Infinity, 1.5]) {
    const bad = good(); bad.samplesNs[0] = value; assert.throws(() => validateProfile(bad, definition), /samples/);
  }
  const bad = good(); bad.samplesNs.pop(); assert.throws(() => validateProfile(bad, definition), /samples/);
});
test('CI-2: replay completion and mixed operations cannot be inferred from counts', () => {
  assert.doesNotThrow(() => validateProfile(good(), definition));
  for (const field of ['ok', 'decisions', 'divergence']) {
    const bad = good(); bad.replay[field] = field === 'ok' ? false : field === 'decisions' ? 9999 : { seq: 0 };
    assert.throws(() => validateProfile(bad, definition), /replay/);
  }
  for (const kind of good().kinds) {
    const bad = good(); bad.kinds = bad.kinds.filter(value => value !== kind);
    assert.throws(() => validateProfile(bad, definition), /operations/);
  }
});
test('CI-2: clocks and storage labels refuse malformed or impossible observations', () => {
  assert.doesNotThrow(() => validateProfile(good(), definition));
  for (const field of ['elapsedNs', 'replayNs']) {
    const bad = good(); bad[field] = 0; assert.throws(() => validateProfile(bad, definition), /clock/);
  }
  const bad = good(); bad.elapsedNs = 9999; assert.throws(() => validateProfile(bad, definition), /clock/);
  bad.elapsedNs = 10_001; bad.storage = 'disk'; assert.throws(() => validateProfile(bad, definition), /storage/);
});
