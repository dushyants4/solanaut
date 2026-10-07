// ADR-019: authenticate an opaque container; derived-state validation is separate.
import { canonicalJSON,sha256hex } from "./canonical.ts";
import { verifyCheckpointBinding,type CheckpointBinding,type CheckpointSignatures,type CheckpointTrust } from "./checkpoint.ts";
export class CheckpointEnvelopeError extends Error{
  readonly code="checkpoint-envelope";
  constructor(message:string){super(message);this.name="CheckpointEnvelopeError";}
}
export interface CheckpointEnvelope{
  readonly binding:Readonly<CheckpointBinding>;readonly signatures:Readonly<CheckpointSignatures>;
  readonly archives:string;readonly state:string;readonly prefix:string;
}
const fields=["binding","signatures","archives","state","prefix"];
function shape(input:unknown,names:readonly string[]):Record<string,unknown>{
  if(!input || typeof input!=="object" || Array.isArray(input) || Object.keys(input).sort().join(",")!==[...names].sort().join(","))throw new CheckpointEnvelopeError("checkpoint envelope fields are invalid");
  return input as Record<string,unknown>;
}
function failure(error:unknown):never{
  if(error instanceof CheckpointEnvelopeError)throw error;
  throw new CheckpointEnvelopeError("checkpoint envelope cannot be authenticated");
}
export function verifyCheckpointEnvelope(input:unknown,trust:CheckpointTrust,maxBytes:unknown):Readonly<CheckpointEnvelope>{
  try{
    const pins=structuredClone(trust);
    if(!Number.isSafeInteger(maxBytes) || (maxBytes as number)<=0)throw new CheckpointEnvelopeError("checkpoint envelope byte limit is invalid");
    if(typeof input!=="string")throw new CheckpointEnvelopeError("checkpoint envelope must be text");
    if(Buffer.byteLength(input,"utf8")>(maxBytes as number))throw new CheckpointEnvelopeError("checkpoint envelope exceeds configured byte limit");
    const body=shape(JSON.parse(input),["format","kind",...fields]);
    if(body.format!==1 || body.kind!=="solanaut-signed-checkpoint" || canonicalJSON(body)+"\n"!==input)throw new CheckpointEnvelopeError("checkpoint envelope framing or format is unsupported");
    if(!["archives","state","prefix"].every(key=>typeof body[key]==="string"))throw new CheckpointEnvelopeError("checkpoint envelope payload must be text");
    const archives=body.archives as string,state=body.state as string,prefix=body.prefix as string;
    const binding=verifyCheckpointBinding(body.binding,body.signatures as CheckpointSignatures,pins,{archiveDigest:sha256hex(archives),stateDigest:sha256hex(state),prefixDigest:sha256hex(prefix)});
    const signatures=Object.freeze({...body.signatures as CheckpointSignatures});
    return Object.freeze({binding,signatures,archives,state,prefix});
  }catch(error){return failure(error);}
}
export function prepareCheckpointEnvelope(input:unknown,trust:CheckpointTrust,maxBytes:unknown):Readonly<{text:string;digest:string}>{
  try{
    const pins=structuredClone(trust),body=shape(structuredClone(input),fields);
    const text=canonicalJSON({format:1,kind:"solanaut-signed-checkpoint",...body})+"\n";
    verifyCheckpointEnvelope(text,pins,maxBytes);
    return Object.freeze({text,digest:sha256hex(text)});
  }catch(error){return failure(error);}
}
