import {strict as assert} from "node:assert";
import {after,test} from "node:test";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,readFileSync,rmSync,symlinkSync,linkSync,unlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {canonicalJSON} from "../src/canonical.ts";
import {createPolicy} from "../src/policy.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
const directory=mkdtempSync(join(tmpdir(),"solanaut-policy-cli-")); after(()=>rmSync(directory,{recursive:true,force:true}));
const policy={...WORKLOAD_POLICY,latch:{...WORKLOAD_POLICY.latch,cluster:"devnet" as const}};
const path=join(directory,"policy.json"),bytes=canonicalJSON(policy),issued="2026-10-06T00:00:00.000Z";
writeFileSync(path,bytes);
const invoke=(...args:string[])=>spawnSync(process.execPath,["packages/sdk/bin/prepare-policy.ts",...args],{encoding:"utf8",timeout:3000});
const flags=["--version","2","--issued",issued];
test("POL-1/5: preparation returns the exact canonical signing text and public identity",()=> {
  const result=invoke(path,...flags); assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{guardId:policy.latch.guardId,cluster:"devnet",operatorKey:policy.latch.releaseKey,version:2,issued,policyHash:createPolicy(policy).hash,text:preparePolicyText(policy,2,issued)});
  assert.equal(result.stderr,""); assert.equal(readFileSync(path,"utf8"),bytes);
});
test("POL-1/5: preparation is deterministic and never invents a signature",()=> {
  const first=invoke(path,...flags),second=invoke(path,...flags); assert.equal(first.status,0,first.stderr); assert.equal(second.status,0,second.stderr);
  assert.equal(first.stdout,second.stdout); assert.equal("signature" in JSON.parse(first.stdout),false);
});
test("POL-1/5: missing, duplicate, unknown and noncanonical version arguments are usage errors",()=> {
  for(const args of [[],[path],[path,"--version","2"],[path,...flags,"--unknown","x"],[path,...flags,"--version","2"],...["0","-1","2.5","02","2e0","9007199254740992"].map(value=>[path,"--version",value,"--issued",issued])]) {
    const result=invoke(...args); assert.equal(result.status,2,result.stderr); assert.equal(result.stdout,""); assert.equal(JSON.parse(result.stderr).error.code,"usage");
  }
});
test("POL-1: malformed issued timestamps never become signing requests",()=> {
  for(const value of ["yesterday","2026-10-06","2026-10-06T00:00:00Z","2026-10-06T01:00:00.000+01:00"]){const result=invoke(path,"--version","2","--issued",value); assert.equal(result.status,2,result.stderr); assert.equal(JSON.parse(result.stderr).error.code,"usage"); assert.equal(result.stdout,"");}
});
test("POL-1/3: malformed JSON and invalid policies return redacted policy errors",()=> {
  for(const [index,content] of ["confidential-payload",JSON.stringify({version:1}),canonicalJSON({...policy,latch:{...policy.latch,releaseKey:policy.principal[0]}})].entries()) {
    const source=join(directory,"invalid-"+index); writeFileSync(source,content); const result=invoke(source,...flags);
    assert.equal(result.status,1,result.stderr); assert.equal(JSON.parse(result.stderr).error.code,"policy"); assert.equal(result.stdout,""); assert.ok(!result.stderr.includes(content)); assert.ok(!result.stderr.includes(source));
  }
});
test("POL-1/5: missing, symlink, directory and oversized sources refuse without leaking paths",()=> {
  const link=join(directory,"link"),large=join(directory,"large"),invalidUtf8=join(directory,"utf8"),hardLink=join(directory,"hard");
  symlinkSync(path,link); writeFileSync(large," ".repeat(1_048_577)); writeFileSync(invalidUtf8,Buffer.from([255]));
  for(const source of [join(directory,"confidential-name"),link,directory,large,invalidUtf8]) {const result=invoke(source,...flags); assert.equal(result.status,1,result.stderr); assert.equal(JSON.parse(result.stderr).error.code,"source"); assert.equal(result.stdout,""); assert.ok(!result.stderr.includes(source));}
  linkSync(path,hardLink);
  try {for(const source of [path,hardLink]) {const result=invoke(source,...flags); assert.equal(result.status,1,result.stderr); assert.equal(JSON.parse(result.stderr).error.code,"source");}}
  finally {unlinkSync(hardLink);}
  const boundary=join(directory,"boundary"); writeFileSync(boundary,bytes+" ".repeat(1_048_576-Buffer.byteLength(bytes)));
  assert.equal(invoke(boundary,...flags).status,0);
});
test("POL-1/5: explicit help succeeds; extra help and unsupported cluster refuse",()=> {
  const help=invoke("--help"); assert.equal(help.status,0,help.stderr); assert.match(help.stdout,/usage:/); assert.equal(invoke("--help",path).status,2);
  const source=join(directory,"cluster"); writeFileSync(source,canonicalJSON({...policy,latch:{...policy.latch,cluster:"mainnet-beta"}}));
  const result=invoke(source,...flags); assert.equal(result.status,1,result.stderr); assert.equal(JSON.parse(result.stderr).error.code,"policy");
});
