// PKG-1 to PKG-3: exercise an actual npm tarball, not the workspace symlink.
// Cache metadata with npm cache add @gubernaut/core@1.0.1; install offline without scripts.

import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { craftLegacy, key } from "../../packages/sdk/test/support/craft.ts";
import { WORKLOAD_POLICY } from "../../packages/sdk/test/support/workload.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const candidate = resolve(root, process.env.SOLANAUT_PACKAGE ?? ".sandbox/releases/sdk");
// Outside the repository so ancestor node_modules cannot mask undeclared dependencies.
const scratch = mkdtempSync(join(tmpdir(), "solanaut-consumer-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const consumer = join(scratch, "consumer");
mkdirSync(consumer);
const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch], { cwd: candidate, encoding: "utf8" }))[0];
writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "solanaut-consumer-test", private: true, type: "module" }));
execFileSync("npm", ["install", "--offline", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund", join(scratch, packed.filename)], { cwd: consumer, stdio: "pipe" });

const transfer = (to: number) => craftLegacy({
  header: [1, 0, 1], keys: [key(1), key(to), key(0)],
  instructions: [{ program: 2, accounts: [0, 1], data: [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }],
});
const inputPolicy = JSON.stringify(WORKLOAD_POLICY, (_key, value) => typeof value === "bigint" ? value.toString() : value);

test("PKG-1/SNP-7: private owned facade restores and serializes installed JavaScript outside the workspace",()=>{
  const script=`
    import {createGuard,preparePolicyText,encodeBase58} from '@solanaut/sdk';
    import {generateKeyPairSync,sign} from 'node:crypto';
    import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
    import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
    import {tmpdir} from 'node:os';import {join} from 'node:path';
    const base=import.meta.resolve('@solanaut/sdk'),{openOwnedGuard,OwnedGuardError}=await import(new URL('./owned-guard.js',base)),{fileStore,publishOwnedRequestIndex}=await import(new URL('./record.js',base));
    const root=await import('@solanaut/sdk');if('openOwnedGuard' in root || 'OwnedGuardError' in root)throw new Error('private facade leaked root exports');
    const directory=mkdtempSync(join(tmpdir(),'solanaut-owned-facade-')),path=join(directory,'guard.jsonl'),operator=generateKeyPairSync('ed25519');
    const operatorKey=encodeBase58(Buffer.from(operator.publicKey.export({format:'jwk'}).x,'base64url'));
    const policy=JSON.parse(process.argv[1]);policy.latch.releaseKey=operatorKey;policy.latch.cluster='devnet';
    const issued='2026-10-09T00:00:00.000Z',trust={operatorKey,guardId:policy.latch.guardId,cluster:'devnet'};
    const authorization=version=>{const text=preparePolicyText(policy,version,issued);return {...trust,version,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString('base64')};};
    const options=()=>({path,policy,authorization:authorization(1)}),refuse=async call=>{let denied=false;try{await call();}catch(error){denied=error instanceof OwnedGuardError && error.code==='owned-guard';}if(!denied)throw new Error('installed private facade accepted invalid operation');};
    try{
      const missing=join(directory,'missing.jsonl');await refuse(()=>openOwnedGuard({...options(),path:missing}));if(existsSync(missing))throw new Error('installed facade created history');
      const store=fileStore(path,{ownership:'kernel'}),trusted=await createGuard({policy,authorization:authorization(1),log:store});await publishOwnedRequestIndex(store,{policyTrust:trust});trusted.close();
      const before=readFileSync(path);await refuse(()=>openOwnedGuard({...options(),authorization:authorization(2)}));if(!readFileSync(path).equals(before))throw new Error('installed facade upgraded policy');
      const input=options(),opening=openOwnedGuard(input);input.authorization.guardId='changed';const g=await opening;
      try{
        if(!Object.isFrozen(g)||!Object.isFrozen(g.policy.latch)||'guard' in g||'store' in g||'entries' in g)throw new Error('installed facade exposed mutable authority');
        const message=new Uint8Array(Buffer.from(process.argv[2],'base64')),admitted=await g.check({message,at:900,blockHeight:10n,lastValidBlockHeight:20n},{clientId:'client',id:'redeem'});
        if(!admitted.allow)throw new Error('installed redemption fixture denied');
        await refuse(()=>g.redeem(message,admitted.hash,21n));
        const shared=new Uint8Array(new SharedArrayBuffer(message.length));shared.set(message);const redeeming=g.redeem(shared,admitted.hash,10n),redemptionStatus=g.status();shared.fill(255);
        const redeemed=await redeeming;if(!redeemed.ok||!Object.isFrozen(redeemed)||(await redemptionStatus).seq!==admitted.seq+2)throw new Error('installed redemption capture or durability failed');
        await refuse(()=>g.redeem(message,admitted.hash,10n));
        const id={clientId:'client',id:'captured'},payload={decision:'a'.repeat(64)},pending=g.beginRequest(id,'report',payload,1000),observed=g.status();id.id='changed';payload.decision='b'.repeat(64);
        const start=await pending;if(start.request.id!=='captured'||JSON.parse(start.payload).decision!=='a'.repeat(64)||(await observed).seq!==start.seq+1)throw new Error('installed facade capture or FIFO failed');
        const actual={clientId:'client',id:'captured'},answer={nested:{ready:true}},finishing=g.finishRequest(actual,start.hash,answer);answer.nested.ready=false;await finishing;
        const result=await g.requestResult(actual,start.hash);if(!result.nested.ready||!Object.isFrozen(result.nested))throw new Error('installed facade response capture failed');
        await refuse(()=>g.beginRequest(actual,'status',{},2000));await g.beginRequest({clientId:'client',id:'next'},'status',{},2000);
        const bytes=new Uint8Array(new SharedArrayBuffer(1));bytes[0]=255;const decision=g.check({message:bytes,at:2001},{clientId:'client',id:'proposal'});bytes[0]=0;if((await decision).message!=='/w==')throw new Error('installed facade retained shared bytes');
        await refuse(()=>g.check({message:Uint8Array.of(0),at:2001},{clientId:'client',id:'proposal'}));
        const latching=[0,1].map(i=>g.check({message:Uint8Array.of(255),at:2002+i},{clientId:'client',id:'latch-'+i})),preparing=g.releaseText('2026-10-10T00:00:00.000Z');await Promise.all(latching);const text=await preparing;
        await refuse(()=>g.releaseText('2026-10-10'));await refuse(()=>g.releaseText('2026-99-99T00:00:00.000Z'));
        const releaseSignature=new Uint8Array(new SharedArrayBuffer(64));releaseSignature.set(sign(null,Buffer.from(text),operator.privateKey));const releasing=g.release(text,releaseSignature,4000),releaseStatus=g.status();releaseSignature.fill(0);
        const released=await releasing;if(!released.released||!Object.isFrozen(released)||(await releaseStatus).latched)throw new Error('installed release capture or durability failed');await refuse(()=>g.release(text,releaseSignature,4000));
        const preceding=g.beginRequest({clientId:'client',id:'last'},'status',{},2002),closing=g.close();await preceding;await closing;await refuse(()=>g.status());await g.close();
      }finally{await g.close();}
      const index=readFileSync(path+'.request-index');writeFileSync(path+'.request-index','corrupt');await refuse(()=>openOwnedGuard(options()));writeFileSync(path+'.request-index',index);
      const restored=await openOwnedGuard(options());try{const decision=readFileSync(path,'utf8').trim().split(String.fromCharCode(10)).map(line=>JSON.parse(line)).find(entry=>entry.kind==='decision'&&entry.request?.id==='redeem');await refuse(()=>restored.redeem(new Uint8Array(Buffer.from(process.argv[2],'base64')),decision.hash,10n));
        for(let i=0;i<3;i++)await restored.check({message:Uint8Array.of(255),at:5000+i},{clientId:'client',id:'disk-latch-'+i});
        const before=await restored.status(),text=await restored.releaseText('2026-10-10T00:00:00.000Z'),signature=new Uint8Array(sign(null,Buffer.from(text),operator.privateKey)),original=fs.writeSync;
        try{fs.writeSync=()=>{throw new Error('PRIVATE_SENTINEL: release storage unavailable');};syncBuiltinESMExports();await refuse(()=>restored.release(text,signature,6000));}finally{fs.writeSync=original;syncBuiltinESMExports();}
        if(!(await restored.status()).latched||(await restored.status()).seq!==before.seq)throw new Error('installed failed release changed latch');
      }finally{await restored.close();}
    }finally{rmSync(directory,{recursive:true,force:true});}
    console.log('private owned facade qualified');`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,inputPolicy,Buffer.from(transfer(2)).toString("base64")],{cwd:consumer,encoding:"utf8",timeout:15000});
  assert.equal(result.status,0,result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.stdout,"private owned facade qualified\n");
});

test("PKG-1/STO-2/SIG-8: installed writer refuses live journal damage and cannot revive after repair", () => {
  const script = `
    import {createGuard} from '@solanaut/sdk';
    import fs from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
    const base=import.meta.resolve('@solanaut/sdk'),{fileStore}=await import(new URL('./record.js',base));
    const directory=fs.mkdtempSync(join(tmpdir(),'solanaut-live-record-'));
    try{for(const ownership of ['manual','kernel'])for(const damage of ['append','truncate','overwrite']){
      const path=join(directory,ownership+'-'+damage+'.jsonl'),store=fileStore(path,{ownership}),g=await createGuard({policy:JSON.parse(process.argv[1]),log:store});
      try{
        const message=new Uint8Array(Buffer.from(process.argv[2],'base64'));
        if(!g.check({message,at:1000}).allow)throw new Error('live record fixture denied');
        const original=fs.readFileSync(path,'utf8');
        if(damage==='append')fs.appendFileSync(path,'{}'+String.fromCharCode(10));
        else if(damage==='truncate')fs.truncateSync(path,0);
        else{if(!original.includes('"at":1000'))throw new Error('overwrite fixture absent');fs.writeFileSync(path,original.replace('"at":1000','"at":9000'));}
        const damaged=fs.readFileSync(path,'utf8'),denied=g.check({message,at:2000});
        if(denied.seq!==-1||denied.rule!=='fail-closed'||fs.readFileSync(path,'utf8')!==damaged||g.entries().length!==1)throw new Error('installed writer acknowledged damaged history');
        fs.writeFileSync(path,original);if(g.check({message,at:3000}).seq!==-1||fs.readFileSync(path,'utf8')!==original)throw new Error('installed writer revived after damage');
        let failed=false;try{store.append(store.entries[0]);}catch(error){failed=/closed or failed/.test(error.message);}if(!failed)throw new Error('installed store failure was not permanent');
      }finally{g.close();store.close();}
    }}finally{fs.rmSync(directory,{recursive:true,force:true});}
    console.log('live journal damage refused');`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,inputPolicy,Buffer.from(transfer(2)).toString("base64")],{cwd:consumer,encoding:"utf8",timeout:15000});
  assert.equal(result.status,0,result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.stdout,"live journal damage refused\n");
});

