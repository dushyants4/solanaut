import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { checkTransaction, same, type CorpusRow } from "./differential-check.ts";
const rows:CorpusRow[]=readFileSync("evals/ci/differential/mainnet-453965982.jsonl","utf8").trimEnd().split("\n").map(line=>JSON.parse(line));
test("CI-2: real wire, signatures and accounts compare in all supported formats",()=> {
  for(const version of ["legacy",0,1] as const) {const row=rows.find(row=>row.version===version)!; assert.ok(checkTransaction(row).signatures>0);}
});
test("CI-2: mismatched bytes, roles, quantities and names cannot evade comparison",()=> {
  for(const [actual,reference] of [[Uint8Array.of(1),Uint8Array.of(2)],[{writable:false},{writable:true}],[9007199254740993n,9007199254740992n],["Transfer","Approve"]]) assert.throws(()=>same(actual,reference));
  assert.doesNotThrow(()=>same({value:1n},{value:1n}));
});
test("CI-2: client prefix decoding requires a named guard refusal for trailing data",()=> {
  assert.equal(checkTransaction(rows[761]!).strictRefusal,true);
});
