import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="package.json",source=readFileSync(path,"utf8"),site="node --test --test-concurrency=1 packages/sdk/test";
const run=()=>spawnSync(process.execPath,["--test","evals/ci/ordinary-serial.test.ts"],{encoding:"utf8",timeout:10000});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);assert.equal(source.split(site).length,2);
try{
  writeFileSync(path,source.replace(site,"node --test packages/sdk/test"));
  const result=run();assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/root command ran test files concurrently/);assert.match(result.stdout,/tests 1\b/);
  console.log("caught ordinary serial fault: omitted leading scheduling option");
}finally{writeFileSync(path,source);}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("Ordinary serial fault caught; restored root command passes");
