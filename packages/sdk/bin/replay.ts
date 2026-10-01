// Recompute every decision of a guard's record from its bytes, under a policy, and print the first
// that differs (ADR-010). Under the policy the record was written with, a sound record replays
// exactly; under another, this shows where that policy would have decided differently.
//
//   npm run replay -- <record.jsonl> <policy.json>
//
// The policy file is policy v1 as JSON, with amounts as decimal strings. Exit 0 if the record
// replays, 1 if it diverges, 2 if it cannot be read.

import { readFileSync } from "node:fs";
import { replay } from "../src/guard.ts";
import type { Entry } from "../src/log.ts";

const [recordPath, policyPath] = process.argv.slice(2);
if (!recordPath || !policyPath) {
  console.error("usage: npm run replay -- <record.jsonl> <policy.json>");
  process.exit(2);
}

let entries: Entry[];
let policy: unknown;
try {
  entries = readFileSync(recordPath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Entry);
  policy = JSON.parse(readFileSync(policyPath, "utf8"));
} catch (e) {
  console.error(`replay: ${(e as Error).message}`);
  process.exit(2);
}

const res = await replay(entries, policy);
if (res.ok) {
  console.log(`replays: ${entries.length} entries, ${res.decisions} decisions recomputed, no divergence`);
  process.exit(0);
}
const d = res.divergence!;
console.log(`diverges at seq ${d.seq}, field ${d.field}`);
console.log(`  recorded:   ${JSON.stringify(d.recorded)}`);
console.log(`  recomputed: ${JSON.stringify(d.recomputed)}`);
process.exit(1);
