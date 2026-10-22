import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
const run=()=>spawnSync(process.execPath,["--test","evals/ci/bite-partitions.test.ts","evals/ci/bite.test.ts"],{encoding:"utf8",timeout:15000});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["duplicate-partition","evals/ci/bite.ts","const index=Number(args[1])-1","const index=0"],
  ["missing-tail","evals/ci/bite.ts","return partitioned.slice(start,end);","return partitioned.slice(start,end-1);"],
  ["own-job-extra","evals/ci/bite.ts",'export const OWN_JOB: readonly string[] = ["packaging/faults.ts"];','export const OWN_JOB: readonly string[] = ["packaging/faults.ts", "sdk/request-faults.ts"];'],
  ["own-job-unpartitioned","evals/ci/bite.ts","const partitioned=CAMPAIGNS.filter(path=>!OWN_JOB.includes(path));","const partitioned=[...CAMPAIGNS];"],
  ["shard-skips-faults","evals/packaging/faults.ts","return all.filter((_, position) => position % count === index);","return all.filter((_, position) => position % count === index && position < 140);"],
  ["list-hides-faults","evals/packaging/faults.ts","for (const fault of selected) console.log(fault.name);","for (const fault of selected.slice(1)) console.log(fault.name);"],
  ["workflow-missing-shard",".github/workflows/ci.yml","shard: [1, 2, 3, 4]","shard: [1, 2, 3]"],
  ["workflow-shard-command",".github/workflows/ci.yml","--shard ${{ matrix.shard }}/4","--shard 1/4"],
  ["workflow-skip-package-job",".github/workflows/ci.yml","name: installed package fault injections (${{ matrix.shard }})","name: installed package fault injections (${{ matrix.shard }})\n    if: false"],
  ["invalid-partition","evals/ci/bite.ts","/^[123]$/","/^[1234]$/"],
  ["implicit-subset","evals/ci/bite.ts","if(args.length===0)return [...CAMPAIGNS];","if(args.length===0)return CAMPAIGNS.slice(1);"],
  ["failure-loss","evals/ci/bite.ts","if (result !== 0) failed.push(path);","if (false) failed.push(path);"],
  ["restoration-loss","evals/ci/bite.ts","if (fingerprint() !== original)","if (false)"],
  ["workflow-missing-partition",".github/workflows/ci.yml","partition: [1, 2, 3]","partition: [1, 2]"],
  ["workflow-fingerprint","evals/ci/bite.ts",'hash.update(readFileSync(join(directory,".github/workflows",path)));',"void 0;"],
  ["workflow-deadline",".github/workflows/ci.yml","name: maintained fault campaigns (${{ matrix.partition }})\n    runs-on: ubuntu-24.04\n    timeout-minutes: 15","name: maintained fault campaigns (${{ matrix.partition }})\n    runs-on: ubuntu-24.04\n    timeout-minutes: 150"],
  ["workflow-cancel-failures",".github/workflows/ci.yml","strategy:\n      fail-fast: false\n      matrix:\n        partition: [1, 2, 3]","strategy:\n      fail-fast: true\n      matrix:\n        partition: [1, 2, 3]"],
  ["workflow-skip-job",".github/workflows/ci.yml","name: maintained fault campaigns (${{ matrix.partition }})","name: maintained fault campaigns (${{ matrix.partition }})\n    if: false"],
  ["workflow-ignore-failure",".github/workflows/ci.yml","name: maintained fault campaigns (${{ matrix.partition }})","name: maintained fault campaigns (${{ matrix.partition }})\n    continue-on-error: true"],
] as const;
for(const [name,path,before,after] of faults){
  const source=readFileSync(path,"utf8");assert.equal(source.split(before).length,2,"missing or ambiguous partition fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const changed=run();assert.equal(changed.status,1,changed.stdout+changed.stderr);assert.equal(changed.signal,null);assert.equal(changed.error,undefined);assert.match(changed.stdout,/tests 9\b/);console.log("caught fault partition fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All fault partition faults caught; restored sources pass");
