import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { instrumentSource, type RawCoverage } from "./coverage-instrument.ts";
import { summarizeCoverage } from "./coverage-merge.ts";
const fixture = () => {
  const result=instrumentSource("function f(x){if(x) return 1; return 2;} f(true);","fixture.ts");
  const context:{__solanautCoverage?:Record<string,RawCoverage>}={}; runInNewContext(result.code,context);
  return {baseline:result.baseline,report:JSON.parse(JSON.stringify(context.__solanautCoverage))};
};
test("CI-2: merging preserves executed counts and includes unimported source with zero counters",()=> {
  const {baseline,report}=fixture(); const absent=instrumentSource("export const untouched=1;","absent.ts").baseline;
  const files=summarizeCoverage([baseline,absent],[report,report]);
  assert.deepEqual(files.find(file=>file.path==="fixture.ts")?.branches,{covered:1,total:2});
  assert.deepEqual(files.find(file=>file.path==="absent.ts")?.statements,{covered:0,total:1});
});
test("CI-2: missing, foreign and incompatible counter evidence is refused",()=> {
  const {baseline,report}=fixture();
  for(const reports of [[],[null],[[]],[{"foreign.ts":report["fixture.ts"]}],[{"fixture.ts":{...report["fixture.ts"],path:"other.ts"}}]]) assert.throws(()=>summarizeCoverage([baseline],reports),/coverage/);
  const bad=structuredClone(report); delete bad["fixture.ts"].s["0"];
  assert.throws(()=>summarizeCoverage([baseline],[bad]),/coverage/);
  const changed=structuredClone(report); changed["fixture.ts"].statementMap["0"].start.line=999;
  assert.throws(()=>summarizeCoverage([baseline],[changed]),/coverage/);
});
test("CI-2: fabricated negative, fractional, unsafe and malformed branch counters fail",()=> {
  const {baseline,report}=fixture();
  for(const value of [-1,0.5,Infinity,Number.MAX_SAFE_INTEGER+1]) {
    const bad=structuredClone(report); bad["fixture.ts"].s["0"]=value;
    assert.throws(()=>summarizeCoverage([baseline],[bad]),/coverage/);
  }
  const bad=structuredClone(report); bad["fixture.ts"].b["0"]=[1];
  assert.throws(()=>summarizeCoverage([baseline],[bad]),/coverage/);
});
