// SNP-5/6 and LIF-2/7: each redemption fault has an exact site and restores its bytes.
import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const state="packages/sdk/src/state.ts",guard="packages/sdk/src/guard.ts",inspect="packages/sdk/src/inspect.ts";
const originals=new Map([state,guard,inspect].map(path=>[path,readFileSync(path,"utf8")]));
const run=()=>spawnSync(process.execPath,["--test","packages/sdk/test/redeem-replay.test.ts"],{encoding:"utf8",timeout:15_000});
const validation='  if (e.kind === "redeem") verifyRedeem(s, e, signedPolicyHash);';
const faults=[
  ["entire redemption refusal",state,validation,""],
  ["finite redemption time",state,'if (!Number.isFinite(e.at) || e.at < 0) throw new Error("recorded redemption time is invalid");','if (e.at < 0) throw new Error("recorded redemption time is invalid");'],
  ["negative redemption time",state,'if (!Number.isFinite(e.at) || e.at < 0) throw new Error("recorded redemption time is invalid");','if (!Number.isFinite(e.at)) throw new Error("recorded redemption time is invalid");'],
  ["allowed reservation",state,'if (!d || !r || !attempt) throw new Error("recorded redemption names no allowed reservation");','if (false) throw new Error("recorded redemption names no allowed reservation");'],
  ["single-use receipt",state,'if (s.redeemed.has(e.decision)) throw new Error("recorded receipt was already used");','if (false) throw new Error("recorded receipt was already used");'],
  ["permanent receipt finality",state,'if (!unresolved(attempt)) throw new Error("recorded redemption names a final outcome");','if (false) throw new Error("recorded redemption names a final outcome");'],
  ["signed chronological policy",state,'if (signedPolicyHash !== undefined && d.policyHash !== signedPolicyHash)','if (false)'],
  ["unsigned historical compatibility",state,'if (signedPolicyHash !== undefined && d.policyHash !== signedPolicyHash)','if (d.policyHash !== signedPolicyHash)'],
  ["canonical receipt height",state,'if (height.toString() !== e.blockHeight) throw new Error();',''],
  ["inclusive expiry",state,'height > BigInt(d.expires.lastValidBlockHeight)','height >= BigInt(d.expires.lastValidBlockHeight)'],
  ["expiry verification",state,'if (d.expires && (height === null || height > BigInt(d.expires.lastValidBlockHeight)))','if (false)'],
  ["mandatory expiry height",state,'if (d.expires && (height === null || height > BigInt(d.expires.lastValidBlockHeight)))','if (d.expires && (height !== null && height > BigInt(d.expires.lastValidBlockHeight)))'],
  ["live negative bigint compatibility",state,'if (d.expires && (height === null || height > BigInt(d.expires.lastValidBlockHeight)))','if (d.expires && (height === null || height < 0n || height > BigInt(d.expires.lastValidBlockHeight)))'],
  ["unbounded receipt null height",state,'if (d.expires && (height === null || height > BigInt(d.expires.lastValidBlockHeight)))','if (height === null || (d.expires && height > BigInt(d.expires.lastValidBlockHeight)))'],
  ["validation before state mutation",state,validation+'\n  s.seq += 1;\n  s.head = e.hash;\n  s.maxAt = Math.max(s.maxAt ?? e.at, e.at);','  s.seq += 1;\n  s.head = e.hash;\n  s.maxAt = Math.max(s.maxAt ?? e.at, e.at);\n'+validation],
  ["used receipt state",state,'      s.redeemed.add(e.decision);',''],
  ["signing redemption state",state,'      if (s.signing.has(e.decision)) s.signing.get(e.decision)!.redeemed = true;',''],
  ["restore and replay policy context",guard,'  apply(env.state, entry, env.policy, env.policyEntry ? env.policyHash : undefined);\n  if (entry.kind === "release") env.governor.reset();','  apply(env.state, entry, env.policy);\n  if (entry.kind === "release") env.governor.reset();'],
  ["inspection policy context",inspect,'    apply(state, e, policy, previous ? hash : undefined);','    apply(state, e, policy);'],
] as const;
function complete(label:string,expected:number){
  const result=run(),output=result.stdout+result.stderr;
  assert.equal(result.status,expected,label+output);assert.equal(result.signal,null);assert.equal(result.error,undefined);
  assert.match(output,/tests 16\b/);
  if(expected===1){assert.match(output,/AssertionError/);assert.doesNotMatch(output,/ERR_MODULE_NOT_FOUND|SyntaxError|ReferenceError/);}
}
complete("baseline",0);
for(const [name,path,before,after] of faults){
  const source=originals.get(path)!;assert.equal(source.split(before).length,2,"fault must have one exact target: "+name);
  try{writeFileSync(path,source.replace(before,after));complete(name,1);console.log("caught redemption replay fault: "+name);}
  finally{writeFileSync(path,source);}
}
complete("restored",0);for(const [path,source] of originals)assert.equal(readFileSync(path,"utf8"),source);
// Commit already checks the live policy; checkpoint state already requires full replay.
// Their repeated context propagation is defence in depth, not a separately caught fault.
console.log("All redemption replay faults caught; exact source restoration passes");
