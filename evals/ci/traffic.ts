export interface TrafficProfile {name:string; seed:number; proposed:number; completed:number; denied:number; rules:Record<string,number>}
export interface TrafficEvidence {definition:number; profiles:TrafficProfile[]}
export const PROFILE_NAMES=["steady","jitter","bursts","variable-fees","recurring"] as const;
export function upper95(denied:number,proposed:number):number {
  if(!Number.isSafeInteger(proposed) || proposed<1 || !Number.isSafeInteger(denied) || denied<0 || denied>proposed) throw new Error("invalid confidence counts");
  if(denied===proposed) return 1;
  const z2=1.96*1.96, p=denied/proposed, d=1+z2/proposed;
  return Math.min(1,(p+z2/(2*proposed)+1.96*Math.sqrt((p*(1-p)+z2/(4*proposed))/proposed))/d);
}
export function requireTraffic(evidence:TrafficEvidence,status:number|null):void {
  if(status!==0) throw new Error("traffic process failed or did not complete");
  if(evidence.definition!==1) throw new Error("unsupported traffic definition");
  if(evidence.profiles.length!==PROFILE_NAMES.length || evidence.profiles.some((profile,index)=>profile.name!==PROFILE_NAMES[index])) throw new Error("traffic profile inventory differs");
  let proposed=0,denied=0;
  for(const [index,profile] of evidence.profiles.entries()) {
    if(profile.seed!==2606101+index) throw new Error("traffic seed differs from frozen definition");
    if(profile.proposed!==500 || profile.completed!==profile.proposed) throw new Error("traffic population incomplete");
    upper95(profile.denied,profile.proposed);
    if(!profile.rules || Object.entries(profile.rules).some(([rule,count])=>rule.length===0 || !Number.isSafeInteger(count) || count<1) || Object.values(profile.rules).reduce((a,b)=>a+b,0)!==profile.denied) throw new Error("traffic denial rules incomplete");
    proposed+=profile.proposed; denied+=profile.denied;
  }
  if(upper95(denied,proposed)>0.02) throw new Error("false-stop confidence upper bound exceeds target");
}
