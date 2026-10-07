import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as fc from "fast-check";
import { spawnSync } from "node:child_process";
import { propertyTrialOptions, requirePropertyFaultExit, validateCompletion } from "./properties.ts";
test("CI-2: ordinary property options remain unchanged; unknown fault modes and low budgets refuse", () => {
  assert.deepEqual(propertyTrialOptions(10000, 23083), {numRuns:10000,seed:23083});
  for (const mode of ["", "true", "retry", "skip", "first-failure "]) assert.throws(() => propertyTrialOptions(10000, 23083, mode), /invalid fault trial mode/);
  assert.throws(() => propertyTrialOptions(9999, 23083, "first-failure"), /budget below/);
});
test("CI-2: fault diagnostics preserve the complete successful generated population", () => {
  const population = (mode?: string) => {
    const values: number[] = [];
    const result = fc.check(fc.property(fc.integer(), value => { values.push(value); return true; }), propertyTrialOptions(10000, 23083, mode));
    validateCompletion(result, 10000); assert.equal(values.length, 10000); return values;
  };
  assert.deepEqual(population("first-failure"), population());
});
test("CI-2: fault trials report the first actual failure without shrinking or retrying it", () => {
  let calls = 0;
  const result = fc.check(fc.property(fc.integer({min:1,max:100000}), () => { calls++; return false; }), propertyTrialOptions(10000, 23083, "first-failure"));
  assert.equal(result.failed, true); assert.equal(result.numShrinks, 0); assert.equal(calls, 1);
  assert.ok(result.counterexample); assert.throws(() => validateCompletion(result, 10000), /property failed/);
});
test("CI-2: a misleading failure message and exit code cannot hide a timed-out fault trial", () => {
  assert.doesNotThrow(() => requirePropertyFaultExit({status:1,signal:null}));
  const result = spawnSync(process.execPath, ["-e", "process.on('SIGTERM',()=>process.exit(1)); console.log('property failed'); setInterval(()=>{},1000);"], {encoding:"utf8",timeout:1000});
  assert.match(result.stdout, /property failed/); assert.ok(result.error);
  assert.throws(() => requirePropertyFaultExit(result), /fault trial process/);
  for (const value of [{status:0,signal:null},{status:null,signal:"SIGTERM"},{status:1,signal:"SIGTERM"}]) assert.throws(() => requirePropertyFaultExit(value), /fault trial process/);
});
