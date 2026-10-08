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
    import {mkdtempSync,writeFileSync,readFileSync,rmSync,renameSync,symlinkSync,unlinkSync} from 'node:fs';
    import {tmpdir} from 'node:os';
    import {join} from 'node:path';
    const {prepareCheckpointPrefix,rebuildCheckpointPrefix,CheckpointPrefixError}=await import(new URL('./checkpoint-prefix.js',import.meta.resolve('@solanaut/sdk')));
    const {prepareCheckpointState,CheckpointStateError}=await import(new URL('./checkpoint-state.js',import.meta.resolve('@solanaut/sdk')));
    const {prepareCheckpointBundle}=await import(new URL('./checkpoint-bundle.js',import.meta.resolve('@solanaut/sdk')));
    const {prepareCheckpointEnvelope,verifyCheckpointEnvelope,CheckpointEnvelopeError}=await import(new URL('./checkpoint-envelope.js',import.meta.resolve('@solanaut/sdk')));
    const {fileStore,publishOwnedCheckpoint,recoverOwnedCheckpoint}=await import(new URL('./record.js',import.meta.resolve('@solanaut/sdk')));
    const {verifyArchive,streamArchive}=await import(new URL('./archive.js',import.meta.resolve('@solanaut/sdk')));
    const {replayStream}=await import(new URL('./guard.js',import.meta.resolve('@solanaut/sdk')));
    const {prepareCheckpointRecovery}=await import(new URL('./checkpoint-recovery.js',import.meta.resolve('@solanaut/sdk')));
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
    for(const [prepare,ErrorType] of [[prepareCheckpointPrefix,CheckpointPrefixError],[prepareCheckpointState,CheckpointStateError]]){
      let refused=false;try{await prepare(bad,undefined,end,trust);}catch(error){refused=error instanceof ErrorType;}
      if(!refused)throw new Error('dishonest replay accepted');
    }
    console.log(JSON.stringify({events:p.events.length,requests:s.state.requests.length,uncertain:true}));`;
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,inputPolicy,Buffer.from(transfer(2)).toString("base64")],{cwd:consumer,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{events:1,requests:2,uncertain:true});
  for(const name of ["checkpoint-prefix","checkpoint-state","checkpoint-bundle","checkpoint-envelope","checkpoint-publication","checkpoint-recovery","checkpoint-errors"])for(const extension of ["js","d.ts"])assert.ok(packed.files.some((file:{path:string})=>file.path==="dist/src/"+name+"."+extension));
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
    const client=createSendingClient({socket:process.argv[1],clientId:'agent',timeoutMs:100});
    let failure;
    try { await client.propose({id:'payment',message:new Uint8Array([1])}); }
    catch(e) { failure={typed:e instanceof SignerClientError,code:e.code,uncertain:e.mayHaveExecuted}; }
    console.log(JSON.stringify({methods:Object.keys(client).sort(),failure}));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, join(consumer, "missing.sock")], { cwd: consumer, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { methods: ["propose", "report", "status"], failure: { typed: true, code: "connection", uncertain: false } });
});
