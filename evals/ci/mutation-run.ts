// CI-2 definition 22: retain original/authentication group floors and actual supervision.
import { createHash } from "node:crypto";
import { copyFileSync, closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MUTATION_PATHS, MUTATION_TESTS, MUTATION_RUN_LIMIT_MS, stageMutation } from "./mutation-stage.ts";
import { freezeMutationInputs, completedMutation } from "./mutation-recovery.ts";
import { readSupervisedResult, type RunCommand, type RunTicket } from "../../tools/run-supervisor.ts";
const root=fileURLToPath(new URL("../../",import.meta.url)),hash=(bytes:Uint8Array|string)=>createHash("sha256").update(bytes).digest("hex");
const environment={PATH:dirname(process.execPath)+":/usr/bin:/bin",LANG:"C.UTF-8",FUZZ_RUNS:"5000",FUZZ_SEED:"25103",NO_COLOR:"1"};
function command(destination:string,baseline:boolean):RunCommand {
  return {command:process.execPath,args:baseline?["--test","--experimental-test-isolation=none",...MUTATION_TESTS]:[join(root,"node_modules/@stryker-mutator/core/bin/stryker.js"),"run","stryker.config.json"],cwd:destination,timeoutMs:MUTATION_RUN_LIMIT_MS,graceMs:5000,env:environment};
}
function save(directory:string,name:string,value:unknown) {
  const path=join(directory,name),fd=openSync(path,"wx",0o600);
  try {writeFileSync(fd,JSON.stringify(value,null,2)+"\n");fsyncSync(fd);}finally{closeSync(fd);}
  const parent=openSync(directory,"r");try{fsyncSync(parent);}finally{closeSync(parent);}
}
async function start(baseline:boolean) {
  const scratch=resolve(root,".sandbox/solanaut-1/mutation");mkdirSync(scratch,{recursive:true});
  const destination=mkdtempSync(join(scratch,"run-"));stageMutation(root,destination);
  const supervision=join(destination,"supervision");mkdirSync(supervision,{mode:0o700});
  for(const name of ["run-supervisor.ts","run-completion.ts"])copyFileSync(join(root,"tools",name),join(supervision,name));
  const supervisorHashes=Object.fromEntries(["run-supervisor.ts","run-completion.ts"].map(name=>[name,hash(readFileSync(join(supervision,name)))]));
  const binding=freezeMutationInputs(root,destination),cmd=command(destination,baseline);
  save(destination,"manifest.json",{definition:22,node:process.version,baseline,runLimitMs:MUTATION_RUN_LIMIT_MS,binding,tests:MUTATION_TESTS,environment,supervisorHashes,started:new Date().toISOString()});
  const frozen=await import(pathToFileURL(join(supervision,"run-supervisor.ts")).href) as typeof import("../../tools/run-supervisor.ts");
  const ticket=frozen.launchSupervisedRun(join(destination,"execution"),cmd,hash(readFileSync(join(destination,"manifest.json"))));
  save(destination,"ticket.json",ticket);console.log("Mutation run directory: "+destination);
  return {destination,ticket};
}
function finish(destination:string) {
  const bytes=readFileSync(join(destination,"manifest.json")),manifest=JSON.parse(bytes.toString("utf8"));
  if(manifest.definition!==22 || manifest.node!==process.version || typeof manifest.baseline!=="boolean" || manifest.runLimitMs!==MUTATION_RUN_LIMIT_MS || JSON.stringify(manifest.tests)!==JSON.stringify(MUTATION_TESTS) || JSON.stringify(manifest.environment)!==JSON.stringify(environment))throw new Error("mutation execution definition differs");
  for(const name of ["run-supervisor.ts","run-completion.ts"])if(hash(readFileSync(join(destination,"supervision",name)))!==manifest.supervisorHashes?.[name])throw new Error("frozen supervisor source changed");
  const ticket=JSON.parse(readFileSync(join(destination,"ticket.json"),"utf8")) as RunTicket;
  if(ticket.directory!==join(destination,"execution") || ticket.identity.inputHash!==hash(bytes) || ticket.identity.commandHash!==hash(JSON.stringify(command(destination,manifest.baseline))))throw new Error("mutation ticket binding differs");
  const sources=Object.fromEntries(MUTATION_PATHS.map(path=>[path,readFileSync(join(destination,path),"utf8")]));
  const summary=completedMutation(root,destination,manifest.binding,ticket,sources,manifest.baseline);
  if(manifest.baseline)console.log("Staged mutation baseline passes; no mutation score measured");
  else console.log(JSON.stringify(summary));
}
const args=process.argv.slice(2);
if(args.length===2 && args[0]==="--finish")finish(resolve(args[1]!));
else {
  if(!["","--baseline","--start","--start --baseline"].includes(args.join(" ")))throw new Error("usage: mutation-run.ts [--start] [--baseline] | --finish <run-directory>");
  const run=await start(args.includes("--baseline"));
  if(!args.includes("--start")) {
    const end=process.hrtime.bigint()+BigInt(MUTATION_RUN_LIMIT_MS+10_000)*1_000_000n;
    while(readSupervisedResult(run.ticket)===null) {
      if(process.hrtime.bigint()>end)throw new Error("supervised mutation completion missing");
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    finish(run.destination);
  } else console.log("Started only; inspect execution/output.txt and use --finish after actual completion.");
}
