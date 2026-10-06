import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createGuard} from "../../packages/sdk/src/guard.ts";
import type {PolicyInput} from "../../packages/sdk/src/policy.ts";
import {encodeBase58,decodeBase58} from "../../packages/sdk/src/base58.ts";
import {PROGRAMS} from "../../packages/sdk/src/classify.ts";
import {craftLegacy,enc,key} from "../../packages/sdk/test/support/craft.ts";
import {rng} from "../../packages/sdk/test/support/kit.ts";
import {PROFILE_NAMES,requireTraffic,upper95,type TrafficEvidence} from "./traffic.ts";
import {buildProfile,type Payment} from "./traffic-workload.ts";
export interface LoopEvidence {name:string; proposed:number; allowed:number; outcomes:number; firstRefusal:number|null; rule:string|null; postures:(string|null)[]}
function policy(name:string):PolicyInput {
  return {version:1,principal:[encodeBase58(Uint8Array.from(key(1)))],programs:{allow:[PROGRAMS.system,PROGRAMS.computeBudget],opaque:"deny"},destinations:{allow:[2,3,4].map(value=>encodeBase58(Uint8Array.from(key(value))))},
    sol:{maxPerTx:1_000_000_000n,maxPerWindow:1_000_000_000_000n},tokens:[],fees:{maxPriorityPerTx:10_000_000n,maxPerWindow:1_000_000_000_000n,tipAccounts:[]},lookupTables:[],windowMs:86_400_000,
    intents:{maxAttempts:3},latch:{afterDenials:5,releaseKey:encodeBase58(Uint8Array.from(key(20))),guardId:"traffic-"+name,cluster:"localnet"},messages:{allow:false},cosign:{allow:false},sensor:{expectedPerMinute:6}};
}
function message(payment:Payment):Uint8Array {
  const priced=payment.price!==null;
  const keys=[key(1),key(payment.destination),key(0),...(priced?[[...decodeBase58(PROGRAMS.computeBudget)]]:[])];
  const instructions=[...(priced?[{program:3,accounts:[],data:[2,...enc.u32(200000)]},{program:3,accounts:[],data:[3,...enc.u64(payment.price!)]}]:[]),{program:2,accounts:[0,1],data:[...enc.u32(2),...enc.u64(payment.amount)]}];
  return craftLegacy({keys,header:[1,0,priced?2:1],blockhash:payment.blockhash,instructions});
}
export async function measureTraffic():Promise<TrafficEvidence> {
  const evidence:TrafficEvidence={definition:1,profiles:[]};
  for(const [index,name] of PROFILE_NAMES.entries()) {
    const seed=2606101+index,payments=buildProfile(name,seed),guard=await createGuard({policy:policy(name)});
    let denied=0,completed=0; const rules:Record<string,number>={};
    try {
      for(const payment of payments) {
        const decision=guard.check({message:message(payment),at:payment.at});
        if(decision.allow) guard.report(decision.hash,"landed");
        else {if(!decision.rule) throw new Error("unnamed traffic refusal"); denied++; rules[decision.rule]=(rules[decision.rule]??0)+1;}
        completed++;
      }
      const entries=guard.entries();
      if(entries.filter(entry=>entry.kind==="decision").length!==completed || entries.filter(entry=>entry.kind==="report").length!==completed-denied) throw new Error("traffic history does not reconcile");
      evidence.profiles.push({name,seed,proposed:payments.length,completed,denied,rules});
    } finally {guard.close();}
  }
  return evidence;
}
export async function measureLoops():Promise<LoopEvidence[]> {
  const loops:LoopEvidence[]=[];
  for(const [index,name] of ["identical","escalating","alternating","failed-outcomes"].entries()) {
    const random=rng(2606201+index),guard=await createGuard({policy:policy(name)});
    const result:LoopEvidence={name,proposed:0,allowed:0,outcomes:0,firstRefusal:null,rule:null,postures:[]};
    try {
      for(let turn=1;turn<=60;turn++) {
        const payment:Payment={at:turn*400,destination:name==="alternating"?2+(turn%2):name==="failed-outcomes"?2+((turn-1)%3):2,
          amount:name==="failed-outcomes"?1_000_000n+BigInt(turn):250_000_000n+(name==="alternating"?BigInt(turn):0n),price:name==="escalating"?BigInt(1000*turn):null,blockhash:[...random.bytes(32)]};
        const decision=guard.check({message:message(payment),at:payment.at}); result.proposed++; result.postures.push(decision.posture);
        if(!decision.allow) {if(!decision.rule) throw new Error("unnamed loop refusal"); result.firstRefusal=turn; result.rule=decision.rule; break;}
        result.allowed++; guard.report(decision.hash,"failed"); result.outcomes++;
      }
      const entries=guard.entries();
      if(entries.filter(entry=>entry.kind==="decision").length!==result.proposed || entries.filter(entry=>entry.kind==="report" && entry.outcome==="failed").length!==result.outcomes) throw new Error("loop history does not reconcile");
      loops.push(result);
    } finally {guard.close();}
  }
  return loops;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==2) throw new Error("usage: traffic-run.ts");
  const evidence=await measureTraffic(),loops=await measureLoops();
  const proposed=evidence.profiles.reduce((sum,profile)=>sum+profile.proposed,0),denied=evidence.profiles.reduce((sum,profile)=>sum+profile.denied,0);
  console.log(JSON.stringify({evidence,proposed,denied,upper95:upper95(denied,proposed),loops})); requireTraffic(evidence,0);
}
