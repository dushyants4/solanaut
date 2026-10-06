import { strict as assert } from "node:assert";
import { test } from "node:test";
import { requireMutationReport } from "./mutation.ts";
const sources={"packages/sdk/src/policy.ts":"export const value = 1;\n"};
function report(killed=8, survived=2) {
  return {schemaVersion:"1",files:{"packages/sdk/src/policy.ts":{language:"typescript",source:sources["packages/sdk/src/policy.ts"],mutants:Array.from({length:killed+survived},(_,id)=>({id:String(id),mutatorName:"ArithmeticOperator",replacement:"2",location:{start:{line:1,column:20},end:{line:1,column:21}},status:id<killed?"Killed":"Survived"}))}}};
}
test("CI-2: mutation score uses exact valid populations and the fixed floor",()=> {
  assert.deepEqual(requireMutationReport(report(),sources,0),{detected:8,undetected:2,invalid:0,total:10,score:80});
  assert.throws(()=>requireMutationReport(report(799,201),sources,0),/below.*80/);
});
test("CI-2: failed or interrupted Stryker runs cannot qualify",()=> {
  for(const status of [1,2,null]) assert.throws(()=>requireMutationReport(report(),sources,status),/process/);
});
test("CI-2: missing, foreign and changed mutation sources fail closed",()=> {
  const missing=report(); missing.files={} as typeof missing.files;
  assert.throws(()=>requireMutationReport(missing,sources,0),/inventory/);
  const changed=report(); changed.files["packages/sdk/src/policy.ts"].source="different";
  assert.throws(()=>requireMutationReport(changed,sources,0),/source/);
  assert.throws(()=>requireMutationReport(report(),{"different.ts":"text"},0),/inventory/);
});
test("CI-2: ignored, pending and malformed mutant results are rejected",()=> {
  for(const status of ["Ignored","Pending","bogus"]) {
    const bad=report(); bad.files["packages/sdk/src/policy.ts"].mutants[0]!.status=status;
    assert.throws(()=>requireMutationReport(bad,sources,0),/status/);
  }
  const duplicate=report(); duplicate.files["packages/sdk/src/policy.ts"].mutants[1]!.id="0";
  assert.throws(()=>requireMutationReport(duplicate,sources,0),/identity/);
  const location=report(); location.files["packages/sdk/src/policy.ts"].mutants[0]!.location.start.line=0;
  assert.throws(()=>requireMutationReport(location,sources,0),/location/);
});
test("CI-2: no mutants or all-invalid mutants cannot report a perfect score",()=> {
  assert.throws(()=>requireMutationReport(report(0,0),sources,0),/population/);
  const invalid=report(); for(const mutant of invalid.files["packages/sdk/src/policy.ts"].mutants) mutant.status="RuntimeError";
  assert.throws(()=>requireMutationReport(invalid,sources,0),/population/);
});
test("CI-2: Stryker timeout and invalid semantics remain explicit",()=> {
  const value=report(); value.files["packages/sdk/src/policy.ts"].mutants[0]!.status="Timeout";
  value.files["packages/sdk/src/policy.ts"].mutants.push({...value.files["packages/sdk/src/policy.ts"].mutants[0]!,id:"10",status:"CompileError"});
  value.files["packages/sdk/src/policy.ts"].mutants.push({...value.files["packages/sdk/src/policy.ts"].mutants[0]!,id:"11",status:"RuntimeError"});
  assert.deepEqual(requireMutationReport(value,sources,0),{detected:8,undetected:2,invalid:2,total:12,score:80});
});
test("CI-2: malformed report roots and schema versions are refused",()=> {
  for(const bad of [null,{},[],{...report(),schemaVersion:"2"}]) assert.throws(()=>requireMutationReport(bad,sources,0),/report/);
});
