import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "packages/sdk/bin/verify-archive.ts", original = readFileSync(path,"utf8");
const print = "console.log(JSON.stringify(await verifyArchive(input.path, input.options)))";
const faults = [
  ["duplicate-flag", "seen.has(flag)", "false"],
  ["unknown-flag", 'default: throw new Error("usage")', "default: break"],
  ["noncanonical-integer", "!/^(0|[1-9][0-9]*)$/.test(value)", "false"],
  ["drop-head-pin", "options.expectedHead = value", "options.expectedHead = undefined"],
  ["invent-receipt", print, "console.log(JSON.stringify({entries:0}))"],
  ["successful-refusal-exit", "process.exitCode = 1", "process.exitCode = 0"],
  ["write-source", print, `await (await import('node:fs/promises')).appendFile(input.path,'\\n'); ${print}`],
] as const;
const battery = () => spawnSync(process.execPath,["--test","packages/sdk/test/archive-cli.test.ts"],{encoding:"utf8",timeout:30_000});
const baseline=battery(); assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,from,to] of faults) {
  assert.equal(original.split(from).length,2,`missing or ambiguous fault: ${name}`);
  try {
    writeFileSync(path,original.replace(from,to)); const result=battery();
    assert.equal(result.status,1,result.stdout+result.stderr); assert.match(result.stdout+result.stderr,/AssertionError/);
    console.log(`caught archive CLI fault: ${name}`);
  } finally { writeFileSync(path,original); }
}
const restored=battery(); assert.equal(restored.status,0,restored.stdout+restored.stderr);
console.log("All archive CLI faults caught; restored command passes");
