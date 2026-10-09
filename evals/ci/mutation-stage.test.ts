import { strict as assert } from "node:assert";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { MUTATION_PATHS, MUTATION_TESTS, stageMutation } from "./mutation-stage.ts";
import * as staging from "./mutation-stage.ts";
test("CI-2: mutation staging copies only the frozen inputs and tests execute its changed source",()=> {
  mkdirSync(".sandbox/solanaut-1/mutation",{recursive:true});
  const root=resolve("."), destination=mkdtempSync(resolve(".sandbox/solanaut-1/mutation/stage-test-"));
  const path="packages/sdk/src/policy.ts", original=readFileSync(path,"utf8");
  try {
    const sources=stageMutation(root,destination);
    assert.equal(Reflect.get(staging,"MUTATION_RUN_LIMIT_MS"),43_200_000);
    assert.deepEqual(MUTATION_PATHS,["base58","classify","guard","message","pda","policy","state","tables","checkpoint","checkpoint-archives","checkpoint-prefix","checkpoint-state","signed-policy","checkpoint-bundle","checkpoint-envelope","record","checkpoint-publication","checkpoint-recovery","archive","checkpoint-errors","request-index","request-index-publication"].map(name=>"packages/sdk/src/"+name+".ts"));
    assert.deepEqual(MUTATION_TESTS,["adapters","admission","boundary-validation","classify","decode","drain.battery","durable","inspect","keel","latch-c","ownership","pin-table","policy","request-identity","sensor.battery","signed-policy","signing-history","storage-failures","checkpoint","checkpoint-archives","malformed-replay","checkpoint-prefix","checkpoint-state","checkpoint-bundle","checkpoint-envelope","checkpoint-publication","checkpoint-recovery","checkpoint-owned-recovery","archive","archive-anchor","archive-stream","replay-stream","record-loading","report-replay","request-index","redeem-replay","request-index-publication","request-index-lookup","owned-request-admission"].map(name=>"packages/sdk/test/"+name+".test.ts"));
    assert.deepEqual(Object.keys(sources),MUTATION_PATHS);
    assert.deepEqual(readdirSync(destination).sort(),["node_modules","package.json","packages","stryker.config.json"]);
    const config=JSON.parse(readFileSync(join(destination,"stryker.config.json"),"utf8"));
    assert.deepEqual(config.mutate,MUTATION_PATHS); assert.equal(config.thresholds.break,80);
    assert.equal(config.inPlace,false); assert.equal(config.ignoreStatic,false); assert.equal(config.coverageAnalysis,"off");
    assert.equal(config.concurrency,4); assert.equal(config.timeoutMS,10_000); assert.equal(config.timeoutFactor,1.5);
    assert.equal(config.commandRunner.command,"node --test --test-isolation=none "+MUTATION_TESTS.join(" "));
    assert.deepEqual(config.reporters,["clear-text","progress-append-only","json"]);
    assert.equal(config.mutator,undefined); assert.equal(config.incremental,undefined);
    const env={...process.env}; delete env.NODE_TEST_CONTEXT;
    const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/policy.test.ts"],{cwd:destination,encoding:"utf8",timeout:15_000,env});
    const baseline=run(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
    assert.equal(original.split("if (problems.length)").length,2);
    writeFileSync(join(destination,path),original.replace("if (problems.length)","if (false)"));
    const changed=run(); assert.equal(changed.status,1,changed.stdout+changed.stderr);
    assert.match(changed.stdout,/fail [1-9]/); assert.equal(readFileSync(path,"utf8"),original);
  } finally {rmSync(destination,{recursive:true,force:true});}
});
