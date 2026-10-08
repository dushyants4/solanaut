import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const CAMPAIGNS = ["ci/bite-faults.ts", "ci/bite-partitions-faults.ts", "ci/ordinary-serial-faults.ts", "ci/dependency-faults.ts", "ci/latch-faults.ts", "ci/property-faults.ts", "ci/fuzz-faults.ts", "ci/cap-faults.ts", "ci/coverage-faults.ts", "ci/coverage-options-faults.ts", "ci/mutation-faults.ts", "ci/mutation-recovery-faults.ts", "ci/run-completion-faults.ts", "ci/run-supervisor-faults.ts", "ci/performance-faults.ts", "ci/differential-faults.ts", "ci/traffic-faults.ts", "ci/replay-faults.ts", "ci/concurrency-faults.ts", "ci/kill-faults.ts", "ci/history-faults.ts", "packaging/faults.ts", "sdk/checkpoint-faults.ts", "sdk/checkpoint-archives-faults.ts", "sdk/checkpoint-prefix-faults.ts", "sdk/checkpoint-state-faults.ts", "sdk/checkpoint-bundle-faults.ts", "sdk/checkpoint-envelope-faults.ts", "sdk/checkpoint-publication-faults.ts", "sdk/checkpoint-recovery-faults.ts", "sdk/checkpoint-owned-recovery-faults.ts", "sdk/malformed-replay-faults.ts", "sdk/report-replay-faults.ts", "sdk/redeem-replay-faults.ts", "sdk/request-index-faults.ts", "sdk/archive-cli-faults.ts", "sdk/archive-faults.ts", "sdk/archive-stream-faults.ts", "sdk/replay-stream-faults.ts", "sdk/record-loading-faults.ts", "sdk/archive-anchor-faults.ts", "sdk/archive-anchor-cli-faults.ts", "sdk/prepare-policy-faults.ts", "sdk/policy-signature-faults.ts", "sdk/control-request-faults.ts", "sdk/ownership-faults.ts", "sdk/request-faults.ts", "sdk/sending-client-faults.ts", "sdk/signing-faults.ts", "signer/authority-faults.ts", "signer/core-faults.ts", "signer/handler-faults.ts", "signer/policy-recovery-faults.ts", "signer/recovery-faults.ts", "signer/rpc-faults.ts", "signer/service-faults.ts", "signer/socket-faults.ts", "sdk/request-index-publication-faults.ts", "ci/mutation-stop-faults.ts"] as const;
// Recovery is maintained alongside the mutation report gate.
export function validateInventory(paths: readonly string[]): void {
  if (JSON.stringify([...paths].sort()) !== JSON.stringify([...CAMPAIGNS].sort())) throw new Error("fault campaign inventory differs from the maintained list");
}
export function selectCampaigns(args:readonly string[]):readonly string[]{
  if(args.length===0)return [...CAMPAIGNS];
  if(args.length!==2 || args[0]!=="--partition" || !/^[123]$/.test(args[1]!))throw new Error("invalid fault partition arguments");
  const index=Number(args[1])-1,start=Math.floor(CAMPAIGNS.length*index/3),end=Math.floor(CAMPAIGNS.length*(index+1)/3);
  return CAMPAIGNS.slice(start,end);
}
export function executeCampaigns(run: (path: string) => number | null, fingerprint: () => string,args:readonly string[]=[]): { ok: boolean; failed: string[]; skipped: string[] } {
  const campaigns=selectCampaigns(args);
  const original = fingerprint(); const failed: string[] = []; let skipped: string[] = [];
  for (const [index, path] of campaigns.entries()) {
    let result: number | null = null;
    try { result = run(path); } catch { result = null; }
    if (result !== 0) failed.push(path);
    if (fingerprint() !== original) {
      if (!failed.includes(path)) failed.push(path);
      skipped = campaigns.slice(index + 1); break;
    }
  }
  return { ok: failed.length === 0 && skipped.length === 0, failed, skipped };
}
export function sourceFingerprint(directory = "."): string {
  const hash = createHash("sha256");
  for (const root of ["packages", "apps", "evals", "tools"]) for (const path of (readdirSync(join(directory,root), { recursive: true }) as string[]).filter((path) => (root === "evals" || root === "tools" || path.includes("/src/")) && path.endsWith(".ts")).sort()) {
    hash.update(root + "/" + path + "\0"); hash.update(readFileSync(join(directory,root,path)));
  }
  for(const path of (readdirSync(join(directory,".github/workflows")) as string[]).filter(path=>/\.ya?ml$/.test(path)).sort()){
    hash.update(".github/workflows/"+path+"\0");hash.update(readFileSync(join(directory,".github/workflows",path)));
  }
  return hash.digest("hex");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateInventory((readdirSync("evals", { recursive: true }) as string[]).filter((path) => /(?:^|\/|-)faults\.ts$/.test(path)));
  const result = executeCampaigns((path) => {
    console.log(`Running fault campaign: ${path}`);
    const run = spawnSync(process.execPath, ["evals/" + path], { stdio: "inherit", timeout: 300_000 });
    return run.status;
  }, sourceFingerprint,process.argv.slice(2));
  console.log(JSON.stringify(result)); process.exitCode = result.ok ? 0 : 1;
}
