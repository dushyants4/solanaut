import {strict as assert} from "node:assert";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const record="packages/sdk/src/record.ts",publication="packages/sdk/src/request-index-publication.ts";
const sources=new Map([record,publication].map(path=>[path,readFileSync(path,"utf8")]));
const directory=".sandbox/solanaut-1/owned-index/faults";mkdirSync(directory,{recursive:true});
function run(name:string){
  const result=spawnSync(process.execPath,["--test","--experimental-test-isolation=none","packages/sdk/test/request-index-publication.test.ts"],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL"});
  writeFileSync(directory+"/"+name+".txt",result.stdout+result.stderr);return result;
}
const baseline=run("baseline");assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  [record,"actual-owner","indexPublishers.get(store)","indexPublishers.get(store) ?? (async()=>({seq:0,head:'',digest:'',directory:'',root:{}}))"],
  [record,"kernel-owner",'mode !== "kernel" || !open || failed',"!open || failed"],
  [record,"closed-owner",'mode !== "kernel" || !open || failed','mode!=="kernel" || failed'],
  [record,"exclusive-maintenance",'if (publishing) throw new RequestIndexPublicationError',"if(false)throw new RequestIndexPublicationError"],
  [record,"captured-pins","const pins = structuredClone(options);\n      held();", "const pins=options;held();"],
  [record,"early-history",'if (canonicalJSON(history) !== canonicalJSON(entries))\n        throw new RequestIndexPublicationError',"if(false)throw new RequestIndexPublicationError"],
  [record,"late-cache","now.size !== before.size ||\n          now.mtimeNs !== before.mtimeNs ||\n          now.ctimeNs !== before.ctimeNs ||\n          canonicalJSON(history) !== canonicalJSON(entries)\n        )\n          throw new RequestIndexPublicationError(\"owned record changed during index validation\")","now.size !== before.size ||\n          now.mtimeNs !== before.mtimeNs ||\n          now.ctimeNs !== before.ctimeNs\n        )\n          throw new RequestIndexPublicationError(\"owned record changed during index validation\")"],
  [record,"record-boundary","now.size !== before.size ||\n          now.mtimeNs !== before.mtimeNs ||\n          now.ctimeNs !== before.ctimeNs ||\n          canonicalJSON(history) !== canonicalJSON(entries)\n        )\n          throw new RequestIndexPublicationError(\"owned record changed during index validation\")","false ||\n          canonicalJSON(history) !== canonicalJSON(entries)\n        )\n          throw new RequestIndexPublicationError(\"owned record changed during index validation\")"],
  [record,"failed-writer","unchanged();\n      try {\n        return replaceRequestIndex(path, validated, unchanged);\n      } catch (error) {\n        failed = true;\n        throw error;\n      }","unchanged();return replaceRequestIndex(path,validated,unchanged);"],
  [publication,"pointer-shape",'Object.keys(value).sort().join(",") !== "digest,format,generation,head,kind,seq"',"false"],
  [publication,"prefix-head","history[value.seq - 1]?.hash !== value.head","false"],
  [publication,"prior-digest","prior.digest !== old.digest","false"],
  [publication,"prior-generation","verifyGeneration(directory!, prior, before);","void 0;"],
  [publication,"generation-inventory",'readdirSync(directory).sort().join("\\n") !==\n    files\n      .map((file) => file.name)\n      .sort()\n      .join("\\n")',"false"],
  [publication,"generation-bytes","source.text !== file.text","false"],
  [publication,"single-link","actual.isFile() && actual.nlink === 1n","actual.isFile()"],
  [publication,"short-write","offset += count;\n  }\n}","offset=bytes.length;}\n}"],
  [publication,"file-sync","writeAll(fd, text);\n    fsyncSync(fd);","writeAll(fd, text);"],
  [publication,"generation-sync","verifyGeneration(temporary, prepared);\n    syncDirectory(temporary);","verifyGeneration(temporary, prepared);"],
  [publication,"generation-parent-sync","temporaryCreated = false;\n    syncDirectory(dirname(path));","temporaryCreated = false;"],
  [publication,"pointer-sync","writeAll(fd, canonicalJSON(body) + \"\\n\");\n      fsyncSync(fd);","writeAll(fd, canonicalJSON(body) + \"\\n\");"],
  [publication,"final-sync","markerCreated = false;\n      syncDirectory(dirname(path));","markerCreated = false;"],
  [publication,"final-owner","owned();\n      verifyGeneration(directory, prepared);","verifyGeneration(directory, prepared);"],
  [publication,"final-pointer","same(published, lstatSync(current, { bigint: true }));","void 0;"],
  [publication,"receipt-digest","digest: prepared.digest,\n      directory,\n      root: prepared.root","digest:'0'.repeat(64),directory,root:prepared.root"],
  [publication,"immutable-receipt","return Object.freeze({\n      seq: validated.seq,\n      head: validated.head,\n      digest: prepared.digest,\n      directory,\n      root: prepared.root,\n    });","return {seq:validated.seq,head:validated.head,digest:prepared.digest,directory,root:prepared.root};"],
  [publication,"descriptor-cleanup","verifyGeneration(directory, prepared);\n    } finally {\n      closeSync(fd);\n    }","verifyGeneration(directory, prepared);\n    } finally {\n    }"],
] as const;
for(const [path,name,before,after] of faults){
  const source=sources.get(path)!;
  const occurrences=source.split(before).length-1;assert.ok(occurrences>0,"missing index-publication fault: "+name);
  try{let changed=source.replaceAll(before,after);
    if(name==="single-link")changed=changed.replace("before.nlink !== 1n ||","");
    // Formatting gave the lookup's copy of these checks its own indentation; damage it too, as replaceAll once did.
    if(name==="late-cache")changed=changed.replace("now.size !== before.size ||\n        now.mtimeNs !== before.mtimeNs ||\n        now.ctimeNs !== before.ctimeNs ||\n        canonicalJSON(history) !== canonicalJSON(entries)\n      )\n        throw new RequestIndexLookupError(\"owned record changed during request lookup\")","now.size !== before.size ||\n        now.mtimeNs !== before.mtimeNs ||\n        now.ctimeNs !== before.ctimeNs\n      )\n        throw new RequestIndexLookupError(\"owned record changed during request lookup\")");
    if(name==="descriptor-cleanup")changed=changed.replace("decode(bytes), stat: before };\n  } finally {\n    closeSync(fd);\n  }","decode(bytes), stat: before };\n  } finally {\n  }");
    if(name==="record-boundary")changed=changed.replace("now.size !== before.size ||\n        now.mtimeNs !== before.mtimeNs ||\n        now.ctimeNs !== before.ctimeNs ||\n        canonicalJSON(history) !== canonicalJSON(entries)\n      )\n        throw new RequestIndexLookupError(\"owned record changed during request lookup\")","false ||\n        canonicalJSON(history) !== canonicalJSON(entries)\n      )\n        throw new RequestIndexLookupError(\"owned record changed during request lookup\")");
    // Full replay backs up the head check. Inject silent repair of corrupt evidence
    // instead: normalise its head and omit the raw canonical-byte comparison.
    if(name==="prefix-head")changed=changed.replace('const value = JSON.parse(source.text) as Pointer,\n    prefix =',
      'const value=JSON.parse(source.text) as Pointer;value.head=history[value.seq-1]?.hash??"";const prefix=').replace('source.text !== canonicalJSON(value) + "\\n" ||',"");
    writeFileSync(path,changed);const result=run(name);
    assert.equal(result.error,undefined,name);assert.equal(result.signal,null,name);
    assert.equal(result.status,1,name+result.stdout+result.stderr);
    assert.match(result.stdout,/tests 21\b/);assert.match(result.stdout,/AssertionError|RequestIndexPublicationError/);
    assert.doesNotMatch(result.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);
    console.log("caught owned index publication fault: "+name);
  }finally{writeFileSync(path,source);}
}
const restored=run("restored");assert.equal(restored.status,0,restored.stdout+restored.stderr);
for(const [path,source] of sources)assert.equal(readFileSync(path,"utf8"),source);
console.log("All owned request-index publication faults caught; sources restored");
