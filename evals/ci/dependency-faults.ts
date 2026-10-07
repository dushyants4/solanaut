import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const require=createRequire(import.meta.url),client=createRequire(require.resolve("typed-rest-client/package.json"));
const execute=()=>spawnSync(process.execPath,["--test","evals/ci/dependency.test.ts"],{encoding:"utf8",timeout:30_000});
const baseline=execute();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["scoped-pin","package.json",'"qs": "6.16.0"','"qs": "6.15.1"'],
  ["installed-version",client.resolve("qs/package.json"),'"version": "6.16.0"','"version": "6.15.1"'],
  ["constructor-guard",client.resolve("qs/lib/utils.js"),"typeof obj.constructor.isBuffer === 'function'","obj.constructor.isBuffer"],
  ["comma-null-guard",client.resolve("qs/lib/stringify.js"),"return v == null ? v : encoder(v);","return encoder(v);"],
] as const;
for(const [name,path,before,after] of faults){
  const original=readFileSync(path,"utf8");assert.equal(original.split(before).length,2,name);
  try{
    writeFileSync(path,original.replace(before,after));const result=execute();
    assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);
    console.log("caught dependency fault: "+name);
  }finally{writeFileSync(path,original);}
  assert.equal(readFileSync(path,"utf8"),original);
}
const restored=execute();assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All dependency faults caught; installed bytes restored and tests pass");
