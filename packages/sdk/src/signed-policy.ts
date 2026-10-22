// A policy the operator signs: both its canonical content and a readable summary derived from it
// (ADR-014, ADR-019).
import { canonicalJSON } from "./canonical.ts";
import { createPolicy, type Policy } from "./policy.ts";
import { verifyEd25519 } from "./latch.ts";
import { EVALUATION_PROFILE } from "./profile.ts";
import type { PolicyEntry } from "./log.ts";
export interface PolicyTrust {
  operatorKey: string;
  guardId: string;
  cluster: string;
}
export interface PolicyAuthorization extends PolicyTrust {
  version: number;
  issued: string;
  text: string;
  signature: string;
}
export class PolicyAuthorizationError extends Error {
  readonly code = "policy-authorization";
  constructor(message: string) {
    super(message);
    this.name = "PolicyAuthorizationError";
  }
}
function duration(ms: number): string {
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000} hours`;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const factor = gcd(ms, 60_000);
  return `${ms % 60_000 === 0 ? ms / 60_000 : `${ms / factor}/${60_000 / factor}`} minutes`;
}
export function preparePolicyText(input: unknown, version: number, issued: string): string {
  const { policy: p, hash } = createPolicy(input);
  if (!Number.isSafeInteger(version) || version <= 0)
    throw new PolicyAuthorizationError("policy version must be a positive safe integer");
  if (typeof issued !== "string" || !Number.isFinite(Date.parse(issued)) || new Date(issued).toISOString() !== issued)
    throw new PolicyAuthorizationError("policy issued must be a canonical UTC ISO timestamp");
  const destinations = p.destinations.allow;
  const names =
    destinations.slice(0, 2).join(", ") + (destinations.length > 2 ? ` and ${destinations.length - 2} more` : "");
  return [
    "solanaut policy",
    `guard: ${p.latch.guardId}`,
    `cluster: ${p.latch.cluster}`,
    `version: ${version}`,
    `policy: ${hash}`,
    `issued: ${issued}`,
    `destinations: ${destinations.length}, ${names}`,
    `SOL: ${p.sol.maxPerTx} per transaction, ${p.sol.maxPerWindow} per ${duration(p.windowMs)}`,
    `tokens: ${p.tokens.length}`,
    `programs: ${p.programs.allow.length}; opaque: ${p.programs.opaque}`,
  ].join("\n");
}
export function verifyPolicyAuthorization(input: unknown, a: PolicyAuthorization): Policy {
  const { policy } = createPolicy(input);
  if (!a || typeof a !== "object") throw new PolicyAuthorizationError("signed policy authorization is required");
  if (policy.latch.guardId !== a.guardId || policy.latch.cluster !== a.cluster)
    throw new PolicyAuthorizationError("signed policy names another guard or cluster");
  if (policy.latch.releaseKey !== a.operatorKey || policy.principal.includes(a.operatorKey))
    throw new PolicyAuthorizationError("policy operator differs from the externally pinned key or is a principal");
  if (a.text !== preparePolicyText(policy, a.version, a.issued))
    throw new PolicyAuthorizationError("signed policy text, hash or summary differs from canonical policy");
  const signature = a.signature;
  if (typeof signature !== "string") throw new PolicyAuthorizationError("policy signature is missing");
  if (signature.length !== 88) throw new PolicyAuthorizationError("policy signature has invalid encoded size");
  const bytes = Buffer.from(signature, "base64");
  if (bytes.toString("base64") !== signature || !verifyEd25519(a.operatorKey, Buffer.from(a.text), bytes))
    throw new PolicyAuthorizationError("policy signature does not verify");
  return policy;
}
export function verifyPolicyEntry(e: PolicyEntry, trust: PolicyTrust | undefined, previous?: PolicyEntry): Policy {
  if (!trust)
    throw new PolicyAuthorizationError(
      "signed policy history requires an externally pinned operator, guard and cluster",
    );
  if (canonicalJSON(e.profile) !== canonicalJSON(EVALUATION_PROFILE))
    throw new PolicyAuthorizationError("unsupported policy evaluation profile");
  const policy = verifyPolicyAuthorization(JSON.parse(e.policy), {
    ...trust,
    version: e.version,
    issued: e.issued,
    text: e.text,
    signature: e.signature,
  });
  if (canonicalJSON(policy) !== e.policy) throw new PolicyAuthorizationError("recorded policy is not canonical");
  if (
    previous &&
    (e.version < previous.version ||
      (e.version === previous.version && (e.policy !== previous.policy || e.text !== previous.text)))
  )
    throw new PolicyAuthorizationError("policy version rollback or changed content at equal version");
  return policy;
}
