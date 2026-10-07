// PUB-1: prepare review evidence; no visibility change, rewrite or clearance decision.
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inventoryHistory } from "./history.ts";
if (process.argv.length !== 2 && !(process.argv.length === 4 && process.argv[2] === "--repository")) throw new Error("usage: node evals/ci/history-run.ts [--repository <workspace repository>]");
const root = fileURLToPath(new URL("../../", import.meta.url));
const repository = realpathSync(resolve(root, process.argv[3] ?? "."));
const workspace = realpathSync(root);
if (repository !== workspace && !repository.startsWith(workspace + sep)) throw new Error("history repository must be within this workspace");
const inventory = inventoryHistory(repository);
const directory = join(root, "evals/ci/history"); mkdirSync(directory, { recursive: true });
const name = `inventory-${inventory.head.slice(0, 7)}-${inventory.digest.slice(0, 12)}-${Date.now()}.json`;
writeFileSync(join(directory, name), JSON.stringify(inventory, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({
  revision: inventory.head, manifest: "evals/ci/history/" + name, digest: inventory.digest,
  refs: inventory.refs.length, commits: inventory.commits.length, blobs: inventory.blobs.length,
  uniquePaths: new Set([...inventory.blobs, ...inventory.gitlinks].flatMap(b => b.paths)).size,
  gitlinks: inventory.gitlinks.length,
  scope: "all local refs and current HEAD; reachable Git history only",
  exclusions: ["reflogs and unreachable objects", "uncommitted files", "gitlink target repositories"],
  clearance: false,
}));
