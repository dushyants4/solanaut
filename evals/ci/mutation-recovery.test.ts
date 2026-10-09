import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { freezeMutationInputs, verifyMutationInputs, completedMutation } from "./mutation-recovery.ts";
import { launchSupervisedRun, readSupervisedResult, type RunTicket } from "../../tools/run-supervisor.ts";
import {stopSupervisedRun} from "../../tools/stop-supervised-run.ts";
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture() {
  mkdirSync(".sandbox/solanaut-1/mutation",{recursive:true});const base=resolve(mkdtempSync(".sandbox/solanaut-1/mutation/recovery-test-")),root=join(base,"root"),stage=join(base,"stage");
  const sources={"packages/sdk/src/policy.ts":"export const value=1;\n"};
  for(const directory of [root,stage])for(const [path,text] of Object.entries({...sources,"package.json":"{}\n","packages/sdk/package.json":"{}\n","packages/sdk/test/policy.test.ts":"fixture test\n"})) {mkdirSync(dirname(join(directory,path)),{recursive:true});writeFileSync(join(directory,path),text);}
  writeFileSync(join(root,"package-lock.json"),"fixture lock\n");writeFileSync(join(stage,"stryker.config.json"),"{}\n");
  mkdirSync(join(stage,"reports"));const report={schemaVersion:"1",files:{"packages/sdk/src/policy.ts":{language:"typescript",source:sources["packages/sdk/src/policy.ts"],mutants:Array.from({length:10},(_,id)=>({id:String(id),mutatorName:"ArithmeticOperator",replacement:"2",location:{start:{line:1,column:20},end:{line:1,column:21}},status:id<8?"Killed":"Survived"}))}}};
  writeFileSync(join(stage,"reports/mutation.json"),JSON.stringify(report));return {base,root,stage,sources};
}
async function finished(ticket:RunTicket) {const end=Date.now()+5000;while(readSupervisedResult(ticket)===null && Date.now()<end)await sleep(20);assert.notEqual(readSupervisedResult(ticket),null);}
test("CI-2: supervised completion qualifies only the bound complete synthetic mutation fixture",async()=>{
  const f=fixture();
  try {
    const binding=freezeMutationInputs(f.root,f.stage);assert.doesNotThrow(()=>verifyMutationInputs(f.root,f.stage,binding));
    const ticket=launchSupervisedRun(join(f.stage,"execution"),{command:process.execPath,args:["-e","process.exit(0)"],cwd:f.stage,timeoutMs:5000,graceMs:100},"a".repeat(64));await finished(ticket);
    assert.deepEqual(completedMutation(f.root,f.stage,binding,ticket,f.sources,false),{detected:8,undetected:2,invalid:0,total:10,score:80});
    assert.deepEqual(completedMutation(f.root,f.stage,binding,ticket,f.sources,true),{baseline:true});
    const reportPath=join(f.stage,"reports/mutation.json"),report=JSON.parse(readFileSync(reportPath,"utf8"));report.files["packages/sdk/src/policy.ts"].mutants[7].status="Survived";writeFileSync(reportPath,JSON.stringify(report));
    assert.throws(()=>completedMutation(f.root,f.stage,binding,ticket,f.sources,false),/below/);
    writeFileSync(join(f.stage,"stryker.config.json"),"changed");
    assert.throws(()=>completedMutation(f.root,f.stage,binding,ticket,f.sources,true));
  } finally {rmSync(f.base,{recursive:true,force:true});}
});
test("CI-2: an extra staged input cannot silently enter the frozen population",()=>{
  const f=fixture();
  try {writeFileSync(join(f.stage,"packages/sdk/src/extra.ts"),"extra");assert.throws(()=>freezeMutationInputs(f.root,f.stage),/inventory/);}
  finally {rmSync(f.base,{recursive:true,force:true});}
});
test("CI-2: every copied source, test, package, configuration and lock input remains bound",()=>{
  const f=fixture();
  try {
    const binding=freezeMutationInputs(f.root,f.stage);
    for(const [directory,path] of [[f.stage,"packages/sdk/src/policy.ts"],[f.stage,"packages/sdk/test/policy.test.ts"],[f.stage,"package.json"],[f.stage,"stryker.config.json"],[f.root,"packages/sdk/test/policy.test.ts"],[f.root,"package-lock.json"]]) {
      const location=join(directory!,path!),old=readFileSync(location);writeFileSync(location,"changed");assert.throws(()=>verifyMutationInputs(f.root,f.stage,binding));writeFileSync(location,old);
    }
    writeFileSync(join(f.stage,"packages/sdk/src/extra.ts"),"extra");assert.throws(()=>verifyMutationInputs(f.root,f.stage,binding));
  } finally {rmSync(f.base,{recursive:true,force:true});}
});
test("CI-2: missing, symlinked and mismatched staged inputs cannot be frozen",()=>{
  const f=fixture();
  try {const path=join(f.stage,"packages/sdk/src/policy.ts");rmSync(path);assert.throws(()=>freezeMutationInputs(f.root,f.stage));symlinkSync(join(f.root,"packages/sdk/src/policy.ts"),path);assert.throws(()=>freezeMutationInputs(f.root,f.stage));rmSync(path);writeFileSync(path,"changed");assert.throws(()=>freezeMutationInputs(f.root,f.stage));}
  finally {rmSync(f.base,{recursive:true,force:true});}
});
test("CI-2: pending and failed actual child execution cannot qualify a present fixture report",async()=>{
  const f=fixture();
  try {
    const binding=freezeMutationInputs(f.root,f.stage);
    const ticket=launchSupervisedRun(join(f.stage,"execution"),{command:process.execPath,args:["-e","setTimeout(()=>process.exit(7),150)"],cwd:f.stage,timeoutMs:5000,graceMs:100},"a".repeat(64));
    assert.throws(()=>completedMutation(f.root,f.stage,binding,ticket,f.sources,false));await finished(ticket);
    assert.throws(()=>completedMutation(f.root,f.stage,binding,ticket,f.sources,false));assert.throws(()=>completedMutation(f.root,f.stage,binding,ticket,f.sources,true));
  } finally {rmSync(f.base,{recursive:true,force:true});}
});
test("CI-2: an asynchronously started real staged baseline finishes without relaunching",async()=>{
  let stage:string|undefined,ticket:RunTicket|undefined,failed=false;
  try {
    const launch=spawnSync(process.execPath,["evals/ci/mutation-run.ts","--start","--baseline"],{encoding:"utf8",timeout:10000});
    assert.equal(launch.status,0,launch.stdout+launch.stderr);assert.equal(launch.error,undefined);
    stage=launch.stdout.match(/Mutation run directory: (.+)/)?.[1];assert.equal(typeof stage,"string");
    const manifest=JSON.parse(readFileSync(join(stage!,"manifest.json"),"utf8"));assert.equal(manifest.definition,31);assert.equal(manifest.environment.FUZZ_SEED,"31907");
    ticket=JSON.parse(readFileSync(join(stage!,"ticket.json"),"utf8"));
    const specification=JSON.parse(readFileSync(join(ticket!.directory,"spec.json"),"utf8"));
    assert.equal(specification.command.args[1],"--experimental-test-isolation=none");
    const end=Date.now()+20000;while(readSupervisedResult(ticket!)===null && Date.now()<end)await sleep(20);
    assert.notEqual(readSupervisedResult(ticket!),null,"staged baseline incomplete after unchanged wait; "+JSON.stringify(ticket!.identity)+"\n"+readFileSync(join(ticket!.directory,"output.txt"),"utf8"));
    assert.equal((readSupervisedResult(ticket!) as {status:number|null}).status,0,readFileSync(join(ticket!.directory,"output.txt"),"utf8"));
    const before=readFileSync(join(ticket!.directory,"result.json"));
    for(let attempt=0;attempt<2;attempt++) {const finish=spawnSync(process.execPath,["evals/ci/mutation-run.ts","--finish",stage!],{encoding:"utf8",timeout:10000});assert.equal(finish.status,0,finish.stdout+finish.stderr);assert.match(finish.stdout,/baseline passes; no mutation score measured/);assert.deepEqual(readFileSync(join(ticket!.directory,"result.json")),before);}
    assert.match(readFileSync(join(ticket!.directory,"output.txt"),"utf8"),/tests 519\b/);
    const refuses=()=>{const finish=spawnSync(process.execPath,["evals/ci/mutation-run.ts","--finish",stage!],{encoding:"utf8",timeout:10000});assert.equal(finish.status,1,finish.stdout+finish.stderr);assert.equal(finish.error,undefined);};
    const manifestPath=join(stage!,"manifest.json"),manifestText=readFileSync(manifestPath);writeFileSync(manifestPath,Buffer.concat([manifestText,Buffer.from("\n")]));refuses();writeFileSync(manifestPath,manifestText);
    const sourcePath=join(stage!,"supervision/run-supervisor.ts"),source=readFileSync(sourcePath);writeFileSync(sourcePath,"changed");refuses();writeFileSync(sourcePath,source);
    const ticketPath=join(stage!,"ticket.json"),ticketText=readFileSync(ticketPath),commitPath=join(ticket!.directory,"commit.sha256"),commit=readFileSync(commitPath);
    const different={...ticket,identity:{...ticket!.identity,commandHash:"b".repeat(64)}};writeFileSync(ticketPath,JSON.stringify(different));
    const resultText=JSON.stringify({...JSON.parse(before.toString("utf8")),commandHash:different.identity.commandHash})+"\n";writeFileSync(join(ticket!.directory,"result.json"),resultText);writeFileSync(commitPath,createHash("sha256").update(resultText).digest("hex")+"\n");refuses();
    writeFileSync(ticketPath,ticketText);writeFileSync(join(ticket!.directory,"result.json"),before);writeFileSync(commitPath,commit);
    const foreign=join(stage!,"foreign-execution");mkdirSync(foreign,{mode:0o700});writeFileSync(join(foreign,"result.json"),before,{mode:0o600});writeFileSync(join(foreign,"commit.sha256"),commit,{mode:0o600});writeFileSync(ticketPath,JSON.stringify({...ticket,directory:foreign}));refuses();writeFileSync(ticketPath,ticketText);
  } catch(error){failed=true;throw error;} finally {
    try{if(ticket)await stopSupervisedRun(ticket);if(stage)rmSync(stage,{recursive:true,force:true});}
    catch(error){if(failed)console.error("Mutation scratch preserved after unconfirmed cleanup:",error);else throw error;}
  }
});
