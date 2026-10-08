import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/archive.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/archive-stream.test.ts"],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL"});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["entry-hash","entry.hash !== hash","false"],
  ["immutable-entry","yield immutable(entry);","yield entry;"],
  ["immutable-descendants","for(const item of Object.values(value))immutable(item);",""],
  ["immutable-receipt","return immutable({ entries:","return ({ entries:"],
  ["close-on-cancellation","await handle.close()","void 0"],
  ["natural-source-check","before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs ||\n        after.nlink !== 1n || !named.isFile() || named.ino !== before.ino || named.dev !== before.dev","false"],
  ["head-pin","head !== expectedHead","false"],
  ["digest-pin","sha256 !== expectedDigest","false"],
  ["mutable-pin","head !== expectedHead","head !== options.expectedHead"],
  ["stream-entry","yield immutable(entry);","void 0;"],
  ["receipt-count","entries: nextSeq - firstSeq","entries: 0"],
] as const;
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"missing archive stream fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=run();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/tests 8\b/);console.log("caught archive stream fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All archive stream faults caught; restored source passes");
