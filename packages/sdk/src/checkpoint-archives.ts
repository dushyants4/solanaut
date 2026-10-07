// ADR-019: prepare the signed archive catalogue; referenced files still need verification.
import { canonicalJSON, sha256hex } from "./canonical.ts";
export class CheckpointArchiveError extends Error {
  readonly code = "checkpoint-archives";
  constructor(message: string) { super(message); this.name = "CheckpointArchiveError"; }
}
export interface PreparedCheckpointArchives { readonly text: string; readonly digest: string }
const hex=(value:unknown)=>typeof value==="string" && /^[0-9a-f]{64}$/.test(value);
function copy(input:unknown,fields:readonly string[],optional:readonly string[]=[]):Record<string,unknown> {
  if(!input || typeof input!=="object" || Array.isArray(input))throw new CheckpointArchiveError("catalogue object is malformed");
  const keys=Object.keys(input);
  if(keys.some(key=>![...fields,...optional].includes(key)) || fields.some(key=>!Object.hasOwn(input,key)))throw new CheckpointArchiveError("catalogue fields are unsupported");
  const values=Object.fromEntries(keys.map(key=>[key,(input as Record<string,unknown>)[key]]));
  if(optional.includes("anchor") && Object.hasOwn(values,"anchor"))values.anchor=copy(values.anchor,["seq","head"]);
  return JSON.parse(canonicalJSON(values));
}
export function prepareCheckpointArchives(input: unknown, context: {seq:number;head:string}): Readonly<PreparedCheckpointArchives> {
  try {
    // Capture the external endpoint before evaluating caller-owned receipt accessors.
    const endpoint=copy(context,["seq","head"]),seq=endpoint.seq as number,head=endpoint.head;
    if(!Number.isSafeInteger(seq) || seq<0 || (seq===0?head!=="":!hex(head)))throw new CheckpointArchiveError("checkpoint endpoint is invalid");
    const length=Array.isArray(input)?input.length:-1;
    if(!Array.isArray(input) || Object.keys(input).length!==length || !Object.keys(input).every((key,index)=>key===String(index)))throw new CheckpointArchiveError("catalogue must be an ordered dense array");
    const segments=Array.from({length},(_,index)=>copy(input[index],["bytes","entries","firstSeq","head","nextSeq","sha256"],["anchor"]));
    let nextSeq=0,previousHead="";
    for(const segment of segments){
      if(!["bytes","entries","firstSeq","nextSeq"].every(key=>Number.isSafeInteger(segment[key])) ||
        (segment.bytes as number)<(segment.entries as number) || (segment.entries as number)<=0 ||
        segment.firstSeq!==nextSeq || (segment.nextSeq as number)<=nextSeq || (segment.nextSeq as number)>seq ||
        segment.entries!==(segment.nextSeq as number)-nextSeq || !hex(segment.head) || !hex(segment.sha256))throw new CheckpointArchiveError("catalogue segment is invalid or discontinuous");
      if(Object.hasOwn(segment,"anchor")){
        const anchor=segment.anchor as Record<string,unknown>;
        if(!Number.isSafeInteger(anchor.seq) || (anchor.seq as number)<nextSeq || (anchor.seq as number)>=(segment.nextSeq as number) || !hex(anchor.head) ||
          (anchor.seq===(segment.nextSeq as number)-1 && anchor.head!==segment.head))throw new CheckpointArchiveError("catalogue anchor is outside its segment or differs from its head");
      }
      nextSeq=segment.nextSeq as number;previousHead=segment.head as string;
    }
    if(nextSeq!==seq || previousHead!==head)throw new CheckpointArchiveError("catalogue does not reach the checkpoint endpoint");
    const text=canonicalJSON({format:1,kind:"solanaut-checkpoint-archives",segments})+"\n";
    return Object.freeze({text,digest:sha256hex(text)});
  }catch(error){if(error instanceof CheckpointArchiveError)throw error;throw new CheckpointArchiveError("catalogue cannot be canonicalised");}
}
