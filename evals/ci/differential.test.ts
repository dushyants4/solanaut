import { strict as assert } from "node:assert";
import { test } from "node:test";
import { requireDifferential, type DifferentialEvidence } from "./differential.ts";
const digest="a".repeat(64);
const good=():DifferentialEvidence=>({digest,transactions:1000,signatures:1000,versions:{legacy:700,"0":150,"1":150},programs:{system:1,token:1,computeBudget:1},completed:1000,mismatches:0,strictRefusals:9});
test("CI-2: pinned complete real-transaction differential populations pass",()=>assert.doesNotThrow(()=>requireDifferential(good(),digest,0)));
test("CI-2: unsuccessful or interrupted differential processes fail",()=> {for(const status of [1,null]) assert.throws(()=>requireDifferential(good(),digest,status),/process/);});
test("CI-2: corpus substitutions and invalid pins cannot qualify",()=> {
  assert.throws(()=>requireDifferential(good(),"b".repeat(64),0),/digest/);
  assert.throws(()=>requireDifferential(good(),"bad",0),/digest/);
});
test("CI-2: missing transactions, formats and supported program evidence fail",()=> {
  const small=good(); small.transactions=999; small.completed=999; small.signatures=999; small.versions.legacy=699;
  assert.throws(()=>requireDifferential(small,digest,0),/population/);
  for(const field of ["legacy","0","1"]) {
    const bad=good(), missing=bad.versions[field]!; bad.versions[field]=0;
    bad.versions[field==="legacy"?"0":"legacy"]!+=missing;
    assert.throws(()=>requireDifferential(bad,digest,0),/version/);
  }
  for(const field of ["system","token","computeBudget"]) {const bad=good(); bad.programs[field]=0; assert.throws(()=>requireDifferential(bad,digest,0),/program/);}
});
test("CI-2: incomplete execution, signature evidence and any mismatch fail",()=> {
  const bad=good(); bad.completed--; assert.throws(()=>requireDifferential(bad,digest,0),/incomplete/);
  bad.completed++; bad.signatures=0; assert.throws(()=>requireDifferential(bad,digest,0),/signature/);
  bad.signatures=1000; bad.mismatches=1; assert.throws(()=>requireDifferential(bad,digest,0),/mismatch/);
});
test("CI-2: fabricated, duplicate aggregate and invalid strict-refusal counts fail",()=> {
  const bad=good(); bad.versions.legacy!++; assert.throws(()=>requireDifferential(bad,digest,0),/version/);
  for(const value of [-1,NaN,Infinity,0.5,1001]) {const bad=good(); bad.strictRefusals=value; assert.throws(()=>requireDifferential(bad,digest,0),/counts/);}
});
