// ADR-019: immutable derived cache generations; disk metadata cannot mint trust.
import {closeSync,constants,fstatSync,fsyncSync,lstatSync,mkdirSync,openSync,readSync,readdirSync,renameSync,rmSync,unlinkSync,writeSync} from "node:fs";
import {basename,dirname,join} from "node:path";
import {randomUUID} from "node:crypto";
import {canonicalJSON} from "./canonical.ts";
import {lookupRequestIndex,prepareRequestIndex,type PreparedRequestIndex,type RequestIndexRow,type VerifiedRequestIndexRoot} from "./request-index.ts";
import {RequestIndexLookupError,RequestIndexPublicationError} from "./record.ts";
import {bindRequest,requestKey,type RequestIdentity} from "./request.ts";
import type {PolicyTrust} from "./signed-policy.ts";
import type {Entry} from "./log.ts";
export {RequestIndexPublicationError} from "./record.ts";
export interface RequestIndexPublicationOptions {policyTrust:PolicyTrust}
export interface RequestIndexPublicationReceipt {readonly seq:number;readonly head:string;readonly digest:string;readonly directory:string;readonly root:VerifiedRequestIndexRoot}
export interface RequestIndexLookupReceipt {readonly seq:number;readonly head:string;readonly indexSeq:number;readonly indexHead:string;readonly row:Readonly<RequestIndexRow>|null}
// Keep filesystem implementation types out of the installed consumer declaration graph.
interface SourceStat {dev:bigint;ino:bigint;size:bigint;nlink:bigint;mtimeNs:bigint;ctimeNs:bigint;isFile():boolean;isDirectory():boolean}
interface Source {path:string;text:string;stat:SourceStat}
interface Pointer {format:1;kind:"solanaut-request-index-pointer";generation:string;seq:number;head:string;digest:string}
interface ValidatedPublication {prepared:Readonly<PreparedRequestIndex>;pointer:Source|undefined;prefix?:{root:VerifiedRequestIndexRoot;directory:string;seq:number;head:string};seq:number;head:string}
const hex=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{64}$/.test(value);
function same(expected:SourceStat,actual:SourceStat,directory=false):void {
  if(!(directory?actual.isDirectory():actual.isFile()&&actual.nlink===1n)||actual.dev!==expected.dev||actual.ino!==expected.ino||actual.size!==expected.size||actual.mtimeNs!==expected.mtimeNs||actual.ctimeNs!==expected.ctimeNs)throw new RequestIndexPublicationError("request index source changed during publication");
}
function readSource(path:string,maxBytes:number,opened?:number):Source {
  const fd=opened??openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const before=fstatSync(fd,{bigint:true});
    if(!before.isFile()||before.nlink!==1n||before.size>BigInt(maxBytes))throw new RequestIndexPublicationError("request index source is unsupported or exceeds its ceiling");
    const bytes=Buffer.alloc(Number(before.size));let offset=0;
    while(offset<bytes.length){const count=readSync(fd,bytes,offset,bytes.length-offset,null);if(!Number.isSafeInteger(count)||count<=0||count>bytes.length-offset)throw new RequestIndexPublicationError("request index source made invalid read progress");offset+=count;}
    if(readSync(fd,Buffer.alloc(1),0,1,null)!==0)throw new RequestIndexPublicationError("request index source grew during publication");
    same(before,fstatSync(fd,{bigint:true}));same(before,lstatSync(path,{bigint:true}));
    return {path,text:new TextDecoder("utf-8",{fatal:true}).decode(bytes),stat:before};
  }finally{closeSync(fd);}
}
function current(path:string):Source|undefined {
  const source=path+".request-index";let fd:number;
  try{fd=openSync(source,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return undefined;throw error;}
  return readSource(source,65_536,fd);
}
function pointer(source:Source,path:string,history:Entry[]):Pointer {
  const value=JSON.parse(source.text) as Pointer,prefix=basename(path)+".request-index.";
  if(!value||Array.isArray(value)||Object.keys(value).sort().join(",")!=="digest,format,generation,head,kind,seq"||value.format!==1||value.kind!=="solanaut-request-index-pointer"||source.text!==canonicalJSON(value)+"\n"||
    typeof value.generation!=="string"||!value.generation.startsWith(prefix)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.generation.slice(prefix.length))||
    !Number.isSafeInteger(value.seq)||value.seq<1||value.seq>history.length||!hex(value.head)||history[value.seq-1]?.hash!==value.head||!hex(value.digest))throw new RequestIndexPublicationError("current request index pointer is malformed or differs from owned history");
  return value;
}
function unchangedPointer(path:string,source:Source|undefined):void {
  const got=current(path);
  if(source===undefined){if(got!==undefined)throw new RequestIndexPublicationError("request index pointer appeared during publication");}
  else{if(got===undefined||got.text!==source.text)throw new RequestIndexPublicationError("request index pointer changed during publication");same(source.stat,got.stat);}
}
function verifyGeneration(directory:string,prepared:Readonly<PreparedRequestIndex>,expected?:SourceStat):void {
  const before=lstatSync(directory,{bigint:true});if(!before.isDirectory())throw new RequestIndexPublicationError("request index generation is not an actual directory");if(expected)same(expected,before,true);
  const files=[{name:"manifest.json",text:prepared.text},...prepared.shards.map(shard=>({name:shard.bucket+".jsonl",text:shard.text}))];
  if(readdirSync(directory).sort().join("\n")!==files.map(file=>file.name).sort().join("\n"))throw new RequestIndexPublicationError("request index generation file inventory differs");
  for(const file of files){const source=readSource(join(directory,file.name),Buffer.byteLength(file.text));if(source.text!==file.text)throw new RequestIndexPublicationError("request index generation differs from derived history");}
  same(before,lstatSync(directory,{bigint:true}),true);
}
export async function validateIndexPublication(path:string,history:Entry[],options:RequestIndexPublicationOptions):Promise<ValidatedPublication> {
  const pins=structuredClone(options);
  if(!pins||Array.isArray(pins)||Object.keys(pins).join(",")!=="policyTrust"||!pins.policyTrust)throw new RequestIndexPublicationError("request index publication options are invalid");
  const source=current(path),old=source===undefined?undefined:pointer(source,path,history),directory=old===undefined?undefined:join(dirname(path),old.generation),before=directory===undefined?undefined:lstatSync(directory,{bigint:true});
  const endpoint={seq:history.length,head:history.at(-1)?.hash??""},prepared=await prepareRequestIndex(history,undefined,endpoint,pins.policyTrust);
  let prefix:ValidatedPublication["prefix"];
  if(old!==undefined){
    const prior=await prepareRequestIndex(history.slice(0,old.seq),undefined,{seq:old.seq,head:old.head},pins.policyTrust);
    if(prior.digest!==old.digest)throw new RequestIndexPublicationError("current request index digest differs from independently derived prefix");
    verifyGeneration(directory!,prior,before);
    prefix={root:prior.root,directory:directory!,seq:old.seq,head:old.head};
  }
  unchangedPointer(path,source);return {prepared,pointer:source,prefix,...endpoint};
}
function freeze<T>(value:T):T {
  if(value&&typeof value==="object"){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;
}
/** The prefix row is authenticated on disk; complete signed replay validates every tail entry. */
export async function lookupIndexPublication(path:string,history:Entry[],identity:RequestIdentity,options:RequestIndexPublicationOptions):Promise<Readonly<RequestIndexLookupReceipt>> {
  const captured=structuredClone(history),id=structuredClone(identity),pins=structuredClone(options),binding=bindRequest(pins.policyTrust.guardId,id,new Uint8Array()),key=requestKey(binding);
  const validated=await validateIndexPublication(path,captured,pins),prefix=validated.prefix;
  if(!prefix)throw new RequestIndexLookupError("current request lookup requires a published index");
  let row:{-readonly [K in keyof RequestIndexRow]:RequestIndexRow[K]}|null=structuredClone(await lookupRequestIndex(prefix.directory,prefix.root,id));
  for(const entry of captured.slice(prefix.seq)){
    if(entry.kind==="request"||(entry.kind==="decision"&&entry.request)){
      if(requestKey(entry.request!)!==key)continue;
      if(row)throw new RequestIndexLookupError("tail repeats an indexed request identity");
      row={format:1,kind:"solanaut-request-index-row",key,start:entry,redeem:null,signed:null,started:null,response:null,report:null,settled:null};
    }else if(row&&entry.kind==="response"&&entry.request===row.start.hash)row.response=entry;
    else if(row&&(entry.kind==="redeem"||entry.kind==="report"||entry.kind==="signing")&&(entry.kind==="signing"?entry.event.decision:entry.decision)===row.start.hash){
      if(entry.kind==="redeem")row.redeem=entry;
      else if(entry.kind==="report"){row.report=entry;if(entry.outcome!=="unknown")row.settled??=entry;}
      else if(entry.event.stage==="signed")row.signed=entry;
      else if(entry.event.stage==="send-started")row.started=entry;
      else row.response=entry;
    }
  }
  unchangedPointer(path,validated.pointer);
  return freeze({seq:validated.seq,head:validated.head,indexSeq:prefix.seq,indexHead:prefix.head,row});
}
function writeAll(fd:number,text:string):void {
  const bytes=Buffer.from(text,"utf8");let offset=0;
  while(offset<bytes.length){const count=writeSync(fd,bytes,offset,bytes.length-offset);if(!Number.isSafeInteger(count)||count<=0||count>bytes.length-offset)throw new RequestIndexPublicationError("request index write made invalid progress");offset+=count;}
}
function writeFile(path:string,text:string):void {
  const fd=openSync(path,"wx",0o600);
  try{writeAll(fd,text);fsyncSync(fd);const held=fstatSync(fd,{bigint:true});if(held.size!==BigInt(Buffer.byteLength(text)))throw new RequestIndexPublicationError("request index written size differs");same(held,lstatSync(path,{bigint:true}));}
  finally{closeSync(fd);}
}
function syncDirectory(path:string):void {
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK|constants.O_DIRECTORY);
  try{const before=fstatSync(fd,{bigint:true});if(!before.isDirectory())throw new RequestIndexPublicationError("request index sync source is not a directory");fsyncSync(fd);same(before,lstatSync(path,{bigint:true}),true);}
  finally{closeSync(fd);}
}
export function replaceRequestIndex(path:string,validated:ValidatedPublication,owned:()=>void):Readonly<RequestIndexPublicationReceipt> {
  const {prepared}=validated,current=path+".request-index",directory=path+".request-index."+randomUUID(),temporary=directory+".tmp",marker=directory+".pointer.tmp";
  let temporaryCreated=false,markerCreated=false;
  try{
    owned();unchangedPointer(path,validated.pointer);mkdirSync(temporary,{mode:0o700});temporaryCreated=true;
    writeFile(join(temporary,"manifest.json"),prepared.text);
    for(const shard of prepared.shards)writeFile(join(temporary,shard.bucket+".jsonl"),shard.text);
    verifyGeneration(temporary,prepared);syncDirectory(temporary);owned();renameSync(temporary,directory);temporaryCreated=false;syncDirectory(dirname(path));
    const body:Pointer={format:1,kind:"solanaut-request-index-pointer",generation:basename(directory),seq:validated.seq,head:validated.head,digest:prepared.digest};
    // Keep the old pointer live until every new generation file is complete and synced.
    const fd=openSync(marker,"wx",0o600);markerCreated=true;
    try{
      writeAll(fd,canonicalJSON(body)+"\n");fsyncSync(fd);const before=fstatSync(fd,{bigint:true});same(before,lstatSync(marker,{bigint:true}));
      owned();unchangedPointer(path,validated.pointer);renameSync(marker,current);markerCreated=false;syncDirectory(dirname(path));
      const published=fstatSync(fd,{bigint:true});if(published.dev!==before.dev||published.ino!==before.ino||published.size!==before.size||published.mtimeNs!==before.mtimeNs)throw new RequestIndexPublicationError("published request index pointer differs from written source");same(published,lstatSync(current,{bigint:true}));
      owned();verifyGeneration(directory,prepared);
    }finally{closeSync(fd);}
    return Object.freeze({seq:validated.seq,head:validated.head,digest:prepared.digest,directory,root:prepared.root});
  }finally{if(markerCreated)unlinkSync(marker);if(temporaryCreated)rmSync(temporary,{recursive:true,force:true});}
}
