// Builder-authored installed-command preparation; no live RPC or funds are used.
import {strict as assert} from "node:assert";
import {after,before,test} from "node:test";
import {spawnSync} from "node:child_process";
import {generateKeyPairSync,sign} from "node:crypto";
import {constants,mkdtempSync,writeFileSync,readFileSync,rmSync,symlinkSync,linkSync,unlinkSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createGuard} from "../src/guard.ts";
import {memoryStore} from "../src/record.ts";
import {canonicalJSON} from "../src/canonical.ts";
import {encodeBase58} from "../src/base58.ts";
import {preparePolicyText} from "../src/signed-policy.ts";
import {seal,type Entry,type DecisionEntry} from "../src/log.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";

const directory=mkdtempSync(join(tmpdir(),"solanaut-replay-command-"));
after(()=>rmSync(directory,{recursive:true,force:true}));
const command="packages/sdk/bin/replay.ts",limit=1_048_576,marker="private-diagnostic-marker";
const policyPath=join(directory,"policy.json"),legacyPath=join(directory,"legacy.jsonl");
let legacy:DecisionEntry;
let signed:Awaited<ReturnType<typeof signedHistory>>;
const bytes=(entries:readonly Entry[])=>entries.map(entry=>canonicalJSON(entry)+"\n").join("");
const reseal=(entry:Entry,changes:Record<string,unknown>={})=>{const {hash:_,...body}=entry;return seal({...body,...changes} as never);};
const invoke=(...args:string[])=>spawnSync(process.execPath,[command,...args],{encoding:"utf8",timeout:5000,killSignal:"SIGKILL"});
function source(name:string,content:string|Uint8Array){const path=join(directory,name);writeFileSync(path,content);return path;}
function safeFailure(result:ReturnType<typeof invoke>,code=2){
  assert.equal(result.error,undefined,result.stdout+result.stderr);assert.equal(result.signal,null,result.stdout+result.stderr);
  assert.equal(result.status,code,result.stdout+result.stderr);assert.equal(result.stdout,"");
  assert.doesNotMatch(result.stderr,new RegExp(marker));assert.ok(!result.stderr.includes(directory));
}
async function signedHistory(){
  const operator=generateKeyPairSync("ed25519"),agent=generateKeyPairSync("ed25519");
  const address=(pair:typeof operator)=>encodeBase58(Buffer.from(pair.publicKey.export({format:"jwk"}).x!,"base64url"));
  const policy={...structuredClone(WORKLOAD_POLICY),principal:[address(agent)],latch:{...WORKLOAD_POLICY.latch,releaseKey:address(operator),cluster:"devnet" as const}};
  const trust={operatorKey:address(operator),guardId:policy.latch.guardId,cluster:policy.latch.cluster},issued="2026-10-08T00:00:00.000Z";
  const authorization=(input:unknown,version:number)=>{const text=preparePolicyText(input,version,issued);return {...trust,version,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString("base64")};};
  const store=memoryStore(),guard=await createGuard({policy,authorization:authorization(policy,1),log:store});
  const message=craftLegacy({header:[1,0,1],keys:[[...Buffer.from(agent.publicKey.export({format:"jwk"}).x!,"base64url")],key(2),key(0)],blockhash:key(20),instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
  const decision=guard.check({message,at:1000,blockHeight:10n,lastValidBlockHeight:100n},{clientId:"client",id:"unresolved"});
  assert.ok(decision.allow);assert.ok(guard.redeem(message,decision.hash,10n).ok);
  const signatureBytes=sign(null,message,agent.privateKey),signature=encodeBase58(signatureBytes);
  guard.recordSigning({stage:"signed",decision:decision.hash,wire:Buffer.concat([Buffer.from([1]),signatureBytes,message]).toString("base64"),signature});
  guard.recordSigning({stage:"send-started",decision:decision.hash,blockHeight:"11"});
  guard.recordSigning({stage:"response",decision:decision.hash,status:"uncertain",signature});
  for(let index=0;index<3;index++)guard.check({message:new Uint8Array([255]),at:1001+index});
  assert.ok(guard.status().latched);guard.close();
  const next={...policy,sol:{...policy.sol,maxPerTx:2_000_000_000n}},updated=await createGuard({policy:next,authorization:authorization(next,2),log:store});
  assert.ok(updated.status().latched);assert.equal(updated.redeem(message,decision.hash,12n).ok,false);updated.close();
  const entries=structuredClone(store.entries),record=source("signed.jsonl",bytes(entries)),publicTrust=source("public-trust.json",JSON.stringify(trust,null,2));
  return {entries,record,publicTrust,trust,policy,next,decision};
}
before(async()=>{
  writeFileSync(policyPath,canonicalJSON(WORKLOAD_POLICY));
  const guard=await createGuard({policy:WORKLOAD_POLICY});legacy=guard.check({message:null as never,at:1000});guard.close();
  writeFileSync(legacyPath,bytes([legacy]));signed=await signedHistory();
});

test("PKG-3: legacy two positional arguments preserve success text and exit",()=>{
  const result=invoke(legacyPath,policyPath);assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout,"replays: 1 entries, 1 decisions recomputed, no divergence\n");assert.equal(result.stderr,"");
});
test("PKG-3/VER-1: signed policy history replays with independent public trust and retained lifecycle facts",()=>{
  const result=invoke(signed.record,"-",signed.publicTrust);assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout,`replays: ${signed.entries.length} entries, ${signed.entries.filter(entry=>entry.kind==="decision").length} decisions recomputed, no divergence\n`);
  assert.equal(result.stderr,"");assert.equal(signed.entries.filter(entry=>entry.kind==="policy").length,2);
  assert.ok(signed.entries.some(entry=>entry.kind==="signing" && entry.event.stage==="send-started"));
  assert.ok(signed.entries.some(entry=>entry.kind==="decision" && entry.latch));
});
test("PKG-3: missing and extra positional arguments retain the usage exit",()=>{
  for(const args of [[],[legacyPath],[legacyPath,policyPath,"unused","extra"]]){
    const result=invoke(...args);assert.equal(result.status,2,result.stderr);assert.equal(result.stdout,"");
    assert.equal(result.stderr,"usage: npm run replay -- <record.jsonl> <policy.json|-> [public-trust.json]\n");
  }
});
test("OPR-2/PKG-3: malformed policy and trust sources never expose source text or sensitive paths",()=>{
  for(const field of ["policy","trust"]){
    const malformed=source(field+"-"+marker,`{"${marker}":`);
    safeFailure(field==="policy"?invoke(legacyPath,malformed):invoke(signed.record,"-",malformed));
  }
  safeFailure(invoke(legacyPath,join(directory,marker+"-missing")));
  safeFailure(invoke(join(directory,marker+"-missing-record"),policyPath));
});
test("OPR-2/PKG-3: invalid policies report fixed diagnostics rather than validator values",()=>{
  const invalid=source("invalid-policy.json",canonicalJSON({...WORKLOAD_POLICY,principal:[marker]}));safeFailure(invoke(legacyPath,invalid));
});
test("POL-2/VER-2/PKG-3: signed history cannot authenticate its own missing or substituted trust",()=>{
  for(const trust of [undefined,{...signed.trust,operatorKey:WORKLOAD_POLICY.principal[0]},{...signed.trust,guardId:"foreign"},{...signed.trust,cluster:"localnet"}]){
    const result=trust===undefined?invoke(signed.record,"-"):invoke(signed.record,"-",source("wrong-trust.json",JSON.stringify(trust)));
    assert.notEqual(result.status,0,result.stdout+result.stderr);assert.equal(result.signal,null);
    assert.ok(!result.stdout.includes("no divergence"));assert.doesNotMatch(result.stdout+result.stderr,new RegExp(marker));
  }
});
test("OPR-2/PKG-3: public trust accepts exactly its public pin fields",()=>{
  for(const trust of [null,[],{...signed.trust,privateKey:marker},{...signed.trust,operatorKey:5},{operatorKey:signed.trust.operatorKey,guardId:signed.trust.guardId},{"cluster,guardId":signed.trust.cluster,operatorKey:signed.trust.operatorKey},{"cluster,guardId,operatorKey":"joined-fields"}]){
    safeFailure(invoke(signed.record,"-",source("malformed-trust.json",JSON.stringify(trust))));
  }
});
test("VER-1/VER-2/PKG-3: forged signatures, unsupported profiles and policy rollback refuse",()=>{
  const first=signed.entries[0]!;assert.equal(first.kind,"policy");
  for(const changes of [{signature:Buffer.alloc(64).toString("base64")},{profile:{unsupported:marker}},{v:2}]){
    const changed=signed.entries.map((entry,index)=>index===0?reseal(entry,changes):entry);
    for(let index=1;index<changed.length;index++)changed[index]=reseal(changed[index]!,{prev:changed[index-1]!.hash});
    const result=invoke(source("unsupported.jsonl",bytes(changed)),"-",signed.publicTrust);
    assert.notEqual(result.status,0,result.stdout+result.stderr);assert.equal(result.signal,null);assert.ok(!result.stdout.includes("no divergence"));
    assert.doesNotMatch(result.stdout+result.stderr,new RegExp(marker));
  }
  const rollback=reseal(first,{seq:signed.entries.length,prev:signed.entries.at(-1)!.hash});
  const result=invoke(source("rollback.jsonl",bytes([...signed.entries,rollback])),"-",signed.publicTrust);
  assert.notEqual(result.status,0,result.stdout+result.stderr);assert.ok(!result.stdout.includes("no divergence"));
});
test("PKG-3: first divergence keeps its sequence/field and redacts detail values",()=>{
  const changed=reseal(legacy,{rule:"fail-closed",reason:marker});
  const result=invoke(source("divergence.jsonl",bytes([changed])),policyPath);
  assert.equal(result.status,1,result.stderr);assert.equal(result.stderr,"");
  assert.equal(result.stdout,"diverges at seq 0, field rule\n  recorded: [redacted]\n  recomputed: [redacted]\n");
});
test("SNP-1/PKG-3: blank lines, incomplete framing and corrupt final records cannot produce success",()=>{
  const valid=bytes([legacy]);
  for(const content of [valid+"\n",valid.trimEnd(),valid+`{"${marker}":`,valid.replace(legacy.hash,"0".repeat(64)),valid+JSON.stringify({...legacy,seq:1})+"\n",Buffer.from([255,10])]){
    safeFailure(invoke(source("bad-record-"+marker,content),policyPath));
  }
});
test("SNP-1/PKG-3: actual record line ceiling has an inclusive boundary",()=>{
  const empty=reseal(legacy,{reason:""}),base=Buffer.byteLength(canonicalJSON(empty));
  const boundary=reseal(legacy,{reason:"a".repeat(limit-base)});
  assert.equal(Buffer.byteLength(canonicalJSON(boundary)),limit);
  const result=invoke(source("line-boundary.jsonl",bytes([boundary])),policyPath);assert.equal(result.status,0,result.stderr);
  const large=reseal(legacy,{reason:"a".repeat(limit-base+1)});safeFailure(invoke(source("line-over.jsonl",bytes([large])),policyPath));
});
test("OPR-2/PKG-3: public JSON source ceilings are inclusive and invalid UTF-8 refuses",()=>{
  const policy=canonicalJSON(WORKLOAD_POLICY),trust=JSON.stringify(signed.trust);
  const policyBoundary=source("policy-boundary.json",policy+" ".repeat(limit-Buffer.byteLength(policy)));
  const trustBoundary=source("trust-boundary.json",trust+" ".repeat(limit-Buffer.byteLength(trust)));
  assert.equal(invoke(legacyPath,policyBoundary).status,0);assert.equal(invoke(signed.record,"-",trustBoundary).status,0);
  for(const path of [source("policy-over.json",policy+" ".repeat(limit-Buffer.byteLength(policy)+1)),source("policy-utf8.json",Buffer.from([255]))])safeFailure(invoke(legacyPath,path));
  for(const path of [source("trust-over.json",trust+" ".repeat(limit-Buffer.byteLength(trust)+1)),source("trust-utf8.json",Buffer.from([255]))])safeFailure(invoke(signed.record,"-",path));
  const text=JSON.stringify({...signed.trust,guardId:"UTF8-SENTINEL"}),offset=text.indexOf("UTF8-SENTINEL");
  safeFailure(invoke(signed.record,"-",source("trust-utf8-string.json",Buffer.concat([Buffer.from(text.slice(0,offset)),Buffer.from([255]),Buffer.from(text.slice(offset+"UTF8-SENTINEL".length))]))));
});
test("OPR-2/PKG-3: public descriptor opens enforce no-follow and nonblocking flags",()=>{
  const evidence=join(directory,"public-opens.json"),wrapper="import * as fs from 'node:fs'; export * from 'node:fs'; export function openSync(path,flags,...args){globalThis.replayPublicOpened(flags);return fs.openSync(path,flags,...args);}";
  const script=`
    import {registerHooks} from 'node:module';import {writeFileSync,constants} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
    const flags=[];globalThis.replayPublicOpened=value=>flags.push(value);process.on('exit',()=>writeFileSync(${JSON.stringify(evidence)},JSON.stringify(flags)));
    registerHooks({resolve(specifier,context,next){if(specifier==='node:fs' && context.parentURL?.endsWith('/bin/replay.ts'))return {url:'data:text/javascript,'+encodeURIComponent(${JSON.stringify(wrapper)}),shortCircuit:true};return next(specifier,context);}});
    process.argv=[process.execPath,${JSON.stringify(command)},${JSON.stringify(legacyPath)},${JSON.stringify(policyPath)}];await import(pathToFileURL(resolve(${JSON.stringify(command)})).href);
  `;
  const result=spawnSync(process.execPath,["--input-type=module","--eval",script],{encoding:"utf8",timeout:5000});assert.equal(result.status,0,result.stderr);
  const flags=JSON.parse(readFileSync(evidence,"utf8"));assert.equal(flags.length,1);
  assert.ok((flags[0]&constants.O_NOFOLLOW)!==0);assert.ok((flags[0]&constants.O_NONBLOCK)!==0);
});
test("OPR-2/PKG-3: observed public source replacement refuses after a real descriptor read",()=>{
  const path=source("replaced-policy.json",canonicalJSON(WORKLOAD_POLICY)),evidence=join(directory,"public-change.json");
  const wrapper="import * as fs from 'node:fs';export * from 'node:fs';export function readSync(...args){const count=fs.readSync(...args);if(count>0)globalThis.replayPublicChange();return count;}";
  const script=`
    import {registerHooks} from 'node:module';import {writeFileSync,renameSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
    let changed=false;globalThis.replayPublicChange=()=>{if(!changed){changed=true;writeFileSync(${JSON.stringify(path+".replacement")},${JSON.stringify(canonicalJSON(WORKLOAD_POLICY))});renameSync(${JSON.stringify(path+".replacement")},${JSON.stringify(path)});}};
    process.on('exit',()=>writeFileSync(${JSON.stringify(evidence)},JSON.stringify({changed})));
    registerHooks({resolve(specifier,context,next){if(specifier==='node:fs' && context.parentURL?.endsWith('/bin/replay.ts'))return {url:'data:text/javascript,'+encodeURIComponent(${JSON.stringify(wrapper)}),shortCircuit:true};return next(specifier,context);}});
    process.argv=[process.execPath,${JSON.stringify(command)},${JSON.stringify(legacyPath)},${JSON.stringify(path)}];await import(pathToFileURL(resolve(${JSON.stringify(command)})).href);
  `;
  const result=spawnSync(process.execPath,["--input-type=module","--eval",script],{encoding:"utf8",timeout:5000});safeFailure(result);
  assert.equal(JSON.parse(readFileSync(evidence,"utf8")).changed,true);
});
test("OPR-2/SNP-1/PKG-3: symlink, hardlink and directory inputs refuse without reading their content",()=>{
  for(const [name,path,invokeWith] of [
    ["record",legacyPath,(input:string)=>invoke(input,policyPath)],
    ["policy",policyPath,(input:string)=>invoke(legacyPath,input)],
    ["trust",signed.publicTrust,(input:string)=>invoke(signed.record,"-",input)],
  ] as const){
    const link=join(directory,name+"-symlink"),hard=join(directory,name+"-hardlink");symlinkSync(path,link);
    safeFailure(invokeWith(link));safeFailure(invokeWith(directory));linkSync(path,hard);
    try{safeFailure(invokeWith(path));safeFailure(invokeWith(hard));}finally{unlinkSync(hard);}
  }
});
test("OPR-2/SNP-1/PKG-3: special files fail without a blocking read",()=>{
  const fifo=join(directory,"fifo-"+marker),made=spawnSync("mkfifo",[fifo],{encoding:"utf8",timeout:1000});assert.equal(made.status,0,made.stderr);
  safeFailure(invoke(fifo,policyPath));safeFailure(invoke(legacyPath,fifo));safeFailure(invoke(signed.record,"-",fifo));
});
function observed(args:string[],changed?:string){
  const evidence=join(directory,"observation.json"),script=`
    import {registerHooks} from 'node:module';
    import {writeFileSync} from 'node:fs';
    import {resolve} from 'node:path';
    import {pathToFileURL} from 'node:url';
    const args=${JSON.stringify(args)},record=args[0];let opens=0,closes=0;
    globalThis.replayCommandOpened=()=>{opens++;if(opens===2 && ${JSON.stringify(changed)!==undefined})writeFileSync(record,${JSON.stringify(changed??"")});};
    globalThis.replayCommandClosed=()=>{closes++;};
    process.on('exit',()=>writeFileSync(${JSON.stringify(evidence)},JSON.stringify({opens,closes})));
    registerHooks({resolve(specifier,context,next){
      if(specifier==='node:fs/promises' && context.parentURL?.endsWith('/archive.ts'))return {url:'data:text/javascript,'+encodeURIComponent(${JSON.stringify("import fs from 'node:fs/promises'; export default new Proxy(fs,{get(target,key){if(key!=='open')return Reflect.get(target,key);return async function(...args){globalThis.replayCommandOpened();const handle=await target.open(...args);return new Proxy(handle,{get(object,field){if(field==='close')return async()=>{globalThis.replayCommandClosed();return object.close();};const value=Reflect.get(object,field);return typeof value==='function'?value.bind(object):value;}});};}}); ")}),shortCircuit:true};
      return next(specifier,context);
    }});
    process.argv=[process.execPath,${JSON.stringify(command)},...args];
    await import(pathToFileURL(resolve(${JSON.stringify(command)})).href);
  `;
  const result=spawnSync(process.execPath,["--input-type=module","--eval",script],{encoding:"utf8",timeout:5000,killSignal:"SIGKILL"});
  assert.equal(result.error,undefined,result.stdout+result.stderr);assert.equal(result.signal,null,result.stdout+result.stderr);
  return {result,reads:JSON.parse(readFileSync(evidence,"utf8")) as {opens:number;closes:number}};
}
test("SNP-7/PKG-3: successful command uses two complete actual archive reads",()=>{
  const {result,reads}=observed([legacyPath,policyPath]);assert.equal(result.status,0,result.stderr);
  assert.equal(reads.opens,2);assert.equal(reads.closes,2);assert.match(result.stdout,/no divergence/);
});
test("SNP-7/PKG-3: valid but changed complete sources between actual reads refuse",()=>{
  const path=source("between-reads.jsonl",bytes([legacy])),changed=bytes([reseal(legacy,{reason:"different valid explanation"})]);
  const {result,reads}=observed([path,policyPath],changed);safeFailure(result);assert.equal(reads.opens,2);assert.equal(reads.closes,2);
});
test("SNP-8/PKG-3: successful verification leaves all input bytes and directory contents unchanged",()=>{
  const paths=[legacyPath,policyPath,signed.record,signed.publicTrust],before=paths.map(path=>readFileSync(path)),names=readdirSync(directory).sort();
  assert.equal(invoke(legacyPath,policyPath).status,0);assert.equal(invoke(signed.record,"-",signed.publicTrust).status,0);
  for(const [index,path] of paths.entries())assert.deepEqual(readFileSync(path),before[index]);assert.deepEqual(readdirSync(directory).sort(),names);
});
