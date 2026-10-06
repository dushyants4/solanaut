import {strict as assert} from "node:assert";
import {test} from "node:test";
import {buildProfile} from "./traffic-workload.ts";
test("RT-1: frozen traffic definitions produce complete deterministic populations",()=> {
  for(const [index,name] of ["steady","jitter","bursts","variable-fees","recurring"].entries()) {
    const payments=buildProfile(name,2606101+index); assert.equal(payments.length,500);
    assert.deepEqual(payments,buildProfile(name,2606101+index));
    for(const payment of payments) {assert.ok(payment.amount>=1_000_000n && payment.amount<=10_000_000n); assert.ok([2,3,4].includes(payment.destination)); assert.equal(payment.blockhash.length,32);}
    assert.equal(new Set(payments.map(payment=>payment.blockhash.join(","))).size,500);
  }
});
test("RT-1: frozen spacing, burst cadence and recurring effects are retained",()=> {
  const steady=buildProfile("steady",2606101),jitter=buildProfile("jitter",2606102),bursts=buildProfile("bursts",2606103),recurring=buildProfile("recurring",2606105);
  for(let i=1;i<500;i++) {
    assert.equal(steady[i]!.at-steady[i-1]!.at,10000);
    const gap=jitter[i]!.at-jitter[i-1]!.at; assert.ok(gap>=8000 && gap<=12000);
    assert.equal(bursts[i]!.at,1000+Math.floor(i/10)*100000+(i%10)*100);
    assert.equal(recurring[i]!.at-recurring[i-1]!.at,10000); assert.equal(recurring[i]!.destination,2); assert.equal(recurring[i]!.amount,5_000_000n);
  }
});
test("RT-1: priority prices remain bounded and profile substitutions fail",()=> {
  for(const payment of buildProfile("variable-fees",2606104)) assert.ok(payment.price!==null && payment.price>=5000n && payment.price<=20000n);
  for(const name of ["steady","jitter","bursts","recurring"]) assert.ok(buildProfile(name,2606101).every(payment=>payment.price===null));
  assert.throws(()=>buildProfile("replacement",2606101),/profile/); assert.throws(()=>buildProfile("steady",NaN),/seed/);
});
