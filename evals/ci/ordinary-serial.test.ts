// CI-2: Node options must precede the test paths to control file scheduling.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("CI-2: the root test command actually serialises files instead of appending an ignored option",()=>{
  const directory=mkdtempSync(join(tmpdir(),"solanaut-serial-")),output=join(directory,"events.jsonl");
  try{
    const script=JSON.parse(readFileSync("package.json","utf8")).scripts.test as string,tokens=script.split(" ");
    assert.equal(tokens[0],"node");
    const first=tokens.findIndex(token=>token.endsWith(".test.ts"));assert.ok(first>0);
    const paths=["a","b"].map(name=>{
      const path=join(directory,name+".test.ts");
      writeFileSync(path,'import {test} from "node:test";import {appendFileSync} from "node:fs";const record=value=>appendFileSync('+JSON.stringify(output)+',JSON.stringify(value)+"\\n");test('+JSON.stringify(name)+',async()=>{record({stage:"start",name:'+JSON.stringify(name)+'});await new Promise(resolve=>setTimeout(resolve,500));record({stage:"end",name:'+JSON.stringify(name)+'});});');
      return path;
    });
    // Retain the previous CI suffix: it must not be relied upon for scheduling.
    const env={...process.env};delete env.NODE_TEST_CONTEXT;
    const result=spawnSync(process.execPath,["--test-concurrency=2",...tokens.slice(1,first),...paths,"--test-concurrency=1"],{encoding:"utf8",timeout:5000,env});
    assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/tests 2\b/);
    const events=readFileSync(output,"utf8").trim().split("\n").map(line=>JSON.parse(line));
    let active=0;assert.equal(events.length,4);
    for(const event of events){active+=event.stage==="start"?1:-1;assert.ok(active>=0 && active<=1,"root command ran test files concurrently");}
    assert.equal(active,0);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
