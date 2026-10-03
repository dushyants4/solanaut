import assert from "node:assert/strict";

export function denied(d, rule) {
  assert.equal(d.allow, false, `expected a denial as ${rule}, got allow (reason: ${d.reason})`);
  assert.equal(d.rule, rule, `expected rule ${rule}, got ${d.rule} (reason: ${d.reason})`);
}
export function allowed(d) {
  assert.equal(d.allow, true, `expected allow, got ${d.rule}: ${d.reason}`);
}
