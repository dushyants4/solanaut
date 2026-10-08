import {readSupervisedResult,type RunTicket} from "./run-supervisor.ts";
export async function stopSupervisedRun(ticket:RunTicket):Promise<void> {
  if(!Number.isSafeInteger(ticket.supervisorPid)||ticket.supervisorPid<=1)throw new Error("invalid supervisor PID");
  let result=readSupervisedResult(ticket);
  if(result===null){
    try{process.kill(ticket.supervisorPid,"SIGTERM");}catch(error){if((error as NodeJS.ErrnoException).code!=="ESRCH")throw error;}
    // This is teardown containment, not the admission/baseline completion wait.
    const end=process.hrtime.bigint()+10_000_000_000n;
    while(result===null&&process.hrtime.bigint()<end){await new Promise(resolve=>setTimeout(resolve,20));result=readSupervisedResult(ticket);}
  }
  if(result===null)throw new Error("supervisor shutdown is unconfirmed; preserve its scratch directory");
  if(typeof result!=="object"||Reflect.get(result,"format")!==1||Reflect.get(result,"state")!=="complete")throw new Error("invalid supervisor completion during shutdown");
  if(Reflect.get(result,"error")==="process group termination unconfirmed")throw new Error("supervised process group shutdown is unconfirmed; preserve its scratch directory");
}
