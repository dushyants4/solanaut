import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path="packages/sdk/src/checkpoint-archives.ts",source=readFileSync(path,"utf8");
const execute=()=>spawnSync(process.execPath,["--test","packages/sdk/test/checkpoint-archives.test.ts"],{encoding:"utf8",timeout:15_000});
const baseline=execute();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["unknown-fields","keys.some(key=>![...fields,...optional].includes(key))","false"],
  ["dense-array",' || Object.keys(input).length!==length || !Object.keys(input).every((key,index)=>key===String(index))',""],
  ["caller-array-method",'Array.from({length},(_,index)=>copy(input[index],',"input.map(value=>copy(value,"],
  ["integer-fields",'["bytes","entries","firstSeq","nextSeq"].every(key=>Number.isSafeInteger(segment[key]))',"true"],
  ["bytes-span","(segment.bytes as number)<(segment.entries as number)","false"],
  ["first-sequence","segment.firstSeq!==nextSeq","false"],
  ["entry-count","segment.entries!==(segment.nextSeq as number)-nextSeq","false"],
  ["segment-head","!hex(segment.head)","false"],
  ["segment-digest","!hex(segment.sha256)","false"],
  ["anchor-integer","!Number.isSafeInteger(anchor.seq)","false"],
  ["anchor-first","(anchor.seq as number)<nextSeq","false"],
  ["anchor-end","(anchor.seq as number)>=(segment.nextSeq as number)","false"],
  ["anchor-head","anchor.head!==segment.head","false"],
  ["endpoint-sequence","nextSeq!==seq","false"],
  ["endpoint-head","previousHead!==head","false"],
  ["captured-endpoint","previousHead!==head","previousHead!==context.head"],
  ["canonical-order",'import { canonicalJSON, sha256hex } from "./canonical.ts";','import { sha256hex } from "./canonical.ts";\nconst canonicalJSON=JSON.stringify;'],
  ["digest","digest:sha256hex(text)",'digest:sha256hex("bogus")'],
  ["immutable-result","Object.freeze({text,digest:sha256hex(text)})","({text,digest:sha256hex(text)})"],
] as const;
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"missing or ambiguous catalogue fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=execute();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 15\b/);console.log("caught checkpoint catalogue fault: "+name);}
  finally{writeFileSync(path,source);}
}
const entry="packages/sdk/src/index.ts",entrySource=readFileSync(entry,"utf8");
try{
  const damaged=entrySource.replace(/^export .*from "\.\/checkpoint-archives\.ts";\n/m,"");assert.notEqual(damaged,entrySource);writeFileSync(entry,damaged);
  const result=execute();assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stdout,/SDK exports archive catalogue/);assert.match(result.stdout,/tests 15\b/);console.log("caught checkpoint catalogue fault: SDK export");
}finally{writeFileSync(entry,entrySource);}
const restored=execute();assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All checkpoint catalogue faults caught; restored source passes");
