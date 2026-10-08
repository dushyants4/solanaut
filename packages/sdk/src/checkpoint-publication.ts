// ADR-019: publication validates derived state before replacing the owned checkpoint.
import {closeSync,constants,fstatSync,fsyncSync,linkSync,lstatSync,openSync,readFileSync,renameSync,unlinkSync,writeSync} from "node:fs";
import {dirname} from "node:path";
import {randomUUID} from "node:crypto";
import {canonicalJSON,sha256hex} from "./canonical.ts";
import {verifyArchive,type ArchiveReceipt} from "./archive.ts";
import {prepareCheckpointBundle} from "./checkpoint-bundle.ts";
import {verifyCheckpointEnvelope} from "./checkpoint-envelope.ts";
import type {CheckpointTrust} from "./checkpoint.ts";
import type {PolicyTrust} from "./signed-policy.ts";
import type {Entry} from "./log.ts";
import {CheckpointPublicationError} from "./checkpoint-errors.ts";
export {CheckpointPublicationError} from "./checkpoint-errors.ts";
export interface CheckpointPublicationOptions{
  checkpointTrust:CheckpointTrust;policyTrust:PolicyTrust;archives:string[];maxBytes:number;
}
export interface CheckpointPublicationReceipt{seq:number;head:string;digest:string;bytes:number}
export async function validatePublication(input:unknown,options:CheckpointPublicationOptions,history:Entry[]){
  const pins=structuredClone(options);
  if(!pins || Array.isArray(pins) || Object.keys(pins).sort().join(",")!=="archives,checkpointTrust,maxBytes,policyTrust" ||
    !Array.isArray(pins.archives) || !pins.archives.length || !pins.archives.every(path=>typeof path==="string" && path.length>0))throw new CheckpointPublicationError("checkpoint publication options are invalid");
  const envelope=verifyCheckpointEnvelope(input,pins.checkpointTrust,pins.maxBytes);
  const context={seq:history.length,head:history.at(-1)?.hash??""};
  const receipts:ArchiveReceipt[]=[];
  let seq=0,head="";
  for(const path of pins.archives){
    const receipt=await verifyArchive(path,{firstSeq:seq,previousHead:head});
    receipts.push(receipt);seq=receipt.nextSeq;head=receipt.head;
  }
  if(seq!==context.seq || head!==context.head)throw new CheckpointPublicationError("retained archives differ from owned record endpoint");
  const bundle=await prepareCheckpointBundle(history,undefined,receipts,context,pins.policyTrust,pins.checkpointTrust);
  if(canonicalJSON(envelope.binding)!==canonicalJSON(bundle.binding) || envelope.archives!==bundle.archives || envelope.state!==bundle.state || envelope.prefix!==bundle.prefix)throw new CheckpointPublicationError("checkpoint differs from owned history replay");
  // Replay is asynchronous; recheck every retained source before publication.
  for(let i=0;i<pins.archives.length;i++){
    const receipt=receipts[i]!;
    const verified=await verifyArchive(pins.archives[i]!,{firstSeq:receipt.firstSeq,previousHead:i===0?"":receipts[i-1]!.head,expectedHead:receipt.head,expectedDigest:receipt.sha256});
    if(canonicalJSON(verified)!==canonicalJSON(receipt))throw new CheckpointPublicationError("retained archive changed after replay");
  }
  return {text:input as string,pins,receipt:Object.freeze({...context,digest:sha256hex(input as string),bytes:Buffer.byteLength(input as string,"utf8")})};
}
function syncDirectory(path:string){const fd=openSync(dirname(path),"r");try{fsyncSync(fd);}finally{closeSync(fd);}}
function writeAll(fd:number,text:string){
  const bytes=Buffer.from(text,"utf8");let offset=0;
  while(offset<bytes.length){const count=writeSync(fd,bytes,offset,bytes.length-offset);if(!Number.isSafeInteger(count)||count<=0||count>bytes.length-offset)throw new Error("checkpoint write made invalid progress");offset+=count;}
}
export function replaceCheckpoint(path:string,text:string,pins:CheckpointPublicationOptions,owned:()=>void){
  const current=path+".checkpoint",previous=current+".previous",temporary=current+"."+randomUUID()+".tmp",prior=previous+"."+randomUUID()+".tmp";
  let old:ReturnType<typeof fstatSync>|undefined;
  let oldFd:number|undefined,fd:number|undefined,tempCreated=false,priorCreated=false;
  try{
    owned();
    try{oldFd=openSync(current,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
    if(oldFd!==undefined){
      old=fstatSync(oldFd);
      if(!old.isFile() || old.size>pins.maxBytes)throw new Error("current checkpoint source is unsupported");
      verifyCheckpointEnvelope(readFileSync(oldFd,"utf8"),pins.checkpointTrust,pins.maxBytes);
    }
    fd=openSync(temporary,"wx",0o600);tempCreated=true;
    writeAll(fd,text);fsyncSync(fd);
    owned();
    if(old!==undefined){
      const named=lstatSync(current);
      if(!named.isFile() || named.ino!==old.ino || named.dev!==old.dev || named.size!==old.size || named.mtimeMs!==old.mtimeMs || named.ctimeMs!==old.ctimeMs)throw new Error("current checkpoint changed during publication");
      linkSync(current,prior);priorCreated=true;renameSync(prior,previous);priorCreated=false;syncDirectory(current);
    }else{
      try{lstatSync(current);throw new Error("current checkpoint appeared during publication");}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
    }
    owned();renameSync(temporary,current);tempCreated=false;syncDirectory(current);
  }finally{
    if(fd!==undefined)closeSync(fd);if(oldFd!==undefined)closeSync(oldFd);
    if(tempCreated)unlinkSync(temporary);if(priorCreated)unlinkSync(prior);
  }
}
