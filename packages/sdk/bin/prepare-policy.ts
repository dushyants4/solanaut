// Prepares a policy's public signing text, and nothing more: no key, no signature, no RPC, and no
// policy installed (POL-1, POL-5).
import { constants, openSync, closeSync, fstatSync, readSync } from "node:fs";
import { createPolicy } from "../src/policy.ts";
import { preparePolicyText } from "../src/signed-policy.ts";
const usage = "usage: solanaut-prepare-policy <policy.json> --version <positive integer> --issued <UTC ISO timestamp>";
function argumentsOf(args: string[]): { path: string; version: number; issued: string } {
  const [path, ...flags] = args;
  if (!path || path.startsWith("--") || flags.length !== 4) throw new Error("usage");
  const values = new Map<string, string>();
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index]!,
      value = flags[index + 1]!;
    if (!["--version", "--issued"].includes(flag) || values.has(flag)) throw new Error("usage");
    values.set(flag, value);
  }
  const version = values.get("--version")!,
    issued = values.get("--issued")!;
  if (
    !/^[1-9][0-9]*$/.test(version) ||
    !Number.isSafeInteger(Number(version)) ||
    !Number.isFinite(Date.parse(issued)) ||
    new Date(issued).toISOString() !== issued
  )
    throw new Error("usage");
  return { path, version: Number(version), issued };
}
function source(path: string): string {
  const handle = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(handle, { bigint: true }),
      limit = 1_048_576;
    if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(limit)) throw new Error("source");
    const buffer = Buffer.alloc(limit + 1);
    let bytes = 0,
      count: number;
    while (bytes < buffer.length && (count = readSync(handle, buffer, bytes, buffer.length - bytes, null)) > 0)
      bytes += count;
    const after = fstatSync(handle, { bigint: true });
    if (
      bytes > limit ||
      BigInt(bytes) !== before.size ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      after.nlink !== 1n
    )
      throw new Error("source");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytes));
  } finally {
    closeSync(handle);
  }
}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  console.log(usage);
  process.exit(0);
}
let options: ReturnType<typeof argumentsOf>;
try {
  options = argumentsOf(args);
} catch {
  console.error(JSON.stringify({ error: { code: "usage", message: usage } }));
  process.exit(2);
}
let content: string;
try {
  content = source(options.path);
} catch {
  console.error(JSON.stringify({ error: { code: "source", message: "policy source could not be read safely" } }));
  process.exit(1);
}
try {
  const { policy, hash } = createPolicy(JSON.parse(content));
  if (policy.latch.cluster !== "devnet" && policy.latch.cluster !== "localnet") throw new Error("cluster");
  const text = preparePolicyText(policy, options.version, options.issued);
  console.log(
    JSON.stringify({
      guardId: policy.latch.guardId,
      cluster: policy.latch.cluster,
      operatorKey: policy.latch.releaseKey,
      version: options.version,
      issued: options.issued,
      policyHash: hash,
      text,
    }),
  );
} catch {
  console.error(JSON.stringify({ error: { code: "policy", message: "policy is invalid or unsupported" } }));
  process.exit(1);
}
