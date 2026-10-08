import {strict as assert} from "node:assert";
import {test} from "node:test";
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {createHash} from "node:crypto";
import {launchSupervisedRun,readSupervisedResult,type RunTicket} from "../../tools/run-supervisor.ts";
import {stopSupervisedRun} from "../../tools/stop-supervised-run.ts";
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check:()=>boolean){const end=Date.now()+5000;while(!check()&&Date.now()<end)await sleep(20);assert.ok(check(),"fixture did not reach its expected boundary");}
function fixture(){mkdirSync(".sandbox/solanaut-1/mutation",{recursive:true});return resolve(mkdtempSync(".sandbox/solanaut-1/mutation/stop-test-"));}
async function clean(base:string,ticket:RunTicket){if(readSupervisedResult(ticket)===null){try{process.kill(ticket.supervisorPid,"SIGTERM");}catch{}await until(()=>readSupervisedResult(ticket)!==null);}rmSync(base,{recursive:true,force:true});}
test("CI-2: interruption waits for the bound supervisor commit before scratch deletion",async()=>{
  const base=fixture(),ready=join(base,"ready"),late=join(base,"stopped");
  const script=`const fs=require('node:fs');process.on('SIGTERM',()=>setTimeout(()=>{fs.writeFileSync(${JSON.stringify(late)},'stopped');process.exit(0)},150));setInterval(()=>{},1000);fs.writeFileSync(${JSON.stringify(ready)},'ready');`;
  const ticket=launchSupervisedRun(join(base,"execution"),{command:process.execPath,args:["-e",script],cwd:base,timeoutMs:5000,graceMs:1000},"a".repeat(64));
  try{await until(()=>existsSync(ready));await stopSupervisedRun(ticket);const result=readSupervisedResult(ticket);assert.notEqual(result,null,"stop returned before durable supervisor completion");assert.equal(Reflect.get(result as object,"error"),"supervisor interrupted");assert.equal(Reflect.get(result as object,"timedOut"),false);assert.equal(readFileSync(late,"utf8"),"stopped");}
  finally{await clean(base,ticket);}
});
test("CI-2: completed or corrupt bound evidence cannot trigger a fresh PID signal",async()=>{
  const base=fixture(),ticket=launchSupervisedRun(join(base,"execution"),{command:process.execPath,args:["-e","process.exit(0)"],cwd:base,timeoutMs:5000,graceMs:100},"b".repeat(64));
  const kill=process.kill;let signals=0,marker:string|undefined;
  try{await until(()=>readSupervisedResult(ticket)!==null);process.kill=(()=>{signals++;return true;}) as typeof process.kill;
    await stopSupervisedRun(ticket);assert.equal(signals,0,"a completed ticket must not signal a potentially reused PID");
    for(const supervisorPid of [0,1,-1,NaN])await assert.rejects(stopSupervisedRun({...ticket,supervisorPid}),/invalid supervisor PID/);assert.equal(signals,0);
    marker=readFileSync(join(ticket.directory,"commit.sha256"),"utf8");const path=join(ticket.directory,"result.json"),original=readFileSync(path,"utf8");
    for(const [change,reason] of [[{state:"pending"},/invalid supervisor completion/],[{error:"process group termination unconfirmed"},/process group shutdown is unconfirmed/]] as const){
      const text=JSON.stringify({...JSON.parse(original),...change})+"\n";writeFileSync(path,text);writeFileSync(join(ticket.directory,"commit.sha256"),createHash("sha256").update(text).digest("hex")+"\n");
      try{await assert.rejects(stopSupervisedRun(ticket),reason);assert.equal(signals,0);}finally{writeFileSync(path,original);writeFileSync(join(ticket.directory,"commit.sha256"),marker);}
    }
    writeFileSync(join(ticket.directory,"commit.sha256"),"invalid\n");
    await assert.rejects(stopSupervisedRun(ticket),/commit marker/);assert.equal(signals,0);
  }finally{process.kill=kill;if(marker!==undefined)writeFileSync(join(ticket.directory,"commit.sha256"),marker);await clean(base,ticket);}
});
