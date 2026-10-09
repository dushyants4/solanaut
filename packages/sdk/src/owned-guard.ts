// ADR-019: private admission/control ownership, not the trusted synchronous SDK.
import {canonicalJSON} from "./canonical.ts";
import {createPolicy,type Policy} from "./policy.ts";
import {verifyPolicyAuthorization,type PolicyAuthorization} from "./signed-policy.ts";
import {fileStore,lookupOwnedRequestIndex,type EntryStore} from "./record.ts";
import {createGuard,checkOwnedRequest,beginOwnedRequest,finishOwnedRequest,ownedRequestResult,type Guard,type GuardStatus,type ProposalV1,type Decision} from "./guard.ts";
import type {RequestIdentity} from "./request.ts";
import type {ControlMethod} from "./control-request.ts";
import type {ControlRequestEntry,ControlResponseEntry} from "./log.ts";

export interface OwnedGuardOptions {path:string;policy:unknown;authorization:PolicyAuthorization}
export interface OwnedGuard {
  check(proposal:ProposalV1,identity:RequestIdentity):Promise<Decision>;
  beginRequest(identity:RequestIdentity,method:ControlMethod,payload:unknown,at:number):Promise<ControlRequestEntry>;
  finishRequest(identity:RequestIdentity,startHash:string,result:unknown):Promise<ControlResponseEntry>;
  requestResult(identity:RequestIdentity,startHash:string):Promise<unknown>;
  status():Promise<Readonly<GuardStatus>>;
  close():Promise<void>;
  readonly policy:Policy;
  readonly policyHash:string;
}
export class OwnedGuardError extends Error {
  readonly code="owned-guard";
  constructor(){super("owned guard cannot establish or complete the requested operation");this.name="OwnedGuardError";}
}
function detached<T>(input:T):T {
  const copy=structuredClone(input);
  function freeze(value:unknown):void {if(value&&typeof value==="object"){for(const child of Object.values(value))freeze(child);Object.freeze(value);}}
  freeze(copy);return copy;
}

/** Internal only: no key, signing, sending, maintenance setup or implicit policy upgrade. */
export async function openOwnedGuard(input:OwnedGuardOptions):Promise<OwnedGuard> {
  let store:EntryStore|undefined,guard:Guard|undefined;
  try {
    const options=structuredClone(input);
    if(!options||typeof options.path!=="string"||options.path.length===0)throw new OwnedGuardError();
    const policy=verifyPolicyAuthorization(options.policy,options.authorization);
    if(policy.latch.cluster!=="devnet")throw new OwnedGuardError();
    store=fileStore(options.path,{ownership:"kernel",create:false});
    const lastPolicy=store.entries.findLast(entry=>entry.kind==="policy");
    if(store.entries[0]?.kind!=="policy"||lastPolicy?.kind!=="policy"||lastPolicy.policy!==canonicalJSON(policy)||lastPolicy.version!==options.authorization.version||lastPolicy.text!==options.authorization.text)throw new OwnedGuardError();
    guard=await createGuard({policy,authorization:options.authorization,log:store});
    const evidence=await lookupOwnedRequestIndex(store,{clientId:"owned-startup",id:"validation"},{policyTrust:options.authorization});
    const last=store.entries.at(-1);
    if(evidence.seq!==guard.status().seq||evidence.head!==last?.hash)throw new OwnedGuardError();
    return facade(guard);
  } catch {
    try {if(guard)guard.close();else store?.close();}catch { /* Preserve the fixed startup error. */ }
    throw new OwnedGuardError();
  }
}

function facade(guard:Guard):OwnedGuard {
  let queue:Promise<void>=Promise.resolve(),accepting=true,closed=false,closing:Promise<void>|undefined;
  function enqueue<T>(work:()=>Promise<T>|T):Promise<T> {
    if(!accepting)return Promise.reject(new OwnedGuardError());
    const pending=queue.then(()=>{if(closed)throw new OwnedGuardError();return work();}).catch(()=>{throw new OwnedGuardError();});
    queue=pending.then(()=>undefined,()=>undefined);return pending;
  }
  function captured<T>(capture:()=>()=>Promise<T>):Promise<T> {
    try {return enqueue(capture());}catch{return Promise.reject(new OwnedGuardError());}
  }
  const policy=detached(createPolicy(guard.policy).policy);
  return Object.freeze({
    policy,policyHash:guard.policyHash,
    check(proposal:ProposalV1,identity:RequestIdentity){return captured(()=>{
      const p=structuredClone(proposal),id=structuredClone(identity);
      if(p?.message instanceof Uint8Array)p.message=new Uint8Array(p.message);
      return async()=>{
        const decision=await checkOwnedRequest(guard,p,id);
        // A failed append or identity collision is not a durable admission reply.
        if(decision.seq<0)throw new OwnedGuardError();
        return decision;
      };
    });},
    beginRequest(identity:RequestIdentity,method:ControlMethod,payload:unknown,at:number){return captured(()=>{
      const id=structuredClone(identity),value=structuredClone(payload);
      return ()=>beginOwnedRequest(guard,id,method,value,at);
    });},
    finishRequest(identity:RequestIdentity,startHash:string,result:unknown){return captured(()=>{
      const id=structuredClone(identity),value=structuredClone(result);
      return ()=>finishOwnedRequest(guard,id,startHash,value);
    });},
    requestResult(identity:RequestIdentity,startHash:string){return captured(()=>{
      const id=structuredClone(identity);return ()=>ownedRequestResult(guard,id,startHash);
    });},
    status(){return enqueue(()=>detached(guard.status()));},
    close(){
      if(closing)return closing;
      accepting=false;
      closing=queue.then(()=>{closed=true;guard.close();}).catch(()=>{throw new OwnedGuardError();});
      return closing;
    },
  });
}
