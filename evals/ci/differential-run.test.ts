import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CORPUS_DIGEST, REGRESSION_DIGEST, readCorpus } from "./differential-run.ts";
test("CI-2: the frozen corpus has distinct transactions and refuses any changed byte",()=> {
  assert.equal(readCorpus(readFileSync("evals/ci/differential/mainnet-453965982.jsonl"),REGRESSION_DIGEST).length,1078);
  const bytes=readFileSync("evals/ci/differential/mainnet-453972158.jsonl"); assert.equal(readCorpus(bytes,CORPUS_DIGEST).length,1578);
  const position=bytes.indexOf('"wire":"')+8; bytes[position]=bytes[position]===65?66:65;
  assert.throws(()=>readCorpus(bytes,CORPUS_DIGEST),/digest/);
});
test("CI-2: matching bytes do not excuse missing framing or duplicate identities",()=> {
  const rows=[{index:0,version:"legacy",wire:"AA==",loaded:{writable:[],readonly:[]}}];
  const check=(text:string)=>readCorpus(Buffer.from(text),createHash("sha256").update(text).digest("hex"));
  assert.throws(()=>check(JSON.stringify(rows[0])),/framing/);
  assert.throws(()=>check(rows.concat({...rows[0]!,index:1}).map(row=>JSON.stringify(row)).join("\n")+"\n"),/duplicate/);
});
