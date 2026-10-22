// @solanaut/sdk: a transaction firewall for Solana agents. An agent proposes the bytes it wants
// signed; the guard decides by a policy the operator wrote, records the decision, and only an
// allowed one can be signed. The exports are grouped by what they are for, in the order the
// modules load.

// The guard, and the record it keeps.
export {
  createGuard,
  replay,
  VERIFIED_KEEL_DIGEST,
  VERIFIED_KEEL_MODULE,
  verifyKeelSource,
  type Decision,
  type Entry,
  type EntryStore,
  type Guard,
  type GuardOptions,
  type GuardStatus,
  type Outcome,
  type ProposalV1,
  type ReplayResult,
  type RuleV1,
  type Sensor,
  type SensorView,
} from "./guard.ts";
export { fileStore, memoryStore, type FileStoreOptions } from "./record.ts";
export {
  verifyArchive,
  ArchiveError,
  type ArchiveErrorCode,
  type ArchiveOptions,
  type ArchiveReceipt,
} from "./archive.ts";

// A policy the operator signs.
export {
  preparePolicyText,
  verifyPolicyAuthorization,
  PolicyAuthorizationError,
  type PolicyAuthorization,
  type PolicyTrust,
} from "./signed-policy.ts";
export { EVALUATION_PROFILE } from "./profile.ts";

// Checkpoints of the record, and the archives they bind.
export {
  prepareCheckpointText,
  prepareCheckpointPrefixText,
  verifyCheckpointBinding,
  CheckpointBindingError,
  type CheckpointBinding,
  type CheckpointTrust,
  type CheckpointSignatures,
  type CheckpointDigests,
} from "./checkpoint.ts";
export {
  prepareCheckpointArchives,
  CheckpointArchiveError,
  type PreparedCheckpointArchives,
} from "./checkpoint-archives.ts";

// What a signer host passes and keeps: request identities and the signing journal.
export type { RequestIdentity, RequestBinding } from "./request.ts";
export type { ControlMethod } from "./control-request.ts";
export type { SigningEvent, SigningHistory } from "./signing.ts";
export type { RuntimeAuthority } from "./authority.ts";

// Policies, and how a message's bytes are read and what they would do.
export {
  createPolicy,
  contextOf,
  PolicyError,
  policyHash,
  type Policy,
  type PolicyInput,
  type PolicyV1,
} from "./policy.ts";
export {
  effectsOf,
  classify,
  classifyInstruction,
  PROGRAMS,
  type ClassifyContext,
  type EffectsV1,
} from "./classify.ts";
export {
  decodeMessage,
  decodeTransaction,
  resolveMessage,
  DecodeError,
  type DecodedMessage,
  type PinnedTable,
  type ResolvedMessage,
} from "./message.ts";

// The latch's release text, the loop sensors, lookup-table pins and addresses.
export { releaseText, parseReleaseText, verifyEd25519 } from "./latch.ts";
export { sensorV0, sensorV1, SENSOR_V1 } from "./sensor.ts";
export { decodeLookupTableAccount, pinFromAccount } from "./tables.ts";
export { associatedTokenAddress, findProgramAddress } from "./pda.ts";
export { encodeBase58, decodeBase58, isAddress } from "./base58.ts";

// Denials, as the agent and the operator each see them.
export { SolanautDenied, type DeniedRule, type DenialClass, type Refusal, type RefusalObserver } from "./errors.ts";

// Adapters: Solana Agent Kit's wallet, @solana/kit's signer, the signer's socket client, JSON-RPC.
export {
  guardedWallet,
  BLOCKHASH_LIFETIME,
  type BaseWalletLike,
  type GuardedWalletOptions,
} from "./adapters/agent-kit.ts";
export {
  guardedSigner,
  type GuardedSignerOptions,
  type KitTransactionLike,
  type PartialSignerLike,
} from "./adapters/kit.ts";
export {
  createSendingClient,
  SignerClientError,
  type SignerClientCode,
  type SendingClientOptions,
  type SendingRequest,
  type SendingResult,
  type SignerRefusal,
  type ReportResult,
} from "./adapters/sending-client.ts";
export { jsonRpc, RpcRefused, type JsonRpcOptions, type RpcLike } from "./adapters/rpc.ts";

// Reading a record back.
export { inspectRecord, type Inspection } from "./inspect.ts";
