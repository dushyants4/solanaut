// Qualification prototype only. The maintained package gate remains unchanged.
import {strict as assert} from "node:assert";
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {cpSync,closeSync,lstatSync,mkdirSync,mkdtempSync,openSync,readFileSync,readdirSync,rmSync,writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {performance} from "node:perf_hooks";
import {stripTypeScriptTypes} from "node:module";
import {fileURLToPath} from "node:url";
import {runInNewContext} from "node:vm";

const root=fileURLToPath(new URL("../../",import.meta.url));
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
export function requireInstalledResult(result,target){
  const refuse=()=>{throw new Error("unqualified installed result");};
  if(result.timedOut||result.signal!==null||result.errorCode!==null||result.status!==(target?1:0))refuse();
  const text=result.stdout,lines=text.split("\n"),start=lines.findLastIndex(line=>/^(?:ℹ|#) tests \d+$/.test(line));
  if(start<0)refuse();
  const footer=lines.slice(start),count=name=>Number(footer.find(line=>new RegExp(`^(?:ℹ|#) ${name} \\d+$`).test(line))?.split(" ").at(-1));
  if(count("tests")!==19||count("cancelled")!==0||count("skipped")!==0||count("todo")!==0||count("pass")+count("fail")!==19)refuse();
  if(target){if(count("fail")<1||!lines.some(line=>/[✖]|not ok/.test(line)&&line.includes(target)))refuse();}
  else if(count("pass")!==19||count("fail")!==0)refuse();
}
function fingerprint(directory){
  return Object.fromEntries(readdirSync(directory,{recursive:true}).sort().flatMap(path=>{
    const file=join(directory,path),stat=lstatSync(file);
    if(stat.isDirectory())return [];
    assert.ok(stat.isFile(),"candidate must contain actual regular files");
    return [[path,{sha256:hash(readFileSync(file)),mode:stat.mode&0o777}]];
  }));
}
export async function experiment(){
  const output=join(root,"evals/packaging/parallel-experiment"),scratch=join(root,".sandbox/solanaut-1/package-parallel");
  mkdirSync(output,{recursive:true});mkdirSync(scratch,{recursive:true});
  const stage=join(root,".sandbox/releases/sdk"),original=fingerprint(stage),source=readFileSync(join(root,"evals/packaging/faults.ts"),"utf8");
  const first=source.indexOf("const faults = ["),last=source.indexOf("\n];",first);
  assert.ok(first>=0&&last>first);
  // The existing trusted repository declarations remain the entire fault population.
  const faults=runInNewContext(stripTypeScriptTypes(source.slice(first,last+3))+"\nfaults",{}, {timeout:1000});
  assert.equal(faults.length,144);assert.equal(new Set(faults.map(fault=>fault.name)).size,144);
  const definition={kind:"unqualified parallel package prototype",revision:"826d05864271f3b2af05c8a8eb11243b1755c50f",node:process.version,
    workers:4,processLimitMs:300000,childLimitMs:60000,installedCases:19,compileCache:"disabled",
    sourceSha256:hash(source),testSha256:hash(readFileSync(join(root,"evals/packaging/packed-sdk.test.ts"))),
    prototypeSha256:hash(readFileSync(fileURLToPath(import.meta.url))),stage:original,
    faults:faults.map(({name,path,caught})=>({name,path,caught}))};
  writeFileSync(join(output,"definition.json"),JSON.stringify(definition,null,2)+"\n");
  const began=performance.now(),children=new Set(),results=[],controls=[],errors=[];let next=0,expired=false;
  function stop(child){if(child.pid&&child.exitCode===null&&child.signalCode===null)try{process.kill(-child.pid,"SIGTERM");}catch{/* Already exited. */}}
  const interrupt=()=>{expired=true;for(const child of children)stop(child);};
  process.once("SIGTERM",interrupt);
  const deadline=setTimeout(interrupt,definition.processLimitMs);
  function battery(candidate,name){
    assert.equal(expired,false,"prototype process limit elapsed");
    const path=join(output,name+".txt"),fd=openSync(path,"w");
    return new Promise(resolve=>{
      let errorCode=null,timedOut=false;
      const child=spawn(process.execPath,["--test","evals/packaging/packed-sdk.test.ts"],{cwd:root,detached:true,
        stdio:["ignore",fd,fd],env:{...process.env,NO_COLOR:"1",NODE_DISABLE_COMPILE_CACHE:"1",SOLANAUT_PACKAGE:candidate}});
      children.add(child);
      const timer=setTimeout(()=>{timedOut=true;stop(child);},definition.childLimitMs);
      child.on("error",error=>{errorCode=error.code??"spawn-error";});
      child.on("close",(status,signal)=>{clearTimeout(timer);children.delete(child);closeSync(fd);
        resolve({status,signal,errorCode,timedOut:timedOut||expired,stdout:readFileSync(path,"utf8"),log:name+".txt"});});
    });
  }
  async function worker(index){
    const candidate=mkdtempSync(join(scratch,"candidate-"));cpSync(stage,candidate,{recursive:true});
    try{
      assert.deepEqual(fingerprint(candidate),original);
      const initial=await battery(candidate,`worker-${index}-initial`);requireInstalledResult(initial);controls.push(initial.log);
      while(next<faults.length&&!expired){
        const fault=faults[next++],path=join(candidate,fault.path),bytes=readFileSync(path),mode=lstatSync(path).mode&0o777;
        try{
          const damaged=fault.damage(bytes.toString("utf8"));
          if(damaged===undefined)rmSync(path);
          else{assert.notEqual(damaged,bytes.toString("utf8"),"fault must change its isolated candidate");writeFileSync(path,damaged);}
          const result=await battery(candidate,fault.name);requireInstalledResult(result,fault.caught);
          results.push({name:fault.name,log:result.log});console.log("prototype caught package fault: "+fault.name);
        }finally{writeFileSync(path,bytes,{mode});}
      }
      assert.deepEqual(fingerprint(candidate),original);
      const final=await battery(candidate,`worker-${index}-final`);requireInstalledResult(final);controls.push(final.log);
    }finally{rmSync(candidate,{recursive:true,force:true});}
  }
  try{
    const workers=await Promise.allSettled(Array.from({length:definition.workers},(_,index)=>worker(index)));
    for(const result of workers)if(result.status==="rejected")errors.push(String(result.reason));
  }finally{clearTimeout(deadline);process.removeListener("SIGTERM",interrupt);for(const child of children)stop(child);}
  const unchanged=JSON.stringify(fingerprint(stage))===JSON.stringify(original),complete=results.length===faults.length&&
    new Set(results.map(result=>result.name)).size===faults.length&&controls.length===definition.workers*2;
  const ok=!expired&&errors.length===0&&unchanged&&complete;
  const summary={prototypeOnly:true,ok,expired,errors,originalStageUnchanged:unchanged,
    elapsedMs:performance.now()-began,controls,results};
  writeFileSync(join(output,"summary.json"),JSON.stringify(summary,null,2)+"\n");
  assert.equal(ok,true,"parallel prototype did not qualify: "+JSON.stringify({...summary,results:results.length}));
  console.log("Parallel prototype complete; maintained gate still unchanged");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await experiment();
