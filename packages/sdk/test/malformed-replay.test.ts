// SNP-5/D21: live malformed inputs never reach Keel.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createGuard, replay } from "../src/guard.ts";
import { memoryStore } from "../src/record.ts";
import { seal, type DecisionEntry } from "../src/log.ts";
import { WORKLOAD_POLICY, step } from "./support/workload.ts";
async function malformed(): Promise<DecisionEntry> {
  const guard=await createGuard({policy:WORKLOAD_POLICY});
  try{return guard.check({message:null as unknown as Uint8Array,at:0});}
  finally{guard.close();}
}
test("SNP-5/D21: genuine malformed proposal history retains its null controller fields",async()=>{
  const entry=await malformed();
  assert.equal(entry.input,"invalid");
  assert.deepEqual([entry.posture,entry.telemetry,entry.temperatureMax],[null,null,null]);
  assert.equal((await replay([entry],WORKLOAD_POLICY)).ok,true);
  const store=memoryStore();store.entries.push(entry);
  const restored=await createGuard({policy:WORKLOAD_POLICY,log:store});restored.close();
});
test("SNP-5/D21: resealed malformed inputs cannot inject controller events into replay or restore",async()=>{
  const {hash,...body}=await malformed();
  const changes:Partial<DecisionEntry>[]=[
    {posture:"DEFAULT"},
    {telemetry:{intensity:0,valence:0,repetition:0}},
    {temperatureMax:0},
    {posture:"DEFAULT",telemetry:{intensity:0,valence:0,repetition:0},temperatureMax:0},
  ];
  for(const changed of changes){
    const entry=seal({...body,...changed});
    const result=await replay([entry],WORKLOAD_POLICY);
    assert.equal(result.ok,false,JSON.stringify(changed));
    assert.equal(result.divergence?.seq,0);
    const store=memoryStore();store.entries.push(entry);
    await assert.rejects(createGuard({policy:WORKLOAD_POLICY,log:store}),/malformed.*Keel/);
  }
});
test("SNP-5/D21: real parsed controller events remain replayable and restorable",async()=>{
  const store=memoryStore(),guard=await createGuard({policy:WORKLOAD_POLICY,log:store});
  step(guard,0);guard.close();
  assert.notEqual((store.entries[0] as DecisionEntry).posture,null);
  assert.equal((await replay(store.entries,WORKLOAD_POLICY)).ok,true);
  const restored=await createGuard({policy:WORKLOAD_POLICY,log:store});restored.close();
});
