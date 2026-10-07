import { strict as assert } from "node:assert";
import { test } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launchSupervisedRun, readSupervisedResult, type RunCommand, type RunTicket } from "../../tools/run-supervisor.ts";
import { requireRunCompletion, type RunCompletion } from "../../tools/run-completion.ts";
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture() {mkdirSync(".sandbox/solanaut-1",{recursive:true});const base=resolve(mkdtempSync(".sandbox/solanaut-1/supervisor-test-"));return {base,directory:join(base,"run")};}
const command=(code:string, change:Partial<RunCommand>={}):RunCommand=>({command:process.execPath,args:["--input-type=module","-e",code],cwd:process.cwd(),timeoutMs:5000,graceMs:100,...change});
async function result(ticket:RunTicket):Promise<RunCompletion> {
  const end=Date.now()+10_000;
  while(Date.now()<end) {const value=readSupervisedResult(ticket);if(value!==null)return value as RunCompletion;await sleep(20);}
  throw new Error("supervisor did not publish completion");
}
function cleanup(base:string,ticket?:RunTicket) {
  if(ticket) {
    try {const value=JSON.parse(readFileSync(join(ticket.directory,"result.json"),"utf8"));if(Number.isSafeInteger(value.childPid) && value.childPid>0)process.kill(-value.childPid,"SIGKILL");} catch {}
    try {process.kill(ticket.supervisorPid,"SIGTERM");} catch {}
  }
  rmSync(base,{recursive:true,force:true});
}
test("CI-2: actual successful child completion is bound and stored privately",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {
    ticket=launchSupervisedRun(f.directory,command("console.log('fixture child output')"),"a".repeat(64));
    const value=await result(ticket);assert.equal(requireRunCompletion(value,ticket.identity),0);
    assert.equal(value.supervisorPid,ticket.supervisorPid);assert.notEqual(value.childPid,value.supervisorPid);
    assert.equal(statSync(f.directory).mode&0o777,0o700);assert.equal(statSync(join(f.directory,"result.json")).mode&0o777,0o600);
    assert.match(readFileSync(join(f.directory,"output.txt"),"utf8"),/fixture child output/);
    assert.throws(()=>process.kill(value.childPid,0));
  } finally {cleanup(f.base,ticket);}
});
test("CI-2: actual nonzero child exit cannot qualify",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {ticket=launchSupervisedRun(f.directory,command("process.exit(7)"),"a".repeat(64));const value=await result(ticket);assert.equal(value.status,7);assert.equal(value.signal,null);assert.throws(()=>requireRunCompletion(value,ticket!.identity));}
  finally {cleanup(f.base,ticket);}
});
test("CI-2: actual child termination signal remains a signal",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {ticket=launchSupervisedRun(f.directory,command("process.kill(process.pid,'SIGTERM')"),"a".repeat(64));const value=await result(ticket);assert.equal(value.status,null);assert.equal(value.signal,"SIGTERM");assert.throws(()=>requireRunCompletion(value,ticket!.identity));}
  finally {cleanup(f.base,ticket);}
});
test("CI-2: timeout cannot qualify even when the child handles termination with exit zero",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {ticket=launchSupervisedRun(f.directory,command("process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},20);setTimeout(()=>process.exit(0),7000)",{timeoutMs:2000}),"a".repeat(64));const value=await result(ticket);assert.equal(value.status,0);assert.equal(value.timedOut,true);assert.throws(()=>requireRunCompletion(value,ticket!.identity));assert.throws(()=>process.kill(value.childPid,0));}
  finally {cleanup(f.base,ticket);}
});
test("CI-2: launch failure records failure rather than inventing a child exit",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {ticket=launchSupervisedRun(f.directory,command("",{command:join(f.base,"absent-command")}),"a".repeat(64));const value=await result(ticket);assert.notEqual(value.status,0);assert.match(value.error??"",/ENOENT/);assert.throws(()=>requireRunCompletion(value,ticket!.identity));}
  finally {cleanup(f.base,ticket);}
});
test("CI-2: an existing run directory cannot be reused or overwritten",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {ticket=launchSupervisedRun(f.directory,command("process.exit(0)"),"a".repeat(64));assert.throws(()=>launchSupervisedRun(f.directory,command("process.exit(7)"),"a".repeat(64)));const value=await result(ticket);assert.equal(value.status,0);}
  finally {cleanup(f.base,ticket);}
});
test("CI-2: detached actual waiting survives the launching process being killed",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;let driver:ReturnType<typeof spawn>|undefined;
  try {
    const module=pathToFileURL(resolve("tools/run-supervisor.ts")).href;
    const script=`import {launchSupervisedRun} from ${JSON.stringify(module)};console.log(JSON.stringify(launchSupervisedRun(${JSON.stringify(f.directory)},${JSON.stringify(command("setTimeout(()=>process.exit(0),750)"))},'a'.repeat(64))));setInterval(()=>{},100);`;
    driver=spawn(process.execPath,["--input-type=module","-e",script],{detached:true,stdio:["ignore","pipe","pipe"]});
    const child=driver;let stderr="";child.stderr!.on("data",bytes=>stderr+=bytes);
    ticket=await new Promise<RunTicket>((resolve,reject)=>{let text="";child.stdout!.on("data",bytes=>{text+=bytes;if(text.includes("\n")){try{resolve(JSON.parse(text.split("\n")[0]!));}catch(error){reject(error);}}});child.once("close",code=>reject(new Error("driver ended before ticket: "+code+" "+stderr)));child.once("error",reject);});
    const exited=new Promise((resolve)=>child.once("close",(code,signal)=>resolve({code,signal})));process.kill(-child.pid!,"SIGKILL");assert.deepEqual(await exited,{code:null,signal:"SIGKILL"});
    const value=await result(ticket);assert.equal(requireRunCompletion(value,ticket.identity),0);assert.equal(value.supervisorPid,ticket.supervisorPid);
  } finally {if(driver && driver.exitCode===null && driver.signalCode===null)driver.kill("SIGKILL");cleanup(f.base,ticket);}
});
test("CI-2: wrong specification identity refuses before executing the child",()=>{
  const f=fixture();
  try {
    mkdirSync(f.directory,{mode:0o700});writeFileSync(join(f.directory,"commit.sha256"),"",{mode:0o600});const marker=join(f.base,"executed");
    const cmd=command(`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'executed');`);
    const spec={format:1,identity:{runId:"wrong-specification",inputHash:"a".repeat(64),commandHash:createHash("sha256").update(JSON.stringify(cmd)).digest("hex")},command:cmd};
    writeFileSync(join(f.directory,"spec.json"),JSON.stringify(spec)+"\n",{mode:0o600});
    const worker=spawnSync(process.execPath,[resolve("tools/run-supervisor.ts"),f.directory,"c".repeat(64)],{encoding:"utf8",timeout:5000});
    assert.equal(worker.status,1,worker.stdout+worker.stderr);assert.match(worker.stderr,/specification differs/);assert.equal(existsSync(marker),false);assert.equal(existsSync(join(f.directory,"result.json")),false);
  } finally {cleanup(f.base);}
});
test("CI-2: a normal launcher exits without waiting for its supervised child",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;let driver:ReturnType<typeof spawn>|undefined;
  try {
    const release=join(f.base,"release"), module=pathToFileURL(resolve("tools/run-supervisor.ts")).href;
    const code=`import {existsSync} from 'node:fs';setInterval(()=>{if(existsSync(${JSON.stringify(release)}))process.exit(0);},20);setTimeout(()=>process.exit(0),7000);`;
    const script=`import {launchSupervisedRun} from ${JSON.stringify(module)};console.log(JSON.stringify(launchSupervisedRun(${JSON.stringify(f.directory)},${JSON.stringify(command(code,{timeoutMs:10000}))},'a'.repeat(64))));`;
    driver=spawn(process.execPath,["--input-type=module","-e",script],{stdio:["ignore","pipe","pipe"]});
    const child=driver;let stdout="",stderr="";child.stdout!.on("data",bytes=>stdout+=bytes);child.stderr!.on("data",bytes=>stderr+=bytes);
    const status=await new Promise(resolve=>{child.once("close",(code,signal)=>resolve({code,signal}));child.once("error",error=>resolve({error}));});
    assert.deepEqual(status,{code:0,signal:null},stderr);ticket=JSON.parse(stdout.trim());
    assert.equal(readSupervisedResult(ticket!),null,"launcher exit precedes actual child completion");
    writeFileSync(release,"release");const value=await result(ticket!);assert.equal(requireRunCompletion(value,ticket!.identity),0);
  } finally {if(driver && driver.exitCode===null && driver.signalCode===null)driver.kill("SIGKILL");cleanup(f.base,ticket);}
});
test("CI-2: foreign worker result cannot be read through a ticket",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {ticket=launchSupervisedRun(f.directory,command("process.exit(0)"),"a".repeat(64));const value=await result(ticket);
    for(const field of ["supervisorPid","runId","inputHash","commandHash"] as const) {
      const changed=JSON.stringify({...value,[field]:field==="supervisorPid"?value.supervisorPid+1:field==="runId"?"foreign":"c".repeat(64)})+"\n";writeFileSync(join(f.directory,"result.json"),changed);
      writeFileSync(join(f.directory,"commit.sha256"),createHash("sha256").update(changed).digest("hex")+"\n",{mode:0o600});
      assert.throws(()=>readSupervisedResult(ticket!),field);
    }
  } finally {cleanup(f.base,ticket);}
});
test("CI-2: inconsistent command identity refuses despite a matching specification digest",()=>{
  const f=fixture();
  try {
    mkdirSync(f.directory,{mode:0o700});writeFileSync(join(f.directory,"commit.sha256"),"",{mode:0o600});const marker=join(f.base,"executed");
    const cmd=command(`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'executed');`);
    const text=JSON.stringify({format:1,identity:{runId:"command-fixture",inputHash:"a".repeat(64),commandHash:"c".repeat(64)},command:cmd})+"\n";
    writeFileSync(join(f.directory,"spec.json"),text,{mode:0o600});
    const worker=spawnSync(process.execPath,[resolve("tools/run-supervisor.ts"),f.directory,createHash("sha256").update(text).digest("hex")],{encoding:"utf8",timeout:5000});
    assert.equal(worker.status,1,worker.stdout+worker.stderr);assert.match(worker.stderr,/invalid supervised specification/);assert.equal(existsSync(marker),false);
  } finally {cleanup(f.base);}
});
test("CI-2: shared result permissions refuse before reading completion",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {ticket=launchSupervisedRun(f.directory,command("process.exit(0)"),"a".repeat(64));await result(ticket);chmodSync(join(f.directory,"result.json"),0o644);assert.throws(()=>readSupervisedResult(ticket!),/storage is not private/);}
  finally {cleanup(f.base,ticket);}
});
function syncFailure(kind:"file"|"directory") {
  const f=fixture();
  try {
    mkdirSync(f.directory,{mode:0o700});writeFileSync(join(f.directory,"commit.sha256"),"",{mode:0o600});
    const marker=join(f.base,"executed"),cmd=command(`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'executed');`);
    const identity={runId:"publication-fixture",inputHash:"a".repeat(64),commandHash:createHash("sha256").update(JSON.stringify(cmd)).digest("hex")};
    const text=JSON.stringify({format:1,identity,command:cmd})+"\n";writeFileSync(join(f.directory,"spec.json"),text,{mode:0o600});
    const preload=join(f.base,"storage-fault.mjs");const condition=kind==="file"?'target.includes("/.result.json-")':`target===${JSON.stringify(f.directory)} && fs.existsSync(${JSON.stringify(join(f.directory,"result.json"))})`;
    writeFileSync(preload,`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;fs.fsyncSync=(fd)=>{const target=fs.readlinkSync('/proc/self/fd/'+fd);if(${condition})throw Object.assign(new Error('injected sync failure'),{code:'ENOSPC'});return original(fd);};syncBuiltinESMExports();`);
    const worker=spawnSync(process.execPath,[resolve("tools/run-supervisor.ts"),f.directory,createHash("sha256").update(text).digest("hex")],{encoding:"utf8",timeout:5000,env:{...process.env,NODE_OPTIONS:"--import="+pathToFileURL(preload).href}});
    assert.equal(worker.status,1,worker.stdout+worker.stderr);assert.equal(worker.error,undefined);assert.equal(existsSync(marker),true,"actual child ran before the result write failed");
    assert.equal(readSupervisedResult({directory:f.directory,identity,supervisorPid:worker.pid}),null,"an unsynced publication cannot be accepted");
  } finally {cleanup(f.base);}
}
test("CI-2: completion-file sync failure never publishes accepted success",()=>syncFailure("file"));
test("CI-2: completion-directory sync failure never publishes accepted success",()=>syncFailure("directory"));
test("CI-2: incomplete commit evidence cannot publish a valid result",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {ticket=launchSupervisedRun(f.directory,command("process.exit(0)"),"a".repeat(64));await result(ticket);writeFileSync(join(f.directory,"commit.sha256"),"partial",{mode:0o600});assert.throws(()=>readSupervisedResult(ticket!));}
  finally {cleanup(f.base,ticket);}
});
test("CI-2: altered result bytes cannot retain the existing commit binding",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {ticket=launchSupervisedRun(f.directory,command("process.exit(0)"),"a".repeat(64));const value=await result(ticket);writeFileSync(join(f.directory,"result.json"),JSON.stringify({...value,started:"2026-10-07T00:00:00.000Z"}));assert.throws(()=>readSupervisedResult(ticket!));}
  finally {cleanup(f.base,ticket);}
});
test("CI-2: malformed operator commands refuse before creating a run",()=>{
  const f=fixture();
  try {for(const change of [{timeoutMs:0},{timeoutMs:2_147_483_648},{graceMs:0},{graceMs:5001},{cwd:"relative"},{command:"relative"},{args:["bad\0argument"]}])assert.throws(()=>launchSupervisedRun(f.directory,command("process.exit(0)",change),"a".repeat(64)));assert.equal(existsSync(f.directory),false);}
  finally {cleanup(f.base);}
});
test("CI-2: a frozen evaluation environment excludes caller injection in supervisor and child",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  const prior=process.env.NODE_OPTIONS,foreign=process.env.SOLANAUT_FOREIGN_FIXTURE;
  try {
    const marker=join(f.base,"injected"),preload=join(f.base,"injection.mjs");
    writeFileSync(preload,`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'executed');`);
    process.env.NODE_OPTIONS="--import="+pathToFileURL(preload).href;process.env.SOLANAUT_FOREIGN_FIXTURE="fixture";
    const cmd={...command("console.log(JSON.stringify({seed:process.env.FUZZ_SEED,foreign:process.env.SOLANAUT_FOREIGN_FIXTURE??null,options:process.env.NODE_OPTIONS??null}))"),env:{PATH:process.env.PATH!,LANG:"C.UTF-8",FUZZ_SEED:"23093",FUZZ_RUNS:"5000"}};
    ticket=launchSupervisedRun(f.directory,cmd,"a".repeat(64));const value=await result(ticket);
    assert.equal(requireRunCompletion(value,ticket.identity),0);
    assert.equal(existsSync(marker),false,"supervisor never loads the caller preload");
    assert.deepEqual(JSON.parse(readFileSync(join(f.directory,"output.txt"),"utf8").trim()),{seed:"23093",foreign:null,options:null});
    assert.deepEqual(JSON.parse(readFileSync(join(f.directory,"spec.json"),"utf8")).command.env,cmd.env);
  } finally {
    if(prior===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=prior;
    if(foreign===undefined)delete process.env.SOLANAUT_FOREIGN_FIXTURE;else process.env.SOLANAUT_FOREIGN_FIXTURE=foreign;
    cleanup(f.base,ticket);
  }
});
test("CI-2: evaluation environment rejects loader and undeclared variable overrides",()=>{
  const f=fixture();
  try {for(const env of [{NODE_OPTIONS:"--import=untrusted"},{LD_PRELOAD:"untrusted"},{FUZZ_SEED:4},{PATH:"bad\0path"},null])assert.throws(()=>launchSupervisedRun(f.directory,{...command("process.exit(0)"),env} as unknown as RunCommand,"a".repeat(64)));assert.equal(existsSync(f.directory),false);}
  finally {cleanup(f.base);}
});
test("CI-2: child environment uses the specification despite a different worker environment",()=>{
  const f=fixture();
  try {
    mkdirSync(f.directory,{mode:0o700});writeFileSync(join(f.directory,"commit.sha256"),"",{mode:0o600});
    const cmd={...command("console.log(JSON.stringify({seed:process.env.FUZZ_SEED,foreign:process.env.SOLANAUT_FOREIGN_FIXTURE??null}))"),env:{PATH:process.env.PATH!,FUZZ_SEED:"23093",FUZZ_RUNS:"5000"}};
    const identity={runId:"child-environment",inputHash:"a".repeat(64),commandHash:createHash("sha256").update(JSON.stringify(cmd)).digest("hex")};
    const text=JSON.stringify({format:1,identity,command:cmd})+"\n";writeFileSync(join(f.directory,"spec.json"),text,{mode:0o600});
    const worker=spawnSync(process.execPath,[resolve("tools/run-supervisor.ts"),f.directory,createHash("sha256").update(text).digest("hex")],{encoding:"utf8",timeout:5000,env:{...process.env,NODE_OPTIONS:undefined,FUZZ_SEED:"wrong",SOLANAUT_FOREIGN_FIXTURE:"fixture"}});
    assert.equal(worker.status,0,worker.stderr);assert.equal(worker.error,undefined);
    assert.deepEqual(JSON.parse(worker.stdout.trim()),{seed:"23093",foreign:null});
    assert.equal(requireRunCompletion(readSupervisedResult({directory:f.directory,identity,supervisorPid:worker.pid}),identity),0);
  } finally {cleanup(f.base);}
});
test("CI-2: supervisor interruption cannot qualify a child that exits zero on termination",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {
    const ready=join(f.base,"ready"),code=`import {writeFileSync} from 'node:fs';process.on('SIGTERM',()=>process.exit(0));writeFileSync(${JSON.stringify(ready)},'ready');setInterval(()=>{},20);setTimeout(()=>process.exit(0),7000);`;
    ticket=launchSupervisedRun(f.directory,command(code,{timeoutMs:10000}),"a".repeat(64));
    const end=Date.now()+5000;while(!existsSync(ready) && Date.now()<end)await sleep(20);assert.equal(existsSync(ready),true);
    process.kill(ticket.supervisorPid,"SIGTERM");const value=await result(ticket);
    assert.equal(value.status,0);assert.equal(value.timedOut,false);assert.equal(value.error,"supervisor interrupted");assert.throws(()=>requireRunCompletion(value,ticket!.identity));
    assert.throws(()=>process.kill(value.childPid,0));
  } finally {cleanup(f.base,ticket);}
});
test("CI-2: killed supervisor leaves no eligible completion and requires external child containment",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;let pid:number|undefined;
  try {
    const ready=join(f.base,"ready"),code=`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(ready)},JSON.stringify({pid:process.pid}));setInterval(()=>{},20);setTimeout(()=>process.exit(0),7000);`;
    ticket=launchSupervisedRun(f.directory,command(code,{timeoutMs:10000}),"a".repeat(64));
    const end=Date.now()+5000;while(!existsSync(ready) && Date.now()<end)await sleep(20);assert.equal(existsSync(ready),true);
    pid=JSON.parse(readFileSync(ready,"utf8")).pid;assert.equal(Number.isSafeInteger(pid) && pid!>0,true);
    process.kill(ticket.supervisorPid,"SIGKILL");
    let stopped=false;
    while(Date.now()<end) {try {const stat=readFileSync(`/proc/${ticket.supervisorPid}/stat`,"utf8");if(stat.slice(stat.lastIndexOf(")")+2).startsWith("Z ")){stopped=true;break;}}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT"){stopped=true;break;}throw error;}await sleep(20);}
    assert.equal(stopped,true,"actual supervisor death was observed");
    assert.equal(readSupervisedResult(ticket),null);assert.throws(()=>requireRunCompletion(null,ticket!.identity));
    process.kill(pid!,0);process.kill(-pid!,"SIGKILL");
  } finally {if(pid)try {process.kill(-pid,"SIGKILL");}catch{}cleanup(f.base,ticket);}
});
test("CI-2: normal child exit with a surviving worker cannot qualify",async()=>{
  const f=fixture();let ticket:RunTicket|undefined;
  try {
    const code="import {spawn} from 'node:child_process';const child=spawn(process.execPath,['-e','process.on(\"SIGTERM\",()=>{});setInterval(()=>{},20);setTimeout(()=>process.exit(0),7000)'],{stdio:'ignore'});console.log(JSON.stringify({leafPid:child.pid}));child.unref();setTimeout(()=>process.exit(0),200);";
    ticket=launchSupervisedRun(f.directory,command(code,{graceMs:100}),"a".repeat(64));const value=await result(ticket);
    assert.equal(value.status,0);assert.notEqual(value.error,null);assert.throws(()=>requireRunCompletion(value,ticket!.identity));
    const leaf=JSON.parse(readFileSync(join(f.directory,"output.txt"),"utf8").split("\n")[0]!);
    try {const stat=readFileSync(`/proc/${leaf.leafPid}/stat`,"utf8");assert.equal(stat.slice(stat.lastIndexOf(")")+2).split(" ")[0],"Z");}
    catch(error) {if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  } finally {cleanup(f.base,ticket);}
});
