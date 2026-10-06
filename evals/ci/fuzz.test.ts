import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runFuzz } from "./fuzz.ts";
const summary = "fuzz: 1000000 inputs, 100 accepted and matched kit, 999900 refused with a named rule";
test("CI-2 fuzz gate refuses reduced/invalid budgets before starting work", () => {
  for (const count of [0, 999999, NaN, Infinity, 1_000_000.5]) {
    let started = false;
    assert.throws(() => runFuzz(() => { started = true; return { status: 0, output: summary }; }, count));
    assert.equal(started, false);
  }
});
test("CI-2 fuzz gate rejects failed processes and missing, duplicated or incomplete evidence", () => {
  for (const result of [{ status: 1, output: summary }, { status: null, output: summary },
    { status: 0, output: "" }, { status: 0, output: summary + "\n" + summary },
    { status: 0, output: summary.replace("1000000 inputs", "999999 inputs") },
    { status: 0, output: summary.replace("999900 refused", "999899 refused") },
    { status: 0, output: summary.replace("100 accepted", "0 accepted").replace("999900 refused", "1000000 refused") }]) {
    assert.throws(() => runFuzz(() => result));
  }
});
test("CI-2 fuzz gate passes the full budget and a seed and accepts complete evidence", () => {
  let calls = 0;
  runFuzz((runs, seed) => { calls++; assert.equal(runs, 1_000_000); assert.ok(Number.isInteger(seed)); return { status: 0, output: summary }; });
  assert.equal(calls, 1);
});
