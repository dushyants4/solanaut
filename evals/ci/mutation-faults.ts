import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const faults=[
  ["process-completion","mutation.ts","if(status!==0)","if(false)"],
  ["score-floor","mutation.ts","(detected+undetected)*80","(detected+undetected)*79"],
  ["group-floor","mutation.ts","if(group.detected*100<(group.detected+group.undetected)*80)","if(false)"],
  ["group-classification","mutation.ts","retained.has(path)","false"],
  ["group-valid-population","mutation.ts","group.present && group.detected+group.undetected===0","false"],
  ["source-inventory","mutation.ts",'throw new Error("mutation inventory differs")',"void 0"],
  ["source-content","mutation.ts","file.source!==source","false"],
  ["mutant-identity","mutation.ts","ids.has(mutant.id)","false"],
  ["status-completion","mutation.ts",'default: throw new Error("incomplete or excluded mutation status");',"default: detected++; break;"],
  ["valid-population","mutation.ts",'throw new Error("no valid mutation population")',"void 0"],
  ["location-boundary","mutation.ts","line<1","line<0"],
  ["staging-threshold","mutation-stage.ts","break:80","break:79"],
  ["staging-scope","mutation-stage.ts",'"base58.ts","classify.ts"','"classify.ts"'],
  ["checkpoint-scope","mutation-stage.ts",'"checkpoint.ts","checkpoint-archives.ts"','"checkpoint-archives.ts"'],
  ["catalogue-scope","mutation-stage.ts",'"checkpoint.ts","checkpoint-archives.ts"','"checkpoint.ts"'],
  ["checkpoint-tests","mutation-stage.ts",'"checkpoint","checkpoint-archives","malformed-replay"','"checkpoint-archives","malformed-replay"'],
  ["catalogue-tests","mutation-stage.ts",'"checkpoint","checkpoint-archives","malformed-replay"','"checkpoint","malformed-replay"'],
  ["malformed-history-tests","mutation-stage.ts",'"checkpoint","checkpoint-archives","malformed-replay"','"checkpoint","checkpoint-archives"'],
  ["working-tree-mutation","mutation-stage.ts","inPlace:false","inPlace:true"],
  ["prefix-scope","mutation-stage.ts",'"checkpoint-prefix.ts",',""],
  ["state-scope","mutation-stage.ts",'"checkpoint-state.ts",',""],
  ["signed-policy-scope","mutation-stage.ts",',"signed-policy.ts"',""],
  ["prefix-tests","mutation-stage.ts",',"checkpoint-prefix"',""],
  ["state-tests","mutation-stage.ts",',"checkpoint-state"',""],
  ["bundle-scope","mutation-stage.ts",',"checkpoint-bundle.ts"',""],
  ["bundle-tests","mutation-stage.ts",',"checkpoint-bundle"',""],
  ["envelope-scope","mutation-stage.ts",',"checkpoint-envelope.ts"',""],
  ["record-scope","mutation-stage.ts",',"record.ts"',""],
  ["publication-scope","mutation-stage.ts",',"checkpoint-publication.ts"',""],
  ["publication-tests","mutation-stage.ts",',"checkpoint-publication"',""],
  ["recovery-scope","mutation-stage.ts",',"checkpoint-recovery.ts"',""],
  ["recovery-tests","mutation-stage.ts",',"checkpoint-recovery"',""],
  ["owned-recovery-tests","mutation-stage.ts",',"checkpoint-owned-recovery"',""],
  ["archive-scope","mutation-stage.ts",',"archive.ts"',""],
  ["archive-tests","mutation-stage.ts",',"archive"',""],
  ["archive-anchor-tests","mutation-stage.ts",',"archive-anchor"',""],
  ["archive-stream-tests","mutation-stage.ts",',"archive-stream"',""],
  ["envelope-tests","mutation-stage.ts",',"checkpoint-envelope"',""],
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
    let damaged=original.replace(from,to);
    // Group floors imply the global floor; weaken both for the whole-floor trial.
    if(name==="score-floor")damaged=damaged.replace("(group.detected+group.undetected)*80","(group.detected+group.undetected)*79");
    if(name==="valid-population")damaged=damaged.replace("group.present && group.detected+group.undetected===0","false");
    writeFileSync(path,damaged); const changed=run();
    assert.equal(changed.status,1,changed.stdout+changed.stderr); assert.match(changed.stdout,/CI-2/);
    assert.match(changed.stdout,/tests 9\b/); console.log("caught mutation gate fault: "+name);
  } finally {writeFileSync(path,original);}
}
const restored=run(); assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All mutation report/staging faults caught; restored sources pass");
