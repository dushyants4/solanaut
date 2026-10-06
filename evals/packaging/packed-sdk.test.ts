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
    import {createGuard} from '@solanaut/sdk';
    const g = await createGuard({policy: JSON.parse(process.argv[1]), sensor: () => ({intensity:0,valence:0,repetition:0})});
    const pay = g.check({message: new Uint8Array(Buffer.from(process.argv[2], 'base64')), at: 1000});
    const drain = g.check({message: new Uint8Array(Buffer.from(process.argv[3], 'base64')), at: 2000});
    console.log(JSON.stringify({allow: pay.allow, rule: drain.rule, verified: pay.keel.verified}));
    g.close();
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
    import {createGuard, createSendingClient, SignerClientError, verifyArchive, type ArchiveOptions, type ArchiveReceipt, type ArchiveErrorCode, type GuardOptions, type Decision, type SendingResult} from '@solanaut/sdk';
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
    const archiveOptions: ArchiveOptions = {maxLineBytes:1024};
    const receipt: ArchiveReceipt = await verifyArchive('history.jsonl',archiveOptions);
    const code: ArchiveErrorCode = 'head';
    // @ts-expect-error line limits are numeric
    verifyArchive('history.jsonl',{maxLineBytes:'1024'});
    // @ts-expect-error unknown pins cannot silently disable verification
    verifyArchive('history.jsonl',{expectedHed:'wrong'});
    void receipt; void code;
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
});

test("PKG-3: installed replay and table-pin commands execute with their documented usage exits", () => {
  for (const bin of ["solanaut-replay", "solanaut-pin-table"]) {
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
