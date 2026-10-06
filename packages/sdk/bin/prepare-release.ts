// Stage a private npm candidate. Development continues to consume native TypeScript.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const stage = join(root, ".sandbox/releases/sdk");
if (process.argv.length !== 2) {
  console.error("usage: npm run release:prepare");
  process.exit(2);
}
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
const build = spawnSync(join(root, "node_modules/.bin/tsc"), [
  "-p", join(root, "packages/sdk/tsconfig.release.json"), "--outDir", join(stage, "dist"),
], { stdio: "inherit" });
if (build.status !== 0) {
  console.error(build.error?.message ?? "release compilation failed");
  process.exit(build.status ?? 1);
}
const source = JSON.parse(readFileSync(join(root, "packages/sdk/package.json"), "utf8"));
const manifest = {
  name: source.name, version: source.version, private: true, type: "module",
  description: source.description, engines: { node: ">=22.18.0" },
  exports: { ".": { types: "./dist/src/index.d.ts", import: "./dist/src/index.js" } },
  types: "./dist/src/index.d.ts", files: ["dist"],
  bin: { "solanaut-replay": "./dist/bin/replay.js", "solanaut-pin-table": "./dist/bin/pin-table.js", "solanaut-verify-archive": "./dist/bin/verify-archive.js" },
  dependencies: source.dependencies,
};
writeFileSync(join(stage, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
for (const name of ["replay", "pin-table", "verify-archive"]) {
  const path = join(stage, "dist/bin", name + ".js");
  writeFileSync(path, "#!/usr/bin/env node\n" + readFileSync(path, "utf8"));
  chmodSync(path, 0o755);
}
console.log("Private SDK candidate staged in .sandbox/releases/sdk");
