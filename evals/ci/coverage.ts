export interface CoverageCounts { covered: number; total: number }
export interface CoverageFile { path: string; statements: CoverageCounts; branches: CoverageCounts }
export function requireTestProcess(status: number | null): void { if(status!==0) throw new Error("coverage test process failed or did not complete"); }
const critical = new Set(["guard.ts","state.ts","classify.ts","message.ts","policy.ts","record.ts","latch.ts","signed-policy.ts","request.ts","control-request.ts","signing.ts","checkpoint.ts","checkpoint-archives.ts","adapters/sending-client.ts"]);
function counts(value: CoverageCounts): void {
  if (!value || !Number.isSafeInteger(value.covered) || !Number.isSafeInteger(value.total) || value.covered<0 || value.covered>value.total || value.total>10_000_000) throw new Error("invalid coverage counts");
}
const passes = (value: CoverageCounts, floor: number) => value.total===0 || value.covered*100>=value.total*floor;
export function requireCoverage(files: readonly CoverageFile[], inventory: readonly string[]): void {
  const paths=files.map(file=>file.path);
  if (new Set(inventory).size!==inventory.length || new Set(paths).size!==paths.length || JSON.stringify([...paths].sort())!==JSON.stringify([...inventory].sort()) || inventory.some(path=>! /^(packages\/sdk|apps\/signer)\/src\/[^\s]+\.ts$/.test(path))) throw new Error("coverage inventory differs");
  const failures: string[]=[];
  for(const file of files) {
    counts(file.statements); counts(file.branches);
    if ((file.path.startsWith("apps/signer/src/") || critical.has(file.path.slice("packages/sdk/src/".length))) && !passes(file.branches,85)) failures.push(`${file.path}: branch coverage below critical floor`);
  }
  for(const root of ["packages/sdk/src/","apps/signer/src/"]) {
    const totals={statements:{covered:0,total:0},branches:{covered:0,total:0}};
    for(const file of files.filter(file=>file.path.startsWith(root))) for(const metric of ["statements","branches"] as const) {
      totals[metric].covered+=file[metric].covered; totals[metric].total+=file[metric].total;
    }
    if(totals.statements.total===0 || !passes(totals.statements,95)) failures.push(`${root}: statement coverage below floor or no executable statements`);
    if(!passes(totals.branches,90)) failures.push(`${root}: branch coverage below floor`);
  }
  if(failures.length) throw new Error(failures.join("\n"));
}
