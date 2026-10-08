// SNP-5/6 and LIF-7: mutate one report boundary at a time; restore exact bytes.
import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const path="packages/sdk/src/state.ts",source=readFileSync(path,"utf8");
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/report-replay.test.ts"],{encoding:"utf8",timeout:15_000});
const validation='  if (e.kind === "report") verifyReport(s, e);';
const faults=[
  ["entire report refusal",validation,""],
  ["outcome enum",'if (!OUTCOMES.includes(e.outcome))','if (false)'],
  ["source enum",'if (e.source !== "caller" && e.source !== "signer")','if (false)'],
  ["finite time",'if (!Number.isFinite(e.at) || e.at < 0) throw new Error("recorded report time is invalid");','if (e.at < 0) throw new Error("recorded report time is invalid");'],
  ["negative time",'if (!Number.isFinite(e.at) || e.at < 0) throw new Error("recorded report time is invalid");','if (!Number.isFinite(e.at)) throw new Error("recorded report time is invalid");'],
  ["permanent finality",'if (!unresolved(attempt)) throw new Error("recorded report names an attempt with a final outcome");','if (false) throw new Error("recorded report names an attempt with a final outcome");'],
  ["reservation validation",'if (!s.allowed.has(e.decision) || !r || !attempt)','if (false)'],
  ["validation after mutation",validation+'\n  if (e.kind === "redeem") verifyRedeem(s, e, signedPolicyHash);\n  s.seq += 1;\n  s.head = e.hash;\n  s.maxAt = Math.max(s.maxAt ?? e.at, e.at);','  if (e.kind === "redeem") verifyRedeem(s, e, signedPolicyHash);\n  s.seq += 1;\n  s.head = e.hash;\n  s.maxAt = Math.max(s.maxAt ?? e.at, e.at);\n'+validation],
  ["unknown releases value",'if (e.outcome === "failed" || e.outcome === "expired")','if (e.outcome === "failed" || e.outcome === "expired" || e.outcome === "unknown")'],
  ["repeat unknown inflates sensor",'if (attempt.status === "unknown") s.sensor.unknownStreak = Math.max(0, s.sensor.unknownStreak - 1);',''],
  ["expired retains fees",'if (e.outcome === "expired") r.feesReleased = true;',''],
  ["final signing not settled",'if (e.outcome !== "unknown" && s.signing.has(e.decision)) s.signing.get(e.decision)!.settled = true;',''],
] as const;
const baseline=run();assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
for(const [name,before,after] of faults){
  assert.equal(source.split(before).length,2,"fault must have one target: "+name);
  try{
    writeFileSync(path,source.replace(before,after));const result=run(),output=result.stdout+result.stderr;
    assert.equal(result.status,1,name+output);assert.equal(result.signal,null);assert.equal(result.error,undefined);
    assert.match(output,/tests 16\b/);assert.match(output,/AssertionError/);
    console.log("caught report replay fault: "+name);
  }finally{writeFileSync(path,source);}
}
const restored=run();assert.equal(restored.status,0,restored.stdout+restored.stderr);
assert.equal(readFileSync(path,"utf8"),source);console.log("All report replay faults caught; restored source passes");
