// ADR-019: prepare recovery from verified history; checkpoint failure cannot invent state.
import type {Governor} from "@gubernaut/core";
import {isAddress} from "./base58.ts";
import {canonicalJSON} from "./canonical.ts";
import {prepareCheckpointState} from "./checkpoint-state.ts";
import {prepareCheckpointPrefix,rebuildCheckpointPrefix} from "./checkpoint-prefix.ts";
import {verifyCheckpointEnvelope} from "./checkpoint-envelope.ts";
import {validatePublication,type CheckpointPublicationOptions} from "./checkpoint-publication.ts";
import type {Entry} from "./log.ts";
import {CheckpointRecoveryError} from "./checkpoint-errors.ts";
export {CheckpointRecoveryError} from "./checkpoint-errors.ts";
export interface CheckpointRecoveryOptions extends CheckpointPublicationOptions{expectedAnchor?:{seq:number;head:string}}
export interface PreparedCheckpointRecovery{
  readonly mode:"checkpoint"|"full-replay";readonly reason:"missing-checkpoint"|"invalid-checkpoint"|null;
  readonly checkpointSeq:number|null;readonly seq:number;readonly head:string;readonly state:string;readonly controller:Governor;
}
function configuration(pins:CheckpointRecoveryOptions){
  if(!pins || Array.isArray(pins) || !["archives","checkpointTrust","maxBytes","policyTrust"].every(key=>Object.hasOwn(pins,key)) ||
    Object.keys(pins).some(key=>!["archives","checkpointTrust","maxBytes","policyTrust","expectedAnchor"].includes(key)) ||
    !Number.isSafeInteger(pins.maxBytes) || pins.maxBytes<=0 || !Array.isArray(pins.archives) ||
    Object.keys(pins.archives).length!==pins.archives.length || !Object.keys(pins.archives).every((key,index)=>key===String(index)) || !pins.archives.every(path=>typeof path==="string" && path.length>0))throw new CheckpointRecoveryError("recovery configuration is invalid");
  const trust=pins.checkpointTrust,policy=pins.policyTrust;
  if(!trust || Array.isArray(trust) || Object.keys(trust).sort().join(",")!=="anchorKey,checkpointKey,cluster,guardId,principalKeys" ||
    !isAddress(trust.checkpointKey) || !isAddress(trust.anchorKey) || trust.checkpointKey===trust.anchorKey ||
    !Array.isArray(trust.principalKeys) || !trust.principalKeys.length || Object.keys(trust.principalKeys).length!==trust.principalKeys.length || !Object.keys(trust.principalKeys).every((key,index)=>key===String(index)) || !trust.principalKeys.every(key=>typeof key==="string" && isAddress(key)) ||
    trust.principalKeys.includes(trust.checkpointKey) || !policy || trust.guardId!==policy.guardId || trust.cluster!==policy.cluster)throw new CheckpointRecoveryError("recovery authority pins are invalid or foreign");
  const anchor=pins.expectedAnchor;
  if(anchor!==undefined && (!anchor || Array.isArray(anchor) || Object.keys(anchor).sort().join(",")!=="head,seq" || !Number.isSafeInteger(anchor.seq) || anchor.seq<0 || typeof anchor.head!=="string" || !/^[0-9a-f]{64}$/.test(anchor.head)))throw new CheckpointRecoveryError("external recovery anchor is invalid");
}
export async function prepareCheckpointRecovery(input:unknown,checkpointInput:unknown,options:CheckpointRecoveryOptions):Promise<Readonly<PreparedCheckpointRecovery>>{
  try{
    const pins=structuredClone(options);configuration(pins);
    const captured=structuredClone(input);
    if(!Array.isArray(captured))throw new CheckpointRecoveryError("recovery history must be an ordered array");
    const entries=JSON.parse(canonicalJSON(captured)) as Entry[],context={seq:entries.length,head:entries.at(-1)?.hash??""};
    if(pins.expectedAnchor && entries[pins.expectedAnchor.seq]?.hash!==pins.expectedAnchor.head)throw new CheckpointRecoveryError("verified history does not contain the external anchor");
    // Full signed replay is mandatory, including when a checkpoint appears valid.
    const state=await prepareCheckpointState(entries,undefined,context,pins.policyTrust),policy=JSON.parse(JSON.parse(state.text).policy.canonical);
    if(!policy.principal.every((key:string)=>pins.checkpointTrust.principalKeys.includes(key)))throw new CheckpointRecoveryError("current principals differ from recovery authority pins");
    let checkpointSeq:number|null=null,prefix:string|undefined;
    let reason:"missing-checkpoint"|"invalid-checkpoint"|null=checkpointInput===undefined?"missing-checkpoint":"invalid-checkpoint";
    if(checkpointInput!==undefined){
      try{
        const envelope=verifyCheckpointEnvelope(checkpointInput,pins.checkpointTrust,pins.maxBytes),seq=envelope.binding.seq;
        if(seq>entries.length)throw new CheckpointRecoveryError("checkpoint is ahead of verified history");
        const prefixHistory=entries.slice(0,seq);
        await validatePublication(checkpointInput,{checkpointTrust:pins.checkpointTrust,policyTrust:pins.policyTrust,archives:pins.archives,maxBytes:pins.maxBytes},prefixHistory);
        prefix=envelope.prefix;checkpointSeq=seq;reason=null;
      }catch{ /* The independently verified full record remains the fallback. */ }
    }
    if(checkpointSeq===null){prefix=(await prepareCheckpointPrefix(entries,undefined,context,pins.policyTrust)).text;}
    const prefixHistory=checkpointSeq===null?entries:entries.slice(0,checkpointSeq),endpoint={seq:prefixHistory.length,head:prefixHistory.at(-1)?.hash??""};
    const rebuilt=await rebuildCheckpointPrefix(prefixHistory,undefined,endpoint,prefix,pins.policyTrust),controller=rebuilt.controller;
    for(const entry of checkpointSeq===null?[]:entries.slice(checkpointSeq)){
      if(entry.kind==="release")controller.reset();
      else if(entry.kind==="decision" && entry.telemetry!==null && entry.posture!==null && controller.tick(entry.telemetry).posture!==entry.posture)throw new CheckpointRecoveryError("checkpoint tail controller replay diverges");
    }
    return Object.freeze({mode:checkpointSeq===null?"full-replay":"checkpoint",reason,checkpointSeq,...context,state:state.text,controller});
  }catch(error){if(error instanceof CheckpointRecoveryError)throw error;throw new CheckpointRecoveryError("verified checkpoint recovery cannot be prepared");}
}
