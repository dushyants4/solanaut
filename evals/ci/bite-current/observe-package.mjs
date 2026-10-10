// Diagnostic replay of the maintained runner's exact package invocation.
// It records process termination; it does not change the campaign or its limit.
import {spawnSync} from "node:child_process";
import {writeFileSync} from "node:fs";
import {performance} from "node:perf_hooks";

const started=new Date().toISOString(),begin=performance.now();
const result=spawnSync(process.execPath,["evals/packaging/faults.ts"],{
  stdio:"inherit",timeout:300_000,
});
writeFileSync("evals/ci/bite-current/package-termination.json",JSON.stringify({
  node:process.version,started,finished:new Date().toISOString(),
  elapsedMs:performance.now()-begin,timeoutMs:300_000,
  status:result.status,signal:result.signal,errorCode:result.error?.code??null,
},null,2)+"\n");
process.exitCode=result.status===0&&!result.error?0:1;
