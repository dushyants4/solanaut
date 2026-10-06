export interface MutationSummary { detected:number; undetected:number; invalid:number; total:number; score:number }
function object(value:unknown): Record<string,unknown> {
  if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("invalid mutation report object");
  return value as Record<string,unknown>;
}
function offset(value:unknown,source:string):number {
  const position=object(value), lines=source.split("\n");
  const line=position.line as number, column=position.column as number;
  if(!Number.isSafeInteger(line) || !Number.isSafeInteger(column) || line<1 || line>lines.length || column<1 || column>lines[line-1]!.length+1) throw new Error("invalid mutation location");
  return lines.slice(0,line-1).reduce((sum,text)=>sum+text.length+1,0)+column-1;
}
export function requireMutationReport(report: unknown, sources: Readonly<Record<string,string>>, status: number | null): MutationSummary {
  if(status!==0) throw new Error("Stryker process failed or did not complete");
  const root=object(report);
  if(root.schemaVersion!=="1") throw new Error("unsupported mutation report schema");
  const files=object(root.files), expected=Object.keys(sources).sort();
  if(expected.length===0 || JSON.stringify(Object.keys(files).sort())!==JSON.stringify(expected)) throw new Error("mutation inventory differs");
  let detected=0,undetected=0,invalid=0; const ids=new Set<string>();
  for(const path of expected) {
    const file=object(files[path]), source=sources[path]!;
    if(file.source!==source || file.language!=="typescript") throw new Error("mutation source differs: "+path);
    if(!Array.isArray(file.mutants) || file.mutants.length===0) throw new Error("empty mutation population: "+path);
    for(const value of file.mutants) {
      const mutant=object(value);
      if(typeof mutant.id!=="string" || !mutant.id || ids.has(mutant.id)) throw new Error("invalid mutation identity");
      ids.add(mutant.id);
      if(typeof mutant.mutatorName!=="string" || !mutant.mutatorName || typeof mutant.replacement!=="string") throw new Error("invalid mutation report metadata");
      const location=object(mutant.location);
      if(offset(location.start,source)>=offset(location.end,source)) throw new Error("invalid mutation location range");
      switch(mutant.status) {
        case "Killed": case "Timeout": detected++; break;
        case "Survived": case "NoCoverage": undetected++; break;
        case "CompileError": case "RuntimeError": invalid++; break;
        default: throw new Error("incomplete or excluded mutation status");
      }
    }
  }
  if(detected+undetected===0) throw new Error("no valid mutation population");
  if(detected*100<(detected+undetected)*80) throw new Error("mutation score below required 80% floor");
  return {detected,undetected,invalid,total:ids.size,score:detected*100/(detected+undetected)};
}
