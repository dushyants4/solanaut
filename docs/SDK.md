# SDK guide and reference

> **Draft 25** · 2026-10-27 · owner: integrator · for: developers putting the guard in front of an agent's key.
> Register: `kb/DOCUMENTS.md`. It describes the current exports of an unpublished candidate, not a stable-release
> promise.

`@solanaut/sdk` sits between an AI agent and its key. The agent proposes the message bytes it wants signed; the guard
checks them against a policy the operator wrote, records its decision, and only an allowed decision can be signed.

This page has two halves. The guide (sections 1 to 5) takes you from an empty file to a guarded payment. The
reference (sections 6 to 9) lists every export, every error, and the limits. Numbers such as S119 are rows of
[CLAIMS](CLAIMS.md), each with its evidence and the command that reproduces it.

1. [Get it](#1-get-it)
2. [Check, redeem, sign, report](#2-check-redeem-sign-report)
3. [Choose an integration](#3-choose-an-integration)
4. [Write a policy](#4-write-a-policy)
5. [Refusals: what the agent hears, and what the operator sees](#5-refusals-what-the-agent-hears-and-what-the-operator-sees)
6. [Reference](#6-reference)
7. [Errors, and what to do about each](#7-errors-and-what-to-do-about-each)
8. [Internal components](#8-internal-components)
9. [Limits, and the evidence](#9-limits-and-the-evidence)

## 1. Get it

The SDK is not published to npm. There are two ways to use it today:

- **Inside this repository.** npm workspaces resolve `@solanaut/sdk` to [`packages/sdk/src/`](../packages/sdk/src/),
  which Node runs as TypeScript, with no build step (22.18 or later; 26.7.0 is the pinned version). Run `npm install`
  at the root, then `import { createGuard } from "@solanaut/sdk"` from any workspace, as
  [`apps/sandbox`](../apps/sandbox/src/main.ts) does.
- **In a project of your own.** Build the compiled private candidate and install its tarball: [PREVIEW](PREVIEW.md)
  walks through it, and [PACKAGING](PACKAGING.md) explains the build. The compiled package runs on Node
  22.18.0 or later, with no loader flags.

Import every runtime function and type from `@solanaut/sdk`. The generated declarations carry the complete
signatures, and the source list of exports, grouped by purpose, is
[`packages/sdk/src/index.ts`](../packages/sdk/src/index.ts).

## 2. Check, redeem, sign, report

Every guarded payment takes the same four steps. This is the sandbox's version, shortened from
[`apps/sandbox/src/main.ts`](../apps/sandbox/src/main.ts). The complete file, runnable offline, is
[`examples/guarded-payment.mjs`](../examples/guarded-payment.mjs): `node examples/guarded-payment.mjs`.

```ts
import { createGuard } from "@solanaut/sdk";

const guard = await createGuard({ policy });

// `latest` is the getLatestBlockhash answer the transaction was built with. Heights are bigints.
async function pay(transaction, latest) {
  const message = transaction.serializeMessage();          // the exact bytes the signature will cover
  const blockHeight = BigInt(await connection.getBlockHeight("confirmed"));
  const lastValidBlockHeight = BigInt(latest.lastValidBlockHeight);

  const decision = guard.check({ message, at: Date.now(), blockHeight, lastValidBlockHeight });
  if (!decision.allow) return `refused by ${decision.rule}`;   // nothing to sign

  const receipt = guard.redeem(message, decision.hash, blockHeight);
  if (!receipt.ok) throw new Error(`the receipt did not redeem: ${receipt.reason}`);

  transaction.sign(agent);
  await connection.sendRawTransaction(transaction.serialize());
  guard.report(decision.hash, "landed");                  // once confirmed; or "failed", "expired", "unknown"
  return "landed";
}
```

1. **Check.** `guard.check(proposal)` takes the serialized message and the caller's clock and block heights, runs the
   rules in order, and returns a `Decision`. The first rule that fails is the decision's `rule`. An allowed decision is
   a receipt: it binds the message's hash, its expiry height and the policy's hash, and it reserves the payment's
   spending against the windows. It is not a signature, and it sends nothing.
2. **Redeem.** `guard.redeem(message, hash, blockHeight)` confirms, just before signing, that these are the admitted
   bytes and that the receipt has not been used, and, when the check was given heights, that the blockhash is still
   valid. It returns `{ ok, reason }`. A receipt redeems once.
3. **Sign and send** the exact bytes that were checked. The guard does neither; the adapters in section 3 do both.
4. **Report** how it went: `landed`, `failed`, `expired` or `unknown`. A payment that landed stays counted against the
   windows. `failed` releases its value but keeps its fees, which may have been paid; `expired` releases both; `unknown`
   releases nothing, because the payment could still land.

Every check, redemption and report is an entry in a hash-chained record, kept before the guard answers. Without a
`log`, the record lives in memory and a restart forgets it. With `log: "<path>"` the record is a file, and after an
orderly `close()` the guard restores itself from it on the next start. To restart after a crash, give it Linux kernel
ownership, `log: fileStore(path, { ownership: "kernel" })`: the default manual ownership refuses a marker a dead
process left behind, until the operator repairs it ([STORAGE](STORAGE.md)). `await replay(entries, policy)`
recomputes every decision from its bytes.

[`examples/offline-preview.mjs`](../examples/offline-preview.mjs) runs these steps end to end with synthetic bytes,
including a second redemption that is refused, an unlisted payee and a replay.

## 3. Choose an integration

| You have | Use | It |
|---|---|---|
| a Solana Agent Kit agent | `guardedWallet(wallet, guard, { rpc })` | checks before the wallet signs, verifies what it signed, sends the checked bytes itself, and reports the outcome |
| a `@solana/kit` partial signer | `guardedSigner(signer, guard)` | checks and redeems every message before delegating, and verifies each returned signature. It never broadcasts: it records each signed message as `unknown`, and you report the final outcome with `guard.report`, finding the decision in `guard.entries()` |
| an agent with no key, talking to the separate signer | `createSendingClient(options)` | asks the signer to `propose`, `report` or give its `status` over a Unix socket ([CLIENT](CLIENT.md)) |
| your own signing code | `createGuard` | the four steps in section 2 |

With Solana Agent Kit the change is one line:

```ts
const agent = new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), rpc, {});
```

In TypeScript, the kit's own types need two casts on that line, as in
[`apps/agentkit/src/run.ts`](../apps/agentkit/src/run.ts). Both adapters refuse to wrap a wallet or signer whose key
is not in the policy's `principal`: they throw when you create them.

Choose before connecting a wallet. `createGuard`, `guardedSigner` and `guardedWallet` run in the trusted caller's
process, and a caller that controls its key can bypass the guard. `createSendingClient` uses the distinct signer
protocol, where the agent holds no key; that deployment's isolation is not yet qualified ([SIGNER](SIGNER.md)).

## 4. Write a policy

A policy is plain data, validated once when the guard is created. Every field is required except `disclosure`. Amounts
are bigints, or decimal strings as JSON carries them. `createPolicy(input)` validates and freezes one on its own; an
invalid policy throws a `PolicyError` listing every problem, and no guard starts.

| Field | What it decides |
|---|---|
| `version` | always `1` |
| `principal` | the guarded public keys: their outflows are what the policy checks |
| `programs` | `allow`: the programs a transaction may call. `opaque`: whether an allowed program the guard does not decode may run (`"deny"` is the product's choice) |
| `destinations` | `allow`: the owners that may receive SOL or tokens |
| `sol` | `maxPerTx` and `maxPerWindow`, in lamports |
| `tokens` | one entry per allowed mint: `mint`, `program` (`"token"` or `"token-2022"`), `maxPerTx`, `maxPerWindow`. Any mint not listed is refused |
| `fees` | lamports: `maxPriorityPerTx`; `maxPerWindow`, counting priority fees, base fees and tips; `tipAccounts`, where SOL sent counts as a tip |
| `lookupTables` | pinned table prefixes for v0 messages, `{ address, entries }`; `npm run pin-table` prints one. An index past the pin is refused |
| `windowMs` | the length of the spending window, in milliseconds |
| `intents` | `maxAttempts`: how many attempts the same payment may take |
| `latch` | `afterDenials`: consecutive denials before the guard latches and refuses everything; a refusal by the loop brake latches it at once. `releaseKey`: the operator's key, outside the principal, that signs a release. `guardId` (1 to 64 printable characters) and `cluster` (`"localnet"`, `"devnet"` or `"mainnet-beta"`) name the guard in that release |
| `messages` | `{ allow: false }`: off-chain message signing is refused in v1 |
| `cosign` | `{ allow: false }`: a required signer outside the principal is refused in v1 |
| `sensor` | `expectedPerMinute`: the proposal rate the loop sensor treats as normal |
| `disclosure` | optional: `"class"`, the default, or `"full"` for development, only in a policy the operator signed (section 5) |

The rules that use these fields, in the order they run, are in [SPEC](SPEC.md) §5. Keep the policy out of the agent's
reach: it is safe only while the agent cannot change it (claims S2).

**Signed policies.** In production the operator signs the policy. `preparePolicyText(policy, version, issued)` gives
the exact text to sign, and the `solanaut-prepare-policy` command prints it as a public request
([POLICY](POLICY.md)). The policy's `latch.releaseKey` must be the operator key that signs it. Pass the signed
`authorization` to `createGuard`, which verifies the signature, the exact text, and the operator, guard and cluster it
names, and refuses to start otherwise. Fill those three from your own retained configuration, never from the request
([POLICY](POLICY.md)). `verifyPolicyAuthorization(policy, authorization)` runs the same check on its own, and returns
the validated policy. Verification captures the signature text once, and refuses an
invalid encoded size before decoding, with a `PolicyAuthorizationError`; supply the operator's Ed25519 signature as
canonical base64. A prepared request alone authorizes nothing. Versions, restarts and replay of signed history are in
[POLICIES](POLICIES.md).

## 5. Refusals: what the agent hears, and what the operator sees

A precise reason shows a model where to push, so the agent is told less than the operator. By default an adapter
throws `SolanautDenied` with only a `class` (`refused`, `retry-later` or `invalid`) and a `ref`, the number of the
decision in the record. The rule and the reason go to the operator, outside the model's context:

```ts
const guard = await createGuard({ policy, onRefusal: (refusal) => operatorLog(refusal) });
```

The callback receives a detached, deeply frozen `{ rule, reason, decision }` after the decision is kept. An
adapter-only refusal has `decision: null`; a storage failure has an unrecorded decision with reference −1. Reusing a
request that is already recorded does not call it again. If the callback fails, a fixed diagnostic goes to stderr; it
cannot change the verdict or its record.

For development, add `disclosure: "full"` to the policy **before signing it**, then pass its verified `authorization`
to `createGuard`. Adapter errors then carry `rule` and `reason`, and decisions are marked `disclosure: "full"`. The
error never carries the decision or an exception's cause. Unsigned full disclosure refuses to start. Leaving the field
out keeps the legacy policy bytes and the `"class"` default. These boundaries keep details out of the model's feedback,
but trusted code in the same process can still inspect the guard. The signer's socket always uses the class contract,
whatever the policy says ([ADR-025](../design/ADR-025-denial-disclosure.md)).

A policy denial is an ordinary decision: check `allow`, then read `rule` and `reason` from the decision or the
callback.

## 6. Reference

### The guard and its record

| Export or method | Contract |
|---|---|
| `createGuard(options)` | Asynchronously validates the policy, verifies the pinned Keel module and controller, opens the record and restores its history. An invalid policy, trust pin or history refuses startup. |
| `guard.check(proposal, request?)` | Takes unsigned message bytes, time and optional block heights and grouping. Returns a recorded admission or a named denial. An admission reserves spending; it is not a signature or a send. |
| `guard.redeem(message, decisionHash, blockHeight?)` | Checks the exact admitted bytes, receipt, expiry and single use before signing. Returns `{ ok, reason }`; a receipt may not be redeemed again. |
| `guard.report(decisionHash, outcome)` | Trusted SDK bookkeeping for an admitted decision. Throws for unsupported outcomes, absent allowed decisions or reports after a final outcome. An unknown outcome keeps its reservations. |
| `guard.status()` | Returns the latch and the sequence and denial counts. It does not attest chain settlement, dedicated-user isolation or service health. |
| `guard.entries()` | The recorded entries, in order. The guard's current state and history are in memory; bounded archive verification does not make replay bounded. |
| `guard.releaseText(expires)` / `guard.release(text, signature, at)` | Prepares and verifies an operator-signed release for the current latch. Keep the operator outside the principal; SDK time is supplied by the caller. |
| `guard.close()` | Stops the guard and releases ownership of its record. Always close during an orderly shutdown. |
| `guard.policy` / `guard.policyHash` | The validated, frozen policy the guard runs, and its hash. |
| `fileStore` / `memoryStore` | Persistent or ephemeral record stores. A memory store forgets its state on restart. Linux kernel ownership and explicit first creation are in [STORAGE](STORAGE.md). |
| `verifyArchive` | Checks bounded structural framing, the chain and optional independent pins. It does not authenticate unpinned history, replay policy or recover state. |
| `replay` / `inspectRecord` | Recomputes decisions, or projects a record's status for inspection. Signed history requires an independently pinned trust identity. Inspecting a record does not replace a successful replay. |

`GuardOptions`, `Guard`, `GuardStatus`, `ProposalV1`, `Decision`, `RuleV1`, `Outcome`, `Entry`, `EntryStore`,
`ReplayResult`, `FileStoreOptions` and `Inspection` describe these interfaces. `ArchiveOptions`, `ArchiveReceipt` and
`ArchiveErrorCode` describe structural verification.

- **Anchors.** `expectedAnchor: { seq, head }` checks that an externally trusted anchor is present at its exact
  sequence, and the receipt returns that captured pin. `ArchiveError.code === "anchor"` means disagreement, or anchored
  history that is missing. Follow [STORAGE](STORAGE.md): this API neither obtains nor authenticates on-chain metadata,
  and does not cover a rewrite after the anchor.
- **Storage failure** can return `fail-closed` without a durable decision; never use that answer as an admitted
  receipt. Preserve failed history rather than editing it to make a restore pass.
- **Restore** checks every recorded report and redemption as the live guard would, before any state changes: a
  resealed record cannot slip in an outcome after a final one, an unsupported outcome, or a redemption of a denied,
  used or expired receipt (defects D22 and D23, [SPEC](SPEC.md) §10). Repeated `unknown` outcomes and legitimate
  unsigned historical redemptions still restore. With signed history, each redemption is checked against the policy
  in force when it was recorded. None of this removes the trust SDK mode places in its caller's clock and heights.

### Wallets and sending

| Export | Behaviour |
|---|---|
| `guardedSigner(signer, guard, options?)` | A kit-style partial signer. It checks and redeems exact messages and validates returned signatures. Signing does not broadcast. |
| `guardedWallet(wallet, guard, options)` | A wallet wrapper for transaction objects. Sign-only methods stay sign-only; explicit send methods submit the checked signed bytes and reconcile outcomes through the configured RPC. Raw off-chain message signing is denied. |
| `createSendingClient(options)` | Explicit `propose`, `report` and `status` requests over a Unix socket. `propose` can sign and send. There is no partial-signing method and no automatic retry. |
| `jsonRpc(url, options?)` | The trusted SDK adapter's JSON-RPC client. It is distinct from the isolated signer's two-provider RPC boundary ([RPC](RPC.md)). |

Wallet and signing types: `BaseWalletLike`, `GuardedWalletOptions`, `KitTransactionLike`, `PartialSignerLike` and
`GuardedSignerOptions`. Sending types: `SendingClientOptions`, `SendingRequest`, `SendingResult`, `SignerRefusal`,
`ReportResult` and `SignerClientCode`. RPC types: `RpcLike` and `JsonRpcOptions`. `BLOCKHASH_LIFETIME` is the SDK
adapter's lifetime constant, not authoritative confirmation that a particular transaction has expired.

What the sending wallet checks:

- **The wire it sends.** It captures the serialized wire once, verifies the admitted message and the wallet's
  signature, then sends those same bytes. A changed or malformed serialization is refused before any RPC call, and
  the refusal names `wallet-changed-message` to the operator: discard the rejected transaction object and inspect the
  recorded outcome before retrying. A signing already verified stays `unknown`, even if serialization erases the
  object's signature ([adapter-wire](../evals/sdk/adapter-wire.md), S119).
- **Buffers it is handed.** It privately copies raw `ArrayBuffer` and `SharedArrayBuffer` messages and wires before
  admission and verification ([adapter-buffer-current](../evals/sdk/adapter-buffer-current.md), S125; the earlier
  [prepared correction](../evals/sdk/adapter-buffer.md) keeps its failures).
- **Batches, and provider text.** Wallet batch membership is captured before awaiting and copied before delegation,
  and provider diagnostics keep fixed categories without raw exception text. The initial failures are in
  [adapter-batch](../evals/sdk/adapter-batch.md) and [rpc-redaction](../evals/signer/rpc-redaction.md); the
  integration is [integrated-fixes](../evals/release/integrated-fixes.md) (S157).

Its stated limits are the trusted SDK inputs and direct key access; none of this is a claim about an isolated signing
service.

Keep a request's identity, bytes and grouping through any uncertain outcome. `sent` means evidence of submission, not
settlement. Never invent a new identity just to retry the same payment. [REQUESTS](REQUESTS.md) describes durable
identity, and [CLIENT](CLIENT.md) the transport errors and reconciliation.

### Policies, bytes and helpers

- **Policies.** `createPolicy`, `policyHash` and `contextOf` validate and canonicalize policy content and derive its
  classification context. `Policy`, `PolicyInput` and `PolicyV1` describe input and validated policy. Use bigint or
  decimal-string amounts, keeping each field's denomination. Canonicalization does not establish operator approval.
  `preparePolicyText` and `verifyPolicyAuthorization` bind exact policy content to an external operator, guard and
  cluster pin; `PolicyAuthorization`, `PolicyTrust` and `EVALUATION_PROFILE` support signed history. See
  [POLICIES](POLICIES.md), including the higher signed version needed to restore earlier content.
- **Bytes.** `decodeMessage`, `decodeTransaction` and `resolveMessage` decode unsigned messages or signed wire
  transactions, and resolve pinned lookup tables. `DecodedMessage`, `ResolvedMessage` and `PinnedTable` describe their
  output. Decoding accepts a format; it does not admit a payment.
- **Effects.** `classify`, `classifyInstruction`, `effectsOf`, `PROGRAMS`, `ClassifyContext` and `EffectsV1` derive
  recognized effects. Unknown or opaque effects acquire no safety from being decoded; the product's fallback denies
  opaque execution.
- **Tables and addresses.** `decodeLookupTableAccount` and `pinFromAccount` prepare lookup-table evidence.
  `associatedTokenAddress` and `findProgramAddress` derive addresses offline. `encodeBase58`, `decodeBase58` and
  `isAddress` handle address encoding.
- **The latch.** `releaseText`, `parseReleaseText` and `verifyEd25519` handle the release text and its signature;
  parsing alone does not authorize a release.
- **Sensors and Keel.** `sensorV0`, `sensorV1`, `SENSOR_V1`, `Sensor` and `SensorView` expose the sensors; signed mode
  fixes its recorded evaluation profile. `VERIFIED_KEEL_DIGEST`, `VERIFIED_KEEL_MODULE` and `verifyKeelSource` expose
  the pin verification.

### Checkpoint bindings

`prepareCheckpointText`, `prepareCheckpointPrefixText`, `verifyCheckpointBinding` and `CheckpointBindingError`, with
`CheckpointBinding`, `CheckpointTrust`, `CheckpointSignatures` and `CheckpointDigests`, authenticate externally pinned
metadata and independently computed payload digests. Both signatures are required, and the checkpoint key must differ
from the principal and anchor keys. The binding's `seq` is the next record sequence, with the preceding entry's
`head`; genesis uses zero and an empty head. An archive anchor's sequence instead identifies its actual entry. This
does not read payloads, restore state, establish freshness or rebuild Keel: do not resume a guard from this result
alone. Packed JavaScript and declaration checks pass ([checkpoint](../evals/sdk/checkpoint.md)); the complete snapshot
and recovery workflow is not implemented.

`prepareCheckpointArchives(receipts, { seq, head })` returns immutable canonical catalogue text and its SHA-256 digest,
for the checkpoint's archive payload binding; `PreparedCheckpointArchives` describes it. Supply ordered receipts from
`verifyArchive`, starting at genesis and ending at the checkpoint's next sequence and preceding head. Malformed or
discontinuous metadata throws `CheckpointArchiveError` with code `checkpoint-archives`. Verify each referenced file
separately: preparation checks metadata only. It does not establish anchor authority, restore state or publish a
snapshot.

### The signer host's journal

`Guard` also exposes `beginRequest`, `finishRequest`, `requestResult` and `recordSigning`, with the `RequestIdentity`,
`RequestBinding`, `ControlMethod`, `SigningEvent`, `SigningHistory` and `RuntimeAuthority` types. They are bookkeeping
APIs for a trusted host, not extra signer socket methods ([REQUESTS](REQUESTS.md)). Host attribution supplied from the
same process is not process isolation. Do not use them to fabricate chain outcomes or send evidence.

### Refusals

`SolanautDenied` is the error the adapters throw; `DenialClass` is its `class`, `DeniedRule` the rule an operator sees,
and `Refusal` and `RefusalObserver` type the `onRefusal` callback (section 5).

## 7. Errors, and what to do about each

| Error | Action |
|---|---|
| `PolicyError` (`rule: invalid-policy`) | Correct the field problems it lists; no guard started. |
| `PolicyAuthorizationError` (`code: policy-authorization`) | Verify the independent trust pin and the exact signed text and version; never disable verification to start. |
| `DecodeError` (`rule`) | Correct unsupported or malformed bytes, or table pins; classification and admission are still required afterwards. |
| `SolanautDenied` (`ref`, `class`) | Stop on `refused`, inspect an `invalid` proposal, and reconcile a `retry-later` result before another attempt. `ref` identifies the recorded decision, or is −1 when the refusal has none. An adapter-only refusal can follow an earlier admission or signature, so −1 does not prove nothing happened. By default the error carries no rule, reason, decision or cause. |
| `SignerClientError` (`code`, `mayHaveExecuted`, optional `remoteCode`) | Follow [CLIENT](CLIENT.md). Preserve the request whenever execution is uncertain. |
| `ArchiveError` (`code`) | Follow [STORAGE](STORAGE.md); structural success still needs authenticated replay and a recovery drill. |
| `CheckpointBindingError` (`code: checkpoint-binding`) | Refuse this checkpoint binding. Check the external pins, both signatures, the exact profile and the independently computed payload digests; a complete restore still needs verified replay. |
| `CheckpointArchiveError` (`code: checkpoint-archives`) | Correct the ordered archive receipts and the checkpoint endpoint, then verify the referenced files separately. Preparing a catalogue does not verify its files or restore state. |
| `RpcRefused` (`refused`, `method`) | The SDK's RPC explicitly refused its request. A plain transport error does not establish that a send never reached the chain. |

Startup, record ownership and operational failures can also throw ordinary errors. Keep the service stopped until the
cause is understood: missing history is not an empty new identity. Stable typed operational errors and the complete
installed-service workflow are release work.

## 8. Internal components

Some modules are packaged so the compiled candidate can be tested whole, but have no root export: the signer host's
owned guard, the request index, checkpoint publication and recovery, streamed replay and archive streaming. They are
parts of the signer host's recovery path, which is unfinished. Their file paths are not a public API, and none of them
can authorize an admission. [OVERVIEW](OVERVIEW.md) §5 describes each one, with its evidence.

## 9. Limits, and the evidence

- **SDK mode trusts its caller.** Its clock, block heights and outcome reports come from the code that calls it, and a
  caller that can reach its own key can bypass the guard. The isolated signer exists to remove that trust; its
  deployment is not yet qualified ([SIGNER](SIGNER.md)).
- **The installed package** matches the retained real-transaction corpus
  ([installed-differential](../evals/release/installed-differential.md), S138) and reproduces the mixed replay
  ([installed-replay](../evals/release/installed-replay.md), S139), through its public exports on the available
  runtimes. CI runs the 144 installed-package faults in four shards on every push, and they pass (S163). None of this
  qualifies an isolated service, snapshots or a stable release.
- **This is a candidate.** The version stays `0.0.0` and `private: true`; exports may change before a stable release.
- **Release drafts.** The proposed devnet preview and its page copy are drafts in
  [release/STAGED-RELEASE.md](release/STAGED-RELEASE.md) and [PRODUCT-PAGE.md](PRODUCT-PAGE.md); public availability
  and a stable deployment are outstanding.
