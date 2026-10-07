import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const faults=[
  ["process-completion","mutation.ts","if(status!==0)","if(false)"],
  ["score-floor","mutation.ts","(detected+undetected)*80","(detected+undetected)*79"],
  ["source-inventory","mutation.ts",'throw new Error("mutation inventory differs")',"void 0"],
  ["source-content","mutation.ts","file.source!==source","false"],
  ["mutant-identity","mutation.ts","ids.has(mutant.id)","false"],
  ["status-completion","mutation.ts",'default: throw new Error("incomplete or excluded mutation status");',"default: detected++; break;"],
  ["valid-population","mutation.ts",'throw new Error("no valid mutation population")',"void 0"],
  ["location-boundary","mutation.ts","line<1","line<0"],
  ["staging-threshold","mutation-stage.ts","break:80","break:79"],
  ["staging-scope","mutation-stage.ts",'"base58.ts","classify.ts"','"classify.ts"'],
  ["working-tree-mutation","mutation-stage.ts","inPlace:false","inPlace:true"],
  ["staging-execution","mutation-stage.ts","--test-isolation=none ",""],
  ["whole-run-resource-limit","mutation-stage.ts","MUTATION_RUN_LIMIT_MS=43_200_000","MUTATION_RUN_LIMIT_MS=43_199_999"],
  ["per-mutant-timeout","mutation-stage.ts","timeoutMS:10_000","timeoutMS:1"],
] as const;
const paths=["evals/ci/mutation.test.ts","evals/ci/mutation-stage.test.ts"];
const run=()=>spawnSync(process.execPath,["--test",...paths],{encoding:"utf8",timeout:30_000});
const baseline=run(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,file,from,to] of faults) {
  const path="evals/ci/"+file, original=readFileSync(path,"utf8");
  assert.equal(original.split(from).length,2,"missing or ambiguous site: "+name);
  try {
    writeFileSync(path,original.replace(from,to)); const changed=run();
    assert.equal(changed.status,1,changed.stdout+changed.stderr); assert.match(changed.stdout,/CI-2/);
    assert.match(changed.stdout,/tests 8\b/); console.log("caught mutation gate fault: "+name);
  } finally {writeFileSync(path,original);}
}
const restored=run(); assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All mutation report/staging faults caught; restored sources pass");
