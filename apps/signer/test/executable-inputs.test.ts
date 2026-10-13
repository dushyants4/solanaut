// SIG-1/2/8/10: native CLI refuses unsafe public configuration before any key or RPC access.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
const main = "apps/signer/src/main.ts";
function run(args: string[]) { return spawnSync(process.execPath, [...process.execArgv.filter(arg => !arg.startsWith("--test")), main, ...args], { encoding: "utf8", timeout: 5000, env: { ...process.env, NODE_NO_WARNINGS: "1" } }); }
test("SIG-2/10: help is explicit and missing same-user or configuration arguments are usage errors", () => {
  const help = run(["--help"]); assert.equal(help.status, 0); assert.match(help.stdout, /--same-user.*--config/); assert.equal(help.stderr, "");
  for (const args of [[], ["--config", "/public.json"], ["--same-user"], ["--same-user", "--config"], ["--same-user", "--config", "/public.json", "--unknown"]]) {
    const result = run(args); assert.equal(result.status, 2); assert.equal(result.stdout, ""); assert.match(result.stderr, /^usage:/);
  }
});
test("SIG-1/8: unsafe, malformed and wrong-cluster public configs refuse with fixed diagnostics", () => {
  const directory = mkdtempSync(join(tmpdir(), "solanaut-cli-public-")); chmodSync(directory, 0o700);
  const path = join(directory, "config.json");
  for (const content of ["PRIVATE_CONFIGURATION_182981", '{}', '{"cluster":"mainnet-beta"}', '{"cluster":"devnet","private":"PRIVATE_CONFIGURATION_182981"}']) {
    writeFileSync(path, content, { mode: 0o600 });
    const result = run(["--same-user", "--config", path]);
    assert.equal(result.status, 1); assert.equal(result.stdout, ""); assert.equal(result.stderr, "signer startup refused\n");
  }
  chmodSync(path, 0o644);
  const result = run(["--same-user", "--config", path]); assert.equal(result.status, 1); assert.equal(result.stderr, "signer startup refused\n");
});
