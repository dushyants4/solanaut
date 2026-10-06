import {strict as assert} from "node:assert";
import {test} from "node:test";
import {upper95,requireTraffic,type TrafficEvidence} from "./traffic.ts";
const names=["steady","jitter","bursts","variable-fees","recurring"];
const good=():TrafficEvidence=>({definition:1,profiles:names.map((name,index)=>({name,seed:2606101+index,proposed:500,completed:500,denied:0,rules:{}}))});
test("RT-1: complete frozen benign populations pass",()=>assert.doesNotThrow(()=>requireTraffic(good(),0)));
test("RT-1: Wilson upper bound is unrounded and includes sampling uncertainty",()=> {
  assert.ok(Math.abs(upper95(0,2000)-0.001917117)/0.001917117<0.00001);
  assert.ok(upper95(0,500)>0); assert.equal(upper95(500,500),1);
  assert.ok(upper95(36,2500)<0.02); assert.ok(upper95(37,2500)>0.02);
});
test("RT-1: failed, interrupted and unsupported traffic measurements fail",()=> {
  for(const status of [1,null]) assert.throws(()=>requireTraffic(good(),status),/process/);
  assert.throws(()=>requireTraffic({...good(),definition:0},0),/definition/);
});
test("RT-1: missing, repeated and substituted profiles cannot shrink the workload",()=> {
  const missing=good(); missing.profiles.pop(); assert.throws(()=>requireTraffic(missing,0),/profile/);
  const repeated=good(); repeated.profiles[4]!.name="steady"; assert.throws(()=>requireTraffic(repeated,0),/profile/);
  const seed=good(); seed.profiles[0]!.seed++; assert.throws(()=>requireTraffic(seed,0),/seed/);
});
test("RT-1: short or incomplete profiles cannot silently exclude proposals",()=> {
  const short=good(); short.profiles[0]!.proposed--; short.profiles[0]!.completed--;
  assert.throws(()=>requireTraffic(short,0),/population/);
  const incomplete=good(); incomplete.profiles[0]!.completed--;
  assert.throws(()=>requireTraffic(incomplete,0),/population/);
});
test("RT-1: all false stops count and a failed confidence target fails",()=> {
  const bad=good(); for(const profile of bad.profiles) {profile.denied=10; profile.rules={latched:10};}
  assert.throws(()=>requireTraffic(bad,0),/false-stop/);
  for(const count of [-1,501,NaN,0.5]) {const bad=good(); bad.profiles[0]!.denied=count; assert.throws(()=>requireTraffic(bad,0),/counts/);}
});
test("RT-1: denial classifications must reconcile to every stop",()=> {
  const bad=good(); bad.profiles[0]!.denied=1; assert.throws(()=>requireTraffic(bad,0),/rules/);
  for(const count of [NaN,-1,0.5]) {const bad=good(); bad.profiles[0]!.rules={latched:count}; assert.throws(()=>requireTraffic(bad,0),/rules/);}
});
test("RT-1: invalid confidence populations fail rather than produce NaN",()=> {
  for(const [k,n] of [[0,0],[-1,10],[11,10],[0.5,10],[0,NaN]]) assert.throws(()=>upper95(k!,n!));
});
