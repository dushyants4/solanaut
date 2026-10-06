export interface TimingEvidence {
  definition:number; machine:string; node:string; workload:string;
  preNs:number[]; persistedNs:number[]; freshnessNs:number[];
  decisions:number; elapsedNs:number; replayed:number; replayElapsedNs:number;
  restart:{decisions:number; elapsedNs:number; ready:boolean; snapshotVerified:boolean; keelReplayed:boolean};
}
export interface TimingBaseline { definition:number; machine:string; node:string; workload:string; revision:string; preP99Ns:number; persistedP99Ns:number }
const positive=(value:number)=>Number.isSafeInteger(value) && value>0;
export function p99(samples:readonly number[]):number {
  if(!Array.isArray(samples) || samples.length===0 || samples.some(value=>!positive(value))) throw new Error("invalid timing samples");
  return [...samples].sort((a,b)=>a-b)[Math.ceil(samples.length*0.99)-1]!;
}
export function requirePerformance(evidence:TimingEvidence,baseline:TimingBaseline,status:number|null):void {
  if(status!==0) throw new Error("timing process failed or did not complete");
  if(!baseline || !evidence || baseline.definition!==1 || evidence.definition!==1 ||
    !/^[a-f0-9]{40}$/.test(baseline.revision) || !positive(baseline.preP99Ns) || !positive(baseline.persistedP99Ns) ||
    ["machine","node","workload"].some(field=> {
      const key=field as "machine"|"node"|"workload";
      return typeof baseline[key]!=="string" || baseline[key].length===0 || baseline[key]!==evidence[key];
    })) throw new Error("missing or incompatible timing baseline");
  if(!positive(evidence.decisions) || evidence.decisions<10_000) throw new Error("timing population below definition floor");
  const pre=p99(evidence.preNs), persisted=p99(evidence.persistedNs); p99(evidence.freshnessNs);
  if(evidence.preNs.length!==evidence.decisions || evidence.persistedNs.length!==evidence.decisions || evidence.freshnessNs.length!==evidence.decisions) throw new Error("incomplete timing samples");
  if(pre>5_000_000 || persisted>25_000_000) throw new Error("decision latency exceeds target");
  if(!positive(evidence.elapsedNs) || BigInt(evidence.decisions)*1_000_000_000n<BigInt(evidence.elapsedNs)*200n) throw new Error("decision rate below target");
  if(evidence.replayed!==evidence.decisions) throw new Error("replay population incomplete");
  if(!positive(evidence.replayElapsedNs) || BigInt(evidence.replayed)*1_000_000_000n<BigInt(evidence.replayElapsedNs)*5_000n) throw new Error("replay rate below target");
  const restart=evidence.restart;
  if(!restart || restart.decisions!==100_000 || !positive(restart.elapsedNs) || restart.elapsedNs>5_000_000_000 || restart.ready!==true || restart.snapshotVerified!==true || restart.keelReplayed!==true) throw new Error("restart evidence missing or target exceeded");
  if(evidence.freshnessNs.some(value=>value>1_000_000_000)) throw new Error("dashboard freshness target exceeded");
  if(BigInt(pre)*5n>BigInt(baseline.preP99Ns)*6n || BigInt(persisted)*5n>BigInt(baseline.persistedP99Ns)*6n) throw new Error("p99 regression exceeds target");
}
