import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="apps/firewall/src/filter.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","apps/firewall/test/filter.test.ts"],{encoding:"utf8",timeout:5000});
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
const faults=[
  ["configured-tools",'if (!tools.includes(call.name))',"if(false)"],
  ["cluster-pin",'fields.cluster!.value !== "devnet"',"false"],
  ["supported-tools",'supported.includes(tool)',"true"],
  ["network-pin",'call.arguments.networkId !== "solana:devnet"',"false"],
  ["own-network",'!Object.hasOwn(call.arguments, "networkId") ||',""],
  ["copied-tools",'Object.freeze(values as string[])','selected as string[]'],
  ["frozen-arguments",'Object.freeze(value);',"void 0;"],
  ["byte-limit",'Buffer.byteLength(text, "utf8") > 65536',"false"],
  ["byte-not-character-limit",'Buffer.byteLength(text, "utf8") > 65536','text.length>65536'],
  ["depth-limit",'depth > 32',"false"],
  ["call-envelope",'Object.keys(call).sort().join(",") !== "arguments,name"',"false"],
  ["config-accessors",'Object.values(slots).some((field) => !Object.hasOwn(field, "value"))',"false"],
  ["captured-config-values",'slots[key]!.value','selected[Number(key)]'],
] as const;
for(const [name,before,after] of faults){assert.equal(source.split(before).length,2,"missing filter fault: "+name);
  try{writeFileSync(path,source.replace(before,after));const result=run();assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 9\b/);assert.doesNotMatch(result.stdout+result.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);console.log("caught filter fault: "+name);}
  finally{writeFileSync(path,source);}
}
for(const [name,path,before,after] of [
  ["firewall-critical-floor","evals/ci/coverage.ts",'file.path.startsWith("apps/firewall/src/") || ',""],
  ["firewall-aggregate-floor","evals/ci/coverage.ts",',"apps/firewall/src/"',""],
  ["firewall-instrumentation","evals/ci/coverage-hook.ts",'apps\\/(?:signer|firewall)','apps\\/signer'],
] as const){const original=readFileSync(path,"utf8");assert.equal(original.split(before).length,2,"missing firewall coverage fault: "+name);
  try{writeFileSync(path,original.replace(before,after));const result=spawnSync(process.execPath,["--test","evals/ci/coverage.test.ts","evals/ci/coverage-hook.test.ts"],{encoding:"utf8",timeout:5000});assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.match(result.stdout,/tests 6\b/);console.log("caught filter coverage fault: "+name);}
  finally{writeFileSync(path,original);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);console.log("All filter faults caught; sources restored");
