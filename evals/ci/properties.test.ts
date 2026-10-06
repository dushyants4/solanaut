import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as fc from "fast-check";
import { checkProperty, propertySeed, validateCompletion } from "./properties.ts";

test("CI-2 property gate refuses reduced budgets, incomplete runs, skips and failures", () => {
  const clean = { failed: false, numRuns: 10_000, numSkips: 0 };
  validateCompletion(clean, 10_000);
  for (const count of [0, 9999, NaN, Infinity, 10_000.5]) assert.throws(() => validateCompletion(clean, count));
  for (const result of [{ ...clean, failed: true }, { ...clean, numRuns: 9999 }, { ...clean, numSkips: 1 }]) assert.throws(() => validateCompletion(result, 10_000));
  assert.throws(() => checkProperty("under-budget", fc.property(fc.boolean(), () => true), 1));
});
test("CI-2 property seeds are canonical signed 32-bit integers", () => {
  assert.equal(propertySeed("-2147483648"), -2147483648);
  assert.equal(propertySeed("2147483647"), 2147483647);
  for (const value of ["", "1.5", "NaN", "2147483648", "-2147483649", "01", " 1", "-0"]) assert.throws(() => propertySeed(value));
  assert.ok(Number.isInteger(propertySeed()));
});
test("CI-2 runner throws on a failing property and completes the required successful runs", () => {
  assert.throws(() => checkProperty("always-false", fc.property(fc.boolean(), () => false)), /property failed/);
  let executions = 0;
  checkProperty("successful-count", fc.property(fc.boolean(), () => { executions++; return true; }));
  assert.equal(executions, 10_000);
});
