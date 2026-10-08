// Diagnostic only: unchanged definition-19 selected workload, not a performance gate.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {dirname,resolve,join} from "node:path";
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from "node:fs";
import {MUTATION_TESTS} from "../../evals/ci/mutation-stage.ts";
const directory=resolve(".sandbox/solanaut-1/checkpoint-profile/definition19");mkdirSync(directory,{recursive:true});
const environment={PATH:dirname(process.execPath)+":/usr/bin:/bin",LANG:"C.UTF-8",FUZZ_RUNS:"5000",FUZZ_SEED:"24713",NO_COLOR:"1"};
const args=["--cpu-prof","--cpu-prof-dir="+directory,"--test","--experimental-test-isolation=none",...MUTATION_TESTS];
const paths=["package.json","package-lock.json",...MUTATION_TESTS,...(readdirSync("packages/sdk/src",{recursive:true}) as string[]).filter(path=>path.endsWith(".ts")).map(path=>"packages/sdk/src/"+path)].sort();
const hashes=Object.fromEntries(paths.map(path=>[path,createHash("sha256").update(readFileSync(path)).digest("hex")]));
const manifest={purpose:"checkpoint preparation diagnostic; no performance qualification",base:spawnSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).stdout.trim(),node:process.version,definition:19,args,environment,hashes};
writeFileSync(join(directory,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
const result=spawnSync(process.execPath,args,{encoding:"utf8",env:environment,timeout:60000,maxBuffer:32*1024*1024});
writeFileSync(join(directory,"output.txt"),result.stdout+result.stderr);writeFileSync(join(directory,"result.json"),JSON.stringify({status:result.status,signal:result.signal,error:result.error?.message})+"\n");
if(paths.some(path=>createHash("sha256").update(readFileSync(path)).digest("hex")!==hashes[path]))throw new Error("diagnostic inputs changed");
console.log("Diagnostic output: "+directory+"; status="+result.status);process.exitCode=result.status===0?0:1;
