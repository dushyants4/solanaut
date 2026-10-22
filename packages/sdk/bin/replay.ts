// Recompute every decision of a guard's record from its bytes, under a policy, and print the first
// that differs (ADR-010). Under the policy the record was written with, a sound record replays
// exactly; under another, this shows where that policy would have decided differently.
//
//   npm run replay -- <record.jsonl> <policy.json>
//
// The policy file is policy v1 as JSON, with amounts as decimal strings. Exit 0 if the record
// replays, 1 if it diverges, 2 if it cannot be read.

import { constants, openSync, closeSync, fstatSync, lstatSync, readSync } from "node:fs";
import { streamArchive } from "../src/archive.ts";
import { replayStream } from "../src/guard.ts";
import type { PolicyTrust } from "../src/signed-policy.ts";

function publicJSON(path: string): unknown {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd, { bigint: true }),
      limit = 1_048_576;
    if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(limit)) throw new Error("source");
    const buffer = Buffer.alloc(limit + 1);
    let bytes = 0,
      count: number;
    while (bytes < buffer.length && (count = readSync(fd, buffer, bytes, buffer.length - bytes, null)) > 0)
      bytes += count;
    const after = fstatSync(fd, { bigint: true }),
      named = lstatSync(path, { bigint: true });
    if (
      bytes > limit ||
      BigInt(bytes) !== before.size ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      after.nlink !== 1n ||
      !named.isFile() ||
      named.nlink !== 1n ||
      named.ino !== before.ino ||
      named.dev !== before.dev ||
      named.size !== before.size ||
      named.mtimeNs !== before.mtimeNs ||
      named.ctimeNs !== before.ctimeNs
    )
      throw new Error("source");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytes)));
  } finally {
    closeSync(fd);
  }
}
function publicTrust(input: unknown): PolicyTrust {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("trust");
  const value = input as Record<string, unknown>,
    keys = Object.keys(value);
  if (
    keys.length !== 3 ||
    keys.some(
      (key) => !["operatorKey", "guardId", "cluster"].includes(key) || typeof value[key] !== "string" || !value[key],
    )
  )
    throw new Error("trust");
  return {
    operatorKey: value.operatorKey as string,
    guardId: value.guardId as string,
    cluster: value.cluster as string,
  };
}

const [recordPath, policyPath, trustPath, ...extra] = process.argv.slice(2);
if (!recordPath || !policyPath || extra.length > 0) {
  console.error("usage: npm run replay -- <record.jsonl> <policy.json|-> [public-trust.json]");
  process.exit(2);
}

let policy: unknown;
let trust: PolicyTrust | undefined;
try {
  if (process.platform !== "linux") throw new Error("source");
  policy = policyPath === "-" ? undefined : publicJSON(policyPath);
  trust = trustPath ? publicTrust(publicJSON(trustPath)) : undefined;
} catch {
  console.error("replay: public policy or trust input could not be read safely");
  process.exit(2);
}

let entries = 0;
const open = async function* () {
  let count = 0;
  for await (const entry of streamArchive(recordPath)) {
    count++;
    yield entry;
  }
  entries = count;
};
const res = await replayStream(open, policy, undefined, trust).catch(() => {
  console.error("replay: history verification could not complete; check the source, policy and public trust pins");
  process.exit(2);
});
if (res.ok) {
  console.log(`replays: ${entries} entries, ${res.decisions} decisions recomputed, no divergence`);
  process.exit(0);
}
const d = res.divergence!;
console.log(`diverges at seq ${d.seq}, field ${d.field}`);
console.log("  recorded: [redacted]");
console.log("  recomputed: [redacted]");
process.exit(1);
