// ADR-009: the wire handed to RPC must carry the admitted signed message.
import {strict as assert} from "node:assert";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {createGuard} from "../src/guard.ts";
import {guardedWallet,type BaseWalletLike,type RpcLike} from "../src/adapters/agent-kit.ts";
import {encodeBase58} from "../src/base58.ts";
import {WORKLOAD_POLICY} from "./support/workload.ts";
import {craftLegacy,key} from "./support/craft.ts";

function fixture(){
  const agent=generateKeyPairSync("ed25519"),bytes=Buffer.from(agent.publicKey.export({format:"jwk"}).x!,"base64url"),address=encodeBase58(bytes);
  const publicKey={toBase58:()=>address,toBytes:()=>new Uint8Array(bytes)};
  const message=(destination:number)=>craftLegacy({header:[1,0,1],keys:[[...bytes],key(destination),key(0)],instructions:[{program:2,accounts:[0,1],data:[2,0,0,0,1,0,0,0,0,0,0,0]}]});
  const admitted=message(2),foreign=message(3),signature=sign(null,admitted,agent.privateKey);
  const wire=(value:Uint8Array,sig=sign(null,value,agent.privateKey))=>Buffer.concat([Buffer.from([1]),sig,value]);
  const tx={serializeMessage:()=>admitted,signatures:[{publicKey,signature:signature as Uint8Array|null}],serialize:()=>wire(admitted)};
  const wallet:BaseWalletLike<typeof tx>={publicKey,signTransaction:async t=>t,signAllTransactions:async ts=>ts,signAndSendTransaction:async()=>{throw new Error("wallet must not send");},signMessage:async()=>{throw new Error("must not sign messages");}};
  const sent:Uint8Array[]=[],rpc:RpcLike={getBlockHeight:async()=>10n,sendRawTransaction:async value=>{sent.push(value);return encodeBase58(signature);},confirm:async()=>"landed"};
  const policy={...structuredClone(WORKLOAD_POLICY),principal:[address]};
  return {admitted,foreign,signature,wire,tx,wallet,rpc,sent,policy};
}
for(const BufferType of [ArrayBuffer,SharedArrayBuffer]){
  test(`ADP-1/ADR-009: RPC handoff privately captures raw ${BufferType.name} wire`,async()=>{
    const f=fixture(),g=await createGuard({policy:f.policy});try{
      const expected=f.wire(f.admitted),backing=new BufferType(expected.length);
      new Uint8Array(backing).set(expected);
      Object.assign(f.tx,{serialize:()=>backing});
      f.rpc.sendRawTransaction=async value=>{
        new Uint8Array(backing).set(f.wire(f.foreign));
        f.sent.push(value);return encodeBase58(f.signature);
      };
      await guardedWallet(f.wallet,g,{rpc:f.rpc,now:()=>1000}).signAndSendTransaction(f.tx);
      assert.equal(f.sent.length,1);assert.deepEqual(f.sent[0],new Uint8Array(expected));
      assert.notEqual(f.sent[0]!.buffer,backing,"RPC bytes cannot alias caller storage");
    }finally{g.close();}
  });
  for(const versioned of [false,true])test(`ADP-1/ADR-009: ${versioned?"versioned":"legacy"} admission privately captures raw ${BufferType.name} message`,async()=>{
    const f=fixture(),g=await createGuard({policy:f.policy});try{
      const backing=new BufferType(f.admitted.length);new Uint8Array(backing).set(f.admitted);
      const tx=versioned?{message:{serialize:()=>backing,staticAccountKeys:[f.wallet.publicKey]},signatures:[f.signature],serialize:()=>f.wire(new Uint8Array(backing))}:Object.assign(f.tx,{serializeMessage:()=>backing,serialize:()=>f.wire(new Uint8Array(backing))});
      const wallet={...f.wallet,signTransaction:async (value:any)=>{
        new Uint8Array(backing).set(f.foreign);
        const signature=f.wire(f.foreign).slice(1,65);
        if(versioned)value.signatures[0]=signature;else value.signatures[0].signature=signature;
        return value;
      }};
      await assert.rejects(guardedWallet<any>(wallet,g,{rpc:f.rpc,now:()=>1000}).signAndSendTransaction(tx),(error:Error)=>Reflect.get(error,"rule")==="wallet-changed-message");
      assert.equal(f.sent.length,0,"mutated admission never reaches RPC");
    }finally{g.close();}
  });
}
