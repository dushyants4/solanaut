# SDK reference — private candidate

> **Draft 18** · 2026-10-08 · owner: integrator · for: developers integrating the candidate.
> Register: `kb/DOCUMENTS.md`. This describes current exports, not a stable-release promise.

Recovery now refuses impossible report/redemption transitions before state changes
(D22/D23). Valid repeated unknown outcomes and legitimate unsigned historical
redemptions retain their existing contract. Chronological policy equality applies
where signed history supplies it. This does not remove trusted SDK telemetry.

The internal request-index module is packaged for component qualification, without
a root export or supported consumer contract. Its independently replay-derived
root describes only a completed prefix; hits and absence cannot authorise current
admissions. Source/installed evidence is `../evals/sdk/request-index.md`.
The proposed devnet preview and page copy are in `release/STAGED-RELEASE.md` and
`PRODUCT-PAGE.md`; public availability and stable deployment remain outstanding.

Internal record-only use does not initialise checkpoint evaluation. Original
checkpoint modules re-export the same error constructors. Actual maintenance
still validates the full retained history; no new root SDK surface is exposed.

Streamed recomputation remains internal. Public `replay` keeps its array contract
and synchronous per-record loop. The internal source factory must complete both
reads; successful recomputation does not authenticate storage or permit admissions.
Pinned archive verification, actual ownership and live restoration remain separate
contracts. Component evidence: `../evals/sdk/replay-stream.md`.

Envelope, bundle, prefix and admission-state preparation remain internal. Installed compiled tests
do not make their file paths a public API. Publication and recovery are unfinished.

Policy authorisation captures signature text once and refuses an invalid encoded
size before decoding, with `PolicyAuthorizationError`. Supply canonical base64
for the operator's Ed25519 signature.

Import runtime functions and types from `@solanaut/sdk`. The compiled candidate and installed
commands are described in [PACKAGING](PACKAGING.md); source development uses native TypeScript.
Generated declarations contain the complete signatures. The source export list is
[`packages/sdk/src/index.ts`](../packages/sdk/src/index.ts).

`prepareCheckpointArchives(receipts, {seq, head})` returns immutable canonical
catalogue text and its SHA-256 digest for the checkpoint's archive payload binding.
`PreparedCheckpointArchives` describes that returned payload.
Supply ordered receipts from `verifyArchive`, starting at genesis and ending at
the checkpoint's next sequence and preceding head. Malformed or discontinuous
metadata throws `CheckpointArchiveError` with code `checkpoint-archives`.
Verify each referenced file separately; preparation checks metadata only. It does
not establish anchor authority, restore state or publish a snapshot.

The operator preparation command is described in [POLICY](POLICY.md). It returns unsigned
public signing text; it does not replace authorisation or installed-service checks.

Choose the integration before connecting a wallet. `createGuard`, `guardedSigner` and
`guardedWallet` run in the trusted caller's process. That caller can bypass the guard if it
controls its key. `createSendingClient` uses the distinct signer protocol; its deployment
and isolation qualification remain incomplete. See [CLIENT](CLIENT.md) and [SIGNER](SIGNER.md).

## Guard and record

| Export or method | Contract |
|---|---|
| `createGuard(options)` | Asynchronously validates policy, verifies the pinned Keel module/controller, opens the record and restores its history. Invalid policy, trust or history refuses startup. |
| `guard.check(proposal, request?)` | Takes unsigned message bytes, time and optional block heights/grouping. Returns a recorded admission or named denial. An admission reserves spending; it is not a signature or a send. |
| `guard.redeem(message, decisionHash, blockHeight?)` | Checks the exact admitted bytes, receipt, expiry and single use before signing. Returns `{ ok, reason }`; a receipt may not be redeemed again. |
| `guard.report(decisionHash, outcome)` | Trusted SDK bookkeeping for an admitted decision. Throws for unsupported outcomes, absent allowed decisions or reports after a final outcome. An unknown outcome retains conservative reservations. |
| `guard.status()` | Returns latch and sequence/denial state. It does not attest chain settlement, dedicated-user isolation or service health. |
| `guard.entries()` | Exposes recorded entries in order. Current guard state/history is in memory; bounded archive verification does not make guard replay bounded. |
| `guard.releaseText(expires)` / `guard.release(text, signature, at)` | Prepares and verifies an operator-signed release for the current latch. Keep the operator outside the principal; SDK time remains caller-supplied. |
| `guard.close()` | Stops use of the guard and releases record ownership. Always close during orderly shutdown. |
| `fileStore` / `memoryStore` | Persistent or ephemeral record stores. Memory-only mode forgets state on restart. Linux kernel ownership and explicit initial creation are described in [STORAGE](STORAGE.md). |
| `verifyArchive` | Checks bounded structural framing, chain and optional independent pins. It does not authenticate unpinned history, replay policy or recover state. |
| `replay` / `inspectRecord` | Recomputes decisions, or projects record status for inspection. Signed history requires an independently pinned trust identity. Inspecting a record is not a replacement for successful replay. |

