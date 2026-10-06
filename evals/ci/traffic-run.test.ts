import {strict as assert} from "node:assert";
import {test} from "node:test";
import {measureTraffic,measureLoops} from "./traffic-run.ts";
import {requireTraffic} from "./traffic.ts";
test("RT-1: actual guard reconciles every frozen benign proposal",async()=> {
  const evidence=await measureTraffic(); assert.equal(evidence.profiles.length,5);
  assert.equal(evidence.profiles.reduce((sum,profile)=>sum+profile.completed,0),2500);
  assert.doesNotThrow(()=>requireTraffic(evidence,0));
});
test("RT-3: every loop preserves refusal, posture and failed-outcome evidence",async()=> {
  const loops=await measureLoops(); assert.deepEqual(loops.map(loop=>loop.name),["identical","escalating","alternating","failed-outcomes"]);
  for(const loop of loops) {
    assert.equal(loop.postures.length,loop.proposed); assert.equal(loop.outcomes,loop.allowed);
    assert.ok(loop.proposed>=1 && loop.proposed<=60);
    if(loop.firstRefusal===null) {assert.equal(loop.rule,null); assert.equal(loop.proposed,60); assert.equal(loop.allowed,60);}
    else {assert.equal(loop.firstRefusal,loop.proposed); assert.equal(loop.allowed,loop.proposed-1); assert.equal(typeof loop.rule,"string"); assert.ok(loop.rule!.length>0);}
  }
});
