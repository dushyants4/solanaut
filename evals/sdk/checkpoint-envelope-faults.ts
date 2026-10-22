import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/checkpoint-envelope.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/checkpoint-envelope.test.ts"],{encoding:"utf8",timeout:15000});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["array-shape","Array.isArray(input)","false"],
  ["exact-fields",'Object.keys(input).sort().join(",") !== [...names].sort().join(",")',"false"],
  ["canonical-framing",'canonicalJSON(body) + "\\n" !== input',"false"],
  ["format",'body.format !== 1 || body.kind !== "solanaut-signed-checkpoint"',"false"],
  ["safe-ceiling","!Number.isSafeInteger(maxBytes)","false"],
  ["preparse-ceiling",'Buffer.byteLength(input, "utf8") > (maxBytes as number)',"false"],
  ["utf8-ceiling",'Buffer.byteLength(input, "utf8")',"input.length"],
  ["archive-binding","archiveDigest: sha256hex(archives)",'archiveDigest:"0".repeat(64)'],
  ["state-binding","stateDigest: sha256hex(state)",'stateDigest:"0".repeat(64)'],
  ["prefix-binding","prefixDigest: sha256hex(prefix)",'prefixDigest:"0".repeat(64)'],
  ["encoder-pins","const pins = structuredClone(trust),\n      body","const pins=trust,body"],
  ["encoder-verification","verifyCheckpointEnvelope(text, pins, maxBytes);","void 0;"],
  ["encoded-digest","digest: sha256hex(text)",'digest:"0".repeat(64)'],
  ["encoded-immutable","Object.freeze({ text, digest: sha256hex(text) })","({ text, digest: sha256hex(text) })"],
  ["signatures-immutable","Object.freeze({ ...(body.signatures as CheckpointSignatures) })","({ ...(body.signatures as CheckpointSignatures) })"],
  ["decoded-immutable","Object.freeze({ binding, signatures, archives, state, prefix })","({ binding, signatures, archives, state, prefix })"],
] as const;
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"missing envelope fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=run();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/tests 8\b/);console.log("caught checkpoint envelope fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All checkpoint envelope faults caught; restored source passes");