`GuardOptions`, `Guard`, `GuardStatus`, `ProposalV1`, `Decision`, `RuleV1`, `Outcome`, `Entry`,
`EntryStore`, `ReplayResult`, `FileStoreOptions` and `Inspection` describe these interfaces.
`ArchiveOptions`, `ArchiveReceipt` and `ArchiveErrorCode` describe structural verification.
`expectedAnchor: { seq, head }` checks that an externally trusted anchor is present at its
exact sequence; the receipt returns that captured pin. `ArchiveError.code === "anchor"`
means disagreement or missing anchored history. Follow [STORAGE](STORAGE.md); this API does
not obtain or authenticate on-chain metadata and does not cover a rewrite after the anchor.
Policy denials are ordinary decisions: check `allow`, then the named `rule` and `reason`.
Storage failure can return `fail-closed` without a durable decision; do not use that answer
as an admitted receipt. Preserve failed history rather than editing it to make restore pass.

## Checkpoint bindings

The source candidate additionally exports `prepareCheckpointText`,
`prepareCheckpointPrefixText`, `verifyCheckpointBinding` and `CheckpointBindingError`,
with `CheckpointBinding`, `CheckpointTrust`, `CheckpointSignatures` and `CheckpointDigests`.
These authenticate externally pinned metadata and independently computed payload digests.
Both signatures are required; the checkpoint key must differ from principal and anchor keys.
The binding's `seq` is the next record sequence, with the preceding entry's `head`; genesis
uses zero and an empty head. An archive anchor's sequence instead identifies its actual entry.
This does not read payloads, restore state, establish freshness or rebuild Keel. Do not
resume a guard from this result alone. Packed JavaScript/declaration component checks pass
(`evals/sdk/checkpoint.md`); the complete snapshot/recovery workflow is not implemented.

## Wallets and sending

| Export | Behaviour |
|---|---|
| `guardedSigner(signer, guard, options?)` | A kit-style partial signer. It checks and redeems exact messages and validates returned signatures. Signing does not broadcast. |
| `guardedWallet(wallet, guard, options)` | A wallet wrapper for transaction objects. Sign-only methods remain sign-only; explicit send methods submit the checked signed bytes and reconcile outcomes through the configured RPC. Raw off-chain message signing is denied. |
| `createSendingClient(options)` | Explicit `propose`, `report` and `status` requests over a Unix socket. `propose` can sign and send. There is no partial-signing method or automatic retry. |
| `jsonRpc(url, options?)` | The trusted SDK adapter's JSON-RPC implementation. This is distinct from the isolated signer's two-provider authoritative RPC boundary. |

Wallet/signing types: `BaseWalletLike`, `GuardedWalletOptions`, `KitTransactionLike`,
`PartialSignerLike` and `GuardedSignerOptions`. Sending types: `SendingClientOptions`,
`SendingRequest`, `SendingResult`, `SignerRefusal`, `ReportResult` and `SignerClientCode`.
RPC types: `RpcLike` and `JsonRpcOptions`; `BLOCKHASH_LIFETIME` is the SDK adapter's existing
lifetime constant, not authoritative confirmation that a particular transaction has expired.

Keep exact request identities, bytes and grouping through uncertain outcomes. `sent` means
submission evidence, not settlement. Never manufacture a new identity just to retry the same
payment. See [REQUESTS](REQUESTS.md) for durable identity semantics and [CLIENT](CLIENT.md)
for transport errors and reconciliation.

## Policy and low-level helpers

`createPolicy`, `policyHash` and `contextOf` validate/canonicalise policy content and derive
its classification context. `Policy`, `PolicyInput` and `PolicyV1` describe input and validated
policy. Use bigint or decimal-string amounts, keeping the denomination of each field.
Canonicalisation does not establish operator approval. `preparePolicyText` and
`verifyPolicyAuthorization` bind exact policy content to an external operator/guard/cluster
pin. `PolicyAuthorization`, `PolicyTrust` and `EVALUATION_PROFILE` support signed history.
See [POLICIES](POLICIES.md), including higher signed versions when restoring earlier content.

`decodeMessage`, `decodeTransaction` and `resolveMessage` decode unsigned messages or signed
wire transactions and resolve pinned account tables. `DecodedMessage`, `ResolvedMessage`
and `PinnedTable` describe their output. Decoding accepts a format; it does not admit a payment.
`classify`, `classifyInstruction`, `effectsOf`, `PROGRAMS`, `ClassifyContext` and `EffectsV1`
derive recognised effects. Unknown/opaque effects do not acquire safety through decoding;
the accepted product fallback denies opaque execution.

