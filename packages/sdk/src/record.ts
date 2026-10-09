// Where the record lives (ADR-010). A store holds the entries in order and appends one at a
// time; the guard applies an entry only after the store has kept it.
//
// The file store keeps one canonical JSON entry per line, and syncs each line to disk before the
// guard answers. On open it verifies every line: it parses, and its hash is its own. A last line
// with no newline is a write a crash cut short; it was never acknowledged, so it is cut off. Any
// other damage refuses to open: a guard that cannot trust its record does not run.
//
// One writer per record. Manual SDK ownership refuses any existing marker, including stale
// ones. Linux kernel ownership recovers through flock on an inherited open-file description,
// held until this store closes or the process dies. Its mutex inode is never unlinked.

import { closeSync, constants, fstatSync, fsyncSync, ftruncateSync, lstatSync, openSync, readFileSync, readSync, unlinkSync, writeSync, type BigIntStats } from "node:fs";
import { spawnSync } from "node:child_process";
import { hostname } from "node:os";
import { dirname } from "node:path";
import { canonicalJSON } from "./canonical.ts";
import { hashOf, type Entry } from "./log.ts";
import {CheckpointPublicationError,CheckpointRecoveryError} from "./checkpoint-errors.ts";
import type {CheckpointPublicationOptions,CheckpointPublicationReceipt} from "./checkpoint-publication.ts";
import type {CheckpointRecoveryOptions,PreparedCheckpointRecovery} from "./checkpoint-recovery.ts";
import type {RequestIndexLookupReceipt,RequestIndexPublicationOptions,RequestIndexPublicationReceipt} from "./request-index-publication.ts";
import type {RequestIdentity} from "./request.ts";

export interface EntryStore {
  /** Every entry kept so far, oldest first. The store, not the guard, adds to it. */
  readonly entries: Entry[];
  /** Keep one entry, durably, before returning. Throws if it cannot. */
  append(entry: Entry): void;
  close(): void;
}

const publishers=new WeakMap<EntryStore,(text:unknown,options:CheckpointPublicationOptions)=>Promise<CheckpointPublicationReceipt>>();
const recoverers=new WeakMap<EntryStore,(options:CheckpointRecoveryOptions)=>Promise<Readonly<PreparedCheckpointRecovery>>>();
export class RequestIndexPublicationError extends Error {
  readonly code="request-index-publication";
  constructor(message:string){super(message);this.name="RequestIndexPublicationError";}
}
const indexPublishers=new WeakMap<EntryStore,(options:RequestIndexPublicationOptions)=>Promise<Readonly<RequestIndexPublicationReceipt>>>();
export class RequestIndexLookupError extends Error {
  readonly code="request-index-lookup";
  constructor(message:string){super(message);this.name="RequestIndexLookupError";}
}
const indexLookups=new WeakMap<EntryStore,(identity:RequestIdentity,options:RequestIndexPublicationOptions)=>Promise<Readonly<RequestIndexLookupReceipt>>>();
/** Internal read-only evidence through a captured owned head, not an admission permit. */
export async function lookupOwnedRequestIndex(store:EntryStore,identity:RequestIdentity,options:RequestIndexPublicationOptions):Promise<Readonly<RequestIndexLookupReceipt>> {
  const lookup=indexLookups.get(store);
  if(!lookup)throw new RequestIndexLookupError("current request lookup requires actual file ownership");
  try{return await lookup(identity,options);}catch(error){if(error instanceof RequestIndexLookupError)throw error;throw new RequestIndexLookupError("owned request index cannot establish current evidence");}
}
/** Internal maintenance capability; a copied store or disk manifest cannot claim ownership. */
export async function publishOwnedRequestIndex(store:EntryStore,options:RequestIndexPublicationOptions):Promise<Readonly<RequestIndexPublicationReceipt>>{
  const publish=indexPublishers.get(store);
  if(!publish)throw new RequestIndexPublicationError("request index publication requires actual file ownership");
  try{return await publish(options);}catch(error){if(error instanceof RequestIndexPublicationError)throw error;throw new RequestIndexPublicationError("owned request index cannot be published");}
}
/** Internal maintenance capability: only the actual kernel-owned store can publish. */
export async function publishOwnedCheckpoint(store:EntryStore,text:unknown,options:CheckpointPublicationOptions):Promise<CheckpointPublicationReceipt>{
  const publish=publishers.get(store);
  if(!publish)throw new CheckpointPublicationError("checkpoint publication requires actual file ownership");
  try{return await publish(text,options);}catch(error){if(error instanceof CheckpointPublicationError)throw error;throw new CheckpointPublicationError("owned checkpoint cannot be published");}
}

