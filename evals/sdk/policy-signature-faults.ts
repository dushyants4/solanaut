import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path="packages/sdk/src/signed-policy.ts",source=readFileSync(path,"utf8");
const execute=()=>spawnSync(process.execPath,["--test","--test-name-pattern=POL-2: (invalid encoded|signature bytes)","packages/sdk/test/signed-policy.test.ts"],{encoding:"utf8",timeout:15000});
const baseline=execute();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["encoded-size","if (signature.length !== 88)","if (false)"],
  ["captured-decoder",'Buffer.from(signature, "base64")','Buffer.from(a.signature, "base64")'],
  ["captured-canonical",'bytes.toString("base64") !== signature','bytes.toString("base64") !== a.signature'],
] as const;
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"missing policy-signature fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=execute();assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/tests 2\b/);console.log("caught policy signature fault: "+name);}
  finally{writeFileSync(path,source);}
}
const restored=execute();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All policy signature faults caught; restored source passes");
