import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const CAMPAIGNS = ["ci/bite-faults.ts", "ci/latch-faults.ts", "ci/property-faults.ts", "ci/fuzz-faults.ts", "ci/cap-faults.ts", "ci/replay-faults.ts", "ci/concurrency-faults.ts", "ci/kill-faults.ts", "packaging/faults.ts", "sdk/control-request-faults.ts", "sdk/ownership-faults.ts", "sdk/request-faults.ts", "sdk/sending-client-faults.ts", "sdk/signing-faults.ts", "signer/authority-faults.ts", "signer/core-faults.ts", "signer/handler-faults.ts", "signer/policy-recovery-faults.ts", "signer/recovery-faults.ts", "signer/rpc-faults.ts", "signer/service-faults.ts", "signer/socket-faults.ts"] as const;
export function validateInventory(paths: readonly string[]): void {
  if (JSON.stringify([...paths].sort()) !== JSON.stringify([...CAMPAIGNS].sort())) throw new Error("fault campaign inventory differs from the maintained list");
}
export function executeCampaigns(run: (path: string) => number | null, fingerprint: () => string): { ok: boolean; failed: string[]; skipped: string[] } {
  const original = fingerprint(); const failed: string[] = []; let skipped: string[] = [];
  for (const [index, path] of CAMPAIGNS.entries()) {
    let result: number | null = null;
    try { result = run(path); } catch { result = null; }
    if (result !== 0) failed.push(path);
    if (fingerprint() !== original) {
      if (!failed.includes(path)) failed.push(path);
      skipped = CAMPAIGNS.slice(index + 1); break;
    }
  }
  return { ok: failed.length === 0 && skipped.length === 0, failed, skipped };
}
function sourceFingerprint(): string {
  const hash = createHash("sha256");
  for (const root of ["packages", "apps", "evals"]) for (const path of (readdirSync(root, { recursive: true }) as string[]).filter((path) => (root === "evals" || path.includes("/src/")) && path.endsWith(".ts")).sort()) {
    hash.update(root + "/" + path + "\0"); hash.update(readFileSync(root + "/" + path));
  }
  return hash.digest("hex");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateInventory((readdirSync("evals", { recursive: true }) as string[]).filter((path) => /(?:^|\/|-)faults\.ts$/.test(path)));
  const result = executeCampaigns((path) => {
    console.log(`Running fault campaign: ${path}`);
    const run = spawnSync(process.execPath, ["evals/" + path], { stdio: "inherit", timeout: 300_000 });
    return run.status;
  }, sourceFingerprint);
  console.log(JSON.stringify(result)); process.exitCode = result.ok ? 0 : 1;
}
