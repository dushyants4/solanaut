// OWN-2/SNP-4/5: raw record ownership must not initialise checkpoint evaluation.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {spawnSync} from "node:child_process";
import {mkdirSync,mkdtempSync,rmSync} from "node:fs";
import {resolve,join} from "node:path";
const hook=`import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(['@gubernaut/core','@solana/kit'].includes(specifier))throw new Error('record-only operation imported evaluation module: '+specifier);return next(specifier,context);}});
const record=await import('./packages/sdk/src/record.ts');`;
const run=(code:string)=>spawnSync(process.execPath,["--input-type=module","-e",hook+code],{encoding:"utf8",timeout:5000,killSignal:"SIGKILL"});
test("OWN-2: kernel record append and reopen do not require evaluation modules",()=>{
  mkdirSync(".sandbox/solanaut-1/record-loading",{recursive:true});const directory=mkdtempSync(resolve(".sandbox/solanaut-1/record-loading/fixture-")),path=join(directory,"record.jsonl");
  try{const result=run(`const {seal}=await import('./packages/sdk/src/log.ts');
    const path=${JSON.stringify(path)},entry=seal({v:1,kind:'report',seq:0,prev:'',at:0,decision:'a'.repeat(64),outcome:'unknown',source:'caller'});
    const first=record.fileStore(path,{ownership:'kernel',create:true});first.append(entry);first.close();
    const second=record.fileStore(path,{ownership:'kernel',create:false});try{if(second.entries.length!==1 || second.entries[0].hash!==entry.hash)throw new Error('record-only reopen differs');}finally{second.close();}
    console.log('record-only append/reopen verified');`);
    assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/record-only append\/reopen verified/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test("SNP-4/5: fabricated maintenance capabilities refuse before loading evaluation modules",()=>{
  const result=run(`const errors=await import('./packages/sdk/src/checkpoint-errors.ts');
    for(const [method,code,type] of [['publishOwnedCheckpoint','checkpoint-publication','CheckpointPublicationError'],['recoverOwnedCheckpoint','checkpoint-recovery','CheckpointRecoveryError']]){
    let refused=false;try{await record[method](record.memoryStore(),null,{});}catch(error){refused=error instanceof errors[type] && error.code===code;}if(!refused)throw new Error('fabricated maintenance capability accepted');}
    console.log('record-only capability refusal verified');`);
  assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/record-only capability refusal verified/);
});
