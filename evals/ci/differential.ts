export interface DifferentialEvidence { digest:string; transactions:number; signatures:number; versions:Record<string,number>; programs:Record<string,number>; completed:number; mismatches:number; strictRefusals:number }
export function requireDifferential(evidence:DifferentialEvidence,expected:string,status:number|null):void {
  if(status!==0) throw new Error("differential process failed or did not complete");
  if(!/^[a-f0-9]{64}$/.test(expected) || evidence.digest!==expected) throw new Error("differential corpus digest differs");
  if(!Number.isSafeInteger(evidence.transactions) || evidence.transactions<1000) throw new Error("real transaction population below floor");
  if(Object.keys(evidence.versions).sort().join(",")!=="0,1,legacy" || ["legacy","0","1"].some(key=>!Number.isSafeInteger(evidence.versions[key]) || evidence.versions[key]!<1) || Object.values(evidence.versions).reduce((a,b)=>a+b,0)!==evidence.transactions) throw new Error("differential version evidence incomplete");
  if(["system","token","computeBudget"].some(key=>!Number.isSafeInteger(evidence.programs[key]) || evidence.programs[key]!<1)) throw new Error("supported program evidence incomplete");
  if(evidence.completed!==evidence.transactions) throw new Error("differential execution incomplete");
  if(!Number.isSafeInteger(evidence.signatures) || evidence.signatures<evidence.transactions) throw new Error("signature evidence incomplete");
  if(evidence.mismatches!==0) throw new Error("differential mismatch");
  if(!Number.isSafeInteger(evidence.strictRefusals) || evidence.strictRefusals<0 || evidence.strictRefusals>evidence.transactions) throw new Error("invalid strict-refusal counts");
}
