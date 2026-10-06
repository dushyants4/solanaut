// CI-2 definition 1: full-file default Stryker mutations, without score exclusions.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MUTATION_TESTS, stageMutation } from "./mutation-stage.ts";
import { requireMutationReport } from "./mutation.ts";
const root=fileURLToPath(new URL("../../",import.meta.url));
if(process.argv.length!==2 && !(process.argv.length===3 && process.argv[2]==="--baseline")) throw new Error("usage: mutation-run.ts [--baseline]");
const scratch=resolve(root,".sandbox/solanaut-1/mutation"); mkdirSync(scratch,{recursive:true});
const destination=mkdtempSync(join(scratch,"run-")), sources=stageMutation(root,destination);
const hashes=Object.fromEntries(Object.entries(sources).map(([path,text])=>[path,createHash("sha256").update(text).digest("hex")]));
const inputs=["package.json","stryker.config.json",...(readdirSync(join(destination,"packages"),{recursive:true}) as string[]).filter(path=>path.endsWith(".ts") || path.endsWith("package.json")).map(path=>"packages/"+path)].sort();
const inputHashes=Object.fromEntries(inputs.map(path=>[path,createHash("sha256").update(readFileSync(join(destination,path))).digest("hex")]));
const lockHash=createHash("sha256").update(readFileSync(join(root,"package-lock.json"))).digest("hex");
writeFileSync(join(destination,"manifest.json"),JSON.stringify({definition:1,node:process.version,hashes,inputHashes,lockHash,tests:MUTATION_TESTS,started:new Date().toISOString()},null,2)+"\n");
console.log("Mutation run directory: "+destination);
const env:NodeJS.ProcessEnv={...process.env,FUZZ_RUNS:"5000",FUZZ_SEED:"23063"}; delete env.NODE_TEST_CONTEXT;
const baseline=process.argv[2]==="--baseline";
const child=spawn(process.execPath,baseline?["--test",...MUTATION_TESTS]:[join(root,"node_modules/@stryker-mutator/core/bin/stryker.js"),"run","stryker.config.json"],{cwd:destination,stdio:"inherit",env,detached:true});
let hardStop:NodeJS.Timeout|undefined;
const stop=()=> {
  try {process.kill(-child.pid!,"SIGTERM");} catch { /* Already stopped. */ }
  hardStop??=setTimeout(()=> {try {process.kill(-child.pid!,"SIGKILL");} catch { /* Already stopped. */ }},5_000);
};
process.once("SIGTERM",stop); process.once("SIGINT",stop);
const deadline=setTimeout(stop,7_200_000);
const status=await new Promise<number|null>((resolve,reject)=> {child.once("error",reject); child.once("exit",code=>resolve(code));});
clearTimeout(deadline); clearTimeout(hardStop); process.removeListener("SIGTERM",stop); process.removeListener("SIGINT",stop);
if(Object.entries(sources).some(([path,text])=>readFileSync(join(root,path),"utf8")!==text)) throw new Error("working mutation source changed during run");
if(baseline) {
  if(status!==0) throw new Error("staged mutation baseline failed");
  console.log("Staged mutation baseline passes; no mutation score measured");
} else {
  const report=JSON.parse(readFileSync(join(destination,"reports/mutation.json"),"utf8"));
  const summary=requireMutationReport(report,sources,status);
  writeFileSync(join(destination,"summary.json"),JSON.stringify({definition:1,...summary,hashes,completed:new Date().toISOString()},null,2)+"\n");
  console.log(JSON.stringify(summary));
}
