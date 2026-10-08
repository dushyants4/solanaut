import {strict as assert} from "node:assert";
import {test} from "node:test";
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {join,resolve} from "node:path";
import * as bite from "./bite.ts";
const select=(args:string[]):readonly string[]=>{
  assert.equal(typeof Reflect.get(bite,"selectCampaigns"),"function");
  return Reflect.apply(Reflect.get(bite,"selectCampaigns"),undefined,[args]);
};
test("CI-1: fixed fault partitions cover the maintained inventory exactly once",()=>{
  const partitions=[1,2,3].map(value=>select(["--partition",String(value)]));
  assert.deepEqual(partitions.flat(),[...bite.CAMPAIGNS]);
  assert.equal(new Set(partitions.flat()).size,bite.CAMPAIGNS.length);
  assert.ok(partitions.every(paths=>paths.length>0));
  assert.ok(Math.max(...partitions.map(paths=>paths.length))-Math.min(...partitions.map(paths=>paths.length))<=1);
  assert.deepEqual(select([]),[...bite.CAMPAIGNS]);
});
test("CI-1: malformed partition arguments cannot silently omit campaigns",()=>{
  for(const args of [["--partition"],["--partition","0"],["--partition","4"],["--partition","1.5"],["--partition","01"],["--partition","1","extra"],["--unknown","1"]])assert.throws(()=>select(args),/partition/);
});
test("CI-1: workflow requires every fixed partition with the existing restoration runner",()=>{
  const text=readFileSync(".github/workflows/ci.yml","utf8"),body=text.match(/\n  bite:\n([\s\S]*?)(?=\n  [a-z][a-z-]*:\n|$)/)?.[1];
  assert.ok(body,"missing fault workflow job");
  assert.deepEqual([...body.matchAll(/fail-fast: ([^\n]+)/g)].map(match=>match[1]),["false"]);
  const literal=body.match(/partition: (\[[^\n]+\])/)?.[1];assert.ok(literal);
  assert.deepEqual(JSON.parse(literal),[1,2,3]);
  assert.match(body,/npm run test:bite -- --partition \$\{\{ matrix\.partition \}\}/);
  assert.match(body,/\n    timeout-minutes: 15\n/);
  assert.doesNotMatch(body,/^\s+(?:if|continue-on-error):/m);
});
test("CI-1: partition execution retains failures and stops on non-restoring sources",()=>{
  for(const partition of [1,2,3]){
    const args=["--partition",String(partition)],paths=select(args),seen:string[]=[];
    const result=Reflect.apply(bite.executeCampaigns,undefined,[(path:string)=>{seen.push(path);return path===paths[0]?1:0;},()=>"restored",args]);
    assert.deepEqual(seen,paths);assert.equal(result.ok,false);assert.deepEqual(result.failed,[paths[0]]);assert.deepEqual(result.skipped,[]);
    let source="original";
    const damaged=Reflect.apply(bite.executeCampaigns,undefined,[()=>{source="changed";return 0;},()=>source,args]);
    assert.equal(damaged.ok,false);assert.deepEqual(damaged.failed,[paths[0]]);assert.deepEqual(damaged.skipped,paths.slice(1));
  }
});
test("CI-1: workflow-restoration monitoring covers the partition configuration",()=>{
  mkdirSync(".sandbox/solanaut-1/bite-partitions",{recursive:true});
  const root=mkdtempSync(resolve(".sandbox/solanaut-1/bite-partitions/fingerprint-"));
  try{
    for(const path of ["packages","apps","evals","tools",".github/workflows"])mkdirSync(join(root,path),{recursive:true});
    const file=join(root,".github/workflows/ci.yml");writeFileSync(file,"partition: [1, 2, 3]\n");
    const original=bite.sourceFingerprint(root);writeFileSync(file,"partition: [1, 2]\n");
    assert.notEqual(bite.sourceFingerprint(root),original);
    writeFileSync(file,"partition: [1, 2, 3]\n");assert.equal(bite.sourceFingerprint(root),original);
    rmSync(join(root,".github"),{recursive:true});assert.throws(()=>bite.sourceFingerprint(root),/ENOENT/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