/** Internal read-only recovery: the actual kernel owner supplies history and checkpoint. */
export async function recoverOwnedCheckpoint(store:EntryStore,options:CheckpointRecoveryOptions):Promise<Readonly<PreparedCheckpointRecovery>>{
  const recover=recoverers.get(store);
  if(!recover)throw new CheckpointRecoveryError("checkpoint recovery requires actual file ownership");
  try{return await recover(options);}catch(error){if(error instanceof CheckpointRecoveryError)throw error;throw new CheckpointRecoveryError("owned checkpoint cannot be recovered");}
}

/** A store in memory: the default, and what tests use. Nothing survives the process. */
export function memoryStore(): EntryStore {
  const entries: Entry[] = [];
  return { entries, append: (e) => void entries.push(e), close: () => {} };
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export interface FileStoreOptions {
  /** Kernel recovery requires Linux and /usr/bin/flock on a supported local filesystem. */
  ownership?: "manual" | "kernel";
  /** False for an established isolated identity: never create missing history. */
  create?: boolean;
}

function writeAll(fd: number, bytes: Buffer): void {
  for (let offset = 0; offset < bytes.length;) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset);
    if (!Number.isInteger(written) || written <= 0 || written > bytes.length - offset) throw new Error("record write made no valid progress");
    offset += written;
  }
}

