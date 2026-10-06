export interface RawCoverage { path: string; s: Record<string, number>; b: Record<string, number[]>; statementMap: Record<string, unknown>; branchMap: Record<string, { locations: unknown[] }> }
import { createRequire, stripTypeScriptTypes } from "node:module";
const { createInstrumenter } = createRequire(import.meta.url)("istanbul-lib-instrument") as { createInstrumenter(options: Record<string, unknown>): { instrumentSync(source: string,path:string): string; lastFileCoverage(): RawCoverage } };
export function instrumentSource(source: string, path: string): { code: string; baseline: RawCoverage } {
  const instrumenter=createInstrumenter({esModules:true,coverageVariable:"__solanautCoverage",coverageGlobalScope:"globalThis",coverageGlobalScopeFunc:false,compact:false,produceSourceMap:false});
  const code=instrumenter.instrumentSync(stripTypeScriptTypes(source,{mode:"strip",sourceUrl:path}),path);
  return {code,baseline:instrumenter.lastFileCoverage()};
}
