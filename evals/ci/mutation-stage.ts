import { copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
// Whole-run resource containment, distinct from per-mutant test timeouts and score floors.
export const MUTATION_RUN_LIMIT_MS=43_200_000;
export const MUTATION_PATHS=["base58.ts","classify.ts","guard.ts","message.ts","pda.ts","policy.ts","state.ts","tables.ts","checkpoint.ts","checkpoint-archives.ts","checkpoint-prefix.ts","checkpoint-state.ts","signed-policy.ts","checkpoint-bundle.ts","checkpoint-envelope.ts","record.ts","checkpoint-publication.ts","checkpoint-recovery.ts","archive.ts","checkpoint-errors.ts","request-index.ts","request-index-publication.ts"].map(name=>"packages/sdk/src/"+name);
export const MUTATION_TESTS=["adapters","admission","boundary-validation","classify","decode","drain.battery","durable","inspect","keel","latch-c","ownership","pin-table","policy","request-identity","sensor.battery","signed-policy","signing-history","storage-failures","checkpoint","checkpoint-archives","malformed-replay","checkpoint-prefix","checkpoint-state","checkpoint-bundle","checkpoint-envelope","checkpoint-publication","checkpoint-recovery","checkpoint-owned-recovery","archive","archive-anchor","archive-stream","replay-stream","record-loading","report-replay","request-index","redeem-replay","request-index-publication","request-index-lookup","owned-request-admission","owned-control-request"].map(name=>"packages/sdk/test/"+name+".test.ts");
function tree(root:string,path:string):string[] {
  return (readdirSync(join(root,path),{recursive:true}) as string[]).filter(name=>name.endsWith(".ts")).map(name=>path+"/"+name);
}
export function stageMutation(root:string,destination:string):Record<string,string> {
  const paths=["package.json","packages/sdk/package.json",...tree(root,"packages/sdk/src"),...tree(root,"packages/sdk/bin"),...tree(root,"packages/sdk/test/support"),...MUTATION_TESTS];
  const sources=Object.fromEntries(MUTATION_PATHS.map(path=>[path,readFileSync(join(root,path),"utf8")]));
  for(const path of paths) {
    if(!lstatSync(join(root,path)).isFile()) throw new Error("mutation staging requires regular files");
    const target=join(destination,path); mkdirSync(dirname(target),{recursive:true}); copyFileSync(join(root,path),target);
  }
  symlinkSync(join(root,"node_modules"),join(destination,"node_modules"),"dir");
  writeFileSync(join(destination,"stryker.config.json"),JSON.stringify({
    mutate:MUTATION_PATHS,testRunner:"command",commandRunner:{command:"node --test --test-isolation=none "+MUTATION_TESTS.join(" ")},
    coverageAnalysis:"off",concurrency:4,timeoutMS:10_000,timeoutFactor:1.5,
    reporters:["clear-text","progress-append-only","json"],jsonReporter:{fileName:"reports/mutation.json"},
    thresholds:{high:80,low:80,break:80},ignoreStatic:false,inPlace:false,
    tempDirName:".stryker-tmp",cleanTempDir:false,allowConsoleColors:false,
  },null,2)+"\n");
  return sources;
}
