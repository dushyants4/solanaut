// Builder-authored command faults; syntax, setup, signals and timeouts receive no catch credit.
import {strict as assert} from "node:assert";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/bin/replay.ts",source=readFileSync(path,"utf8"),directory=".sandbox/solanaut-1/replay-command/faults";
mkdirSync(directory,{recursive:true});
function run(name:string,pattern?:string){
  const result=spawnSync(process.execPath,["--test","--test-isolation=none",...(pattern?["--test-name-pattern="+pattern]:[]),"packages/sdk/test/replay-command.test.ts"],{encoding:"utf8",timeout:20000,killSignal:"SIGKILL"});
  writeFileSync(directory+"/"+name+".txt",result.stdout+result.stderr);return result;
}
const barrier='if (\n      bytes > limit ||\n      BigInt(bytes) !== before.size ||\n      before.size !== after.size ||\n      before.mtimeNs !== after.mtimeNs ||\n      before.ctimeNs !== after.ctimeNs ||\n      after.nlink !== 1n ||\n      !named.isFile() ||\n      named.nlink !== 1n ||\n      named.ino !== before.ino ||\n      named.dev !== before.dev ||\n      named.size !== before.size ||\n      named.mtimeNs !== before.mtimeNs ||\n      named.ctimeNs !== before.ctimeNs\n    )';
const faults=[
  ["external-trust","replayStream(open, policy, undefined, trust)","replayStream(open, policy, undefined)","signed policy history"],
  ["divergence-exit","if (res.ok)","if (true)","first divergence"],
  ["complete-source","for await (const entry of streamArchive(recordPath))","for await (const entry of [])","two complete actual archive reads"],
  ["fresh-source","const open = async function* () {\n  let count = 0;\n  for await (const entry of streamArchive(recordPath)) {\n    count++;\n    yield entry;\n  }\n  entries = count;\n};","let saved: any[] | undefined; const open = async function* () { if(saved){yield* saved;return;} const items=[];for await(const entry of streamArchive(recordPath)){items.push(entry);yield entry;}saved=items;entries=items.length;};","changed complete sources"],
  ["public-ceiling","limit = 1_048_576","limit = 16_777_216","public JSON source ceilings"],
  ["archive-ceiling","streamArchive(recordPath)","streamArchive(recordPath, {maxLineBytes:16_777_216})","record line ceiling"],
  ["public-utf8","{ fatal: true }","{ fatal: false }","public JSON source ceilings"],
  ["trust-fields",'if (\n    keys.length !== 3 ||\n    keys.some(\n      (key) => !["operatorKey", "guardId", "cluster"].includes(key) || typeof value[key] !== "string" || !value[key],\n    )\n  )','if (false)',"public trust accepts exactly"],
  ["nofollow","constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK","constants.O_RDONLY | constants.O_NONBLOCK","public descriptor opens"],
  ["nonblocking","constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK","constants.O_RDONLY | constants.O_NOFOLLOW","public descriptor opens"],
  ["source-stability",barrier,"if (bytes > limit || BigInt(bytes) !== before.size)","observed public source replacement"],
  ["detail-redaction",'console.log("  recorded: [redacted]");','console.log(`  recorded: ${JSON.stringify(d.recorded)}`);',"first divergence"],
  ["input-diagnostic",'} catch {\n  console.error("replay: public policy or trust input could not be read safely");','} catch (error) {\n  console.error(String(error));',"malformed policy and trust sources"],
] as const;
const baseline=run("baseline");assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const misses:string[]=[];
for(const [name,before,after,pattern] of faults){
  assert.equal(source.split(before).length,2,"fault must select exactly one site: "+name);
  try{
    writeFileSync(path,source.replace(before,after));const result=run(name,pattern);
    assert.equal(result.error,undefined,name);assert.equal(result.signal,null,name);
    if(result.status===0){misses.push(name);console.log("MISSED replay command fault: "+name);continue;}
    assert.equal(result.status,1,name+result.stdout+result.stderr);assert.match(result.stdout,/tests 1\b/);assert.match(result.stdout,/AssertionError/);
    assert.doesNotMatch(result.stdout+result.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND|ETIMEDOUT/);
    console.log("caught replay command fault: "+name);
  }finally{writeFileSync(path,source);}
}
const restored=run("restored");assert.equal(restored.status,0,restored.stdout+restored.stderr);assert.equal(readFileSync(path,"utf8"),source);
assert.deepEqual(misses,[],"missed semantic faults need regressions");console.log("All replay command faults caught; source restored");
