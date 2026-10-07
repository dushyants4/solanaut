import type { RunTicket } from "../../tools/run-supervisor.ts";
import { readSupervisedResult } from "../../tools/run-supervisor.ts";
import { requireRunCompletion } from "../../tools/run-completion.ts";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MUTATION_TESTS } from "./mutation-stage.ts";
import { requireMutationReport } from "./mutation.ts";
export interface MutationInputs { inputs: Record<string,string>; rootInputs: Record<string,string>; lockHash: string }
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
function paths(root:string,directory:string):string[] {
  if(!existsSync(join(root,directory)))return [];
  if(!lstatSync(join(root,directory)).isDirectory())throw new Error("mutation input directory is not regular");
  return (readdirSync(join(root,directory),{recursive:true}) as string[]).filter(path=>path.endsWith(".ts") || path.endsWith("package.json")).map(path=>directory+"/"+path).sort();
}
function hashes(root:string,paths:readonly string[]):Record<string,string> {
  return Object.fromEntries([...paths].sort().map(path=> {
    const file=join(root,path);if(!lstatSync(file).isFile())throw new Error("mutation input is not a regular file");
    return [path,hash(readFileSync(file))];
  }));
}
export function freezeMutationInputs(root:string,stage:string):MutationInputs {
  const rootPaths=["package.json","packages/sdk/package.json",...paths(root,"packages/sdk/src"),...paths(root,"packages/sdk/bin"),...paths(root,"packages/sdk/test/support"),...MUTATION_TESTS.filter(path=>existsSync(join(root,path)))].sort();
  const stagePaths=["package.json","stryker.config.json",...paths(stage,"packages")].sort();
  if(JSON.stringify(stagePaths)!==JSON.stringify([...rootPaths,"stryker.config.json"].sort()))throw new Error("mutation input inventory differs");
  const inputs=hashes(stage,stagePaths),rootInputs=hashes(root,rootPaths);
  if(rootPaths.some(path=>inputs[path]!==rootInputs[path]))throw new Error("copied mutation input differs");
  return {inputs,rootInputs,lockHash:hashes(root,["package-lock.json"])["package-lock.json"]!};
}
export function verifyMutationInputs(root:string,stage:string,binding:MutationInputs):void {
  if(JSON.stringify(freezeMutationInputs(root,stage))!==JSON.stringify(binding))throw new Error("frozen mutation inputs changed");
}
export function completedMutation(root:string,stage:string,binding:MutationInputs,ticket:RunTicket,sources:Record<string,string>,baseline:boolean):unknown {
  const status=requireRunCompletion(readSupervisedResult(ticket),ticket.identity);
  verifyMutationInputs(root,stage,binding);
  if(baseline)return {baseline:true};
  return requireMutationReport(JSON.parse(readFileSync(join(stage,"reports/mutation.json"),"utf8")),sources,status);
}
