// ADR-019: a rebuildable disk projection; only verified full replay can mint its root.
import fs from "node:fs/promises";
import {constants} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {canonicalJSON,sha256hex} from "./canonical.ts";
import {replay} from "./guard.ts";
import {createPolicy} from "./policy.ts";
import {EVALUATION_PROFILE} from "./profile.ts";
import {bindRequest,requestKey,type RequestIdentity} from "./request.ts";
import {sensorV1} from "./sensor.ts";
import type {PolicyTrust} from "./signed-policy.ts";
import {OUTCOMES,type Entry,type DecisionEntry,type ControlRequestEntry,type ControlResponseEntry,type RedeemEntry,type SigningEntry,type ReportEntry,type PolicyEntry} from "./log.ts";

export class RequestIndexError extends Error {
  readonly code="request-index";
  constructor(message:string){super(message);this.name="RequestIndexError";}
}
export interface RequestIndexRow {
  readonly format:1;readonly kind:"solanaut-request-index-row";readonly key:string;
  readonly start:DecisionEntry|ControlRequestEntry;readonly redeem:RedeemEntry|null;
  readonly signed:SigningEntry|null;readonly started:SigningEntry|null;
  readonly response:SigningEntry|ControlResponseEntry|null;
  readonly report:ReportEntry|null;readonly settled:ReportEntry|null;
}
export interface RequestIndexShard {readonly bucket:string;readonly sha256:string;readonly bytes:number;readonly rows:number;readonly text:string}
export interface VerifiedRequestIndexRoot {readonly text:string;readonly digest:string}
export interface PreparedRequestIndex extends VerifiedRequestIndexRoot {readonly root:Readonly<VerifiedRequestIndexRoot>;readonly shards:readonly Readonly<RequestIndexShard>[]}
interface Manifest {
  format:1;kind:"solanaut-request-index";profile:typeof EVALUATION_PROFILE;
  guardId:string;cluster:string;operatorKey:string;policyVersion:number;policyHash:string;
  seq:number;head:string;shards:Omit<RequestIndexShard,"text">[];
}
type MutableRow={-readonly [K in keyof RequestIndexRow]:RequestIndexRow[K]};
const buckets="0123456789abcdef".split("");
const roots=new WeakMap<VerifiedRequestIndexRoot,{manifest:Manifest;text:string}>();
const hex=(value:unknown)=>typeof value==="string" && /^[0-9a-f]{64}$/.test(value);
function immutable<T>(value:T):T {
  if(value && typeof value==="object"){for(const item of Object.values(value))immutable(item);Object.freeze(value);}
  return value;
}
function endpoint(input:{seq:number;head:string}) {
  const value=structuredClone(input);
  if(!value || Object.keys(value).sort().join(",")!=="head,seq" || !Number.isSafeInteger(value.seq) || value.seq<0 ||
    (value.seq===0?value.head!=="":!hex(value.head)))throw new RequestIndexError("request index endpoint is invalid");
  return value;
}
function projection(entries:Entry[]):MutableRow[] {
  const identities=new Map<string,MutableRow>(),hashes=new Map<string,MutableRow>();
  for(const entry of entries){
    if(entry.kind==="request" || (entry.kind==="decision" && entry.request)){
      const key=requestKey(entry.request!),row:MutableRow={format:1,kind:"solanaut-request-index-row",key,start:entry,redeem:null,signed:null,started:null,response:null,report:null,settled:null};
      if(identities.has(key))throw new RequestIndexError("duplicate historical request identity");
      identities.set(key,row);hashes.set(entry.hash,row);
    }else if(entry.kind==="response"){
      const row=hashes.get(entry.request);
      if(!row || row.start.kind!=="request" || row.response)throw new RequestIndexError("control reply has no unique historical start");
      row.response=entry;
    }else if(entry.kind==="redeem" || entry.kind==="report" || entry.kind==="signing"){
      const row=hashes.get(entry.kind==="signing"?entry.event.decision:entry.decision);
      if(!row)continue; // Non-request SDK decisions remain in the retained full history.
      if(row.start.kind!=="decision")throw new RequestIndexError("decision evidence names a control request");
      if(entry.kind==="redeem")row.redeem=entry;
      else if(entry.kind==="report"){row.report=entry;if(entry.outcome!=="unknown")row.settled??=entry;}
      else if(entry.event.stage==="signed")row.signed=entry;
      else if(entry.event.stage==="send-started")row.started=entry;
      else row.response=entry;
    }
  }
  return [...identities.values()].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
}
function reports(entries:Entry[]):void {
  const final=new Set<string>();
  for(const entry of entries)if(entry.kind==="report"){
    if(!OUTCOMES.includes(entry.outcome))throw new RequestIndexError("request index report outcome is unsupported");
    if(!["caller","signer"].includes(entry.source))throw new RequestIndexError("request index report attribution is unsupported");
    if(final.has(entry.decision))throw new RequestIndexError("request index final outcome cannot be reported again");
    if(entry.outcome!=="unknown")final.add(entry.decision);
  }
}
/** Internal preparation captures arrays; it does not claim bounded construction memory. */
export async function prepareRequestIndex(input:unknown,policyInput:unknown,context:{seq:number;head:string},trust?:PolicyTrust):Promise<Readonly<PreparedRequestIndex>> {
  try{
    const end=endpoint(context),captured=structuredClone(input),policySeed=structuredClone(policyInput),pins=structuredClone(trust);
    if(!Array.isArray(captured) || Object.keys(captured).length!==captured.length || !Object.keys(captured).every((key,index)=>key===String(index)))throw new RequestIndexError("request index history must be an ordered dense array");
    const entries=JSON.parse(canonicalJSON(captured)) as Entry[];
    if(entries.length!==end.seq || (entries.at(-1)?.hash??"")!==end.head)throw new RequestIndexError("request index history differs from its endpoint");
    const policies=entries.filter((entry):entry is PolicyEntry=>entry.kind==="policy"),last=policies.at(-1);
    if(!last || !pins)throw new RequestIndexError("request index requires externally pinned signed history");
    reports(entries);
    const result=await replay(entries,policySeed,sensorV1,pins);
    if(!result.ok)throw new RequestIndexError("request index history does not reproduce its decisions");
    const {policy,hash}=createPolicy(JSON.parse(last.policy)),rows=projection(entries);
    const shards=buckets.map(bucket=>{
      const selected=rows.filter(row=>sha256hex(row.key)[0]===bucket),text=selected.map(row=>canonicalJSON(row)+"\n").join("");
      return {bucket,sha256:sha256hex(text),bytes:Buffer.byteLength(text),rows:selected.length,text};
    });
    const manifest:Manifest={format:1,kind:"solanaut-request-index",profile:EVALUATION_PROFILE,guardId:policy.latch.guardId,cluster:policy.latch.cluster,
      operatorKey:pins.operatorKey,policyVersion:last.version,policyHash:hash,...end,shards:shards.map(({text,...metadata})=>metadata)};
    const text=canonicalJSON(manifest)+"\n",root=immutable({text,digest:sha256hex(text)}),prepared=immutable({...root,root,shards});
    // A parsed/copied on-disk manifest can never substitute for independent derivation.
    roots.set(root,{manifest:immutable(manifest),text});return prepared;
  }catch(error){if(error instanceof RequestIndexError)throw error;throw new RequestIndexError("request index history cannot be validated");}
}
async function lines(path:string,expected:{bytes:number;sha256:string},maxLine:number,accept:(text:string)=>void):Promise<void> {
  const handle=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile() || before.nlink!==1n || before.size!==BigInt(expected.bytes))throw new RequestIndexError("request index source differs from verified size");
    const chunk=Buffer.allocUnsafe(65_536),digest=createHash("sha256");let pending=Buffer.alloc(0),bytes=0;
    while(bytes<expected.bytes){
      const read=await handle.read(chunk,0,Math.min(chunk.length,expected.bytes-bytes),null);
      if(!Number.isSafeInteger(read.bytesRead) || read.bytesRead<=0 || read.bytesRead>Math.min(chunk.length,expected.bytes-bytes))throw new RequestIndexError("request index source ended or made invalid progress");
      bytes+=read.bytesRead;digest.update(chunk.subarray(0,read.bytesRead));pending=Buffer.concat([pending,chunk.subarray(0,read.bytesRead)]);
      let start=0,end:number;
      while((end=pending.indexOf(10,start))!==-1){
        if(end===start || end-start>maxLine)throw new RequestIndexError("request index line is empty or exceeds its ceiling");
        accept(new TextDecoder("utf-8",{fatal:true}).decode(pending.subarray(start,end)));start=end+1;
      }
      pending=pending.subarray(start);if(pending.length>maxLine)throw new RequestIndexError("request index line exceeds its ceiling");
    }
    if(pending.length)throw new RequestIndexError("request index lacks its final newline");
    const after=await handle.stat({bigint:true}),named=await fs.lstat(path,{bigint:true});
    if(!named.isFile() || named.dev!==before.dev || named.ino!==before.ino || after.nlink!==1n || after.size!==before.size || after.mtimeNs!==before.mtimeNs || after.ctimeNs!==before.ctimeNs ||
      named.nlink!==1n || named.size!==before.size || named.mtimeNs!==before.mtimeNs || named.ctimeNs!==before.ctimeNs)throw new RequestIndexError("request index source changed during lookup");
    if(digest.digest("hex")!==expected.sha256)throw new RequestIndexError("request index bytes differ from independently derived root");
  }finally{await handle.close();}
}
function row(text:string,bucket:string):RequestIndexRow {
  const value=JSON.parse(text) as RequestIndexRow;
  if(!value || Array.isArray(value) || Object.keys(value).sort().join(",")!=="format,key,kind,redeem,report,response,settled,signed,start,started" || value.format!==1 || value.kind!=="solanaut-request-index-row" || canonicalJSON(value)!==text ||
    typeof value.key!=="string" || sha256hex(value.key)[0]!==bucket || !value.start || !["decision","request"].includes(value.start.kind) || !value.start.request || requestKey(value.start.request)!==value.key)throw new RequestIndexError("request index row is malformed or routed to another shard");
  for(const field of ["redeem","signed","started","response","report","settled"] as const){
    const evidence=value[field];if(evidence===null)continue;
    if(!evidence || typeof evidence!=="object")throw new RequestIndexError("request index evidence is malformed");
    const target=evidence.kind==="signing"?evidence.event?.decision:evidence.kind==="response"?evidence.request:"decision" in evidence?evidence.decision:undefined;
    if(target!==value.start.hash)throw new RequestIndexError("request index evidence names another historical request");
  }
  return value;
}
/** Read-only internal lookup; root provenance cannot be supplied by the cache itself. */
export async function lookupRequestIndex(directory:string,expected:VerifiedRequestIndexRoot,identity:RequestIdentity,options:{maxLineBytes?:number}={}):Promise<Readonly<RequestIndexRow>|null> {
  try{
    const root=roots.get(expected);
    if(!root)throw new RequestIndexError("request index lookup requires an independently derived root");
    const key=requestKey(bindRequest(root.manifest.guardId,identity,new Uint8Array())),bucket=sha256hex(key)[0]!;
    if(!options || typeof options!=="object" || Array.isArray(options) || Object.keys(options).some(key=>key!=="maxLineBytes"))throw new RequestIndexError("request index lookup options are invalid");
    const configured=options.maxLineBytes,maxLine=configured===undefined?1_048_576:configured;
    if(typeof directory!=="string" || !directory || !Number.isSafeInteger(maxLine) || maxLine<1 || maxLine>16_777_216)throw new RequestIndexError("request index lookup input is invalid");
    if(process.platform!=="linux")throw new RequestIndexError("request index lookup supports local Linux files");
    const before=await fs.lstat(directory,{bigint:true});if(!before.isDirectory())throw new RequestIndexError("request index generation must be an actual directory");
    let manifestLines=0;
    await lines(join(directory,"manifest.json"),{bytes:Buffer.byteLength(root.text),sha256:sha256hex(root.text)},65_536,text=>{
      manifestLines++;if(text+"\n"!==root.text)throw new RequestIndexError("disk manifest differs from independently derived root");
    });
    if(manifestLines!==1)throw new RequestIndexError("request index manifest framing differs");
    const shard=root.manifest.shards.find(entry=>entry.bucket===bucket)!;let rows=0,previous:string|undefined,found:RequestIndexRow|null=null;
    await lines(join(directory,bucket+".jsonl"),shard,maxLine,text=>{
      const candidate=row(text,bucket);if(previous!==undefined && candidate.key<=previous)throw new RequestIndexError("request index rows are reordered or repeated");
      previous=candidate.key;rows++;if(candidate.key===key)found=candidate;
    });
    if(rows!==shard.rows)throw new RequestIndexError("request index row count differs from its root");
    const after=await fs.lstat(directory,{bigint:true});if(!after.isDirectory() || before.dev!==after.dev || before.ino!==after.ino)throw new RequestIndexError("request index generation changed during lookup");
    return immutable(found);
  }catch(error){if(error instanceof RequestIndexError)throw error;throw new RequestIndexError("request index lookup cannot establish evidence");}
}
