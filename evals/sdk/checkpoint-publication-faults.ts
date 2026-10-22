import {strict as assert} from "node:assert";
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const record="packages/sdk/src/record.ts",publication="packages/sdk/src/checkpoint-publication.ts";
const sources=new Map([record,publication].map(path=>[path,readFileSync(path,"utf8")]));
const run=()=>{
  mkdirSync(resolve(".sandbox/solanaut-1"),{recursive:true});
  const temporary=mkdtempSync(resolve(".sandbox/solanaut-1/publication-fault-"));
  try{return spawnSync(process.execPath,["--test","--experimental-test-isolation=none","packages/sdk/test/checkpoint-publication.test.ts"],{encoding:"utf8",timeout:15000,killSignal:"SIGKILL",env:{...process.env,TMPDIR:temporary}});}
  finally{rmSync(temporary,{recursive:true,force:true});}
};
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  [record,"actual-store","publishers.get(store)","publishers.get(store) ?? (async()=>({seq:0,head:'',digest:'',bytes:0}))"],
  [record,"kernel-owner",'mode !== "kernel" || !open || failed',"!open || failed"],
  [record,"closed-owner",'mode !== "kernel" || !open || failed','mode!=="kernel" || failed'],
  [record,"cached-history",'if (canonicalJSON(history) !== canonicalJSON(entries))\n        throw new CheckpointPublicationError',"if(false)throw new CheckpointPublicationError"],
  [record,"exclusive-publication",'if (publishing) throw new CheckpointPublicationError',"if(false)throw new CheckpointPublicationError"],
  [record,"stale-record","now.size !== before.size ||\n          now.mtimeNs !== before.mtimeNs ||\n          now.ctimeNs !== before.ctimeNs ||\n          canonicalJSON(history) !== canonicalJSON(entries)\n        )\n          throw new CheckpointPublicationError(\"owned record changed during checkpoint validation\")","false\n        )\n          throw new CheckpointPublicationError(\"owned record changed during checkpoint validation\")"],
  [record,"late-cached-history"," ||\n          canonicalJSON(history) !== canonicalJSON(entries)\n        )\n          throw new CheckpointPublicationError",
    ")throw new CheckpointPublicationError"],
  [record,"failed-writer","try {\n        replaceCheckpoint(path, validated.text, validated.pins, unchanged);\n      } catch (error) {\n        failed = true;\n        throw error;\n      }",
    "try{replaceCheckpoint(path,validated.text,validated.pins,unchanged);}catch(error){throw error;}"],
  [publication,"derived-state","canonicalJSON(envelope.binding) !== canonicalJSON(bundle.binding) ||\n    envelope.archives !== bundle.archives ||\n    envelope.state !== bundle.state ||\n    envelope.prefix !== bundle.prefix","false"],
  [publication,"receipt-digest","digest: sha256hex(input as string)",'digest:"0".repeat(64)'],
  [publication,"short-progress","offset += count;","offset=bytes.length;"],
  [publication,"zero-progress","count <= 0","count < 0"],
  [publication,"file-sync","writeAll(fd, text);\n    fsyncSync(fd);","writeAll(fd, text);"],
  [publication,"prior-sync","priorCreated = false;\n      syncDirectory(current);","priorCreated = false;"],
  [publication,"final-sync","tempCreated = false;\n    syncDirectory(current);","tempCreated = false;"],
  [publication,"preserved-prior","linkSync(current, prior);\n      priorCreated = true;\n      renameSync(prior, previous);\n      priorCreated = false;\n      syncDirectory(current);","syncDirectory(current);"],
  [publication,"prior-authentication","verifyCheckpointEnvelope(readFileSync(oldFd, \"utf8\"), pins.checkpointTrust, pins.maxBytes);","void 0;"],
  [publication,"nofollow-current","constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK","constants.O_RDONLY|constants.O_NONBLOCK"],
] as const;
for(const [path,name,before,after] of faults){
  const source=sources.get(path)!;assert.equal(source.split(before).length,2,"missing publication fault: "+name);
  try{let changed=source.replace(before,after);
    // D25 adds a second cache defence; omit both for the retained all-cache fault.
    if(name==="cached-history")changed=changed.replace("now.size !== before.size ||\n          now.mtimeNs !== before.mtimeNs ||\n          now.ctimeNs !== before.ctimeNs ||\n          canonicalJSON(history) !== canonicalJSON(entries)\n        )\n          throw new CheckpointPublicationError(\"owned record changed during checkpoint validation\")","now.size !== before.size ||\n          now.mtimeNs !== before.mtimeNs ||\n          now.ctimeNs !== before.ctimeNs\n        )\n          throw new CheckpointPublicationError(\"owned record changed during checkpoint validation\")");
    if(name==="nofollow-current")changed=changed.replace("const named = lstatSync(current);","const named=fstatSync(oldFd!);");
    writeFileSync(path,changed);const result=run();
    if(name==="zero-progress"){assert.equal(Reflect.get(result.error!,"code"),"ETIMEDOUT");assert.equal(result.signal,"SIGKILL");assert.equal(result.status,null);console.log("contained checkpoint publication fault: zero-progress (child deadline; no test completion credit)");}
    else{assert.equal(result.status,1,name+result.stdout+result.stderr);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.match(result.stdout,/tests 16\b/);console.log("caught checkpoint publication fault: "+name);}
  }
  finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All checkpoint publication faults caught; restored source passes");
