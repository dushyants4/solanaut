// ADR-019: derive signed-mode admission state from validated history, not caller state.
import { canonicalJSON, sha256hex } from "./canonical.ts";
import { prepareCheckpointPrefix } from "./checkpoint-prefix.ts";
import { createPolicy } from "./policy.ts";
import { EVALUATION_PROFILE } from "./profile.ts";
import { initialState, retentionWindow, apply } from "./state.ts";
import { verifyPolicyEntry, type PolicyTrust } from "./signed-policy.ts";
import type { Entry, PolicyEntry, DecisionEntry } from "./log.ts";
export class CheckpointStateError extends Error {
  readonly code="checkpoint-state";
  constructor(message:string){super(message);this.name="CheckpointStateError";}
}
export interface PreparedCheckpointState {readonly text:string;readonly digest:string}
function values(value:unknown):unknown {
  if(value instanceof Map)return [...value].map(([key,item])=>[key,values(item)]);
  if(value instanceof Set)return [...value];
  if(typeof value==="bigint")return value.toString();
  if(Array.isArray(value))return value.map(values);
  if(value && typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,values(item)]));
  return value;
}
export async function prepareCheckpointState(input:unknown,policyInput:unknown,context:{seq:number;head:string},trust?:PolicyTrust):Promise<Readonly<PreparedCheckpointState>> {
  try{
    const endpoint=structuredClone(context),captured=structuredClone(input),policySeed=structuredClone(policyInput),pins=structuredClone(trust);
    // This also captures/validates the endpoint and dense history, then performs full Keel replay.
    await prepareCheckpointPrefix(captured,policySeed,endpoint,pins);
    const entries=JSON.parse(canonicalJSON(captured)) as Entry[],first=entries.find((e):e is PolicyEntry=>e.kind==="policy");
    if(!first)throw new CheckpointStateError("checkpoint admission state requires signed policy history");
    let {policy,hash}=createPolicy(policySeed??JSON.parse(first.policy)),previous:PolicyEntry|undefined,previousDecision:DecisionEntry|null=null;
    const state=initialState();state.retentionMs=retentionWindow(entries,policy.windowMs);
    for(const entry of entries){
      if(entry.kind==="policy"){policy=verifyPolicyEntry(entry,pins,previous);hash=createPolicy(policy).hash;previous=entry;}
      apply(state,entry,policy,previous?hash:undefined);
      if(entry.kind==="decision")previousDecision=entry;
    }
    const text=canonicalJSON({format:1,kind:"solanaut-checkpoint-admission-state",profile:EVALUATION_PROFILE,
      guardId:policy.latch.guardId,cluster:policy.latch.cluster,policy:{canonical:canonicalJSON(policy),hash,version:previous!.version,entry:previous},
      state:values(state),previousDecision})+"\n";
    return Object.freeze({text,digest:sha256hex(text)});
  }catch(error){if(error instanceof CheckpointStateError)throw error;throw new CheckpointStateError("checkpoint admission history cannot be validated");}
}
