// Qualification accepts only a supervisor's complete, externally bound child result.
export interface RunIdentity { runId: string; inputHash: string; commandHash: string }
export interface RunCompletion extends RunIdentity {
  format: 1; state: "complete"; supervisorPid: number; childPid: number;
  started: string; completed: string; status: number | null;
  signal: string | null; error: string | null; timedOut: boolean;
}
const ID_FIELDS=["runId","inputHash","commandHash"];
const RESULT_FIELDS=[...ID_FIELDS,"format","state","supervisorPid","childPid","started","completed","status","signal","error","timedOut"];
function capture(input:unknown, fields:readonly string[]):Record<string,unknown> {
  try {
    if(!input || typeof input!=="object" || Array.isArray(input) || Object.keys(input).sort().join(",")!==[...fields].sort().join(",")) throw new Error();
    const value=JSON.parse(JSON.stringify(input));
    if(Object.keys(value).sort().join(",")!==[...fields].sort().join(",")) throw new Error();
    return value;
  } catch {throw new Error("invalid supervised result fields");}
}
const digest=(value:unknown)=>typeof value==="string" && /^[0-9a-f]{64}$/.test(value);
function canonicalTime(value:unknown):value is string {
  if(typeof value!=="string") return false;
  const time=Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString()===value;
}
export function requireRunCompletion(input: unknown, identity: RunIdentity): 0 {
  const expected=capture(identity,ID_FIELDS), result=capture(input,RESULT_FIELDS);
  if(typeof expected.runId!=="string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(expected.runId) || !digest(expected.inputHash) || !digest(expected.commandHash)) throw new Error("invalid external run identity");
  if(ID_FIELDS.some(field=>result[field]!==expected[field])) throw new Error("supervised run identity differs");
  if(result.format!==1 || result.state!=="complete") throw new Error("unsupported or incomplete supervised result");
  if(!Number.isSafeInteger(result.supervisorPid) || (result.supervisorPid as number)<=0 || !Number.isSafeInteger(result.childPid) || (result.childPid as number)<=0 || result.childPid===result.supervisorPid) throw new Error("invalid supervised process identity");
  if(!canonicalTime(result.started) || !canonicalTime(result.completed) || Date.parse(result.completed)<Date.parse(result.started)) throw new Error("invalid supervised completion time");
  if(result.status!==0 || result.signal!==null || result.error!==null || result.timedOut!==false) throw new Error("supervised child did not complete successfully");
  return 0;
}
