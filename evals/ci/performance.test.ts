import { strict as assert } from "node:assert";
import { test } from "node:test";
import { p99, requirePerformance, type TimingEvidence, type TimingBaseline } from "./performance.ts";
const baseline=():TimingBaseline=>({definition:1,machine:"reference-linux",node:"26.7.0",workload:"frozen-1",revision:"a".repeat(40),preP99Ns:5_000_000,persistedP99Ns:25_000_000});
const good=():TimingEvidence=>({definition:1,machine:"reference-linux",node:"26.7.0",workload:"frozen-1",preNs:Array(10_000).fill(5_000_000),persistedNs:Array(10_000).fill(25_000_000),freshnessNs:Array(10_000).fill(1_000_000_000),decisions:10_000,elapsedNs:50_000_000_000,replayed:10_000,replayElapsedNs:2_000_000_000,restart:{decisions:100_000,elapsedNs:5_000_000_000,ready:true,snapshotVerified:true,keelReplayed:true}});
test("CI-2: performance boundaries pass and nearest-rank p99 keeps inputs intact",()=> {
  assert.doesNotThrow(()=>requirePerformance(good(),baseline(),0));
  const values=[...Array(99).fill(1),9]; assert.equal(p99(values),1); assert.equal(values.at(-1),9);
  values[98]=8; assert.equal(p99(values),8);
});
test("CI-2: failed or absent measurement-process completion rejects timing",()=> {
  for(const status of [1,null]) assert.throws(()=>requirePerformance(good(),baseline(),status),/process/);
});
test("CI-2: pre-persistence and synced latency floors cannot be rounded down",()=> {
  for(const field of ["preNs","persistedNs"] as const) {const bad=good(); bad[field]=bad[field].map(value=>value+1); assert.throws(()=>requirePerformance(bad,baseline(),0),/latency/);}
});
test("CI-2: throughput and replay counts and elapsed time both govern the gate",()=> {
  for(const field of ["elapsedNs","replayElapsedNs"] as const) {const bad=good(); bad[field]++; assert.throws(()=>requirePerformance(bad,baseline(),0),/rate/);}
  const incomplete=good(); incomplete.replayed--; assert.throws(()=>requirePerformance(incomplete,baseline(),0),/replay/);
});
test("CI-2: complete restored snapshot and Keel evidence is required for restart",()=> {
  for(const field of ["ready","snapshotVerified","keelReplayed"] as const) {const bad=good(); bad.restart[field]=false; assert.throws(()=>requirePerformance(bad,baseline(),0),/restart/);}
  const bad=good(); bad.restart.decisions--; assert.throws(()=>requirePerformance(bad,baseline(),0),/restart/);
  bad.restart.decisions=100_000; bad.restart.elapsedNs++; assert.throws(()=>requirePerformance(bad,baseline(),0),/restart/);
});
test("CI-2: every measured dashboard delay must meet freshness",()=> {
  const bad=good(); bad.freshnessNs[0]=1_000_000_001; assert.throws(()=>requirePerformance(bad,baseline(),0),/freshness/);
});
test("CI-2: p99 regression compares externally supplied compatible baseline",()=> {
  const ref=baseline(); ref.preP99Ns=1_000_000; const current=good(); current.preNs.fill(1_200_000);
  assert.doesNotThrow(()=>requirePerformance(current,ref,0)); current.preNs.fill(1_200_001);
  assert.throws(()=>requirePerformance(current,ref,0),/regression/);
  current.preNs.fill(1_000_000); ref.persistedP99Ns=1_000_000; current.persistedNs.fill(1_200_000);
  assert.doesNotThrow(()=>requirePerformance(current,ref,0)); current.persistedNs.fill(1_200_001);
  assert.throws(()=>requirePerformance(current,ref,0),/regression/);
  for(const field of ["machine","node","workload"] as const) {const ref=baseline(); ref[field]="different"; assert.throws(()=>requirePerformance(good(),ref,0),/baseline/);}
});
test("CI-2: malformed, zero and undersized measurements cannot qualify",()=> {
  for(const value of [0,-1,NaN,Infinity,1.5]) assert.throws(()=>p99([value]),/samples/);
  assert.throws(()=>p99([]),/samples/);
  for(const field of ["preNs","persistedNs","freshnessNs"] as const) {const bad=good(); bad[field]=[]; assert.throws(()=>requirePerformance(bad,baseline(),0),/samples/);}
  for(const field of ["preNs","persistedNs","freshnessNs"] as const) {const bad=good(); bad[field].pop(); assert.throws(()=>requirePerformance(bad,baseline(),0),/samples/);}
  const short=good(); short.decisions=9999; assert.throws(()=>requirePerformance(short,baseline(),0),/population/);
  const invalid=baseline(); invalid.preP99Ns=0; assert.throws(()=>requirePerformance(good(),invalid,0),/baseline/);
});
