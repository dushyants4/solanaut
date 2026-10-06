import { strict as assert } from "node:assert";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("CI-2: explicit hook records real SDK execution with statement and branch maps", () => {
  const directory=mkdtempSync(join(tmpdir(),"solanaut-coverage-probe-"));
  try {
    const result=spawnSync(process.execPath,["--import","./evals/ci/coverage-hook.ts","--input-type=module","-e","import {encodeBase58} from './packages/sdk/src/base58.ts'; if(encodeBase58(new Uint8Array([0,1]))!=='12') process.exitCode=1;"],{encoding:"utf8",timeout:5000,env:{...process.env,SOLANAUT_COVERAGE_DIR:directory}});
    assert.equal(result.status,0,result.stderr);
    const reports=readdirSync(directory); assert.equal(reports.length,1,"hook must persist execution evidence");
    const report=JSON.parse(readFileSync(join(directory,reports[0]!),"utf8"));
    const coverage=report["packages/sdk/src/base58.ts"];
    assert.ok(coverage); assert.ok(Object.keys(coverage.statementMap).length>1);
    assert.ok(Object.values(coverage.s).some(value=>Number(value)>0));
    assert.ok(Object.keys(coverage.branchMap).length>0);
    assert.ok(!report["evals/ci/coverage-hook.ts"],"test tooling is outside product coverage");
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
