import {rng} from "../../packages/sdk/test/support/kit.ts";
import {PROFILE_NAMES} from "./traffic.ts";
export interface Payment {at:number; destination:number; amount:bigint; price:bigint|null; blockhash:number[]}
export function buildProfile(name:string,seed:number):Payment[] {
  if(!PROFILE_NAMES.some(profile=>profile===name)) throw new Error("unknown traffic profile");
  if(!Number.isSafeInteger(seed) || seed<0 || seed>0xffffffff) throw new Error("invalid traffic seed");
  const random=rng(seed); let at=1000;
  return Array.from({length:500},(_,index)=> {
    if(name==="bursts") at=1000+Math.floor(index/10)*100000+(index%10)*100;
    else if(index>0) at+=name==="jitter"?random.int(8000,12000):10000;
    const destination=name==="recurring"?2:random.int(2,4);
    const amount=name==="recurring"?5_000_000n:BigInt(random.int(1_000_000,10_000_000));
    const price=name==="variable-fees"?BigInt(random.int(5000,20000)):null;
    return {at,destination,amount,price,blockhash:[...random.bytes(32)]};
  });
}
