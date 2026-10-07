import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunCompletion, RunIdentity } from "./run-completion.ts";
export interface RunCommand { command: string; args: readonly string[]; cwd: string; timeoutMs: number; graceMs: number }
export interface RunTicket { directory: string; identity: RunIdentity; supervisorPid: number }
interface RunSpec { format: 1; identity: RunIdentity; command: RunCommand }
const hash=(text:string)=>createHash("sha256").update(text).digest("hex");
const digest=(text:unknown)=>typeof text==="string" && /^[0-9a-f]{64}$/.test(text);
function command(input:unknown):RunCommand {
  const value=JSON.parse(JSON.stringify(input)) as RunCommand;
  if(!value || Object.keys(value).sort().join(",")!=="args,command,cwd,graceMs,timeoutMs" || typeof value.command!=="string" || !isAbsolute(value.command) || typeof value.cwd!=="string" || !isAbsolute(value.cwd) || !Array.isArray(value.args) || !value.args.every(arg=>typeof arg==="string" && !arg.includes("\0")) || !Number.isSafeInteger(value.timeoutMs) || value.timeoutMs<1 || value.timeoutMs>2_147_483_647 || !Number.isSafeInteger(value.graceMs) || value.graceMs<1 || value.graceMs>5000) throw new Error("invalid supervised command");
  return value;
}
function syncDirectory(directory:string) {const fd=openSync(directory,"r");try {fsyncSync(fd);} finally {closeSync(fd);}}
function publish(directory:string,name:string,value:unknown) {
  const temporary=join(directory,"."+name+"-"+randomUUID()), destination=join(directory,name);
  const text=JSON.stringify(value)+"\n";
  const fd=openSync(temporary,"wx",0o600);
  try {writeFileSync(fd,text);fsyncSync(fd);} finally {closeSync(fd);}
  try {linkSync(temporary,destination);syncDirectory(directory);} finally {unlinkSync(temporary);}
  return hash(text);
}
function privatePath(path:string,directory:boolean) {
  const info=lstatSync(path);
  if((directory?!info.isDirectory():!info.isFile()) || info.uid!==process.getuid?.() || (info.mode&0o777)!==(directory?0o700:0o600)) throw new Error("supervised storage is not private");
}
export function launchSupervisedRun(directory:string,input:RunCommand,inputHash:string):RunTicket {
  if(process.platform!=="linux" || !digest(inputHash)) throw new Error("unsupported supervised run");
  const cmd=command(input), identity={runId:randomUUID(),inputHash,commandHash:hash(JSON.stringify(cmd))};
  const spec:RunSpec={format:1,identity,command:cmd}, text=JSON.stringify(spec)+"\n";
  if(Buffer.byteLength(text)>65_536) throw new Error("supervised command is too large");
  directory=resolve(directory);mkdirSync(directory,{mode:0o700});privatePath(directory,true);
  publish(directory,"spec.json",spec);
  const commit=openSync(join(directory,"commit.sha256"),"wx",0o600);
  try {fsyncSync(commit);} finally {closeSync(commit);}
  syncDirectory(directory);
  const fd=openSync(join(directory,"output.txt"),"wx",0o600);
  try {
    const worker=spawn(process.execPath,[fileURLToPath(import.meta.url),directory,hash(text)],{detached:true,stdio:["ignore",fd,fd],env:{...process.env,NODE_TEST_CONTEXT:undefined}});
    worker.on("error",()=>{});
    if(!worker.pid) throw new Error("supervisor did not start");
    worker.unref();return {directory,identity,supervisorPid:worker.pid};
  } finally {closeSync(fd);}
}
export function readSupervisedResult(ticket:RunTicket):unknown {
  privatePath(ticket.directory,true);const path=join(ticket.directory,"result.json");
  try {
    const commit=join(ticket.directory,"commit.sha256");privatePath(commit,false);
    const markerSize=lstatSync(commit).size;if(markerSize===0)return null;if(markerSize!==65)throw new Error("invalid supervised commit marker");
    const marker=readFileSync(commit,"utf8");if(!/^[0-9a-f]{64}\n$/.test(marker))throw new Error("invalid supervised commit marker");
    privatePath(path,false);const info=lstatSync(path);if(info.size>65_536) throw new Error("supervised result is too large");const text=readFileSync(path,"utf8");
    if(hash(text)+"\n"!==marker)throw new Error("supervised result digest differs");
    const value=JSON.parse(text);
    if(!value || value.supervisorPid!==ticket.supervisorPid || value.runId!==ticket.identity.runId || value.inputHash!==ticket.identity.inputHash || value.commandHash!==ticket.identity.commandHash) throw new Error("supervised result identity differs");
    return value;
  }
  catch(error) {if((error as NodeJS.ErrnoException).code==="ENOENT") return null;throw error;}
}
function groupExists(pid:number):boolean {try {process.kill(-pid,0);return true;} catch(error) {if((error as NodeJS.ErrnoException).code==="ESRCH")return false;throw error;}}
async function supervise(directory:string,expectedHash:string) {
  privatePath(directory,true);const path=join(directory,"spec.json");privatePath(path,false);
  const text=readFileSync(path,"utf8");if(!digest(expectedHash) || Buffer.byteLength(text)>65_536 || hash(text)!==expectedHash) throw new Error("supervised specification differs");
  const spec=JSON.parse(text) as RunSpec, cmd=command(spec.command);
  if(spec.format!==1 || !spec.identity || !digest(spec.identity.inputHash) || !digest(spec.identity.commandHash) || spec.identity.commandHash!==hash(JSON.stringify(cmd)) || typeof spec.identity.runId!=="string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(spec.identity.runId)) throw new Error("invalid supervised specification");
  const commit=join(directory,"commit.sha256");privatePath(commit,false);
  if(lstatSync(commit).size!==0)throw new Error("supervised run is already committed");
  const started=new Date().toISOString();let timedOut=false,error:string|null=null,interrupted=false;
  const child=spawn(cmd.command,[...cmd.args],{cwd:cmd.cwd,detached:true,stdio:["ignore",1,2],env:{...process.env,NODE_TEST_CONTEXT:undefined}});
  const pid=child.pid??0;let hardStop:NodeJS.Timeout|undefined;
  const signalGroup=(signal:NodeJS.Signals)=>{if(pid)try {process.kill(-pid,signal);} catch(failure) {if((failure as NodeJS.ErrnoException).code!=="ESRCH")error="process-group signal failed";}};
  const stop=()=>{signalGroup("SIGTERM");hardStop??=setTimeout(()=>signalGroup("SIGKILL"),cmd.graceMs);};
  const terminate=()=>{interrupted=true;error="supervisor interrupted";stop();};
  process.once("SIGTERM",terminate);process.once("SIGINT",terminate);
  const deadline=setTimeout(()=>{timedOut=true;stop();},cmd.timeoutMs);
  child.once("error",failure=>{error=(failure as NodeJS.ErrnoException).code??"child launch failed";});
  const completion=await new Promise<{status:number|null;signal:NodeJS.Signals|null}>(resolve=>child.once("close",(status,signal)=>resolve({status,signal})));
  clearTimeout(deadline);
  // A child's exit does not establish that all its workers have stopped.
  if(pid && groupExists(pid)) {
    if(!timedOut && !interrupted)error="child left its process group running";
    stop();const end=process.hrtime.bigint()+BigInt(cmd.graceMs+2000)*1_000_000n;
    while(groupExists(pid) && process.hrtime.bigint()<end)await new Promise(resolve=>setTimeout(resolve,20));
    if(groupExists(pid))error="process group termination unconfirmed";
  }
  clearTimeout(hardStop);process.removeListener("SIGTERM",terminate);process.removeListener("SIGINT",terminate);
  const result:RunCompletion={...spec.identity,format:1,state:"complete",supervisorPid:process.pid,childPid:pid,started,completed:new Date().toISOString(),...completion,error,timedOut};
  const resultHash=publish(directory,"result.json",result);
  // Visibility of the marker follows successful result-file and directory syncs.
  const fd=openSync(commit,"r+");try {writeFileSync(fd,resultHash+"\n");fsyncSync(fd);} finally {closeSync(fd);}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==4)throw new Error("usage: run-supervisor.ts <private-directory> <specification-sha256>");
  await supervise(resolve(process.argv[2]!),process.argv[3]!);
}
