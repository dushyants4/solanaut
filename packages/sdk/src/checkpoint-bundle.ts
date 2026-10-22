// The bytes an operator signs for a checkpoint, prepared so each part agrees with the others.
// Publishing a checkpoint and restoring from one are separate steps (ADR-019).
import { prepareCheckpointArchives } from "./checkpoint-archives.ts";
import { prepareCheckpointState } from "./checkpoint-state.ts";
import { prepareCheckpointPrefix } from "./checkpoint-prefix.ts";
import {
  prepareCheckpointText,
  prepareCheckpointPrefixText,
  type CheckpointBinding,
  type CheckpointTrust,
} from "./checkpoint.ts";
import { EVALUATION_PROFILE } from "./profile.ts";
import { isAddress } from "./base58.ts";
import type { PolicyTrust } from "./signed-policy.ts";
export class CheckpointBundleError extends Error {
  readonly code = "checkpoint-bundle";
  constructor(message: string) {
    super(message);
    this.name = "CheckpointBundleError";
  }
}
export interface PreparedCheckpointBundle {
  readonly binding: Readonly<CheckpointBinding>;
  readonly archives: string;
  readonly state: string;
  readonly prefix: string;
  readonly snapshotText: string;
  readonly prefixText: string;
}
export async function prepareCheckpointBundle(
  input: unknown,
  policyInput: unknown,
  receipts: unknown,
  context: { seq: number; head: string },
  policyTrust: PolicyTrust | undefined,
  checkpointTrust: unknown,
): Promise<Readonly<PreparedCheckpointBundle>> {
  try {
    // External pins and endpoint precede caller history accessors and asynchronous replay.
    const endpoint = structuredClone(context),
      pins = structuredClone(policyTrust),
      trust = structuredClone(checkpointTrust) as CheckpointTrust;
    if (
      !trust ||
      Array.isArray(trust) ||
      Object.keys(trust).sort().join(",") !== "anchorKey,checkpointKey,cluster,guardId,principalKeys" ||
      !isAddress(trust.checkpointKey) ||
      !isAddress(trust.anchorKey) ||
      !Array.isArray(trust.principalKeys) ||
      !trust.principalKeys.length ||
      !trust.principalKeys.every((key) => typeof key === "string" && isAddress(key)) ||
      trust.checkpointKey === trust.anchorKey ||
      trust.principalKeys.includes(trust.checkpointKey)
    )
      throw new CheckpointBundleError("checkpoint authority pins are invalid or overlap");
    const history = structuredClone(input),
      policy = structuredClone(policyInput),
      catalogue = structuredClone(receipts);
    const state = await prepareCheckpointState(history, policy, endpoint, pins);
    const prefix = await prepareCheckpointPrefix(history, policy, endpoint, pins);
    const archives = prepareCheckpointArchives(catalogue, endpoint);
    const admission = JSON.parse(state.text),
      current = JSON.parse(admission.policy.canonical);
    if (
      admission.guardId !== trust.guardId ||
      admission.cluster !== trust.cluster ||
      !current.principal.every((key: string) => trust.principalKeys.includes(key))
    )
      throw new CheckpointBundleError("checkpoint pins differ from current policy identity");
    const binding: Readonly<CheckpointBinding> = Object.freeze({
      format: 1,
      checkpointKey: trust.checkpointKey,
      guardId: trust.guardId,
      cluster: trust.cluster,
      seq: endpoint.seq,
      head: endpoint.head,
      policyVersion: admission.policy.version,
      policyHash: admission.policy.hash,
      profile: EVALUATION_PROFILE,
      archiveDigest: archives.digest,
      stateDigest: state.digest,
      prefixDigest: prefix.digest,
    });
    const snapshotText = prepareCheckpointText(binding),
      prefixText = prepareCheckpointPrefixText(binding);
    return Object.freeze({
      binding,
      archives: archives.text,
      state: state.text,
      prefix: prefix.text,
      snapshotText,
      prefixText,
    });
  } catch (error) {
    if (error instanceof CheckpointBundleError) throw error;
    throw new CheckpointBundleError("checkpoint bundle cannot be prepared");
  }
}
