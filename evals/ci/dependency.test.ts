import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const require=createRequire(import.meta.url),client=createRequire(require.resolve("typed-rest-client/package.json"));
const qs=client("qs"),util=client("./Util.js");
test("DEP-1: Stryker query dependency has the exact scoped reviewed resolution",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../../package.json",import.meta.url),"utf8"));
  assert.equal(manifest.overrides?.["typed-rest-client@2.3.1"]?.qs,"6.16.0");
  assert.equal(client("qs/package.json").version,"6.16.0");
});
test("DEP-1: hostile constructor from query parsing cannot crash serialization",()=>{
  const parsed=qs.parse("x%5Bconstructor%5D%5BisBuffer%5D=y",{plainObjects:true});
  assert.doesNotThrow(()=>qs.stringify(parsed));
  assert.doesNotThrow(()=>util.getUrl("/check","http://127.0.0.1",{params:parsed}));
});
test("DEP-1: nullable comma arrays and ordinary REST query options remain usable",()=>{
  assert.doesNotThrow(()=>qs.stringify({x:[null,undefined,"a"]},{arrayFormat:"comma",encodeValuesOnly:true}));
  assert.equal(util.getUrl("/check","http://127.0.0.1",{params:{tag:["a","b"],space:"a b"}}),"http://127.0.0.1/check?tag=a&tag=b&space=a%20b");
});
