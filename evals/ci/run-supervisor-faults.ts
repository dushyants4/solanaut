import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path="tools/run-supervisor.ts", original=readFileSync(path,"utf8");
const faults=[
  ["worker-detachment",'{detached:true,stdio:["ignore",fd,fd]','{detached:false,stdio:["ignore",fd,fd]',"survives the launching"],
  ["launcher-release","worker.unref();return","return","normal launcher exits"],
  ["retained-output",'stdio:["ignore",fd,fd]','stdio:["ignore","ignore","ignore"]',"actual successful child"],
  ["actual-exit","resolve({status,signal})","resolve({status:0,signal})","actual nonzero child"],
  ["actual-signal","resolve({status,signal})","resolve({status:status??0,signal:null})","actual child termination signal"],
  ["deadline-state","timedOut=true;stop();","stop();","timeout cannot qualify"],
  ["specification-pin","hash(text)!==expectedHash","false","wrong specification identity"],
  ["command-pin","spec.identity.commandHash!==hash(JSON.stringify(cmd))","false","inconsistent command identity"],
  ["ticket-pid","value.supervisorPid!==ticket.supervisorPid","false","foreign worker result"],
  ["ticket-run","value.runId!==ticket.identity.runId","false","foreign worker result"],
  ["ticket-input","value.inputHash!==ticket.identity.inputHash","false","foreign worker result"],
  ["ticket-command","value.commandHash!==ticket.identity.commandHash","false","foreign worker result"],
  ["uncommitted-result","if(markerSize===0)return null;",'if(markerSize===0)return JSON.parse(readFileSync(path,"utf8"));',"completion-directory sync failure"],
  ["result-digest",'hash(text)+"\\n"!==marker',"false","altered result bytes"],
  ["result-file-sync","writeFileSync(fd,text);fsyncSync(fd);","writeFileSync(fd,text);","completion-file sync failure"],
  ["result-directory-sync","linkSync(temporary,destination);syncDirectory(directory);","linkSync(temporary,destination);","completion-directory sync failure"],
  ["early-commit",'const resultHash=publish(directory,"result.json",result);','const resultHash=hash(JSON.stringify(result)+"\\n");writeFileSync(commit,resultHash+"\\n");publish(directory,"result.json",result);',"completion-directory sync failure"],
  ["private-storage",'(info.mode&0o777)!==(directory?0o700:0o600)',"false","shared result permissions"],
  ["descendant-termination",'()=>signalGroup("SIGKILL")',"()=>{}","surviving worker cannot qualify"],
] as const;
const battery=(pattern?:string)=>spawnSync(process.execPath,["--test",...(pattern?["--test-name-pattern="+pattern]:[]),"evals/ci/run-supervisor.test.ts"],{encoding:"utf8",timeout:30_000});
const baseline=battery();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,from,to,pattern] of faults) {
  assert.equal(original.split(from).length,2,"missing or ambiguous fault: "+name);
  try {
    writeFileSync(path,original.replace(from,to));const changed=battery(pattern);
    assert.equal(changed.status,1,changed.stdout+changed.stderr);assert.equal(changed.signal,null);assert.equal(changed.error,undefined);
    assert.match(changed.stdout,/tests 1\b/);assert.match(changed.stdout,/CI-2/);
    console.log("caught supervisor fault: "+name);
  } finally {writeFileSync(path,original);}
}
const restored=battery();assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All supervisor faults caught; restored source passes");
