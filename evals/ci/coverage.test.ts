import { strict as assert } from "node:assert";
import { test } from "node:test";
import { requireCoverage, requireTestProcess, type CoverageFile } from "./coverage.ts";
const good = (): CoverageFile[] => [
  {path:"packages/sdk/src/guard.ts",statements:{covered:95,total:100},branches:{covered:85,total:100}},
  {path:"packages/sdk/src/base58.ts",statements:{covered:95,total:100},branches:{covered:95,total:100}},
  {path:"apps/signer/src/core.ts",statements:{covered:95,total:100},branches:{covered:90,total:100}},
  {path:"apps/firewall/src/filter.ts",statements:{covered:95,total:100},branches:{covered:90,total:100}},
];
const inventory = good().map(file=>file.path);
test("CI-2: failed or missing test-process completion cannot qualify coverage",()=> {
  assert.doesNotThrow(()=>requireTestProcess(0));
  for(const status of [1,2,null]) assert.throws(()=>requireTestProcess(status),/test process/);
});
test("CI-2: exact statement and branch floors pass without rounding", () => {
  assert.doesNotThrow(()=>requireCoverage(good(),inventory));
  for (const [index,metric] of [[0,"statements"],[1,"branches"],[2,"statements"],[2,"branches"],[3,"statements"],[3,"branches"]] as const) {
    const files=good(); files[index]![metric].covered--;
    assert.throws(()=>requireCoverage(files,inventory),/coverage/i);
  }
});
test("CI-2: a critical branch deficit fails even when aggregate totals pass", () => {
  const files=good(); files[0]!.branches.covered=84; files[1]!.branches.covered=100;
  assert.throws(()=>requireCoverage(files,inventory),/guard.ts/);
  files[0]!.branches.covered=100; files[2]!.branches.covered=84;
  assert.throws(()=>requireCoverage(files,inventory),/core.ts/);
  const firewall=good();firewall[3]!.branches.covered=84;
  const helper={path:"apps/firewall/src/helper.ts",statements:{covered:1000,total:1000},branches:{covered:1000,total:1000}};
  assert.throws(()=>requireCoverage([...firewall,helper],[...inventory,helper.path]),/filter.ts/);
  for(const name of ["checkpoint.ts","checkpoint-archives.ts","checkpoint-prefix.ts","checkpoint-state.ts","checkpoint-bundle.ts","checkpoint-envelope.ts","checkpoint-publication.ts","checkpoint-recovery.ts","archive.ts","request-index.ts","request-index-publication.ts"]){
    const checkpoint = {path:"packages/sdk/src/"+name,statements:{covered:100,total:100},branches:{covered:84,total:100}};
    const complete = good(); complete[1]!.branches.covered=100;
    complete[0]!.branches.covered=100;
    assert.throws(()=>requireCoverage([...complete,checkpoint],[...inventory,checkpoint.path]),(error:unknown)=>error instanceof Error && error.message.includes(name));
  }
});
test("CI-2: missing, extra and duplicate files cannot disappear from coverage", () => {
  for(const files of [good().slice(1),[...good(),good()[0]!],[...good(),{...good()[0]!,path:"packages/sdk/src/extra.ts"}]]) assert.throws(()=>requireCoverage(files,inventory),/inventory/);
  assert.throws(()=>requireCoverage(good(),[...inventory,inventory[0]!]),/inventory/);
});
test("CI-2: malformed and empty execution counts fail closed", () => {
  for(const value of [-1,NaN,Infinity,0.5,101]) {
    const files=good(); files[0]!.statements.covered=value;
    assert.throws(()=>requireCoverage(files,inventory),/counts/);
  }
  const files=good(); for(const file of files) file.statements={covered:0,total:0};
  assert.throws(()=>requireCoverage(files,inventory),/statements/);
});
