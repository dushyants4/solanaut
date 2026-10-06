import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { instrumentSource, type RawCoverage } from "./coverage-instrument.ts";
test("CI-2: AST calibration counts separate statements on one line and both branch arms", () => {
  const result=instrumentSource("function f(x){const a=1; const b=2; if(x) return a+b; return 0;} f(true);","fixture.ts");
  const context: {__solanautCoverage?:Record<string,RawCoverage>}={}; runInNewContext(result.code,context);
  const counted=context.__solanautCoverage?.["fixture.ts"];
  assert.ok(counted,"execution must emit counters");
  assert.equal(Object.keys(counted.s).length,6);
  assert.equal(Object.values(counted.s).filter(value=>value>0).length,5);
  assert.equal(Object.values(counted.b).flat().length,2);
  assert.equal(Object.values(counted.b).flat().filter(value=>value>0).length,1);
  assert.ok(Object.values(result.baseline.s).every(value=>value===0));
});
test("CI-2: native type stripping preserves runtime behaviour and leaves unused code uncovered", () => {
  const result=instrumentSource("function f(x: boolean): number {if(x) return 1; return 2;} const unused = (): number => 3; f(false);","typed.ts");
  const context: {__solanautCoverage?:Record<string,RawCoverage>}={}; runInNewContext(result.code,context);
  const counted=context.__solanautCoverage?.["typed.ts"]; assert.ok(counted);
  assert.ok(Object.values(counted.s).some(value=>value===0));
  assert.equal(Object.values(counted.b).flat().filter(value=>value>0).length,1);
  assert.equal(Object.values(result.baseline.s).filter(value=>value>0).length,0);
});
