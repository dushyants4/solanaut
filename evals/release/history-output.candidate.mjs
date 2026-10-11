// Proposed companion correction only; the maintained runner remains unchanged.
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inventoryHistory } from "../ci/history.ts";
import { verifyHistoryBytes } from "./history-bytes.mjs";

if (process.argv.length !== 4) throw new Error("usage: node evals/release/history-bytes-run.mjs <workspace-repository> <fresh-output-directory>");
const root = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const repository = realpathSync(resolve(process.argv[2]));
const output = resolve(process.argv[3]);
if (!repository.startsWith(root + sep) || !output.startsWith(root + sep)) throw new Error("history evidence paths must be within this workspace");
if (realpathSync(dirname(output)) !== dirname(output)) throw new Error("output parent must not redirect");
const sources = ["evals/ci/history.ts", "evals/release/history-bytes.mjs", "evals/release/history-output.candidate.mjs", "evals/release/history-output.test.mjs"];
const inputs = () => Object.fromEntries(sources.map(path => [path, createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex")]));
const before = inputs();
const inventory = inventoryHistory(repository);
mkdirSync(output);
writeFileSync(resolve(output, "inventory.json"), JSON.stringify(inventory, null, 2) + "\n", { flag: "wx" });
writeFileSync(resolve(output, "inputs.json"), JSON.stringify({ measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, repository, sourceHashes: before }, null, 2) + "\n", { flag: "wx" });
let receipt;
try { receipt = verifyHistoryBytes(repository, inventory); }
catch (error) {
  const sensitive = error.message === "sensitive historical path requires human review before content reads";
  const refusal = { revision: inventory.head, inventoryDigest: inventory.digest, complete: false, clearance: false, reason: sensitive ? "sensitive-path-review-required" : "verification-failed", ...(sensitive ? { contentRead: false } : {}) };
  writeFileSync(resolve(output, "refusal.json"), JSON.stringify(refusal, null, 2) + "\n", { flag: "wx" });
  console.error(JSON.stringify(refusal)); process.exitCode = 1;
}
if (JSON.stringify(inputs()) !== JSON.stringify(before)) throw new Error("history checker sources changed during evaluation");
if (!receipt) process.exit(1);
writeFileSync(resolve(output, "contents.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ revision: receipt.revision, inventoryDigest: receipt.inventoryDigest, contentDigest: receipt.contentDigest, blobs: receipt.blobs, bytes: receipt.bytes, skipped: receipt.skipped, clearance: false }));
