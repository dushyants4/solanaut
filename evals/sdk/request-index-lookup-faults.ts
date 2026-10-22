// Builder-authored fault proof; no syntax, setup failure or timeout receives catch credit.
import {strict as assert} from "node:assert";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const record="packages/sdk/src/record.ts",publication="packages/sdk/src/request-index-publication.ts";
const sources=new Map([record,publication].map(path=>[path,readFileSync(path,"utf8")]));
const directory=".sandbox/solanaut-1/owned-lookup/faults";mkdirSync(directory,{recursive:true});
function run(name:string){
  const result=spawnSync(process.execPath,["--test","--test-isolation=none","packages/sdk/test/request-index-lookup.test.ts"],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL"});
  writeFileSync(directory+"/"+name+".txt",result.stdout+result.stderr);return result;
}
const baseline=run("baseline");assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  [record,"actual-capability","indexLookups.get(store)","indexLookups.get(store) ?? (async()=>({seq:0,head:'',indexSeq:0,indexHead:'',row:null}))"],
  [record,"kernel-owner",'mode !== "kernel" || !open || failed',"!open || failed"],
  [record,"closed-owner",'mode !== "kernel" || !open || failed','mode!=="kernel" || failed'],
  [record,"failed-owner",'mode !== "kernel" || !open || failed','mode !== "kernel" || !open'],
  [record,"maintenance",'if (publishing) throw new RequestIndexLookupError',"if(false)throw new RequestIndexLookupError"],
  [record,"captured-identity","const id = structuredClone(identity),\n        pins = structuredClone(options);\n      held();","const id=identity,pins=structuredClone(options);held();"],
  [record,"captured-pins","const id = structuredClone(identity),\n        pins = structuredClone(options);\n      held();","const id=structuredClone(identity),pins=options;held();"],
  [record,"early-cache",'if (canonicalJSON(history) !== canonicalJSON(entries))\n        throw new RequestIndexLookupError',"if(false)throw new RequestIndexLookupError"],
  [record,"late-cache","||\n        canonicalJSON(history) !== canonicalJSON(entries)\n      )\n        throw new RequestIndexLookupError", ") throw new RequestIndexLookupError"],
  [record,"record-boundary","now.size !== before.size ||\n        now.mtimeNs !== before.mtimeNs ||\n        now.ctimeNs !== before.ctimeNs ||\n        canonicalJSON(history) !== canonicalJSON(entries)\n      )\n        throw new RequestIndexLookupError","canonicalJSON(history)!==canonicalJSON(entries))throw new RequestIndexLookupError"],
  [record,"late-owner","held();\n        const now = fstatSync(fd, { bigint: true });","const now = fstatSync(fd, { bigint: true });"],
  [record,"loading-pointer","marker.dev !== named.dev ||\n          marker.ino !== named.ino ||\n          marker.size !== named.size ||\n          marker.mtimeNs !== named.mtimeNs ||\n          marker.ctimeNs !== named.ctimeNs\n        )\n          throw new RequestIndexPublicationError(\"request index pointer changed during module loading\")","false\n        )\n          throw new RequestIndexPublicationError(\"request index pointer changed during module loading\")"],
  [publication,"full-current-replay","prepared = await prepareRequestIndex(history, undefined, endpoint, pins.policyTrust);","prepared=await prepareRequestIndex(old===undefined?history:history.slice(0,old.seq),undefined,old===undefined?endpoint:{seq:old.seq,head:old.head},pins.policyTrust);"],
  [publication,"disk-consultation","structuredClone(\n    await lookupRequestIndex(prefix.directory, prefix.root, id),\n  )","null"],
  [publication,"captured-history","const captured = structuredClone(history),\n    id =", "const captured=history,id="],
  [publication,"tail-start","captured.slice(prefix.seq)","[] as Entry[]"],
  [publication,"tail-response",'else if (row && entry.kind === "response" && entry.request === row.start.hash) row.response = entry;',"else if(false){}"],
  [publication,"tail-redemption",'if (entry.kind === "redeem") row.redeem = entry;', 'if(entry.kind==="redeem"){}'],
  [publication,"tail-signed",'else if (entry.event.stage === "signed") row.signed = entry;', 'else if(entry.event.stage==="signed"){}'],
  [publication,"tail-started",'else if (entry.event.stage === "send-started") row.started = entry;', 'else if(entry.event.stage==="send-started"){}'],
  [publication,"tail-signing-response","else row.response = entry;","else {}"],
  [publication,"tail-report","row.report = entry;\n        if (entry.outcome", "void 0;if(entry.outcome"],
  [publication,"tail-settlement",'if (entry.outcome !== "unknown") row.settled ??= entry;',"row.settled ??= entry;"],
  [publication,"final-pointer","unchangedPointer(path, validated.pointer);","void 0;"],
  [publication,"current-endpoint","seq: validated.seq, head: validated.head, indexSeq: prefix.seq", "seq:prefix.seq,head:prefix.head,indexSeq:prefix.seq"],
  [publication,"immutable-answer","return freeze({ seq: validated.seq", "return ({seq:validated.seq"],
] as const;
const misses:string[]=[];
for(const [path,name,before,after] of faults){
  const source=sources.get(path)!;assert.ok(source.includes(before),"missing owned-lookup fault: "+name);
  let changed=source.replaceAll(before,after);
  // Formatting gave the lookup's copy of these checks its own indentation; damage it too, as replaceAll once did.
  if(name==="late-owner")changed=changed.replace("held();\n      const now = fstatSync(fd, { bigint: true });","const now = fstatSync(fd, { bigint: true });");
  if(name==="loading-pointer")changed=changed.replace("marker.dev !== named.dev ||\n        marker.ino !== named.ino ||\n        marker.size !== named.size ||\n        marker.mtimeNs !== named.mtimeNs ||\n        marker.ctimeNs !== named.ctimeNs\n      )\n        throw new RequestIndexLookupError(\"request index pointer changed during lookup loading\")","false\n      )\n        throw new RequestIndexLookupError(\"request index pointer changed during lookup loading\")");
  try{writeFileSync(path,changed);const result=run(name);
    assert.equal(result.error,undefined,name);assert.equal(result.signal,null,name);
    if(result.status===0){misses.push(name);console.log("MISSED owned request lookup fault: "+name);continue;}
    assert.equal(result.status,1,name+result.stdout+result.stderr);assert.match(result.stdout,/tests 18\b/);assert.match(result.stdout,/AssertionError|RequestIndexLookupError/);
    assert.doesNotMatch(result.stdout+result.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);console.log("caught owned request lookup fault: "+name);
  }finally{writeFileSync(path,source);}
}
const restored=run("restored");assert.equal(restored.status,0,restored.stdout+restored.stderr);
for(const [path,source] of sources)assert.equal(readFileSync(path,"utf8"),source);
assert.deepEqual(misses,[],"missed semantic faults require regressions");console.log("All owned request lookup faults caught; sources restored");
