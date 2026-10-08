import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/record.ts",source=readFileSync(path,"utf8");
const run=(file:string)=>spawnSync(process.execPath,["--test",file],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL"});
for(const [name,damage,file,count] of [
  ["eager-publication",(text:string)=>'import "./checkpoint-publication.ts";\n'+text,"packages/sdk/test/record-loading.test.ts",2],
  ["eager-recovery",(text:string)=>'import "./checkpoint-recovery.ts";\n'+text,"packages/sdk/test/record-loading.test.ts",2],
  ["publication-pin-capture",(text:string)=>text.replace("const pins=structuredClone(options),candidate=text;","const pins=options,candidate=text;"),"packages/sdk/test/checkpoint-publication.test.ts",15],
] as const){
  const baseline=run(file);assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);const changed=damage(source);assert.notEqual(changed,source,"missing loading fault: "+name);
  try{writeFileSync(path,changed);const result=run(file);assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,new RegExp("tests "+count+"\\b"));console.log("caught record loading fault: "+name);}
  finally{writeFileSync(path,source);}
}
const errorsPath="packages/sdk/src/checkpoint-errors.ts",errorsSource=readFileSync(errorsPath,"utf8");
for(const [name,before] of [["publication-error-code",'readonly code="checkpoint-publication"'],["recovery-error-code",'readonly code="checkpoint-recovery"']] as const){
  assert.equal(errorsSource.split(before).length,2,"missing error identity fault: "+name);
  try{writeFileSync(errorsPath,errorsSource.replace(before,'readonly code="foreign"'));const result=run("packages/sdk/test/record-loading.test.ts");assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 2\b/);console.log("caught record loading fault: "+name);}
  finally{writeFileSync(errorsPath,errorsSource);}
}
for(const file of ["packages/sdk/test/record-loading.test.ts","packages/sdk/test/checkpoint-publication.test.ts"]){const result=run(file);assert.equal(result.status,0,result.stdout+result.stderr);}
console.log("All record loading faults caught; restored sources pass");
