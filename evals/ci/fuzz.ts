import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { propertySeed } from "./properties.ts";
export type FuzzRun = (runs: number, seed: number) => { status: number | null; output: string };
function execute(runs: number, seed: number) {
  const result = spawnSync(process.execPath, ["--test", "--test-name-pattern=^fuzz:", "packages/sdk/test/decode.test.ts"], {
    env: { ...process.env, FUZZ_RUNS: String(runs), FUZZ_SEED: String(seed) }, encoding: "utf8", timeout: 600_000, maxBuffer: 4 * 1024 * 1024,
  });
  const output = result.stdout + result.stderr;
  process.stdout.write(output);
  return { status: result.status, output };
}
export function runFuzz(run: FuzzRun = execute, runs = 1_000_000): void {
  if (!Number.isSafeInteger(runs) || runs < 1_000_000) throw new Error("fuzz input budget below required floor");
  const seed = propertySeed(process.env.SOLANAUT_FUZZ_SEED);
  console.log(`fuzz starting: seed=${seed}; requested=${runs}`);
  const result = run(runs, seed);
  if (result.status !== 0) throw new Error("fuzz process failed or interrupted");
  const summaries = [...result.output.matchAll(/fuzz: (\d+) inputs, (\d+) accepted and matched kit, (\d+) refused with a named rule/g)];
  if (summaries.length !== 1) throw new Error("fuzz completion evidence missing or duplicated");
  const [total, accepted, refused] = summaries[0]!.slice(1).map(Number) as [number, number, number];
  if (total !== runs || accepted + refused !== runs || accepted <= 0 || refused <= 0) throw new Error("fuzz completion totals incomplete");
  console.log(`fuzz completed: seed=${seed}; inputs=${total}; accepted=${accepted}; refused=${refused}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runFuzz();
