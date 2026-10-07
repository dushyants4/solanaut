import { strict as assert } from "node:assert";
import { test } from "node:test";
import { requireRunCompletion, type RunCompletion } from "../../tools/run-completion.ts";
const identity={runId:"run-fixture",inputHash:"a".repeat(64),commandHash:"b".repeat(64)};
const completed=():RunCompletion=>({...identity,format:1,state:"complete",supervisorPid:100,childPid:101,started:"2026-10-07T00:00:00.000Z",completed:"2026-10-07T00:00:01.000Z",status:0,signal:null,error:null,timedOut:false});
test("CI-2: a complete externally bound child result admits only actual exit zero",()=>{
  assert.equal(requireRunCompletion(completed(),identity),0);
  for(const status of [1,2,-1,null]) assert.throws(()=>requireRunCompletion({...completed(),status},identity));
});
test("CI-2: missing, partial and report-only completion evidence refuses",()=>{
  for(const input of [undefined,null,[],{}, {...completed(),state:"running"}, {...completed(),reportExists:true}]) assert.throws(()=>requireRunCompletion(input,identity));
  for(const field of Object.keys(completed())) { const input:Record<string,unknown>={...completed()};delete input[field];assert.throws(()=>requireRunCompletion(input,identity),field); }
  const hidden={...completed(),reportExists:true};Object.defineProperty(hidden,"toJSON",{value:()=>completed()});
  assert.throws(()=>requireRunCompletion(hidden,identity));
});
test("CI-2: completion pins the exact run, input and command identities",()=>{
  for(const field of ["runId","inputHash","commandHash"] as const) assert.throws(()=>requireRunCompletion({...completed(),[field]:field==="runId"?"foreign":"c".repeat(64)},identity),field);
  for(const bad of [{...identity,inputHash:"bad"},{...identity,commandHash:"B".repeat(64)},{...identity,runId:""}]) assert.throws(()=>requireRunCompletion({...completed(),...bad},bad));
});
test("CI-2: timeout, signal and launch errors cannot masquerade as exit zero",()=>{
  for(const change of [{timedOut:true},{signal:"SIGTERM"},{error:"ENOENT"},{error:""},{signal:""},{timedOut:0}]) assert.throws(()=>requireRunCompletion({...completed(),...change},identity));
});
test("CI-2: unknown formats and malformed process identities refuse",()=>{
  for(const change of [{format:2},{supervisorPid:0},{childPid:-1},{childPid:100},{childPid:1.5},{supervisorPid:Number.MAX_SAFE_INTEGER+1},{status:"0"}]) assert.throws(()=>requireRunCompletion({...completed(),...change},identity));
});
test("CI-2: completion timestamps are canonical and ordered",()=>{
  for(const change of [{started:"bad"},{completed:"bad"},{completed:"2026-10-06T23:59:59.000Z"},{started:"2026-10-07"},{completed:"2026-10-07T00:00:01Z"}]) assert.throws(()=>requireRunCompletion({...completed(),...change},identity));
  assert.equal(requireRunCompletion({...completed(),completed:completed().started},identity),0);
});
test("CI-2: caller evidence cannot alter external pins during capture",()=>{
  const pins={...identity}, input={...completed(),inputHash:"c".repeat(64)};
  Object.defineProperty(input,"format",{enumerable:true,get(){pins.inputHash=input.inputHash;return 1;}});
  assert.throws(()=>requireRunCompletion(input,pins));
});
test("CI-2: throwing accessors and malformed JSON refuse without leaking their content",()=>{
  const input=completed();Object.defineProperty(input,"status",{enumerable:true,get(){throw new Error("fixture-private-diagnostic");}});
  assert.throws(()=>requireRunCompletion(input,identity),error=>error instanceof Error && error.message==="invalid supervised result fields");
  assert.throws(()=>requireRunCompletion({...completed(),status:undefined},identity));
  const extra=completed();Object.defineProperty(extra,"toJSON",{value:()=>({...completed(),extra:true})});
  assert.throws(()=>requireRunCompletion(extra,identity));
});
