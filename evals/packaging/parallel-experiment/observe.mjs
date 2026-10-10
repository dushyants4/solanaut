// Enforce the unchanged campaign limit around the entire experimental invocation.
import {spawnSync} from "node:child_process";
import {writeFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
const begin=performance.now();
const result=spawnSync(process.execPath,["evals/packaging/parallel-experiment.mjs"],{stdio:"inherit",timeout:300000});
writeFileSync("evals/packaging/parallel-experiment/termination.json",JSON.stringify({
  node:process.version,elapsedMs:performance.now()-begin,timeoutMs:300000,
  status:result.status,signal:result.signal,errorCode:result.error?.code??null,
},null,2)+"\n");
process.exitCode=result.status===0&&!result.error?0:1;