function syncDirectory(path: string): void {
  const fd = openSync(dirname(path), "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function sameFile(fd: number, path: string): void {
  const held = fstatSync(fd, { bigint: true });
  const named = lstatSync(path, { bigint: true });
  if (!named.isFile() || held.dev !== named.dev || held.ino !== named.ino) throw new Error("the record or ownership inode was replaced");
  if (held.nlink !== 1n || named.nlink !== 1n) throw new Error("the record or ownership inode must be single-link");
}

function lock(path: string, mode: "manual" | "kernel"): { held(): void; release(): void } {
  const lockPath = `${path}.lock`;
  if (mode === "kernel" && process.platform !== "linux") throw new Error("kernel record ownership requires Linux");
  let fd: number;
  try { fd = openSync(lockPath, mode === "kernel" ? "a+" : "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`the record ${path} is locked; manual SDK mode refuses stale ownership too; recover under kernel ownership or stop all writers before operator repair`);
    throw error;
  }
  try {
    if (process.platform === "linux") {
      // fd 3 inherits this exact open-file description, so the lock survives the helper's exit.
      const result = spawnSync("/usr/bin/flock", ["--exclusive", "--nonblock", "3"], { stdio: ["ignore", "ignore", "pipe", fd] });
      if (result.status !== 0) throw new Error(`the record ${path} is locked or flock failed: ${result.error?.message ?? result.stderr?.toString() ?? result.status}`);
    }
    sameFile(fd, lockPath);
    if (mode === "kernel") {
      const text = readFileSync(fd, "utf8");
      if (text) {
        const holder = JSON.parse(text) as { mode?: string; pid?: number; host?: string };
        if (holder.mode !== "kernel" && (typeof holder.pid !== "number" || holder.host !== hostname() || alive(holder.pid))) throw new Error(`the record ${path} is locked by a live or foreign manual owner`);
      }
    }
    ftruncateSync(fd, 0);
    writeAll(fd, Buffer.from(JSON.stringify({ mode, pid: process.pid, host: hostname(), at: Date.now() })));
    fsyncSync(fd); syncDirectory(lockPath);
  } catch (error) { closeSync(fd); throw error; }
  return {
    held: () => sameFile(fd, lockPath),
    release() {
      try {
        if (mode === "manual") { sameFile(fd, lockPath); unlinkSync(lockPath); }
      } finally { closeSync(fd); }
    },
  };
}

function readRecord(path: string, fd: number): Entry[] {
  const before = fstatSync(fd, { bigint: true });
  const text = readFileSync(fd, "utf8");
  sameFile(fd, path);
  const after = fstatSync(fd, { bigint: true });
  if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw new Error("the record changed during read");
  const end = text.lastIndexOf("\n") + 1;
  if (end < text.length) {
    // A torn last line: cut it, so the next entry starts on a clean line.
    ftruncateSync(fd, Buffer.byteLength(text.slice(0, end), "utf8"));
    fsyncSync(fd);
  }
  const entries: Entry[] = [];
  const lines = text.slice(0, end).split("\n").slice(0, -1);
  lines.forEach((line, i) => {
    let e: Entry;
    try {
      e = JSON.parse(line) as Entry;
    } catch {
      throw new Error(`the record ${path} is damaged: line ${i + 1} is not JSON`);
    }
    if (e === null || typeof e !== "object" || typeof e.hash !== "string" || hashOf(e) !== e.hash) {
      throw new Error(`the record ${path} is damaged: the hash of line ${i + 1} does not match its entry`);
    }
    entries.push(e);
  });
  return entries;
}

function readCheckpoint(path:string,maxBytes:number):string|null|undefined{
  let fd:number|undefined;
  try{
    fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    const before=fstatSync(fd,{bigint:true});
    if(!before.isFile() || before.size>BigInt(maxBytes))return null;
    const chunks:Buffer[]=[];let size=0;
    for(;;){
      const buffer=Buffer.alloc(Math.min(65536,maxBytes-size+1)),count=readSync(fd,buffer,0,buffer.length,null);
      if(!Number.isSafeInteger(count) || count<0 || count>buffer.length)return null;
      if(count===0)break;
      size+=count;if(size>maxBytes)return null;chunks.push(buffer.subarray(0,count));
    }
    sameFile(fd,path);const after=fstatSync(fd,{bigint:true});
    if(after.size!==before.size || after.mtimeNs!==before.mtimeNs || after.ctimeNs!==before.ctimeNs)return null;
    return Buffer.concat(chunks).toString("utf8");
  }catch(error){return fd===undefined && (error as NodeJS.ErrnoException).code==="ENOENT"?undefined:null;}
  finally{if(fd!==undefined)closeSync(fd);}
}

/** Open (or create) a record file, taking its lock. */
export function fileStore(path: string, options: FileStoreOptions = {}): EntryStore {
  const mode = options.ownership ?? "manual";
  if (mode !== "manual" && mode !== "kernel") throw new Error("unsupported record ownership mode");
  const owner = lock(path, mode);
  let fd: number;
  let entries: Entry[];
  let expected: BigIntStats;
  try {
    fd = openSync(path, constants.O_RDWR | constants.O_APPEND | constants.O_NOFOLLOW | (options.create === false ? 0 : constants.O_CREAT), 0o600);
    sameFile(fd, path);
    entries = readRecord(path, fd);
    if (options.create !== false) syncDirectory(path);
    expected = fstatSync(fd, { bigint: true });
  } catch (e) {
    if (fd! !== undefined) closeSync(fd!);
    owner.release();
    throw e;
  }
  let open = true;
  let failed = false;
  let publishing = false;
  const held=()=>{
    if(mode!=="kernel" || !open || failed)throw new CheckpointPublicationError("checkpoint owner is closed, failed or unsupported");
    owner.held();sameFile(fd,path);
  };
  const store:EntryStore = {
    entries,
    append(entry) {
      if (!open || failed) throw new Error("the record is closed or failed");
      try {
        owner.held(); sameFile(fd, path);
        const current = fstatSync(fd, { bigint: true });
        if (current.size !== expected.size || current.mtimeNs !== expected.mtimeNs || current.ctimeNs !== expected.ctimeNs) throw new Error("the owned record changed outside this writer");
        writeAll(fd, Buffer.from(`${canonicalJSON(entry)}\n`));
        fsyncSync(fd);
        expected = fstatSync(fd, { bigint: true });
      } catch (error) { failed = true; throw error; }
      entries.push(entry);
    },
    close() {
      if (!open) return;
      open = false;
      try { closeSync(fd); } finally { owner.release(); }
    },
  };
  publishers.set(store,async(text,options)=>{
    if(publishing)throw new CheckpointPublicationError("checkpoint publication already in progress");
    publishing=true;
    try{
      held();
      const before=fstatSync(fd,{bigint:true});
      const reader=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
      let history:Entry[];
      try{sameFile(reader,path);history=readRecord(path,reader);}finally{closeSync(reader);}
      if(canonicalJSON(history)!==canonicalJSON(entries))throw new CheckpointPublicationError("owned record and cached entries differ");
      // Capture before the asynchronous loader permits changes to caller-owned options.
      const pins=structuredClone(options),candidate=text;
      const {validatePublication,replaceCheckpoint}=await import("./checkpoint-publication.ts");
      const validated=await validatePublication(candidate,pins,history);
      const unchanged=()=>{
        held();const now=fstatSync(fd,{bigint:true});
        if(now.size!==before.size || now.mtimeNs!==before.mtimeNs || now.ctimeNs!==before.ctimeNs || canonicalJSON(history)!==canonicalJSON(entries))throw new CheckpointPublicationError("owned record changed during checkpoint validation");
      };
      unchanged();
      try{replaceCheckpoint(path,validated.text,validated.pins,unchanged);}catch(error){failed=true;throw error;}
      return validated.receipt;
    }finally{publishing=false;}
  });
  recoverers.set(store,async(options)=>{
    if(publishing)throw new CheckpointRecoveryError("checkpoint maintenance already in progress");
    publishing=true;
    try{
      const pins=structuredClone(options);
      if(!pins || !Number.isSafeInteger(pins.maxBytes) || pins.maxBytes<=0)throw new CheckpointRecoveryError("checkpoint read ceiling is invalid");
      held();const before=fstatSync(fd,{bigint:true});
      const reader=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
      let history:Entry[];
      try{sameFile(reader,path);history=readRecord(path,reader);}finally{closeSync(reader);}
      if(canonicalJSON(history)!==canonicalJSON(entries))throw new CheckpointRecoveryError("owned record and cached recovery history differ");
      const text=readCheckpoint(path+".checkpoint",pins.maxBytes);
      const {prepareCheckpointRecovery}=await import("./checkpoint-recovery.ts");
      const recovered=await prepareCheckpointRecovery(history,text,pins);
      held();const after=fstatSync(fd,{bigint:true});
      if(after.size!==before.size || after.mtimeNs!==before.mtimeNs || after.ctimeNs!==before.ctimeNs || canonicalJSON(history)!==canonicalJSON(entries))throw new CheckpointRecoveryError("owned record changed during recovery");
      return recovered;
    }finally{publishing=false;}
  });
  indexPublishers.set(store,async(options)=>{
    if(publishing)throw new RequestIndexPublicationError("request index maintenance already in progress");
    publishing=true;
    try{
      const pins=structuredClone(options);held();const before=fstatSync(fd,{bigint:true});
      const reader=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);let history:Entry[];
      try{sameFile(reader,path);history=readRecord(path,reader);}finally{closeSync(reader);}
      if(canonicalJSON(history)!==canonicalJSON(entries))throw new RequestIndexPublicationError("owned record and cached index history differ");
      let marker:BigIntStats|undefined;
      try{marker=lstatSync(path+".request-index",{bigint:true});}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
      const {validateIndexPublication,replaceRequestIndex}=await import("./request-index-publication.ts");
      if(marker!==undefined){const named=lstatSync(path+".request-index",{bigint:true});if(marker.dev!==named.dev||marker.ino!==named.ino||marker.size!==named.size||marker.mtimeNs!==named.mtimeNs||marker.ctimeNs!==named.ctimeNs)throw new RequestIndexPublicationError("request index pointer changed during module loading");}
      else{try{lstatSync(path+".request-index");throw new RequestIndexPublicationError("request index pointer appeared during module loading");}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}}
      const validated=await validateIndexPublication(path,history,pins);
      const unchanged=()=>{
        held();const now=fstatSync(fd,{bigint:true});
        if(now.size!==before.size||now.mtimeNs!==before.mtimeNs||now.ctimeNs!==before.ctimeNs||canonicalJSON(history)!==canonicalJSON(entries))throw new RequestIndexPublicationError("owned record changed during index validation");
      };
      unchanged();try{return replaceRequestIndex(path,validated,unchanged);}catch(error){failed=true;throw error;}
    }finally{publishing=false;}
  });
  indexLookups.set(store,async(identity,options)=>{
    if(publishing)throw new RequestIndexLookupError("request index maintenance already in progress");
    publishing=true;
    try{
      const id=structuredClone(identity),pins=structuredClone(options);held();const before=fstatSync(fd,{bigint:true});
      const reader=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);let history:Entry[];
      try{sameFile(reader,path);history=readRecord(path,reader);}finally{closeSync(reader);}
      if(canonicalJSON(history)!==canonicalJSON(entries))throw new RequestIndexLookupError("owned record and cached lookup history differ");
      const marker=lstatSync(path+".request-index",{bigint:true});
      const {lookupIndexPublication}=await import("./request-index-publication.ts");
      const named=lstatSync(path+".request-index",{bigint:true});
      if(marker.dev!==named.dev||marker.ino!==named.ino||marker.size!==named.size||marker.mtimeNs!==named.mtimeNs||marker.ctimeNs!==named.ctimeNs)throw new RequestIndexLookupError("request index pointer changed during lookup loading");
      const answer=await lookupIndexPublication(path,history,id,pins);
      held();const now=fstatSync(fd,{bigint:true});
      if(now.size!==before.size||now.mtimeNs!==before.mtimeNs||now.ctimeNs!==before.ctimeNs||canonicalJSON(history)!==canonicalJSON(entries))throw new RequestIndexLookupError("owned record changed during request lookup");
      return answer;
    }finally{publishing=false;}
  });
  return store;
}
