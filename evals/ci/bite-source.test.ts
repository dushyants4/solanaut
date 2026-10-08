import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sourceFingerprint } from "./bite.ts";
test("CI-1: restoration fingerprints include operator TypeScript tools",()=>{
  mkdirSync(".sandbox/solanaut-1",{recursive:true});
  const directory=mkdtempSync(".sandbox/solanaut-1/bite-source-");
  try {
    for(const root of ["packages","apps","evals","tools"]) mkdirSync(join(directory,root));
    mkdirSync(join(directory,".github/workflows"),{recursive:true});
    const path=join(directory,"tools/run.ts");writeFileSync(path,"original");
    const original=sourceFingerprint(directory);writeFileSync(path,"fault");
    assert.notEqual(sourceFingerprint(directory),original);
    writeFileSync(path,"original");assert.equal(sourceFingerprint(directory),original);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
