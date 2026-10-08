// Explicit test-only instrumentation; no product build or installed-package loader.
import { registerHooks } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { threadId } from "node:worker_threads";
import { instrumentSource, type RawCoverage } from "./coverage-instrument.ts";
const root=fileURLToPath(new URL("../../",import.meta.url)), directory=process.env.SOLANAUT_COVERAGE_DIR;
if(!directory) throw new Error("coverage collector requires an explicit output directory");
registerHooks({load(url,context,nextLoad) {
  const loaded=nextLoad(url,context);
  if(!url.startsWith("file:")) return loaded;
  const path=fileURLToPath(url), name=relative(root,path);
  if(!/^(packages\/sdk|apps\/(?:signer|firewall))\/src\/.+\.ts$/.test(name)) return loaded;
  return {...loaded,format:"module",source:instrumentSource(readFileSync(path,"utf8"),name).code};
}});
process.on("exit",()=> {
  const coverage=(globalThis as typeof globalThis & {__solanautCoverage?:Record<string,RawCoverage>}).__solanautCoverage ?? {};
  writeFileSync(join(directory,`${process.pid}-${threadId}.json`),JSON.stringify(coverage)+"\n");
});
