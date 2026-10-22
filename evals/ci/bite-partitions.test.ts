import {strict as assert} from "node:assert";
import {test} from "node:test";
import {spawnSync} from "node:child_process";
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {join,resolve} from "node:path";
import * as bite from "./bite.ts";
const select=(args:string[]):readonly string[]=>{
  assert.equal(typeof Reflect.get(bite,"selectCampaigns"),"function");
  return Reflect.apply(Reflect.get(bite,"selectCampaigns"),undefined,[args]);
};
test("CI-1: fixed fault partitions and the long campaigns' own job cover the maintained inventory exactly once",()=>{
  const partitions=[1,2,3].map(value=>select(["--partition",String(value)]));
  assert.deepEqual(bite.OWN_JOB,["packaging/faults.ts"]);
  assert.ok(bite.OWN_JOB.every(path=>(bite.CAMPAIGNS as readonly string[]).includes(path)));
  assert.deepEqual(partitions.flat(),bite.CAMPAIGNS.filter(path=>!bite.OWN_JOB.includes(path)));
  assert.equal(new Set([...partitions.flat(),...bite.OWN_JOB]).size,bite.CAMPAIGNS.length);
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
test("CI-1: the package fault job runs every shard, and its shards cover every fault exactly once",()=>{
  const text=readFileSync(".github/workflows/ci.yml","utf8"),body=text.match(/\n  package-faults:\n([\s\S]*?)(?=\n  [a-z][a-z-]*:\n|$)/)?.[1];
  assert.ok(body,"missing package fault workflow job");
  assert.deepEqual([...body.matchAll(/fail-fast: ([^\n]+)/g)].map(match=>match[1]),["false"]);
  const literal=body.match(/shard: (\[[^\n]+\])/)?.[1];assert.ok(literal);
  assert.deepEqual(JSON.parse(literal),[1,2,3,4]);
  assert.match(body,/npm run test:package:faults -- --shard \$\{\{ matrix\.shard \}\}\/4\n/);
  assert.match(body,/\n    timeout-minutes: 15\n/);
  assert.doesNotMatch(body,/^\s+(?:if|continue-on-error):/m);
  const list=(...args:string[])=>{
    const result=spawnSync(process.execPath,["evals/packaging/faults.ts","--list",...args],{encoding:"utf8",timeout:15000});
    assert.equal(result.status,0,result.stdout+result.stderr);
    return result.stdout.trim().split("\n");
  };
  const all=list();
  assert.equal(all.length,144);assert.equal(new Set(all).size,all.length);
  const shards=[1,2,3,4].map(shard=>list("--shard",`${shard}/4`));
  assert.ok(shards.every(names=>names.length>0));
  assert.deepEqual(shards.flat().sort(),[...all].sort());
  for(const args of [["--shard","0/4"],["--shard","5/4"],["--shard","1/0"],["--shard","1"],["--shard","a/4"],["--shard","1/4","extra"],["--unknown"]]){
    const refused=spawnSync(process.execPath,["evals/packaging/faults.ts","--list",...args],{encoding:"utf8",timeout:15000});
    assert.equal(refused.status,1,args.join(" "));
  }
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
