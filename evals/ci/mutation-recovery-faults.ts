import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path="evals/ci/mutation-recovery.ts",original=readFileSync(path,"utf8");
const faults=[
  ["input-inventory","JSON.stringify(stagePaths)!==JSON.stringify([...rootPaths,\"stryker.config.json\"].sort())","false","extra staged input"],
  ["regular-inputs","!lstatSync(file).isFile()","false","missing, symlinked"],
  ["copied-inputs","rootPaths.some(path=>inputs[path]!==rootInputs[path])","false","missing, symlinked"],
  ["input-digests",'createHash("sha256").update(bytes).digest("hex")','"a".repeat(64)',"every copied"],
  ["lock-binding",'hashes(root,["package-lock.json"])["package-lock.json"]!','"a".repeat(64)',"every copied"],
  ["frozen-binding","JSON.stringify(freezeMutationInputs(root,stage))!==JSON.stringify(binding)","false","every copied"],
  ["actual-completion","requireRunCompletion(readSupervisedResult(ticket),ticket.identity)","0","pending and failed"],
  ["completion-inputs","verifyMutationInputs(root,stage,binding);","","bound complete synthetic"],
  ["report-grade",'return requireMutationReport(JSON.parse(readFileSync(join(stage,"reports/mutation.json"),"utf8")),sources,status);',"return {detected:8,undetected:2,invalid:0,total:10,score:80};","bound complete synthetic"],
] as const;
const battery=(pattern?:string)=>spawnSync(process.execPath,["--test",...(pattern?["--test-name-pattern="+pattern]:[]),"evals/ci/mutation-recovery.test.ts"],{encoding:"utf8",timeout:60000});
const baseline=battery();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,from,to,pattern] of faults) {
  assert.equal(original.split(from).length,2,"missing or ambiguous fault: "+name);
  try {writeFileSync(path,original.replace(from,to));const result=battery(pattern);assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 1\b/);assert.match(result.stdout,/CI-2/);console.log("caught mutation recovery fault: "+name);}
  finally {writeFileSync(path,original);}
}
const restored=battery();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All mutation recovery faults caught; restored source passes");
const driver="evals/ci/mutation-run.ts",driverSource=readFileSync(driver,"utf8");
const driverFaults=[
  ["runtime-option",'"--experimental-test-isolation=none"','"--test-isolation=none"'],
  ["baseline-population",'["--test","--experimental-test-isolation=none",...MUTATION_TESTS]','["--test","--experimental-test-isolation=none","packages/sdk/test/policy.test.ts"]'],
  ["supervisor-source",'hash(readFileSync(join(destination,"supervision",name)))!==manifest.supervisorHashes?.[name]',"false"],
  ["manifest-binding","ticket.identity.inputHash!==hash(bytes)","false"],
  ["command-binding","ticket.identity.commandHash!==hash(JSON.stringify(command(destination,manifest.baseline)))","false"],
  ["stage-binding",'ticket.directory!==join(destination,"execution")',"false"],
] as const;
for(const [name,from,to] of driverFaults) {
  assert.equal(driverSource.split(from).length,2,"missing or ambiguous driver fault: "+name);
  try {writeFileSync(driver,driverSource.replace(from,to));const result=battery("asynchronously started");assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 1\b/);console.log("caught mutation driver fault: "+name);}
  finally {writeFileSync(driver,driverSource);}
}
const final=battery();assert.equal(final.status,0,final.stdout+final.stderr);console.log("All mutation driver faults caught; restored source passes");