`decodeLookupTableAccount` and `pinFromAccount` prepare lookup-table evidence.
`associatedTokenAddress` and `findProgramAddress` derive addresses offline.
`encodeBase58`, `decodeBase58` and `isAddress` handle address encoding.
`releaseText`, `parseReleaseText` and `verifyEd25519` handle latch text/signatures; parsing
alone does not authorise a release. `sensorV0`, `sensorV1`, `SENSOR_V1`, `Sensor` and
`SensorView` expose sensors; signed mode fixes its recorded evaluation profile.
`VERIFIED_KEEL_DIGEST`, `VERIFIED_KEEL_MODULE` and `verifyKeelSource` expose pin verification.

The public trusted-host journal also exposes `beginRequest`, `finishRequest`, `requestResult`
and `recordSigning` on `Guard`, with `RequestIdentity`, `RequestBinding`, `ControlMethod`,
`SigningEvent`, `SigningHistory` and `RuntimeAuthority` types. These are bookkeeping APIs,
not extra signer socket methods. Host attribution supplied from the same process is not
process isolation. Do not use these interfaces to fabricate chain outcomes or send evidence.

## Errors and operator actions

| Error | Action |
|---|---|
| `PolicyError` (`rule: invalid-policy`) | Correct its field problems; no guard started. |
| `PolicyAuthorizationError` (`code: policy-authorization`) | Verify the independent trust pin and exact signed text/version; do not disable verification to start. |
| `DecodeError` (`rule`) | Correct unsupported/malformed bytes or table pins; classification/admission remains required afterwards. |
| `SolanautDenied` (`rule`, `reason`, optional `decision`) | Treat the adapter refusal as a denied action. Inspect the policy or request; repeatedly signing the same denied bytes is not recovery. `DeniedRule` types these refusals. |
| `SignerClientError` (`code`, `mayHaveExecuted`, optional `remoteCode`) | Follow [CLIENT](CLIENT.md). Preserve requests whenever execution is uncertain. |
| `ArchiveError` (`code`) | Follow [STORAGE](STORAGE.md); structural success still needs authenticated replay and a recovery drill. |
| `CheckpointBindingError` (`code: checkpoint-binding`) | Refuse this checkpoint binding. Check the external pins, both signatures, exact profile and independently computed payload digests; complete restore still needs verified replay. |
| `CheckpointArchiveError` (`code: checkpoint-archives`) | Correct the ordered archive receipts and checkpoint endpoint, then verify the referenced files separately. Preparing a catalogue does not verify its files or restore state. |
| `RpcRefused` (`refused`, `method`) | The SDK RPC explicitly refused its request. A plain transport error does not establish that a send never reached the chain. |

Startup, record ownership and operational failures can also throw ordinary errors. Keep the
service stopped until the cause is understood; missing history is not an empty new identity.
Stable typed operational errors and the complete installed-service workflow remain release work.

Owned checkpoint publication is an internal maintenance component, not a root SDK
export or signer RPC. Only the actual kernel-owned file store holds its capability;
memory and copied store objects cannot publish. It requires external checkpoint
and policy trust pins, actual retained archive paths and an explicit byte ceiling.
It preserves authenticated predecessors and refuses stale or replay-inconsistent
state. Complete supported maintenance/recovery remains release work. See
`../evals/sdk/checkpoint-publication.md` for component evidence and limitations.

Internal prefix rebuilding returns a fresh runtime controller only after full
history validates the exact supplied tick/reset prefix. It is not a stable root
export or a complete restore API. Signed history still requires external policy
trust pins; a recovery caller also needs authenticated envelope/archive/anchor
validation. `../evals/sdk/checkpoint-rebuild.md` records the component boundary.

Checkpoint recovery preparation remains internal. Its receipt distinguishes a
verified checkpoint from verified full replay and names missing/invalid checkpoint
fallback. It requires full signed history and external policy/checkpoint pins,
and enforces an optional configured anchor on either path. It returns derived
admission text and a fresh runtime controller, not a running guard or owned service.
`../evals/sdk/checkpoint-recovery.md` records the component and remaining obligations.

Internal owned recovery reads the locked record and bounded current checkpoint
directly, then returns the verified preparation receipt only while ownership and
history remain unchanged. It shares maintenance exclusion with publication and
preserves invalid checkpoint evidence on verified full-replay fallback. It is not
a root export or a running-guard factory. The caller still owns the lifecycle;
live isolated startup and supported operator recovery remain release work. See
`../evals/sdk/checkpoint-owned-recovery.md`.

Archive streaming remains internal. It yields immutable records under consumer
backpressure, but only natural completion establishes full structural integrity
and a final receipt. Cancellation closes the source. The existing public
`verifyArchive` fully consumes that core and retains its documented receipt and
typed-error surface. Neither a yielded record nor an archive receipt authenticates
policy/state or permits admission. See `../evals/sdk/archive-stream.md`.