test("PKG-1/OWN-2: installed record refuses journal and mutex aliases with failed-startup cleanup", () => {
  const script=`
    import fs from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
    const base=import.meta.resolve('@solanaut/sdk'),{fileStore}=await import(new URL('./record.js',base));
    const directory=fs.mkdtempSync(join(tmpdir(),'solanaut-record-alias-'));
    const refuse=call=>{let denied=false;try{const other=call();other.close();}catch(error){denied=/single-link/.test(error.message);}if(!denied)throw new Error('installed record admitted an aliased inode');};
    try{
      for(const ownership of ['manual','kernel']){
        const path=join(directory,ownership+'.jsonl'),alias=path+'.alias',owner=fileStore(path,{ownership});
        try{fs.linkSync(path,alias);refuse(()=>fileStore(alias,{ownership,create:false}));}finally{owner.close();fs.unlinkSync(alias);}
        fileStore(path,{ownership,create:false}).close();fileStore(alias,{ownership}).close();
      }
      const path=join(directory,'mutex.jsonl');fileStore(path,{ownership:'kernel'}).close();
      const mutex=path+'.lock',alias=mutex+'.alias',before=fs.readFileSync(mutex);fs.linkSync(mutex,alias);
      try{refuse(()=>fileStore(path,{ownership:'kernel',create:false}));if(!fs.readFileSync(mutex).equals(before))throw new Error('installed aliased mutex evidence changed');}finally{fs.unlinkSync(alias);}
      fileStore(path,{ownership:'kernel',create:false}).close();
    }finally{fs.rmSync(directory,{recursive:true,force:true});}
    console.log('record aliases refused');`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script],{cwd:consumer,encoding:"utf8",timeout:15000});
  assert.equal(result.status,0,result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.stdout,"record aliases refused\n");
});

test("PKG-1/STO-4: installed record rejects changes during startup read and releases ownership", () => {
  const script=`
    import {createGuard} from '@solanaut/sdk';import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {tmpdir} from 'node:os';import {join} from 'node:path';
    const base=import.meta.resolve('@solanaut/sdk'),{fileStore}=await import(new URL('./record.js',base)),directory=fs.mkdtempSync(join(tmpdir(),'solanaut-read-stability-'));
    try{for(const ownership of ['manual','kernel'])for(const damage of ['append','truncate','overwrite']){
      const path=join(directory,ownership+'-'+damage+'.jsonl'),seed=await createGuard({policy:JSON.parse(process.argv[1]),log:path});
      if(!seed.check({message:new Uint8Array(Buffer.from(process.argv[2],'base64')),at:1000}).allow)throw new Error('read stability fixture denied');seed.close();
      const original=fs.readFileSync(path,'utf8'),inode=fs.statSync(path).ino,read=fs.readFileSync;let changed=false,denied=false;
      try{
        fs.readFileSync=(...args)=>{const value=Reflect.apply(read,fs,args);if(!changed&&typeof args[0]==='number'&&(typeof value==='string'||Buffer.isBuffer(value))&&fs.fstatSync(args[0]).ino===inode){changed=true;if(damage==='append')fs.appendFileSync(path,'{}'+String.fromCharCode(10));else if(damage==='truncate')fs.truncateSync(path,0);else fs.writeFileSync(path,original.replace('"at":1000','"at":9000'));}return value;};syncBuiltinESMExports();
        try{fileStore(path,{ownership,create:false}).close();}catch(error){denied=/record changed during read/.test(error.message);}
      }finally{fs.readFileSync=read;syncBuiltinESMExports();}
      if(!changed||!denied||fs.readFileSync(path,'utf8')===original)throw new Error('installed record accepted or repaired an unstable read');
      fs.writeFileSync(path,original);fileStore(path,{ownership,create:false}).close();
    }}finally{fs.rmSync(directory,{recursive:true,force:true});}
    console.log('unstable startup reads refused');`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,inputPolicy,Buffer.from(transfer(2)).toString("base64")],{cwd:consumer,encoding:"utf8",timeout:15000});
  assert.equal(result.status,0,result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.stdout,"unstable startup reads refused\n");
});

test("PKG-1/STO-5: installed record rejects inconsistent read lengths and safely repairs genuine UTF-8 tails", () => {
  const script=`
    import {createGuard} from '@solanaut/sdk';import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {tmpdir} from 'node:os';import {join} from 'node:path';
    const base=import.meta.resolve('@solanaut/sdk'),{fileStore}=await import(new URL('./record.js',base)),directory=fs.mkdtempSync(join(tmpdir(),'solanaut-read-completion-'));
    try{for(const ownership of ['manual','kernel']){
      for(const fault of ['short','oversized']){
        const path=join(directory,ownership+'-'+fault+'.jsonl'),seed=await createGuard({policy:JSON.parse(process.argv[1]),log:path});
        if(!seed.check({message:new Uint8Array(Buffer.from(process.argv[2],'base64')),at:1000}).allow)throw new Error('read completion fixture denied');seed.close();
        const original=fs.readFileSync(path),inode=fs.statSync(path).ino,read=fs.readFileSync;let changed=false,denied=false;
        try{fs.readFileSync=(...args)=>{const value=Reflect.apply(read,fs,args);if(!changed&&typeof args[0]==='number'&&fs.fstatSync(args[0]).ino===inode){changed=true;if(typeof value==='string')return fault==='short'?value.slice(0,-2):value+'{';return fault==='short'?value.subarray(0,value.length-2):Buffer.concat([value,Buffer.from('{')]);}return value;};syncBuiltinESMExports();try{fileStore(path,{ownership,create:false}).close();}catch(error){denied=/record read was incomplete/.test(error.message);}}
        finally{fs.readFileSync=read;syncBuiltinESMExports();}
        if(!changed||!denied||!fs.readFileSync(path).equals(original))throw new Error('installed incomplete read removed or accepted acknowledged history');
        fileStore(path,{ownership,create:false}).close();
        fs.appendFileSync(path,Buffer.from([240,159]));const restored=fileStore(path,{ownership,create:false});try{if(restored.entries.length!==1||!fs.readFileSync(path).equals(original))throw new Error('installed genuine UTF-8 tail recovery failed');}finally{restored.close();}
      }
    }}finally{fs.rmSync(directory,{recursive:true,force:true});}
    console.log('incomplete reads refused without loss');`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,inputPolicy,Buffer.from(transfer(2)).toString("base64")],{cwd:consumer,encoding:"utf8",timeout:15000});
  assert.equal(result.status,0,result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.stdout,"incomplete reads refused without loss\n");
});

test("PKG-1/STO-2: installed writer refuses inconsistent physical append lengths before acknowledgement", () => {
  const script=`
    import {createGuard} from '@solanaut/sdk';import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {tmpdir} from 'node:os';import {join} from 'node:path';
    const {fileStore}=await import(new URL('./record.js',import.meta.resolve('@solanaut/sdk'))),directory=fs.mkdtempSync(join(tmpdir(),'solanaut-write-completion-'));
    try{for(const ownership of ['manual','kernel'])for(const fault of ['missing','extra']){
      const path=join(directory,ownership+'-'+fault+'.jsonl'),store=fileStore(path,{ownership}),g=await createGuard({policy:JSON.parse(process.argv[1]),log:store}),inode=fs.statSync(path).ino,write=fs.writeSync;let changed=false;
      try{fs.writeSync=(...args)=>{if(!changed&&fs.fstatSync(args[0]).ino===inode){changed=true;if(fault==='missing')return args[3];const count=Reflect.apply(write,fs,args);write(args[0],Buffer.from('{}'+String.fromCharCode(10)));return count;}return Reflect.apply(write,fs,args);};syncBuiltinESMExports();
        const first=g.check({message:new Uint8Array(Buffer.from(process.argv[2],'base64')),at:1000});if(!changed||first.seq!==-1||first.rule!=='fail-closed'||store.entries.length!==0)throw new Error('installed writer acknowledged inconsistent physical bytes');
        fs.writeSync=write;syncBuiltinESMExports();const evidence=fs.readFileSync(path);if(g.check({message:new Uint8Array(Buffer.from(process.argv[2],'base64')),at:2000}).seq!==-1||!fs.readFileSync(path).equals(evidence))throw new Error('installed failed writer appended after repair');
      }finally{fs.writeSync=write;syncBuiltinESMExports();g.close();store.close();}
    }for(const ownership of ['manual','kernel']){
      const path=join(directory,ownership+'-complete.jsonl'),store=fileStore(path,{ownership}),g=await createGuard({policy:JSON.parse(process.argv[1]),log:store});
      try{for(let at=1000;at<1002;at++)if(g.check({message:new Uint8Array(Buffer.from(process.argv[2],'base64')),at}).seq!==at-1000)throw new Error('installed complete nonempty append refused');if(store.entries.length!==2||fs.readFileSync(path,'utf8').trimEnd().split(String.fromCharCode(10)).length!==2)throw new Error('installed complete entries were not kept');}finally{g.close();store.close();}
    }}finally{fs.rmSync(directory,{recursive:true,force:true});}
    console.log('inconsistent appends refused');`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,inputPolicy,Buffer.from(transfer(2)).toString("base64")],{cwd:consumer,encoding:"utf8",timeout:15000});
  assert.equal(result.status,0,result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.stdout,"inconsistent appends refused\n");
});

