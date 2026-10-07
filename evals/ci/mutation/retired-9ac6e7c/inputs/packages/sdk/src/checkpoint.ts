// ADR-019: authenticate opaque checkpoint bindings; this does not load or validate state.
import { EVALUATION_PROFILE } from "./profile.ts";
import { canonicalJSON } from "./canonical.ts";
import { isAddress } from "./base58.ts";
import { verifyEd25519 } from "./latch.ts";
export interface CheckpointBinding {
  format: 1; checkpointKey: string; guardId: string; cluster: "localnet" | "devnet";
  /** Next record sequence; head is the preceding entry's hash, or empty at genesis. */
  seq: number; head: string; policyVersion: number; policyHash: string;
  profile: typeof EVALUATION_PROFILE;
  archiveDigest: string; stateDigest: string; prefixDigest: string;
}
export interface CheckpointTrust { checkpointKey: string; principalKeys: readonly string[]; anchorKey: string; guardId: string; cluster: "localnet" | "devnet" }
export interface CheckpointSignatures { snapshot: string; prefix: string }
export interface CheckpointDigests { archiveDigest: string; stateDigest: string; prefixDigest: string }
export class CheckpointBindingError extends Error {
  readonly code = "checkpoint-binding";
  constructor(message: string) { super(message); this.name = "CheckpointBindingError"; }
}
const DIGEST = /^[0-9a-f]{64}$/;
const GUARD = /^[\x20-\x7e]{1,64}$/;
const BINDING_FIELDS = ["format", "checkpointKey", "guardId", "cluster", "seq", "head", "policyVersion", "policyHash", "profile", "archiveDigest", "stateDigest", "prefixDigest"];
function object(input: unknown, fields: readonly string[]): Record<string, unknown> {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).sort().join(",") !== [...fields].sort().join(",")) throw new Error("shape");
    const copy = JSON.parse(canonicalJSON(input));
    if (Object.keys(copy).sort().join(",") !== [...fields].sort().join(",")) throw new Error("shape");
    return copy;
  } catch { throw new CheckpointBindingError("checkpoint data has invalid JSON fields"); }
}
function publicKey(value: unknown): value is string {
  return typeof value === "string" && isAddress(value);
}
const cluster = (value: unknown) => value === "localnet" || value === "devnet";
const digest = (value: unknown) => typeof value === "string" && DIGEST.test(value);
function binding(input: unknown): CheckpointBinding {
  const b = object(input, BINDING_FIELDS);
  if (b.format !== 1 || !publicKey(b.checkpointKey) || typeof b.guardId !== "string" || !GUARD.test(b.guardId) || !cluster(b.cluster)) throw new CheckpointBindingError("checkpoint format or identity is unsupported");
  if (!Number.isSafeInteger(b.seq) || (b.seq as number) < 0 || !Number.isSafeInteger(b.policyVersion) || (b.policyVersion as number) <= 0) throw new CheckpointBindingError("checkpoint sequence or policy version is invalid");
  if (b.seq === 0 ? b.head !== "" : !digest(b.head)) throw new CheckpointBindingError("checkpoint head does not match sequence shape");
  if (![b.policyHash, b.archiveDigest, b.stateDigest, b.prefixDigest].every(digest)) throw new CheckpointBindingError("checkpoint digest is invalid");
  if (canonicalJSON(b.profile) !== canonicalJSON(EVALUATION_PROFILE)) throw new CheckpointBindingError("unsupported checkpoint evaluation profile");
  return b as unknown as CheckpointBinding;
}
export function prepareCheckpointText(input: unknown): string { return "solanaut checkpoint\n" + canonicalJSON(binding(input)); }
export function prepareCheckpointPrefixText(input: unknown): string { return "solanaut checkpoint keel prefix\n" + canonicalJSON(binding(input)); }
function signature(key: string, text: string, value: unknown): boolean {
  if (typeof value !== "string") return false;
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value && verifyEd25519(key, Buffer.from(text), bytes);
}
export function verifyCheckpointBinding(input: unknown, signatures: CheckpointSignatures, trust: CheckpointTrust, digests: CheckpointDigests): Readonly<CheckpointBinding> {
  // Capture external trust and observed digests before evaluating caller-owned metadata.
  const t = object(trust, ["checkpointKey", "principalKeys", "anchorKey", "guardId", "cluster"]);
  const observed = object(digests, ["archiveDigest", "stateDigest", "prefixDigest"]);
  if (!publicKey(t.checkpointKey) || !publicKey(t.anchorKey) || !Array.isArray(t.principalKeys) || !t.principalKeys.length || !t.principalKeys.every(publicKey) || typeof t.guardId !== "string" || !GUARD.test(t.guardId) || !cluster(t.cluster)) throw new CheckpointBindingError("invalid external checkpoint trust");
  if (t.checkpointKey === t.anchorKey || t.principalKeys.includes(t.checkpointKey)) throw new CheckpointBindingError("checkpoint key must be distinct from principal and anchor");
  if (!Object.values(observed).every(digest)) throw new CheckpointBindingError("invalid observed checkpoint digests");
  const b = binding(input);
  if (b.checkpointKey !== t.checkpointKey || b.guardId !== t.guardId || b.cluster !== t.cluster) throw new CheckpointBindingError("checkpoint differs from external identity pin");
  if (b.archiveDigest !== observed.archiveDigest || b.stateDigest !== observed.stateDigest || b.prefixDigest !== observed.prefixDigest) throw new CheckpointBindingError("checkpoint payload digest differs");
  const a = object(signatures, ["snapshot", "prefix"]);
  if (!signature(t.checkpointKey, prepareCheckpointText(b), a.snapshot) || !signature(t.checkpointKey, prepareCheckpointPrefixText(b), a.prefix)) throw new CheckpointBindingError("checkpoint signatures do not verify");
  return Object.freeze({ ...b, profile: EVALUATION_PROFILE });
}
