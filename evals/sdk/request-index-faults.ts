import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {join} from "node:path";
const path="packages/sdk/src/request-index.ts",source=readFileSync(path,"utf8"),output=process.argv[2]??".sandbox/request-index-faults";
mkdirSync(output,{recursive:true});
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/request-index.test.ts"],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL"});
function checked(label:string,expected:number){
  const result=run();writeFileSync(join(output,label+".txt"),result.stdout+result.stderr);
  assert.equal(result.status,expected,label+result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 26\b/);
  if(label.startsWith("report-"))assert.match(result.stdout,/(?:✖|not ok[^\n]*) SNP-7: local report validation remains effective/);
}
checked("baseline",0);
for(const [name,before,after] of [
  ["signed-replay", "const result = await replay(entries, policySeed, sensorV1, pins);", "const result={ok:true};"],
  ["report-outcome-validation", "if (!OUTCOMES.includes(entry.outcome))", "if(false)"],
  ["report-source-validation", "if (![\"caller\", \"signer\"].includes(entry.source))", "if(false)"],
  ["report-finality-validation", "if (final.has(entry.decision))", "if(false)"],
  ["decision-divergence", "if (!result.ok) throw new RequestIndexError(\"request index history does not reproduce its decisions\");", "if(false)throw new RequestIndexError(\"request index history does not reproduce its decisions\");"],
  ["empty-shard-coverage", "const shards = buckets.map((bucket) => {", "const shards=buckets.slice(0,-1).map(bucket=>{"],
  ["control-namespace", "if (entry.kind === \"request\" || (entry.kind === \"decision\" && entry.request)) {", "if(entry.kind===\"decision\" && entry.request){"],
  ["send-started-evidence", "else if (entry.event.stage === \"send-started\") row.started = entry;", "else if(entry.event.stage===\"send-started\"){}"],
  ["final-outcome-evidence", "if (entry.outcome !== \"unknown\") row.settled ??= entry;", "if(false)row.settled??=entry;"],
  ["operator-binding", "operatorKey: pins.operatorKey,\n      policyVersion: last.version", "operatorKey:\"foreign\",policyVersion:last.version"],
  ["endpoint-capture", "const value = structuredClone(input);", "const value=input;"],
  ["trust-capture", "pins = structuredClone(trust);", "pins=trust;"],
  ["omitted-historical-controls", "hash } = createPolicy(JSON.parse(last.policy)),\n      rows = projection(entries);", "hash}=createPolicy(JSON.parse(last.policy)),rows=projection(entries.filter(entry=>entry.kind!==\"request\"));"],
  ["root-provenance", "const root = roots.get(expected);", "const root={manifest:JSON.parse(expected.text),text:expected.text};"],
  ["small-root-retention", "root = immutable({ text, digest: sha256hex(text) })", "root=immutable({text,digest:sha256hex(text),shards})"],
  ["deep-immutability", "Object.freeze(value);", "void value;"],
  ["independent-shard-digest", "if (digest.digest(\"hex\") !== expected.sha256)", "if(false)"],
  ["read-error-absence", "throw new RequestIndexError(\"request index lookup cannot establish evidence\");", "return null;"],
  ["source-change", " ||\n      after.mtimeNs !== before.mtimeNs ||\n      after.ctimeNs !== before.ctimeNs ||\n      named.nlink !== 1n ||\n      named.size !== before.size ||\n      named.mtimeNs !== before.mtimeNs ||\n      named.ctimeNs !== before.ctimeNs", " || named.nlink!==1n || named.size!==before.size"],
  ["late-named-source-change", " ||\n      named.nlink !== 1n ||\n      named.size !== before.size ||\n      named.mtimeNs !== before.mtimeNs ||\n      named.ctimeNs !== before.ctimeNs", ""],
  ["line-ceiling", "maxLine = configured === undefined ? 1_048_576 : configured;", "maxLine=1_048_576;"],
  ["options-shape", "typeof options !== \"object\" ||\n      ", ""],
  ["null-line-ceiling", "maxLine = configured === undefined ? 1_048_576 : configured;", "maxLine=configured??1_048_576;"],
  ["descriptor-cleanup", "finally {\n    await handle.close();\n  }", "finally{}"],
  ["generation-replacement", "before.dev !== after.dev || before.ino !== after.ino", "false"],
  ["single-link-sources", "nlink !== 1n", "nlink<1n"],
  ["exact-identity", "if (candidate.key === key) found = candidate;", "found = candidate;"],
  ["response-binding", "row.response = entry;\n    } else if", "row.response={...entry,request:\"0\".repeat(64)};\n    }else if"],
  ["latest-outcome", "row.report = entry;\n        if (entry.outcome", "row.report=null;if(entry.outcome"],
] as const){
  assert.equal(source.split(before).length,name==="single-link-sources"?4:2,"ambiguous or absent request index fault: "+name);
  try{writeFileSync(path,source.replaceAll(before,after));checked(name,1);console.log("caught request index fault: "+name);}
  finally{writeFileSync(path,source);}
}
checked("restored",0);assert.equal(readFileSync(path,"utf8"),source);
console.log("All request index faults caught; source restored and focused baseline passes");