test("PKG-1: installed JavaScript verifies Keel and gives the source's payment/drain verdicts", () => {
  const script = `
    import {createGuard,replay,memoryStore} from '@solanaut/sdk';
    import {createHash} from 'node:crypto';
    const g = await createGuard({policy: JSON.parse(process.argv[1]), sensor: () => ({intensity:0,valence:0,repetition:0})});
    const pay = g.check({message: new Uint8Array(Buffer.from(process.argv[2], 'base64')), at: 1000});
    const drain = g.check({message: new Uint8Array(Buffer.from(process.argv[3], 'base64')), at: 2000});
    console.log(JSON.stringify({allow: pay.allow, rule: drain.rule, verified: pay.keel.verified}));
    g.close();
    const original=await createGuard({policy:JSON.parse(process.argv[1])});
    const {hash,...body}=original.check({message:null,at:0});original.close();
    const forged={...body,posture:'DEFAULT',telemetry:{intensity:0,valence:0,repetition:0},temperatureMax:0};
    const canonical=JSON.stringify(forged,(_key,value)=>value && typeof value==='object' && !Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
    const entry={...forged,hash:createHash('sha256').update(canonical).digest('hex')};
    if((await replay([entry],JSON.parse(process.argv[1]))).ok)throw new Error('malformed controller event replayed');
    const store=memoryStore();store.entries.push(entry);let refused=false;
    try{const restored=await createGuard({policy:JSON.parse(process.argv[1]),log:store});restored.close();}
    catch(error){refused=/malformed.*Keel/.test(error.message);}
    if(!refused)throw new Error('malformed controller event restored');
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, inputPolicy, Buffer.from(transfer(2)).toString("base64"), Buffer.from(transfer(3)).toString("base64")], { cwd: consumer, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { allow: true, rule: "destination-not-allowed", verified: "bytes" });
  const preview=join(consumer,"offline-preview.mjs");writeFileSync(preview,readFileSync(new URL("../../examples/offline-preview.mjs",import.meta.url)));
  const shown=spawnSync(process.execPath,[preview],{cwd:consumer,encoding:"utf8"});
  assert.equal(shown.status,0,shown.stderr);
  assert.deepEqual(JSON.parse(shown.stdout),{payment:"allowed",unlistedDestination:"destination-not-allowed",reusedReceipt:false,replay:"matched",sent:false});
});

test("PKG-1: the packed runtime has no executable TypeScript, test fixtures or development dependencies", () => {
  const files: string[] = packed.files.map((f: { path: string }) => f.path);
  assert.ok(files.includes("dist/src/index.js"));
  assert.ok(files.includes("dist/src/index.d.ts"));
  assert.ok(files.every((f) => !f.endsWith(".ts") || f.endsWith(".d.ts")));
  assert.ok(files.every((f) => !f.includes("test/") && !f.startsWith("src/")));
  const manifest = JSON.parse(readFileSync(join(consumer, "node_modules/@solanaut/sdk/package.json"), "utf8"));
  assert.equal(manifest.private, true, "candidate remains unpublished and private");
  assert.equal(manifest.version, "0.0.0");
  assert.equal(manifest.devDependencies, undefined);
  assert.deepEqual(manifest.dependencies, { "@gubernaut/core": "1.0.1" });
});

test("PKG-2: consumer declarations resolve and reject invalid sensor telemetry", () => {
  writeFileSync(join(consumer, "consumer.ts"), `
    import {createGuard, createSendingClient, SignerClientError, verifyArchive, prepareCheckpointText, verifyCheckpointBinding, type CheckpointBinding, type CheckpointTrust, type CheckpointDigests, type ArchiveOptions, type ArchiveReceipt, type ArchiveErrorCode, type GuardOptions, type Decision, type SendingResult} from '@solanaut/sdk';
    const options: GuardOptions = {policy: {}, sensor: () => ({intensity:0,valence:0,repetition:0})};
    const g = await createGuard(options);
    const decision: Decision = g.check({message: new Uint8Array(), at: 0});
    const verdict: boolean = decision.allow;
    // @ts-expect-error telemetry must contain bounded numbers, not text
    const bad: GuardOptions = {policy: {}, sensor: () => ({intensity:0,valence:0,repetition:'text'})};
    void verdict; void bad;
    const client = createSendingClient({socket:'/run/solanaut/signer.sock',clientId:'agent'});
    const result = await client.propose({id:'payment',message:new Uint8Array()});
    const status: string = result.status;
    const transport = new SignerClientError('connection','offline');
    const uncertain: boolean = transport.mayHaveExecuted;
    // @ts-expect-error sending clients cannot partially sign
    client.signTransactions([]);
    // @ts-expect-error message bytes cannot be replaced by caller telemetry
    client.propose({id:'payment',message:'base64'});
    void status; void uncertain;
    const archiveOptions: ArchiveOptions = {maxLineBytes:1024,expectedAnchor:{seq:0,head:'a'.repeat(64)}};
    const receipt: ArchiveReceipt = await verifyArchive('history.jsonl',archiveOptions);
    const code: ArchiveErrorCode = 'anchor';
    const anchorSequence: number | undefined = receipt.anchor?.seq;
    // @ts-expect-error anchor sequence is a safe integer number, not a decimal string
    verifyArchive('history.jsonl',{expectedAnchor:{seq:'0',head:'a'.repeat(64)}});
    // @ts-expect-error line limits are numeric
    verifyArchive('history.jsonl',{maxLineBytes:'1024'});
    // @ts-expect-error unknown pins cannot silently disable verification
    verifyArchive('history.jsonl',{expectedHed:'wrong'});
    void receipt; void code;
    const checkpointTrust: CheckpointTrust = {checkpointKey:'key',principalKeys:['principal'],anchorKey:'anchor',guardId:'guard',cluster:'devnet'};
    const checkpointDigests: CheckpointDigests = {archiveDigest:'digest',stateDigest:'digest',prefixDigest:'digest'};
    const checkpoint: Readonly<CheckpointBinding> = verifyCheckpointBinding({}, {snapshot:'signature',prefix:'signature'}, checkpointTrust, checkpointDigests);
    const checkpointSequence: number = checkpoint.seq;
    // @ts-expect-error checkpoint identity must pin a supported cluster
    const wrongCheckpointTrust: CheckpointTrust = {...checkpointTrust,cluster:'mainnet-beta'};
    // @ts-expect-error signature records require both domains
    verifyCheckpointBinding({}, {snapshot:'signature'}, checkpointTrust, checkpointDigests);
    void prepareCheckpointText; void checkpointSequence; void wrongCheckpointTrust;
    const catalogue = (await import('@solanaut/sdk')).prepareCheckpointArchives([], {seq:0,head:''});
    const prepared: import('@solanaut/sdk').PreparedCheckpointArchives = catalogue;
    const digest: string = prepared.digest;
    // @ts-expect-error prepared payloads cannot be changed by consumers
    prepared.text = 'changed';
    void digest;
  `);
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({ compilerOptions: { noEmit: true, strict: true, module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022", types: [], lib: ["ES2022", "DOM"] }, files: ["consumer.ts"] }));
  const result = spawnSync(join(root, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], { cwd: consumer, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
test("SNP-1/PKG-1: installed archive verification checks real history and rejects a wrong pin", () => {
  const script = `
    import {createGuard,verifyArchive,ArchiveError} from '@solanaut/sdk';
    import {writeFileSync} from 'node:fs';
    const g=await createGuard({policy:JSON.parse(process.argv[1]),sensor:()=>({intensity:0,valence:0,repetition:0})});
    g.check({message:new Uint8Array(Buffer.from(process.argv[2],'base64')),at:1000});
    const entries=g.entries();
    writeFileSync('history.jsonl',entries.map(e=>JSON.stringify(e)).join('\\n')+'\\n');
    const head=entries.at(-1).hash;
    const receipt=await verifyArchive('history.jsonl',{expectedHead:head});
    let failure;
    try { await verifyArchive('history.jsonl',{expectedHead:'0'.repeat(64)}); }
    catch(e) { failure={typed:e instanceof ArchiveError,code:e.code}; }
    console.log(JSON.stringify({entries:receipt.entries,head:receipt.head===head,failure}));
    g.close();
  `;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,inputPolicy,Buffer.from(transfer(2)).toString("base64")],{cwd:consumer,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{entries:1,head:true,failure:{typed:true,code:"head"}});
  const command=spawnSync(join(consumer,"node_modules/.bin/solanaut-verify-archive"),["history.jsonl"],{cwd:consumer,encoding:"utf8"});
  assert.equal(command.status,0,command.error?.message ?? command.stderr);
  assert.equal(JSON.parse(command.stdout).entries,1);
  const refused=spawnSync(join(consumer,"node_modules/.bin/solanaut-verify-archive"),["history.jsonl","--head","0".repeat(64)],{cwd:consumer,encoding:"utf8"});
  assert.equal(refused.status,1); assert.equal(JSON.parse(refused.stderr).error.code,"head");
});

test("ANC-3/PKG-1: installed API and command bind an externally trusted archive anchor",()=> {
  const script=`
    import {createGuard,verifyArchive,ArchiveError} from '@solanaut/sdk';
    import {writeFileSync} from 'node:fs';
    const guard=await createGuard({policy:JSON.parse(process.argv[1]),sensor:()=>({intensity:0,valence:0,repetition:0})});
    guard.check({message:new Uint8Array(Buffer.from(process.argv[2],'base64')),at:1000});
    const head=guard.entries()[0].hash;
    writeFileSync('anchor-history.jsonl',guard.entries().map(entry=>JSON.stringify(entry)+'\\n').join('')); guard.close();
    const receipt=await verifyArchive('anchor-history.jsonl',{expectedAnchor:{seq:0,head}});
    let refusal;
    try {await verifyArchive('anchor-history.jsonl',{expectedAnchor:{seq:0,head:'0'.repeat(64)}});}
    catch(error) {refusal={typed:error instanceof ArchiveError,code:error.code};}
    console.log(JSON.stringify({head,anchor:receipt.anchor,refusal}));`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,inputPolicy,Buffer.from(transfer(2)).toString("base64")],{cwd:consumer,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr); const evidence=JSON.parse(result.stdout);
  assert.deepEqual(evidence.anchor,{seq:0,head:evidence.head}); assert.deepEqual(evidence.refusal,{typed:true,code:"anchor"});
  const command=spawnSync(join(consumer,"node_modules/.bin/solanaut-verify-archive"),["anchor-history.jsonl","--anchor-seq","0","--anchor-head",evidence.head],{cwd:consumer,encoding:"utf8"});
  assert.equal(command.status,0,command.stderr); assert.deepEqual(JSON.parse(command.stdout).anchor,evidence.anchor);
  const refused=spawnSync(join(consumer,"node_modules/.bin/solanaut-verify-archive"),["anchor-history.jsonl","--anchor-seq","1","--anchor-head",evidence.head],{cwd:consumer,encoding:"utf8"});
  assert.equal(refused.status,1,refused.stderr); assert.equal(JSON.parse(refused.stderr).error.code,"anchor");
});

test("POL-1/5/PKG-1: installed policy command prepares canonical public signing text",()=> {
  const path=join(consumer,"policy.json"); writeFileSync(path,inputPolicy);
  const issued="2026-10-06T00:00:00.000Z";
  const expected=spawnSync(process.execPath,["--input-type=module","-e",`import {preparePolicyText} from '@solanaut/sdk'; console.log(JSON.stringify(preparePolicyText(JSON.parse(process.argv[1]),2,process.argv[2])));`,inputPolicy,issued],{cwd:consumer,encoding:"utf8"});
  assert.equal(expected.status,0,expected.stderr);
  const result=spawnSync(join(consumer,"node_modules/.bin/solanaut-prepare-policy"),[path,"--version","2","--issued",issued],{cwd:consumer,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr ?? result.error?.message ?? "policy command did not execute"); const request=JSON.parse(result.stdout);
  assert.equal(request.text,JSON.parse(expected.stdout)); assert.equal(request.version,2); assert.equal(request.cluster,"localnet"); assert.equal("signature" in request,false);
  assert.equal(readFileSync(path,"utf8"),inputPolicy);
  const help=spawnSync(join(consumer,"node_modules/.bin/solanaut-prepare-policy"),["--help"],{cwd:consumer,encoding:"utf8"});
  assert.equal(help.status,0,help.stderr); assert.match(help.stdout,/usage:/);
});

test("SNP-3/PKG-1: installed checkpoint binding verifies both domains and refuses altered state", () => {
  const script = `
    import {prepareCheckpointText,prepareCheckpointPrefixText,verifyCheckpointBinding,CheckpointBindingError,prepareCheckpointArchives,CheckpointArchiveError,EVALUATION_PROFILE,encodeBase58} from '@solanaut/sdk';
    import {generateKeyPairSync,sign,createHash} from 'node:crypto';
    const pair=()=>{const keys=generateKeyPairSync('ed25519');return {keys,publicKey:encodeBase58(keys.publicKey.export({type:'spki',format:'der'}).subarray(-32))};};
    const authority=pair(),principal=pair(),anchor=pair();
    const hash=(text)=>createHash('sha256').update(text).digest('hex');
    const digests={archiveDigest:hash('archive'),stateDigest:hash('state'),prefixDigest:hash('prefix')};
    const body={format:1,checkpointKey:authority.publicKey,guardId:'installed-checkpoint',cluster:'localnet',seq:1,head:hash('head'),policyVersion:1,policyHash:hash('policy'),profile:EVALUATION_PROFILE,...digests};
    const trust={checkpointKey:authority.publicKey,principalKeys:[principal.publicKey],anchorKey:anchor.publicKey,guardId:body.guardId,cluster:body.cluster};
    const signatures={snapshot:sign(null,Buffer.from(prepareCheckpointText(body)),authority.keys.privateKey).toString('base64'),prefix:sign(null,Buffer.from(prepareCheckpointPrefixText(body)),authority.keys.privateKey).toString('base64')};
    const verified=verifyCheckpointBinding(body,signatures,trust,digests);let refusal;
    try {verifyCheckpointBinding(body,signatures,trust,{...digests,stateDigest:hash('altered')});}
    catch(error){refusal={typed:error instanceof CheckpointBindingError,code:error.code};}
    const original=Buffer.from;let signatureRefusals=0;
    Buffer.from=function(value,...options){
      if(typeof value==='string' && options[0]==='base64' && value.length!==88)throw new Error('invalid signature reached installed decoder');
      return Reflect.apply(original,Buffer,[value,...options]);
    };
    for(const field of ['snapshot','prefix'])try{verifyCheckpointBinding(body,{...signatures,[field]:'A'.repeat(1000000)},trust,digests);}
    catch(error){if(error instanceof CheckpointBindingError)signatureRefusals++;else throw error;}
    Buffer.from=original;
    const catalogue=prepareCheckpointArchives([],{seq:0,head:''});
    if(catalogue.digest!==hash(catalogue.text))throw new Error('catalogue digest differs');
    let catalogueRefusal=false;
    try{prepareCheckpointArchives([],{seq:1,head:hash('missing')});}
    catch(error){catalogueRefusal=error instanceof CheckpointArchiveError;}
    if(!catalogueRefusal)throw new Error('invalid catalogue accepted');
    console.log(JSON.stringify({seq:verified.seq,immutable:Object.isFrozen(verified),refusal,signatureRefusals}));`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script],{cwd:consumer,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{seq:1,immutable:true,refusal:{typed:true,code:"checkpoint-binding"},signatureRefusals:2});
});

test("SNP-3/5/PKG-1: compiled checkpoint payloads preserve lifecycle and replay refusals outside the workspace",()=>{
  // Inspect internal compiled artefacts; these helpers are not stable root exports.
  const script=`
    import {createGuard,preparePolicyText,verifyPolicyAuthorization,PolicyAuthorizationError,verifyCheckpointBinding,encodeBase58,EVALUATION_PROFILE} from '@solanaut/sdk';
    import {generateKeyPairSync,sign,createHash} from 'node:crypto';
    import {spawnSync} from 'node:child_process';
    import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,renameSync,symlinkSync,unlinkSync} from 'node:fs';
    import {tmpdir} from 'node:os';
    import {join} from 'node:path';
    import {registerHooks} from 'node:module';
    const {prepareCheckpointPrefix,rebuildCheckpointPrefix,CheckpointPrefixError}=await import(new URL('./checkpoint-prefix.js',import.meta.resolve('@solanaut/sdk')));
    const {prepareCheckpointState,CheckpointStateError}=await import(new URL('./checkpoint-state.js',import.meta.resolve('@solanaut/sdk')));
    const {prepareCheckpointBundle}=await import(new URL('./checkpoint-bundle.js',import.meta.resolve('@solanaut/sdk')));
    const {prepareCheckpointEnvelope,verifyCheckpointEnvelope,CheckpointEnvelopeError}=await import(new URL('./checkpoint-envelope.js',import.meta.resolve('@solanaut/sdk')));
    const {fileStore,publishOwnedCheckpoint,recoverOwnedCheckpoint,publishOwnedRequestIndex,lookupOwnedRequestIndex,RequestIndexLookupError,RequestIndexPublicationError}=await import(new URL('./record.js',import.meta.resolve('@solanaut/sdk')));
    const {verifyArchive,streamArchive}=await import(new URL('./archive.js',import.meta.resolve('@solanaut/sdk')));
    const {replay,replayStream,checkOwnedRequest,OwnedRequestAdmissionError,beginOwnedRequest,finishOwnedRequest,ownedRequestResult,OwnedControlRequestError}=await import(new URL('./guard.js',import.meta.resolve('@solanaut/sdk')));
    const {seal}=await import(new URL('./log.js',import.meta.resolve('@solanaut/sdk')));
    const {prepareCheckpointRecovery}=await import(new URL('./checkpoint-recovery.js',import.meta.resolve('@solanaut/sdk')));
    const {prepareRequestIndex,lookupRequestIndex,RequestIndexError}=await import(new URL('./request-index.js',import.meta.resolve('@solanaut/sdk')));
    const operator=generateKeyPairSync('ed25519'),agent=generateKeyPairSync('ed25519');
    const address=pair=>encodeBase58(Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url'));
    const policy=JSON.parse(process.argv[1]);policy.principal=[address(agent)];policy.latch.releaseKey=address(operator);
    const trust={operatorKey:address(operator),guardId:policy.latch.guardId,cluster:policy.latch.cluster},issued='2026-10-07T00:00:00.000Z';
    const text=preparePolicyText(policy,1,issued),authorization={...trust,version:1,issued,text,signature:sign(null,Buffer.from(text),operator.privateKey).toString('base64')};
    const originalFrom=Buffer.from;
    try{
      Buffer.from=function(value,encoding,...args){if(encoding==='base64' && typeof value==='string' && value.length!==88)throw new Error('unbounded signature decoded');return Reflect.apply(originalFrom,Buffer,[value,encoding,...args]);};
      for(const length of [0,1,87,89,1000000]){
        let refused=false;try{verifyPolicyAuthorization(policy,{...authorization,signature:'A'.repeat(length)});}catch(error){refused=error instanceof PolicyAuthorizationError;}
        if(!refused)throw new Error('invalid signature length did not refuse before decoding');
      }
    }finally{Buffer.from=originalFrom;}
    let reads=0;verifyPolicyAuthorization(policy,{...authorization,get signature(){reads++;return reads===1?authorization.signature:'A'.repeat(1000000);}});
    if(reads!==1)throw new Error('signature bytes were reread');
    const g=await createGuard({policy,authorization});
    const message=Buffer.from(process.argv[2],'base64');Buffer.from(agent.publicKey.export({format:'jwk'}).x,'base64url').copy(message,4);
    const d=g.check({message:new Uint8Array(message),at:1000,blockHeight:10n,lastValidBlockHeight:100n},{clientId:'client',id:'payment'});
    if(!d.allow || !g.redeem(message,d.hash,10n).ok)throw new Error('fixture admission refused');
    const sig=sign(null,message,agent.privateKey),signature=encodeBase58(sig);
    g.recordSigning({stage:'signed',decision:d.hash,wire:Buffer.concat([Buffer.from([1]),sig,message]).toString('base64'),signature});
    g.recordSigning({stage:'send-started',decision:d.hash,blockHeight:'11'});
    g.recordSigning({stage:'response',decision:d.hash,status:'uncertain',signature});
    const request=g.beginRequest({clientId:'client',id:'status'},'status',{},1001);g.finishRequest(request.hash,{ready:true});
    const entries=g.entries(),context={seq:entries.length,head:entries.at(-1).hash};g.close();
    const replayRecord='replay-signed.jsonl',replayTrust='replay-trust.json',replayPolicy='replay-policy.json',replayMarker='installed-replay-redaction-sentinel';
    const replayCLI=(...args)=>spawnSync(join(process.cwd(),'node_modules/.bin/solanaut-replay'),args,{encoding:'utf8',timeout:5000});
    const refusedReplay=result=>{if(result.error || result.signal || result.status!==2 || result.stdout!=='' || result.stderr.includes(replayMarker) || result.stderr.includes(process.cwd()))throw new Error('installed replay did not safely refuse source');};
    writeFileSync(replayRecord,entries.map(e=>JSON.stringify(e)+'\\n').join(''));writeFileSync(replayTrust,JSON.stringify(trust));writeFileSync(replayPolicy,JSON.stringify(policy));
    const signedReplay=replayCLI(replayRecord,'-',replayTrust);if(signedReplay.status!==0 || !signedReplay.stdout.includes('no divergence'))throw new Error('installed replay rejected authentic signed lifecycle');
    writeFileSync('replay-wrong-trust.json',JSON.stringify({...trust,guardId:'foreign'}));if(replayCLI(replayRecord,'-','replay-wrong-trust.json').status===0)throw new Error('installed replay ignored independent trust');
    writeFileSync('replay-extra-trust.json',JSON.stringify({...trust,extra:replayMarker}));refusedReplay(replayCLI(replayRecord,'-','replay-extra-trust.json'));
    const utf8Trust=JSON.stringify({...trust,guardId:'UTF8-SENTINEL'}),utf8Offset=utf8Trust.indexOf('UTF8-SENTINEL');writeFileSync('replay-utf8-trust.json',Buffer.concat([Buffer.from(utf8Trust.slice(0,utf8Offset)),Buffer.from([255]),Buffer.from(utf8Trust.slice(utf8Offset+'UTF8-SENTINEL'.length))]));refusedReplay(replayCLI(replayRecord,'-','replay-utf8-trust.json'));
    writeFileSync('replay-blank.jsonl',readFileSync(replayRecord,'utf8')+'\\n');refusedReplay(replayCLI('replay-blank.jsonl','-',replayTrust));
    const legacyGuard=await createGuard({policy}),legacyDecision=legacyGuard.check({message:new Uint8Array(message),at:1000});legacyGuard.close();
    writeFileSync('replay-legacy.jsonl',JSON.stringify(legacyDecision)+'\\n');if(replayCLI('replay-legacy.jsonl',replayPolicy).status!==0)throw new Error('installed replay broke legacy arguments');
    const {hash:oldLegacyHash,...legacyBody}=legacyDecision,changedDecision=seal({...legacyBody,allow:replayMarker});
    writeFileSync('replay-divergence.jsonl',JSON.stringify(changedDecision)+'\\n');const divergedReplay=replayCLI('replay-divergence.jsonl',replayPolicy);
    if(divergedReplay.status!==1 || divergedReplay.stdout!=='diverges at seq 0, field allow\\n  recorded: [redacted]\\n  recomputed: [redacted]\\n' || divergedReplay.stderr!=='')throw new Error('installed replay altered divergence or exposed values');
    refusedReplay(replayCLI('missing-'+replayMarker,replayPolicy));
    refusedReplay(replayCLI('replay-legacy.jsonl','missing-policy-'+replayMarker));
    writeFileSync('replay-large-policy.json',JSON.stringify(policy)+' '.repeat(1048576));refusedReplay(replayCLI('replay-legacy.jsonl','replay-large-policy.json'));
    writeFileSync('replay-large-record.jsonl',JSON.stringify(seal({...legacyBody,reason:'a'.repeat(1048576)}))+'\\n');refusedReplay(replayCLI('replay-large-record.jsonl',replayPolicy));
    function reportAfter(prefix,changes={}){return seal({v:1,kind:'report',seq:prefix.length,prev:prefix.at(-1).hash,at:1001,decision:d.hash,outcome:'unknown',source:'caller',...changes});}
    const invalidReports=[...['outcome','source'].map(field=>[...entries,reportAfter(entries,{[field]:'unsupported'})]),...[null,-1,'1001'].map(at=>[...entries,reportAfter(entries,{at})])];
    for(const outcome of ['landed','failed','expired']){const final=[...entries,reportAfter(entries,{outcome})];for(const next of ['unknown','landed','failed','expired'])invalidReports.push([...final,reportAfter(final,{outcome:next})]);}
    for(const bad of invalidReports){
      if((await replay(bad,undefined,undefined,trust)).ok || (await replayStream(async function*(){yield* bad;},undefined,undefined,trust)).ok)throw new Error('installed impossible report replay accepted');
      let restoredRefused=false;try{const restored=await createGuard({policy,authorization,log:{entries:bad,append(){},close(){}}});restored.close();}catch(error){restoredRefused=/report|outcome|attribution/.test(error.message);}
      if(!restoredRefused)throw new Error('installed impossible report restore accepted');
    }
    function redeemAfter(prefix,changes={}){return seal({v:1,kind:'redeem',seq:prefix.length,prev:prefix.at(-1).hash,at:1001,decision:d.hash,blockHeight:'10',...changes});}
    const admitted=entries.slice(0,2),invalidRedeems=[[...entries,redeemAfter(entries)],...[null,'101','010','x'].map(blockHeight=>[...admitted,redeemAfter(admitted,{blockHeight})]),...[null,-1,'1001'].map(at=>[...admitted,redeemAfter(admitted,{at})]),[...admitted,redeemAfter(admitted,{decision:'0'.repeat(64)})]];
    for(const outcome of ['landed','failed','expired']){const final=[...admitted,reportAfter(admitted,{outcome})];invalidRedeems.push([...final,redeemAfter(final)]);}
    for(const bad of invalidRedeems){
      if((await replay(bad,undefined,undefined,trust)).ok || (await replayStream(async function*(){yield* bad;},undefined,undefined,trust)).ok)throw new Error('installed impossible redemption replay accepted');
      let restoredRefused=false;try{const restored=await createGuard({policy,authorization,log:{entries:bad,append(){},close(){}}});restored.close();}catch(error){restoredRefused=/redeem|redemption|receipt/.test(error.message);}
      if(!restoredRefused)throw new Error('installed impossible redemption restore accepted');
    }
    const prefix=await prepareCheckpointPrefix(entries,undefined,context,trust),state=await prepareCheckpointState(entries,undefined,context,trust);
    const hash=text=>createHash('sha256').update(text).digest('hex'),p=JSON.parse(prefix.text),s=JSON.parse(state.text);
    const rebuilt=await rebuildCheckpointPrefix(entries,undefined,context,prefix.text,trust);
    if(rebuilt.events!==p.events.length || rebuilt.seq!==context.seq || rebuilt.head!==context.head || !Object.isFrozen(rebuilt))throw new Error('installed prefix rebuild lost endpoint/events');
    const {Governor}=await import('@gubernaut/core'),reference=await Governor.create();
    for(const entry of entries){if(entry.kind==='release')reference.reset();else if(entry.kind==='decision'&&entry.telemetry!==null&&entry.posture!==null)reference.tick(entry.telemetry);}
    for(const telemetry of [{intensity:1,valence:-1,repetition:1},{intensity:0,valence:0,repetition:0}])if(JSON.stringify(rebuilt.controller.tick(telemetry))!==JSON.stringify(reference.tick(telemetry)))throw new Error('installed next controller decision differs');
    let prefixRefused=false;try{await rebuildCheckpointPrefix(entries,undefined,context,prefix.text+' ',trust);}catch(error){prefixRefused=error instanceof CheckpointPrefixError;}
    if(!prefixRefused)throw new Error('installed altered prefix accepted');
    const checkpoint=generateKeyPairSync('ed25519'),anchor=generateKeyPairSync('ed25519');
    const checkpointTrust={checkpointKey:address(checkpoint),anchorKey:address(anchor),principalKeys:policy.principal,guardId:trust.guardId,cluster:trust.cluster};
    const receipts=[{bytes:10000,entries:context.seq,firstSeq:0,nextSeq:context.seq,head:context.head,sha256:hash('fixture archive metadata')}];
    const bundle=await prepareCheckpointBundle(entries,undefined,receipts,context,trust,checkpointTrust);
    if(bundle.state!==state.text || bundle.prefix!==prefix.text || !Object.isFrozen(bundle) || !Object.isFrozen(bundle.binding))throw new Error('bundle payload consistency differs');
    const signatures={snapshot:sign(null,Buffer.from(bundle.snapshotText),checkpoint.privateKey).toString('base64'),prefix:sign(null,Buffer.from(bundle.prefixText),checkpoint.privateKey).toString('base64')};
    verifyCheckpointBinding(bundle.binding,signatures,checkpointTrust,{archiveDigest:hash(bundle.archives),stateDigest:hash(bundle.state),prefixDigest:hash(bundle.prefix)});
    const encoded=prepareCheckpointEnvelope({binding:bundle.binding,signatures,archives:bundle.archives,state:bundle.state,prefix:bundle.prefix},checkpointTrust,1000000);
    const decoded=verifyCheckpointEnvelope(encoded.text,checkpointTrust,Buffer.byteLength(encoded.text));
    if(encoded.digest!==hash(encoded.text) || decoded.state!==bundle.state || decoded.prefix!==bundle.prefix || !Object.isFrozen(decoded))throw new Error('envelope round trip differs');
    for(const [text,limit] of [[encoded.text,Buffer.byteLength(encoded.text)-1],[encoded.text.replace('uncertain','altered'),1000000],[' '+encoded.text,1000000]]){
      let refused=false;try{verifyCheckpointEnvelope(text,checkpointTrust,limit);}catch(error){refused=error instanceof CheckpointEnvelopeError;}
      if(!refused)throw new Error('envelope tampering or bound accepted');
    }
    const directory=mkdtempSync(join(tmpdir(),'solanaut-packed-publication-')),recordPath=join(directory,'guard.jsonl'),archivePath=join(directory,'archive.jsonl');
    const stringify=value=>JSON.stringify(value,(_key,item)=>item && typeof item==='object' && !Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
    const history=entries.map(entry=>stringify(entry)+'\\n').join('');writeFileSync(recordPath,history);writeFileSync(archivePath,history,{mode:0o400});
    const store=fileStore(recordPath,{ownership:'kernel',create:false});
    try{
      const index=await prepareRequestIndex(entries,undefined,context,trust),indexPath=join(directory,'request-index');mkdirSync(indexPath);
      const published=await publishOwnedRequestIndex(store,{policyTrust:trust}),publishedPointer=readFileSync(recordPath+'.request-index','utf8');
      if(published.seq!==context.seq || published.head!==context.head || published.digest!==index.digest || !Object.isFrozen(published) || readFileSync(join(published.directory,'manifest.json'),'utf8')!==index.text)throw new Error('installed owned index publication differs');
      if((await lookupRequestIndex(published.directory,published.root,{clientId:'client',id:'payment'}))?.started?.event.stage!=='send-started')throw new Error('installed published index lost uncertain send');
      let indexOwnerRefused=false;try{await publishOwnedRequestIndex({...store},{policyTrust:trust});}catch(error){indexOwnerRefused=error instanceof RequestIndexPublicationError && error.code==='request-index-publication';}if(!indexOwnerRefused)throw new Error('installed forged index owner accepted');
      writeFileSync(recordPath+'.request-index','corrupt');
      try{let refused=false;try{await publishOwnedRequestIndex(store,{policyTrust:trust});}catch(error){refused=error instanceof RequestIndexPublicationError;}if(!refused || readFileSync(recordPath+'.request-index','utf8')!=='corrupt')throw new Error('installed corrupt index pointer accepted or repaired');}finally{writeFileSync(recordPath+'.request-index',publishedPointer);}
      const replacement=await publishOwnedRequestIndex(store,{policyTrust:trust});
      if(replacement.directory===published.directory || readFileSync(join(published.directory,'manifest.json'),'utf8')!==index.text || replacement.digest!==index.digest)throw new Error('installed index replacement lost predecessor');
      const manifest=JSON.parse(index.text);
      if(index.digest!==hash(index.text) || index.root.digest!==index.digest || manifest.seq!==context.seq || manifest.head!==context.head || manifest.guardId!==trust.guardId || manifest.cluster!==trust.cluster || index.shards.map(shard=>shard.bucket).join('')!=='0123456789abcdef')throw new Error('installed index root or complete shard coverage differs');
      writeFileSync(join(indexPath,'manifest.json'),index.text);for(const shard of index.shards)writeFileSync(join(indexPath,shard.bucket+'.jsonl'),shard.text);
      const payment=await lookupRequestIndex(indexPath,index.root,{clientId:'client',id:'payment'}),status=await lookupRequestIndex(indexPath,index.root,{clientId:'client',id:'status'});
      if(payment?.start.hash!==d.hash || payment.signed?.event.signature!==signature || payment.started?.event.stage!=='send-started' || payment.response?.event.status!=='uncertain' || !Object.isFrozen(payment) || !Object.isFrozen(payment.signed.event))throw new Error('installed indexed uncertain send differs');
      if(status?.start.hash!==request.hash || status.response?.result!=='{"ready":true}' || !Object.isFrozen(status.response) || await lookupRequestIndex(indexPath,index.root,{clientId:'client',id:'absent'})!==null)throw new Error('installed indexed reply or absence differs');
      let forgedRootRefused=false;try{await lookupRequestIndex(indexPath,structuredClone(index.root),{clientId:'client',id:'absent'});}catch(error){forgedRootRefused=error instanceof RequestIndexError && error.code==='request-index';}if(!forgedRootRefused)throw new Error('installed cache minted root authority');
      const replyShard=index.shards.find(shard=>shard.text.includes(request.hash)),replyPath=join(indexPath,replyShard.bucket+'.jsonl'),changedReply=replyShard.text.replace(/"result":"[^\\n]*?ready[^\\n]*?true/g,value=>value.replace('true','null'));
      if(changedReply===replyShard.text || Buffer.byteLength(changedReply)!==Buffer.byteLength(replyShard.text))throw new Error('installed altered reply fixture differs');
      try{writeFileSync(replyPath,changedReply);let refused=false;try{await lookupRequestIndex(indexPath,index.root,{clientId:'client',id:'status'});}catch(error){refused=error instanceof RequestIndexError && error.code==='request-index';}if(!refused)throw new Error('installed indexed reply alteration accepted');}finally{writeFileSync(replyPath,replyShard.text);}
      const paymentShard=index.shards.find(shard=>shard.text.includes(d.hash)),paymentPath=join(indexPath,paymentShard.bucket+'.jsonl'),omitted=paymentShard.text.split('\\n').filter(line=>!line.includes(d.hash)).filter(Boolean).map(line=>line+'\\n').join('');
      const falseManifest=structuredClone(manifest),metadata=falseManifest.shards.find(shard=>shard.bucket===paymentShard.bucket);metadata.bytes=Buffer.byteLength(omitted);metadata.rows--;metadata.sha256=hash(omitted);
      try{writeFileSync(paymentPath,omitted);writeFileSync(join(indexPath,'manifest.json'),stringify(falseManifest)+'\\n');let refused=false;try{await lookupRequestIndex(indexPath,index.root,{clientId:'client',id:'payment'});}catch(error){refused=error instanceof RequestIndexError && error.code==='request-index';}if(!refused)throw new Error('installed omission plus local rechecksum accepted');}finally{writeFileSync(paymentPath,paymentShard.text);writeFileSync(join(indexPath,'manifest.json'),index.text);}
      const cursor=streamArchive(archivePath,{expectedHead:context.head});let streamed=0;
      for(;;){const next=await cursor.next();if(next.done){if(next.value.entries!==streamed || next.value.head!==context.head || !Object.isFrozen(next.value))throw new Error('installed stream receipt differs');break;}
        if(!Object.isFrozen(next.value) || next.value.seq!==streamed)throw new Error('installed stream entry differs');streamed++;}
      if(streamed!==context.seq)throw new Error('installed stream count differs');
      const cancelled=streamArchive(archivePath);await cancelled.next();if((await cancelled.return(undefined)).value!==undefined)throw new Error('installed cancelled stream produced receipt');
      let digestRefused=false;try{for await(const _entry of streamArchive(archivePath,{expectedDigest:'0'.repeat(64)}))void 0;}catch(error){digestRefused=error.name==='ArchiveError' && error.code==='digest';}
      if(!digestRefused)throw new Error('installed stream ignored digest');
      const replayed=await replayStream(()=>streamArchive(archivePath,{expectedHead:context.head}),undefined,undefined,trust);
      if(!replayed.ok || replayed.decisions!==entries.filter(entry=>entry.kind==='decision').length)throw new Error('installed streamed replay differs');
      const operatorPin=trust.operatorKey;let captured;
      try{captured=await replayStream(async function*(){trust.operatorKey=policy.principal[0];yield* entries;},undefined,undefined,trust);}finally{trust.operatorKey=operatorPin;}
      if(!captured.ok)throw new Error('installed streamed trust was not captured');
      let opens=0,changedRefused=false;
      try{await replayStream(async function*(){yield* (++opens===1?entries:entries.slice(0,-1));},undefined,undefined,trust);}catch(error){changedRefused=error.name==='StreamReplayError' && error.code==='stream-replay';}
      if(!changedRefused || opens!==2)throw new Error('installed replay accepted changed source');
      const receipt=await verifyArchive(archivePath),actual=await prepareCheckpointBundle(entries,undefined,[receipt],context,trust,checkpointTrust);
      const signatures={snapshot:sign(null,Buffer.from(actual.snapshotText),checkpoint.privateKey).toString('base64'),prefix:sign(null,Buffer.from(actual.prefixText),checkpoint.privateKey).toString('base64')};
      const candidate=prepareCheckpointEnvelope({binding:actual.binding,signatures,archives:actual.archives,state:actual.state,prefix:actual.prefix},checkpointTrust,1000000);
      const options={checkpointTrust,policyTrust:trust,archives:[archivePath],maxBytes:1000000};
      const recovered=await prepareCheckpointRecovery(entries,candidate.text,options);
      if(recovered.mode!=='checkpoint' || recovered.state!==state.text || recovered.seq!==context.seq || !Object.isFrozen(recovered))throw new Error('installed checkpoint recovery differs');
      const fallback=await prepareCheckpointRecovery(entries,'corrupt',options);
      if(fallback.mode!=='full-replay' || fallback.state!==state.text || fallback.checkpointSeq!==null)throw new Error('installed verified fallback differs');
      const falseState=JSON.parse(actual.state);falseState.state.reservations[0][1].sol='0';const changedState=stringify(falseState)+'\\n',changedBinding={...actual.binding,stateDigest:hash(changedState)};
      const {prepareCheckpointText,prepareCheckpointPrefixText}=await import(new URL('./checkpoint.js',import.meta.resolve('@solanaut/sdk')));
      const dishonest=prepareCheckpointEnvelope({binding:changedBinding,archives:actual.archives,state:changedState,prefix:actual.prefix,signatures:{snapshot:sign(null,Buffer.from(prepareCheckpointText(changedBinding)),checkpoint.privateKey).toString('base64'),prefix:sign(null,Buffer.from(prepareCheckpointPrefixText(changedBinding)),checkpoint.privateKey).toString('base64')}},checkpointTrust,1000000);
      const refusedState=await prepareCheckpointRecovery(entries,dishonest.text,options);
      if(refusedState.mode!=='full-replay' || refusedState.state!==state.text)throw new Error('installed dishonest signed state accepted');
      let anchorRefused=false;try{await prepareCheckpointRecovery(entries,'corrupt',{...options,expectedAnchor:{seq:context.seq-1,head:'0'.repeat(64)}});}catch(error){anchorRefused=error.name==='CheckpointRecoveryError' && error.code==='checkpoint-recovery';}
      if(!anchorRefused)throw new Error('installed anchor disagreement bypassed');
      const originalPins=structuredClone(options),pendingPublication=publishOwnedCheckpoint(store,candidate.text,originalPins);
      originalPins.maxBytes=1;originalPins.archives=[];
      const result=await pendingPublication;
      if(result.digest!==hash(candidate.text) || result.seq!==context.seq || readFileSync(recordPath+'.checkpoint','utf8')!==candidate.text)throw new Error('owned installed checkpoint differs');
      const owned=await recoverOwnedCheckpoint(store,options);
      if(owned.mode!=='checkpoint' || owned.state!==state.text || owned.seq!==context.seq || !Object.isFrozen(owned))throw new Error('installed owned recovery differs');
      let recoveryRefused=false;try{await recoverOwnedCheckpoint({...store},options);}catch(error){recoveryRefused=error.name==='CheckpointRecoveryError' && error.code==='checkpoint-recovery';}
      if(!recoveryRefused)throw new Error('installed forged recovery owner accepted');
      const pendingOwned=recoverOwnedCheckpoint(store,options),lock=recordPath+'.lock';renameSync(lock,lock+'.moved');symlinkSync(lock+'.moved',lock);
      try{let aliasRefused=false;try{await pendingOwned;}catch(error){aliasRefused=error.name==='CheckpointRecoveryError' && error.code==='checkpoint-recovery';}if(!aliasRefused)throw new Error('installed ownership alias accepted');}
      finally{unlinkSync(lock);renameSync(lock+'.moved',lock);}
      writeFileSync(recordPath+'.checkpoint','corrupt');
      const ownedFallback=await recoverOwnedCheckpoint(store,options);
      if(ownedFallback.mode!=='full-replay' || ownedFallback.state!==state.text || readFileSync(recordPath+'.checkpoint','utf8')!=='corrupt')throw new Error('installed owned fallback differs');
      writeFileSync(recordPath+'.checkpoint',candidate.text);
      await publishOwnedCheckpoint(store,candidate.text,options);
      if(readFileSync(recordPath+'.checkpoint.previous','utf8')!==candidate.text)throw new Error('installed predecessor lost');
      let refused=false;try{await publishOwnedCheckpoint({...store},candidate.text,options);}catch(error){refused=error.name==='CheckpointPublicationError' && error.code==='checkpoint-publication';}
      if(!refused)throw new Error('forged installed ownership accepted');
      const historical=await lookupOwnedRequestIndex(store,{clientId:'client',id:'payment'},{policyTrust:trust});
      if(historical.row?.started?.event.stage!=='send-started' || historical.row?.response?.event.status!=='uncertain' || historical.seq!==context.seq || historical.indexHead!==context.head || !Object.isFrozen(historical) || !Object.isFrozen(historical.row))throw new Error('installed current lookup lost uncertain history');
      let lookupOwnerRefused=false;try{await lookupOwnedRequestIndex({...store},{clientId:'client',id:'payment'},{policyTrust:trust});}catch(error){lookupOwnerRefused=error instanceof RequestIndexLookupError && error.code==='request-index-lookup';}if(!lookupOwnerRefused)throw new Error('installed forged lookup owner accepted');
      const live=await createGuard({policy,authorization,log:store}),tail=live.beginRequest({clientId:'client',id:'tail'},'status',{},1002),tailReply=live.finishRequest(tail.hash,{ready:true});
      const current=await lookupOwnedRequestIndex(store,{clientId:'client',id:'tail'},{policyTrust:trust});
      if(current.seq!==store.entries.length || current.head!==tailReply.hash || current.indexSeq!==context.seq || current.row?.start.hash!==tail.hash || current.row?.response?.hash!==tailReply.hash || !Object.isFrozen(current.row.response))throw new Error('installed current lookup skipped or altered tail');
      const absent=await lookupOwnedRequestIndex(store,{clientId:'client',id:'absent'},{policyTrust:trust});if(absent.row!==null || absent.head!==tailReply.hash)throw new Error('installed current absence lacks tail binding');
      if('checkOwnedRequest' in await import('@solanaut/sdk'))throw new Error('internal owned admission leaked into stable exports');
      const beforeRetry=live.status().seq,historicalDecision=await checkOwnedRequest(live,{message:new Uint8Array(message),at:2000,blockHeight:200n},{clientId:'client',id:'payment'});
      if(historicalDecision.hash!==d.hash || !Object.isFrozen(historicalDecision) || live.status().seq!==beforeRetry || live.redeem(message,d.hash,10n).ok)throw new Error('installed indexed retry changed history or reused receipt');
      const conflict=await checkOwnedRequest(live,{message:new Uint8Array(message),at:2000,intent:'different'},{clientId:'client',id:'payment'});
      const methodConflict=await checkOwnedRequest(live,{message:new Uint8Array(message),at:2000},{clientId:'client',id:'tail'});
      if(conflict.allow || conflict.seq!==-1 || methodConflict.allow || methodConflict.seq!==-1 || live.status().seq!==beforeRetry)throw new Error('installed indexed collision admitted or recorded');
      const queued=await Promise.all([checkOwnedRequest(live,{message:new Uint8Array(message),at:2001},{clientId:'client',id:'queued'}),checkOwnedRequest(live,{message:new Uint8Array(message),at:2002},{clientId:'client',id:'queued'})]);
      if(queued[0].hash!==queued[1].hash || queued[0].seq!==beforeRetry || live.status().seq!==beforeRetry+1)throw new Error('installed indexed queue admitted duplicate identity');
      if(!Object.isFrozen(queued[0].keel) || !Object.isFrozen(queued[0].amounts) || !Object.isFrozen(queued[0].amounts.tokens) || queued[0]===store.entries.at(-1) || queued[0].amounts===store.entries.at(-1).amounts)throw new Error('installed fresh admission reply aliases mutable log state');
      const freshBefore=JSON.stringify(store.entries);try{queued[0].amounts.sol='999';}catch{}if(JSON.stringify(store.entries)!==freshBefore)throw new Error('installed admission reply changed log');
      const freshRetry=await checkOwnedRequest(live,{message:new Uint8Array(message),at:2003},{clientId:'client',id:'queued'});if(freshRetry.hash!==queued[0].hash || live.status().seq!==beforeRetry+1)throw new Error('installed immutable fresh reply failed later lookup');
      const shared=new Uint8Array(new SharedArrayBuffer(message.length));shared.set(message);const capturedShared=Buffer.from(shared).toString('base64'),pendingShared=checkOwnedRequest(live,{message:shared,at:2004},{clientId:'client',id:'shared'});shared.fill(255);
      if((await pendingShared).message!==capturedShared)throw new Error('installed queued admission retained shared byte backing');
      let admissionOwnerRefused=false;try{await checkOwnedRequest({...live},{message:new Uint8Array(message),at:2003},{clientId:'client',id:'forged'});}catch(error){admissionOwnerRefused=error instanceof OwnedRequestAdmissionError && error.code==='owned-request-admission';}if(!admissionOwnerRefused)throw new Error('installed forged admission guard accepted');
      const publicSDK=await import('@solanaut/sdk');if(['beginOwnedRequest','finishOwnedRequest','ownedRequestResult','OwnedControlRequestError'].some(name=>name in publicSDK))throw new Error('internal owned controls leaked into stable exports');
      const controlId={clientId:'client',id:'installed-control'},controlInput={decision:d.hash},controlPending=beginOwnedRequest(live,controlId,'report',controlInput,2005);controlId.id='changed';controlInput.decision='a'.repeat(64);
      const controlStart=await controlPending,actualControlId={clientId:'client',id:'installed-control'};if(controlStart.request.id!==actualControlId.id || JSON.parse(controlStart.payload).decision!==d.hash || !Object.isFrozen(controlStart.request) || store.entries.find(entry=>entry.hash===controlStart.hash)===controlStart)throw new Error('installed control start capture or detachment failed');
      if(await ownedRequestResult(live,actualControlId,controlStart.hash)!==undefined)throw new Error('installed pending control acquired an answer');
      const controlAnswer={nested:{ready:true}},controlReplyPending=finishOwnedRequest(live,actualControlId,controlStart.hash,controlAnswer);controlAnswer.nested.ready=false;
      const controlResponse=await controlReplyPending,controlCount=live.status().seq,readControl=await ownedRequestResult(live,actualControlId,controlStart.hash);
      if(!readControl.nested.ready || !Object.isFrozen(readControl.nested) || !Object.isFrozen(controlResponse) || store.entries.find(entry=>entry.hash===controlResponse.hash)===controlResponse)throw new Error('installed control response capture or immutability failed');
      if((await beginOwnedRequest(live,actualControlId,'report',{decision:d.hash},9000)).hash!==controlStart.hash || (await finishOwnedRequest(live,actualControlId,controlStart.hash,{nested:{ready:true}})).hash!==controlResponse.hash || live.status().seq!==controlCount)throw new Error('installed control retry changed durable history');
      const mustRefuseControl=async call=>{let refused=false;try{await call();}catch(error){refused=error instanceof OwnedControlRequestError && error.code==='owned-control-request';}if(!refused)throw new Error('installed invalid owned control accepted');};
      await mustRefuseControl(()=>beginOwnedRequest(live,actualControlId,'status',{},2006));await mustRefuseControl(()=>finishOwnedRequest(live,actualControlId,controlStart.hash,{nested:{ready:false}}));await mustRefuseControl(()=>ownedRequestResult(live,actualControlId,'a'.repeat(64)));
      for(const call of [()=>beginOwnedRequest({...live},actualControlId,'status',{},2006),()=>finishOwnedRequest({...live},actualControlId,controlStart.hash,{}),()=>ownedRequestResult({...live},actualControlId,controlStart.hash)])await mustRefuseControl(call);
      const publicStart=live.beginRequest,publicFinish=live.finishRequest;let replacedCalled=false;
      try{live.beginRequest=()=>{replacedCalled=true;throw new Error('public start replaced');};live.finishRequest=()=>{replacedCalled=true;throw new Error('public finish replaced');};
        const privateId={clientId:'client',id:'private-control'},privateStart=await beginOwnedRequest(live,privateId,'status',{},2006);await finishOwnedRequest(live,privateId,privateStart.hash,{ready:true});if(replacedCalled || !(await ownedRequestResult(live,privateId,privateStart.hash)).ready)throw new Error('installed control called mutable public bookkeeping');
      }finally{live.beginRequest=publicStart;live.finishRequest=publicFinish;}
      const pointerBeforeLookup=readFileSync(recordPath+'.request-index','utf8');writeFileSync(recordPath+'.request-index','corrupt');
      try{let refused=false;try{await lookupOwnedRequestIndex(store,{clientId:'client',id:'tail'},{policyTrust:trust});}catch(error){refused=error instanceof RequestIndexLookupError && error.code==='request-index-lookup';}if(!refused || readFileSync(recordPath+'.request-index','utf8')!=='corrupt')throw new Error('installed corrupt lookup pointer accepted or repaired');
        const beforeRefusal=live.status().seq;let admissionRefused=false;try{await checkOwnedRequest(live,{message:new Uint8Array(message),at:2004},{clientId:'client',id:'corrupt'});}catch(error){admissionRefused=error instanceof OwnedRequestAdmissionError && error.code==='owned-request-admission';}if(!admissionRefused || live.status().seq!==beforeRefusal || readFileSync(recordPath+'.request-index','utf8')!=='corrupt')throw new Error('installed corrupt index authorised admission');
        for(const call of [()=>beginOwnedRequest(live,{clientId:'client',id:'corrupt-control'},'status',{},2006),()=>finishOwnedRequest(live,actualControlId,controlStart.hash,{nested:{ready:true}}),()=>ownedRequestResult(live,actualControlId,controlStart.hash)])await mustRefuseControl(call);
        if(live.status().seq!==beforeRefusal)throw new Error('installed corrupt evidence permitted control mutation');
      }finally{writeFileSync(recordPath+'.request-index',pointerBeforeLookup);}
      const actualRecordURL=new URL('./record.js',import.meta.resolve('@solanaut/sdk')).href,gapGuardURL=new URL('./guard.js?owned-gap',import.meta.resolve('@solanaut/sdk')).href;
      const gapSource='import * as real from '+JSON.stringify(actualRecordURL)+';export * from '+JSON.stringify(actualRecordURL)+';export async function lookupOwnedRequestIndex(...args){const answer=await real.lookupOwnedRequestIndex(...args);globalThis.afterOwnedAdmissionLookup();return answer;}';
      const gapHook=registerHooks({resolve(specifier,context,next){if(specifier==='./record.js' && context.parentURL===gapGuardURL)return {url:'data:text/javascript,'+encodeURIComponent(gapSource),shortCircuit:true};return next(specifier,context);}});let gapModule;
      try{gapModule=await import(gapGuardURL);}finally{gapHook.deregister();}
      const gapGuard=await gapModule.createGuard({policy,authorization,log:store}),beforeGap=gapGuard.status().seq;globalThis.afterOwnedAdmissionLookup=()=>gapGuard.check({message:Uint8Array.of(255),at:2005});
      try{let gapRefused=false;try{await gapModule.checkOwnedRequest(gapGuard,{message:new Uint8Array(message),at:2006},{clientId:'client',id:'gap'});}catch(error){gapRefused=error instanceof gapModule.OwnedRequestAdmissionError && error.code==='owned-request-admission';}if(!gapRefused || gapGuard.status().seq!==beforeGap+1 || store.entries.some(entry=>entry.kind==='decision' && entry.request?.id==='gap'))throw new Error('installed stale absence authorised commit');}
      finally{delete globalThis.afterOwnedAdmissionLookup;}
      try{globalThis.afterOwnedAdmissionLookup=()=>gapGuard.check({message:Uint8Array.of(255),at:2007});
        for(const call of [()=>gapModule.beginOwnedRequest(gapGuard,actualControlId,'report',{decision:d.hash},9000),()=>gapModule.finishOwnedRequest(gapGuard,actualControlId,controlStart.hash,{nested:{ready:true}}),()=>gapModule.ownedRequestResult(gapGuard,actualControlId,controlStart.hash)]){
          const before=gapGuard.status().seq;let refused=false;try{await call();}catch(error){refused=error instanceof gapModule.OwnedControlRequestError && error.code==='owned-control-request';}if(!refused || gapGuard.status().seq!==before+1)throw new Error('installed stale control lookup authorised work');
        }
      }
      finally{delete globalThis.afterOwnedAdmissionLookup;gapGuard.close();}
    }finally{store.close();rmSync(directory,{recursive:true,force:true});}
    if(prefix.digest!==hash(prefix.text) || state.digest!==hash(state.text) || !Object.isFrozen(prefix) || !Object.isFrozen(state))throw new Error('payload digest or immutability differs');
    if(JSON.stringify(s.profile)!==JSON.stringify(p.profile) || Object.keys(EVALUATION_PROFILE).some(k=>s.profile[k]!==EVALUATION_PROFILE[k]))throw new Error('payload profile differs');
    if(s.policy.version!==1 || s.policy.hash!==d.policyHash)throw new Error('payload policy differs');
    if(p.events.length!==1 || p.events[0].hash!==d.hash || s.previousDecision.hash!==d.hash || s.state.requests.length!==2 || s.state.responses.length!==1 || s.state.reservations[0][1].sol!=='1' || !s.state.redeemed.includes(d.hash))throw new Error('lifecycle facts lost');
    const lifecycle=s.state.signing.find(([key])=>key===d.hash)[1];
    if(lifecycle.started.stage!=='send-started' || lifecycle.response.status!=='uncertain')throw new Error('uncertain send lost');
    const {hash:unused,...body}=d,forged={...body,telemetry:{intensity:1,valence:-1,repetition:1}};
    const canonical=JSON.stringify(forged,(_key,value)=>value && typeof value==='object' && !Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
    const changed={...forged,hash:hash(canonical)},bad=[entries[0],changed],end={seq:2,head:changed.hash};
    for(const [prepare,ErrorType] of [[prepareCheckpointPrefix,CheckpointPrefixError],[prepareCheckpointState,CheckpointStateError],[prepareRequestIndex,RequestIndexError]]){
      let refused=false;try{await prepare(bad,undefined,end,trust);}catch(error){refused=error instanceof ErrorType;}
      if(!refused)throw new Error('dishonest replay accepted');
    }
    console.log(JSON.stringify({events:p.events.length,requests:s.state.requests.length,uncertain:true}));`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,inputPolicy,Buffer.from(transfer(2)).toString("base64")],{cwd:consumer,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{events:1,requests:2,uncertain:true});
  for(const name of ["checkpoint-prefix","checkpoint-state","checkpoint-bundle","checkpoint-envelope","checkpoint-publication","checkpoint-recovery","checkpoint-errors","request-index"])for(const extension of ["js","d.ts"])assert.ok(packed.files.some((file:{path:string})=>file.path==="dist/src/"+name+"."+extension));
});

test("PKG-1/OWN-2: installed record-only operations avoid evaluation imports",()=>{
  const script=`import {registerHooks} from 'node:module';
    registerHooks({resolve(specifier,context,next){if(['@gubernaut/core','@solana/kit'].includes(specifier))throw new Error('eager evaluation import: '+specifier);return next(specifier,context);}});
    const base=import.meta.resolve('@solanaut/sdk'),record=await import(new URL('./record.js',base)),errors=await import(new URL('./checkpoint-errors.js',base));
    const {mkdtempSync,rmSync}=await import('node:fs'),{seal}=await import(new URL('./log.js',base));
    const directory=mkdtempSync('./record-only-'),path=directory+'/record.jsonl';
    try{const entry=seal({v:1,kind:'report',seq:0,prev:'',at:0,decision:'a'.repeat(64),outcome:'unknown',source:'caller'});
      const first=record.fileStore(path,{ownership:'kernel',create:true});first.append(entry);first.close();
      const second=record.fileStore(path,{ownership:'kernel',create:false});try{if(second.entries.length!==1 || second.entries[0].hash!==entry.hash)throw new Error('installed record differs');}finally{second.close();}
      for(const [method,code,type] of [['publishOwnedCheckpoint','checkpoint-publication','CheckpointPublicationError'],['recoverOwnedCheckpoint','checkpoint-recovery','CheckpointRecoveryError']]){
        let refused=false;try{await record[method](record.memoryStore(),null,{});}catch(error){refused=error instanceof errors[type] && error.code===code;}if(!refused)throw new Error('installed capability refusal differs');}
    }finally{rmSync(directory,{recursive:true,force:true});}
    console.log('installed record-only verified');`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script],{cwd:consumer,encoding:"utf8",timeout:5000,killSignal:"SIGKILL"});
  assert.equal(result.status,0,result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/installed record-only verified/);
});

test("PKG-3: installed replay and table-pin commands execute with their documented usage exits", () => {
  for (const bin of ["solanaut-replay", "solanaut-pin-table", "solanaut-verify-archive"]) {
    const result = spawnSync(join(consumer, "node_modules/.bin", bin), [], { cwd: consumer, encoding: "utf8" });
    assert.equal(result.status, 2, `${bin}: ${result.error?.message ?? result.stderr}`);
    assert.match(result.stdout + result.stderr, /usage:/i);
  }
});
test("CLT-1/PKG-1: installed sending client has explicit methods and typed connection failure without a loader", () => {
  const script = `
    import {createSendingClient,SignerClientError} from '@solanaut/sdk';
    import {strict as assert} from 'node:assert';
    import {createServer} from 'node:net';
    const client=createSendingClient({socket:process.argv[1],clientId:'agent',timeoutMs:100});
    let failure;
    try { await client.propose({id:'payment',message:new Uint8Array([1])}); }
    catch(e) { failure={typed:e instanceof SignerClientError,code:e.code,uncertain:e.mayHaveExecuted}; }
    const inputError=error=>error instanceof SignerClientError && error.code==='input' && error.mayHaveExecuted===false;
    const invalid=[undefined,null,false,0,'input',1n,Symbol('input'),[],()=>{}];
    let requests=0;
    const server=createServer(socket=>{socket.on('error',()=>socket.destroy());socket.on('data',()=>{requests++;socket.destroy();});});
    const socket=process.argv[1]+'-inputs';
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socket,resolve);});
    try{
      const options={socket,clientId:'agent',timeoutMs:100};
      assert.throws(()=>createSendingClient(),inputError,'installed missing options');
      for(const value of [...invalid,Object.assign([],options),Object.assign(()=>{},options)])assert.throws(()=>createSendingClient(value),inputError,'installed options container');
      for(const value of [{...options,socket:'relative'},{...options,clientId:''},{...options,timeoutMs:30001},{...options,timeoutMs:NaN}])assert.throws(()=>createSendingClient(value),inputError,'installed configuration field');
      const checked=createSendingClient(options);
      for(const name of ['propose','report','status']){
        const payload=name==='propose'?{id:'one',message:new Uint8Array([1])}:name==='report'?{id:'one',decision:'a'.repeat(64)}:{id:'one'};
        await assert.rejects(async()=>await checked[name](),inputError,'installed missing payload');
        for(const value of [...invalid,Object.assign([],payload),Object.assign(()=>{},payload)])await assert.rejects(async()=>await checked[name](value),inputError,'installed payload container');
        for(const value of [{...payload,id:''},{...payload,deadline:NaN}])await assert.rejects(async()=>await checked[name](value),inputError,'installed identity/deadline');
      }
      for(const payload of [{id:'one',message:[]},{id:'one',message:new Uint8Array(6145)},{id:'one',message:new Uint8Array([1]),group:1},{id:'one',message:new Uint8Array([1]),group:'x'.repeat(257)}])await assert.rejects(checked.propose(payload),inputError,'installed proposal field');
      await assert.rejects(checked.report({id:'one',decision:'invalid'}),inputError,'installed decision hash');
      assert.equal(requests,0,'invalid inputs must not reach the installed socket');
    }finally{await new Promise(resolve=>server.close(resolve));}
    console.log(JSON.stringify({methods:Object.keys(client).sort(),failure}));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, join(consumer, "missing.sock")], { cwd: consumer, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { methods: ["propose", "report", "status"], failure: { typed: true, code: "connection", uncertain: false } });
});
