import {strict as assert} from "node:assert";
import {test} from "node:test";
const module=await import("./parallel-experiment.mjs").catch(()=>({}));
const output=(pass=19,fail=0,count=19,cancelled=0)=>`${fail?"✖ target\n":""}ℹ tests ${count}\nℹ pass ${pass}\nℹ fail ${fail}\nℹ cancelled ${cancelled}\nℹ skipped 0\nℹ todo 0\n`;
const result=(stdout=output(),status=0)=>({stdout,status,signal:null,errorCode:null,timedOut:false});
const check=(value,target)=>{const fn=Reflect.get(module,"requireInstalledResult");assert.equal(typeof fn,"function","parallel validator must exist");return fn(value,target);};
test("CI-2/PKG-1: parallel prototype accepts the complete installed control",()=>assert.doesNotThrow(()=>check(result())));
test("CI-2/PKG-1: parallel prototype accepts a complete targeted fault",()=>assert.doesNotThrow(()=>check(result(output(18,1),1),"target")));
for(const [name,value,target] of [
  ["timeout",{...result(output(18,1),1),timedOut:true},"target"],
  ["termination",{...result(output(18,1),1),signal:"SIGTERM"},"target"],
  ["spawn error",{...result(output(18,1),1),errorCode:"ETIMEDOUT"},"target"],
  ["partial population",result(output(17,1,18),1),"target"],
  ["wrong target",result(output(18,1),1),"another target"],
  ["cancelled case",result(output(17,1,19,1),1),"target"],
  ["inconsistent counts",result(output(19,1),1),"target"],
  ["passing mutant",result(),"target"],
  ["failed control",result(output(18,1)),undefined],
  ["earlier forged footer",result(output()+output(18,0,18)),undefined],
])test(`CI-2/PKG-1: parallel prototype refuses ${name}`,()=>assert.throws(()=>check(value,target),/unqualified installed result/));
