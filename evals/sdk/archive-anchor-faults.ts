import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
const path="packages/sdk/src/archive.ts",original=readFileSync(path,"utf8");
const faults=[
  ["head-binding","head !== anchorHead","false"],
  ["sequence-binding","nextSeq === anchorSeq","nextSeq===anchorSeq!+1"],
  ["missing-anchor","!anchorMatched","false"],
  ["integer-sequence","!Number.isSafeInteger(anchorSeq)","false"],
  ["segment-coverage","anchorSeq! < firstSeq","false"],
  ["head-shape","!hex(anchorHead)","false"],
  ["mutable-sequence","if (nextSeq === anchorSeq)","if(nextSeq===options.expectedAnchor?.seq)"],
  ["mutable-head","head !== anchorHead","head!==options.expectedAnchor?.head"],
  ["receipt-binding","seq: anchorSeq!, head: anchorHead!","seq:anchorSeq!+1,head:anchorHead!"],
] as const;
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/archive-anchor.test.ts"],{encoding:"utf8",timeout:15_000});
const baseline=run(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,from,to] of faults) {
  assert.equal(original.split(from).length,2,"missing or ambiguous anchor fault: "+name);
  try {writeFileSync(path,original.replace(from,to)); const changed=run(); assert.equal(changed.status,1,changed.stdout+changed.stderr); assert.match(changed.stdout,/ANC-3/); assert.match(changed.stdout,/tests 8\b/); console.log("caught archive anchor fault: "+name);}
  finally {writeFileSync(path,original);}
}
const restored=run(); assert.equal(restored.status,0,restored.stdout+restored.stderr); console.log("All anchor faults caught; restored source passes");
