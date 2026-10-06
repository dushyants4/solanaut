import type { CoverageFile } from "./coverage.ts";
import type { RawCoverage } from "./coverage-instrument.ts";
import { createRequire } from "node:module";
const {createCoverageMap}=createRequire(import.meta.url)("istanbul-lib-coverage") as {createCoverageMap(value:unknown):{merge(value:unknown):void;fileCoverageFor(path:string):{toSummary():{statements:{covered:number;total:number};branches:{covered:number;total:number}}}}};
const keys=(value:object)=>JSON.stringify(Object.keys(value).sort());
const counter=(value:unknown)=>typeof value==="number" && Number.isSafeInteger(value) && value>=0;
export function summarizeCoverage(baselines: readonly RawCoverage[], reports: readonly unknown[]): CoverageFile[] {
  if(reports.length===0 || new Set(baselines.map(file=>file.path)).size!==baselines.length) throw new Error("missing or duplicate coverage evidence");
  const expected=new Map(baselines.map(file=>[file.path,file]));
  const map=createCoverageMap(Object.fromEntries(expected));
  for(const report of reports) {
    if(!report || typeof report!=="object" || Array.isArray(report)) throw new Error("invalid coverage report");
    for(const [path,value] of Object.entries(report)) {
      const template=expected.get(path), file=value as RawCoverage;
      if(!template || !file || file.path!==path || !file.s || !file.b || keys(file.s)!==keys(template.s) || keys(file.b)!==keys(template.b) || JSON.stringify(file.statementMap)!==JSON.stringify(template.statementMap) || JSON.stringify(file.branchMap)!==JSON.stringify(template.branchMap)) throw new Error("coverage source or counter maps differ");
      if(Object.values(file.s).some(value=>!counter(value)) || Object.entries(file.b).some(([key,values])=>!Array.isArray(values) || values.length!==template.b[key]!.length || values.some(value=>!counter(value)))) throw new Error("invalid coverage counters");
    }
    map.merge(report);
  }
  return baselines.map(file=> {
    const summary=map.fileCoverageFor(file.path).toSummary();
    return {path:file.path,statements:{covered:summary.statements.covered,total:summary.statements.total},branches:{covered:summary.branches.covered,total:summary.branches.total}};
  });
}
