import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path="packages/sdk/src/checkpoint-prefix.ts",source=readFileSync(path,"utf8");
const execute=()=>spawnSync(process.execPath,["--test","packages/sdk/test/checkpoint-prefix.test.ts"],{encoding:"utf8",timeout:15_000});
const baseline=execute();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["rebuild-prefix-comparison","prefixInput!==expected.text","false"],
  ["rebuild-reset",'if(event.kind==="reset")controller.reset();','if(event.kind==="reset")void 0;'],
  ["rebuild-posture",'controller.tick(event.telemetry).posture!==event.posture','(controller.tick(event.telemetry),false)'],
  ["rebuild-events","events:prefix.events.length","events:0"],
  ["rebuild-immutable","Object.freeze({controller,events:prefix.events.length,...endpoint})","({controller,events:prefix.events.length,...endpoint})"],
  ["endpoint-fields",'Object.keys(endpoint).sort().join(",")!=="head,seq"',"false"],
  ["captured-endpoint","const endpoint=structuredClone(context)","const endpoint=context"],
  ["captured-history","const entries=JSON.parse(canonicalJSON(captured)) as Entry[]","const entries=input as Entry[]"],
  ["endpoint-sequence","entries.length!==endpoint.seq","false"],
  ["endpoint-head",'(entries.at(-1)?.hash??"")!==endpoint.head',"false"],
  ["full-replay",'if(!result.ok)',"if(false)"],
  ["policy-trust","sensorV1,pins","sensorV1,{...pins,guardId:WORKLOAD_POLICY.latch.guardId}"],
  ["reset-events",'e.kind==="release"',"false"],
  ["tick-events",'e.kind==="decision" && e.posture!==null && e.telemetry!==null',"false"],
  ["event-sequence","seq:e.seq","seq:e.seq+1"],
  ["event-hash","hash:e.hash",'hash:"0".repeat(64)'],
  ["telemetry","telemetry:e.telemetry","telemetry:{intensity:0,valence:0,repetition:0}"],
  ["posture","posture:e.posture",'posture:"DEFAULT"'],
  ["profile","profile:EVALUATION_PROFILE",'profile:{...EVALUATION_PROFILE,sensor:"foreign"}'],
  ["domain",'kind:"solanaut-checkpoint-keel-prefix"','kind:"solanaut-checkpoint"'],
  ["digest","digest:sha256hex(text)",'digest:sha256hex("bogus")'],
  ["immutable","Object.freeze({text,digest:sha256hex(text)})","({text,digest:sha256hex(text)})"],
] as const;
for(const [name,before,after] of faults){
  assert.ok(source.includes(before),"missing prefix fault: "+name);
  let damaged=source.replaceAll(before,after);
  if(name==="policy-trust")damaged='import { WORKLOAD_POLICY } from "../test/support/workload.ts";\n'+damaged;
  try{writeFileSync(path,damaged);const result=execute();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 13\b/);console.log("caught checkpoint prefix fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=execute();assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All checkpoint prefix faults caught; restored source passes");
