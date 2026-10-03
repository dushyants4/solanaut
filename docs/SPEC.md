# SPEC.md — Solanaut's MVP baseline, v1

> **Draft 4** · 2026-10-01 · owner: architect · for: the builder, evaluator and integrator seats, and judges
> reading the code · not public. Decisions: `design/ADR-004` (admission and receipts), `ADR-005` (transaction
> coverage, partly superseded), `ADR-006` (on-chain backstop), `ADR-009` (trust and coverage), `ADR-010` (the log is
> the state), `ADR-011` (Phantom and the dashboard). Claims: `docs/CLAIMS.md`. Roadmap: `docs/ROADMAP.md`.
> Register: `kb/DOCUMENTS.md`.

This is what the Beta MVP builds (milestones 2a.1 to 2a.10 in `docs/ROADMAP.md`), stated concretely enough to write
the failing tests from. What the Alpha adds is marked **(Alpha)**, and §13 states it as requirements with IDs. The code that exists today is described in
`docs/OVERVIEW.md`, and its defects are in §10. They are fixed first.

## 1. Scope

**In (the Beta MVP):**
- the guard core v1: bytes in; legacy, v0 and v1 decoded; an allowlist per instruction;
- policy v1, with a principal and pinned lookup tables;
- receipts, intents, the latch, and the decision log as the guard's state, with replay;
- Keel hardening and sensor v1;
- a Solana Agent Kit `BaseWallet` wrapper and a `@solana/kit` partial signer;
- the on-chain backstop: a Squads v4 spending limit on devnet;
- dashboard v0, read-only, on localhost;
- a CI job, and the batteries.

**The Alpha adds** (milestones 3.1 to 3.10): the signer process; an operator-signed policy; Token-2022 setting checks
and associated-token-account decoding; simulation and Lighthouse bounds for opaque programs; Phantom escalation and
an MCP firewall; the ElizaOS plugin; the log-anchor program; dashboard v1.

**Out:**
- mainnet and real funds, except the capped canary that ADR-008 proposes;
- key custody as a service;
- decoding swap programs such as Jupiter (they are *opaque*, §4);
- an RPC proxy and an x402 payment guard;
- anything about model safety itself.

## 2. Actors and trust

| Actor | Trusted for | Not trusted for |
|---|---|---|
| Agent (model and framework code) | nothing: it **proposes** | anything it says about a transaction's effects |
| Guard (`@solanaut/sdk`) | **admission**: decoding bytes, applying policy, asking Keel | its own integrity when it shares a process with a compromised agent (hence the signer process) |
| Signer | **execution**: signing bytes that carry a valid receipt | deciding anything |
| Operator (the human; a Phantom wallet in the canary and the Alpha) | writing and signing the policy; releasing the latch; holding the Squads config authority | — |
| RPC | sending transactions; in signer mode, block height, blockhash validity and signature statuses | telling the guard what a transaction does |
| Squads v4 program | enforcing the spending limit on-chain, whatever the guard decided | anything outside that limit |
| Dashboard | display only; it holds no keys | — |

### 2.1 Where each input comes from (ADR-009)

| Input | SDK in-process | Signer or proxy (Alpha) |
|---|---|---|
| message bytes | the caller | the caller |
| time `at` | the caller's clock, recorded | the signer's monotonic clock |
| block height, blockhash validity | the caller, recorded | the signer, from the operator's RPC |
| lookup-table contents | pinned in the policy; anything else denied | pinned, or resolved by the signer at finalized commitment |
| intent key | groups attempts for display; in-flight detection uses the effects hash | the same |
| outcome reports | the caller | the signer, from signature statuses |

**The SDK mode's limit, stated:** a process that can lie about time, heights or outcomes can also call the key
directly. The SDK mode stops a fooled or confused model, not a compromised process. Every decision records where its
inputs came from, so replay stays deterministic.

**Deployment modes:**
1. **SDK in-process** (Beta). The guard and the key live in the agent's process.
2. **Signer process** (Alpha). The key lives in `solanaut-signer`; the agent gets receipts and signatures, never the
   key.
3. **MCP firewall** (Alpha). Phantom's agent wallet holds the key; Solanaut's MCP server stands in front of it
   (ADR-011).
4. **On-chain** (Beta, devnet). Funds sit behind a Squads spending limit, so even a stolen key is bounded.

## 3. Data model v1

Amounts are `bigint`: lamports for SOL, base units for tokens. Addresses are base58 strings. Hashes are lowercase
hex SHA-256. "Canonical JSON" means sorted keys, no whitespace, and bigints as decimal strings.

```ts
interface PolicyV1 {
  version: 1;
  principal: string[];                                     // the guarded keys; their outflows are what the policy checks
  programs: { allow: string[]; opaque: "deny" | "allow" }; // opaque: allowlisted but not decoded (§4)
  destinations: { allow: string[] };                       // owners: wallets that may receive SOL or tokens
  sol: { maxPerTx: bigint; maxPerWindow: bigint };
  tokens: { mint: string; program: "token" | "token-2022"; maxPerTx: bigint; maxPerWindow: bigint }[]; // any mint not listed is denied
  fees: { maxPriorityPerTx: bigint; maxPerWindow: bigint; tipAccounts: string[] }; // lamports; the window counts priority, base fees and tips
  lookupTables: { address: string; entries: string[] }[];  // pinned prefixes; an index at or past entries.length is denied
  windowMs: number;
  intents: { maxAttempts: number };
  latch: { afterDenials: number; releaseKey: string; guardId: string; cluster: "localnet" | "devnet" | "mainnet-beta" };
  messages: { allow: false };                              // off-chain signatures are denied in v1
  cosign: { allow: false };                                // a required signer outside the principal is denied in v1
  sensor: { expectedPerMinute: number };                   // sensor v1's rate baseline (§6)
}
// policyHash = sha256(canonicalJSON(policy)). Validated at creation (§5, rule 0); frozen, deep.

interface ProposalV1 {
  message: Uint8Array;                        // the serialized message the signatures cover: legacy, v0 or v1
  at: number;                                 // ms; the caller's clock in SDK mode, the signer's in signer mode (§2.1)
  blockHeight?: bigint;                       // the current block height, from the source §2.1 names
  lastValidBlockHeight?: bigint;              // from getLatestBlockhash, for the receipt's expiry
  intent?: string;                            // the caller's grouping key; never used to decide "in flight"
}

// Derived by the guard from the bytes. Never taken from the agent's word. Built: packages/sdk/src/classify.ts (2a.3).
interface EffectsV1 {
  version: "legacy" | 0 | 1;
  messageHash: string;                        // sha256(message): what the receipt binds
  feePayer: string;
  signers: string[];                          // every required signer, in message order
  otherSigners: string[];                     // required signers outside the principal (rule 6)
  programs: string[];                         // every program called, in order of first call
  opaque: string[];                           // called programs whose instructions are not decoded
  sol: { from: string; to: string; lamports: bigint; kind: "transfer" | "new-account" }[]; // tips excluded
  tokens: { program: "token" | "token-2022"; mint: string | null; fromAccount: string; authority: string;
            toAccount: string; toOwner: string | null; amount: bigint; decimals: number | null }[];
  denied: { index: number; program: string; instruction: string;      // e.g. "Token.Approve", "System.unknown(14)"
            rule: "instruction-denied" | "durable-nonce-denied"; reason: string }[];
  nonce: boolean;                             // the first instruction advances a durable nonce
  computeUnitLimit: number;                   // v1: the config's, 0 if unset; legacy and v0: §4, "Fees"
  priorityFee: bigint;                        // §4, "Fees"
  baseFee: bigint;                            // 5,000 lamports per signature, precompile signatures included
  tips: bigint;                               // SOL sent to policy.fees.tipAccounts
  intentKey: string;                          // sha256(canonical {feePayer, signers, opaque, sol, tokens, nonce})
}

// The record (ADR-010): every entry is hash-chained, and the guard's state is what applying them in order gives.
// Built: packages/sdk/src/log.ts and state.ts (milestone 2a.5). Amounts and heights are decimal strings.
interface EntryBase {
  v: 1;
  seq: number;
  prev: string;                               // hash of the previous entry; "" for the first
  at: number;
  hash: string;                               // sha256(canonicalJSON(entry without hash))
}
interface DecisionV1 extends EntryBase {
  kind: "decision";
  source: "caller" | "signer";                // where time, heights and outcomes came from (§2.1)
  message: string;                            // the proposal's bytes, base64, so the log replays on its own
  blockHeight: string | null;                 // as the proposal stated them
  lastValidBlockHeight: string | null;
  intentKey: string | null;                   // null if the bytes could not be parsed
  group: string | null;                       // the caller's intent key, if any; recorded, never used to decide
  messageHash: string | null;
  shape: string | null;                       // hash of programs and destinations: the sensor's "same shape"
  amounts: { sol: string; tokens: { mint: string; amount: string }[]; fees: string } | null; // what an ALLOW reserves
  allow: boolean;
  rule?: RuleV1;                              // on every denial
  reason: string;
  posture: "DEFAULT" | "INHIBIT" | "REGROUND" | null; // null if Keel never ran for this proposal
  telemetry: { intensity: number; valence: number; repetition: number } | null;
  temperatureMax: number | null;
  policyHash: string;
  keel: { version: "1.0.1"; digest: string; verified: "bytes" | "declared" };
  expires?: { lastValidBlockHeight: string }; // receipts only
}
interface ReportV1 extends EntryBase { kind: "report"; decision: string; outcome: "landed" | "failed" | "expired" | "unknown"; source: "caller" | "signer" }
interface ReleaseV1 extends EntryBase { kind: "release"; latchSeq: number; text: string; signature: string } // signature base64
interface RedeemV1 extends EntryBase { kind: "redeem"; decision: string; blockHeight: string | null }
```

**A receipt is an allowed `DecisionV1`.** The signer signs `bytes` only if all of these hold:
- `allow` is true;
- `sha256(bytes) === messageHash`;
- the receipt has not been used, according to the log, which survives restarts (§7);
- the current block height, from the source §2.1 names, is at most `expires.lastValidBlockHeight`;
- `policyHash` equals its own policy's hash.

After signing, the adapter compares the signed message with the admitted one and throws on any difference (§8).

## 4. What the guard decodes (ADR-009)

**Message versions.** A message whose first byte has the high bit clear is legacy; `0x80` is v0; `0x81` is v1. Any
other version is denied as `unsupported-version`.

- **v0:** every lookup table it uses must be pinned in `policy.lookupTables`. An index at or past a pin's length is
  denied, and so is an unpinned table. Table entries are append-only and a closed table's address can never be
  re-created, so a pinned prefix stays true
  ([source](../kb/sources/2026-09-30_anza-lookup-table-properties.md)).
- **v1:** it has no lookup tables, at most 64 inline accounts, and a config section holding the compute-unit limit,
  the loaded-accounts data limit, the heap size and the priority fee as a lamport total. Any ComputeBudget instruction
  in a v1 message is denied: it would run as a no-op and mislead any reader of instructions
  ([source](../kb/sources/2026-09-30_solana-dev-skill-transactions-v1.md)).

**An allowlist per instruction.** Every instruction of a decoded program is in exactly one class. Anything not listed
is denied as `instruction-denied`.

| Program | Value-moving: destination and amount checked | Denied: grants authority or is unsafe | Allowed: benign |
|---|---|---|---|
| System | Transfer, TransferWithSeed; CreateAccount, CreateAccountWithSeed and CreateAccountAllowPrefund, whose lamports go to the new account, which must be an allowed destination | Assign, AssignWithSeed, Allocate, AllocateWithSeed, and every nonce instruction (Advance, Withdraw, Initialize, Authorize, Upgrade) | — |
| SPL Token | Transfer, TransferChecked | Approve, ApproveChecked, SetAuthority, CloseAccount, Burn, BurnChecked, MintTo, MintToChecked, FreezeAccount, ThawAccount | Revoke, SyncNative, InitializeAccount, InitializeAccount2, InitializeAccount3 |
| Token-2022 | Transfer, TransferChecked; TransferCheckedWithFee **(Alpha)** | the SPL Token list, plus every extension instruction | Revoke, SyncNative, the InitializeAccount family |
| ComputeBudget, legacy and v0 only | — | any ComputeBudget instruction in a v1 message | SetComputeUnitLimit and SetComputeUnitPrice (both feed the fee), SetLoadedAccountsDataSizeLimit, RequestHeapFrame |
| Memo, v1 and v2 | — | — | any |
| Associated Token Account **(Alpha)** | Create and CreateIdempotent, whose rent counts as SOL to the owner, who must be allowed | RecoverNested | — |
| any other program | denied unless allowlisted; if allowlisted, *opaque*, and denied while `programs.opaque` is `"deny"` | | |

**Durable nonces.** A message whose first instruction is AdvanceNonceAccount uses the nonce in place of a blockhash
and does not expire ([source](../kb/sources/2026-09-30_solana-durable-nonces.md)), so intents cannot reason about it.
It is denied as `durable-nonce-denied` in every version, as is every nonce instruction.

**The principal.** Effects are the outflows the principal authorises: System transfers and new-account funding from a
principal account, token transfers whose authority (owner or delegate) is a principal key, and the fee payer's fees.
A message that needs any signer outside the principal is denied as `other-signer` while `cosign.allow` is false.

**Rules for tokens.**
- **Destination.** A token transfer's `toAccount` must be the associated token account of an allowed owner for that
  mint, derived offline with the mint's token program (Token and Token-2022 derive different addresses), or an
  address the policy names directly.
- **Mint.** TransferChecked names it. A plain `Transfer` names no mint, so the mint is inferred when the source is the
  principal's associated token account of a listed mint. Otherwise the transfer is denied as `token-mint-unknown`.
- **Token-2022 extensions** are not read in the Beta, because the SDK has no RPC. The operator lists only mints it has
  checked, and that check is point in time: some extension settings can change later. **(Alpha)** The signer pins
  each listed mint's extension set and re-reads its mutable settings at admission.

**Fees.**
- **Priority fee.** v1: the config's lamport total. Legacy and v0: `ceil(price × limit / 1,000,000)`, where the limit
  is SetComputeUnitLimit's value if present, else the runtime default of 200,000 per instruction and 3,000 per
  builtin instruction, at most 1,400,000 ([source](../kb/sources/2026-09-27_solana-docs-fees.md)). No price means no
  priority fee.
- **Base fee.** 5,000 lamports per signature, counting each signature a precompile instruction (Ed25519, secp256k1,
  secp256r1) verifies.
- **Tips.** SOL sent to `policy.fees.tipAccounts` counts as tips, not as a payment to a destination.
- Rule 13 caps the priority fee per transaction. The fee window counts priority fees, base fees and tips together.
- **Builtins, for the default limit:** only System and ComputeBudget are counted at 3,000 units. Any other program is
  counted at 200,000, which can only over-estimate the fee, so the cap errs toward denying.

**Decided while building the classifier (milestone 2a.3):**
- **CreateAccountAllowPrefund** is decoded from SIMD-0312's layout (a `u32` 13, `u64` lamports, `u64` space, the
  owner; accounts: the new account, then an optional funder). It is denied when the new account is a principal key,
  because the SIMD warns it can brick a funded wallet
  ([source](../kb/sources/2026-09-30_simd-0312-create-account-allow-prefund.md)).
- **p-token's additions** to the Token program, Batch (255), WithdrawExcessLamports (38) and UnwrapLamports (45), are
  denied by not being listed. Batch could otherwise carry a transfer the guard would not see
  ([source](../kb/sources/2026-09-30_simd-0266-p-token.md)).
- **A token transfer whose authority does not sign**, that is a multisig authority, is denied.
- **Two ComputeBudget instructions of the same kind** are denied: the runtime refuses them, and the fee would be
  ambiguous. So is the deprecated RequestUnits, and any ComputeBudget instruction whose data is not its exact size.
- **Instruction data must fit its layout exactly.** A value-moving instruction with short or trailing data, or too
  few accounts, is denied, never counted as if it were understood.
- **The intent key** leaves out the blockhash, the version, fees, tips, ComputeBudget and Memo instructions. Two
  calls to the same opaque program share a key whatever their data: while an opaque call is in flight, another
  waits.

## 5. The rules, in order

The first failing rule is the reason for the decision. Every rule has a failing test before its code exists.

| # | Rule | Denies when |
|---|---|---|
| 0 | `invalid-policy` | at creation: a non-finite or negative cap, an empty or invalid address, an empty principal, a release key that is the fee payer or in the principal, a pinned table with an invalid entry. Creation throws; no guard exists |
| 1 | `malformed-proposal` | the bytes do not parse, or a field is missing or ill-typed |
| 2 | `unsupported-version` | the message version is not legacy, v0 or v1 |
| 3 | `lookup-table-unpinned` | a v0 message uses a table that is not pinned, or an index at or past its pinned length |
| 4 | `latched` | the guard is latched (§7) |
| 5 | `durable-nonce-denied` | the first instruction advances a durable nonce, or any nonce instruction appears |
| 6 | `other-signer` | a required signer is outside the principal, and co-signing is off |
| 7 | `program-not-allowed` | a program is not on the allowlist |
| 8 | `opaque-program` | an allowlisted program is not decoded, and `programs.opaque` is `"deny"` |
| 9 | `instruction-denied` | a denied or unknown instruction of a decoded program, or a ComputeBudget instruction in v1 |
| 10 | `destination-not-allowed` | a SOL or token destination is not allowed |
| 11 | `mint-not-allowed`, `token-mint-unknown` | a token's mint is not listed, or cannot be known |
| 12 | `over-per-tx-cap` | the SOL total, or a mint's total, is over its per-transaction cap |
| 13 | `over-fee-cap` | the priority fee is over `fees.maxPriorityPerTx` |
| 14 | `intent-in-flight` | an earlier attempt with the same effects could still land (§7) |
| 15 | `intent-attempts-exhausted` | the intent has used `intents.maxAttempts` |
| 16 | `over-window-cap` | allowing this would pass a window cap on SOL, a mint, or fees; counted at admission |
| 17 | `loop-reground` | Keel returns REGROUND |
| 18 | `inhibit-cap` | Keel returns INHIBIT, and the amount is over the per-transaction cap × `temperatureMax` (0.3). This mapping is Solanaut's design, not Gubernaut's |
| 19 | `fail-closed` | anything throws |

**Every parsed proposal reaches Keel,** allowed or denied: re-proposing a refused transfer is a loop too. A malformed
proposal has no effects to sense; it counts toward the latch instead.

## 6. Keel and sensor v1

Built at milestone 2a.7 (`evals/sdk/keel.md`).

- **Verify the bytes (D4).** `createGuard` and `replay` hash the Keel module Node resolves: the embedded wasm against
  Keel's declared digest `834015d7…ded7d8`, and the whole module, `dist/index.js`, against `8f642684…9c7190`,
  because the JavaScript around the wasm runs it too. On success `keel.verified` is `"bytes"`; on failure no guard
  exists. The module is hashed at creation; a file swapped between import and creation would not be caught.
- **Validate before ticking (D3).** Telemetry must be three numbers that `Governor.accepts()` takes. Anything else
  denies as `fail-closed`, and Keel does not tick: its `tick()` coerces `null`, strings, booleans and arrays
  (upstream finding U-2, reproduced).
- **Restore only by replay.** Keel's state is rebuilt by replaying the record (ADR-010), never loaded from stored
  numbers: `Governor.create()` accepts a non-finite state (U-3, reproduced).
- **Sensor v1,** the default; its coefficients are `SENSOR_V1` in `packages/sdk/src/sensor.ts`:
  - **intensity** = max(value against the per-transaction cap, the rate term). The rate term counts the proposals
    of the trailing minute against `sensor.expectedPerMinute`: 0 at or below it, rising linearly to 1 at five times
    it. It no longer reads normal payments as full intensity (D8).
  - **valence** = 0.2 less 0.3 for each denial, failed, expired or unknown outcome since the last landed one; a
    landed transaction resets it.
  - **repetition**, over the last 8 parsed proposals: 1 for the same intent at the same fees, if that intent has not
    landed; 0.8 for the same intent at other fees, or the same shape at higher fees (**fee escalation**); 0.5 for the
    same shape at another amount; otherwise 0. **A landed intent counts only as the same shape.**
  - Every coefficient is stated, and none was tuned after looking at a battery's result. **One definition changed
    after the first run:** the first run counted a landed payment, repeated, as a retry, which read recurring payments
    as a saturating loop. The change touched no coefficient, and the battery was re-run on fresh seeds.
  - **What the change costs.** A runaway loop of payments that all land reads as the same shape, so Keel does not
    stop it. The window caps bound it.
- **Measured** (synthetic streams, `evals/sdk/keel.md`): sensor v1 stopped 0 of 600 benign payments arriving at the
  expected rate, and 0 of 600 in bursts (95% upper bound 0.64% each), where sensor v0 stopped 82.8% and 21.7%.
  Identical failing retries stop at turn 3. Retries with rising fees stop at turn 4, by the attempts cap, with Keel at
  REGROUND too. A loop alternating two shapes, with a changing amount, is not stopped within 12 turns.

## 7. Receipts, intents, the latch, the log

- **Reserve at admission.** Caps count allowed amounts when they are allowed. An *unknown* outcome keeps its
  reservation. A `failed` or `expired` outcome releases it only when reported by a source §2.1 trusts in that mode.
- **Intents.** The intent key is the hash of the effects without fees, whatever key the caller sends. Each intent has
  attempts, each `pending`, `landed`, `failed` or `expired`.
  - Attempt *k*+1 is admitted only once attempt *k* is **reported** `failed` or `expired`. In signer mode the signer
    gets the `lastValidBlockHeight` with the blockhash and checks the blockhash's validity itself.
  - `pending` or `unknown` means `intent-in-flight`, at any height:
    - **at or below its last valid height,** the attempt could still land;
    - **past it,** the attempt can no longer land, but it may already have (D14).

    The hold lasts until a report, or until the window has passed since the intent's first attempt. Meanwhile the
    window caps count the attempt.
  - `guardedWallet` reports what it sends. What it only signs, or sends without learning the outcome, it follows up by
    signature before the next proposal: seen landed or failed, it reports that; unseen and past the last valid height,
    read before the status, it reports `expired`.
  - A `landed` intent is done; the same effects again make a new intent.
  - Report outcomes with `guard.report(decisionHash, "landed" | "failed" | "expired" | "unknown")`.
- **The latch.** It trips after `latch.afterDenials` consecutive denials, or on any REGROUND. While latched, every
  proposal is denied as `latched`.
  - Release is `guard.release(signature)`, verified with ed25519 against `latch.releaseKey` over this UTF-8 text,
    which Phantom's `signMessage` can sign:

    ```
    solanaut latch release
    guard: <latch.guardId>
    cluster: <latch.cluster>
    policy: <policyHash>
    seq: <the seq of the decision that latched>
    expires: <ISO 8601 time>
    ```

  - The agent's key cannot release it. A wrong guard, cluster, policy or seq, or an expired message, is refused.
- **The log is the state (ADR-010).** One `DecisionV1` per line, JSONL, append-only, synced to disk before the guard
  answers. Each line's `prev` is the previous line's `hash`.
  - **On start**, the guard verifies the chain and replays it, which rebuilds reservations, intents, used receipts,
    the latch and Keel's state.
  - **One writer.** The guard takes an exclusive lock on its log; a second instance refuses to start.
  - Off-chain caps bound one guard identity. The fleet-wide bound is the on-chain limit (§9).
- **Decided while building durable state (milestone 2a.6):**
  - **The file.** One canonical JSON entry per line, synced with `fsync` before the guard answers. A last line with no
    newline is a write a crash cut short and was never acknowledged, so opening the record cuts it off. Any other
    damage, such as a line that does not parse, a hash that does not match or a broken chain, refuses to start.
  - **Restore.** Every entry is applied again in order, and Keel is ticked again with each recorded telemetry. If
    Keel's posture differs from the record's, the guard refuses to start.
  - **The lock.** `<record>.lock` names the holding process and host. A live holder makes a second guard refuse; a
    dead holder's lock is taken over. The takeover is not atomic, so run one guard per record.
  - **A write that fails shuts the guard.** It denies everything, unrecorded, until it is restarted, so nothing is
    signed on a decision the record does not hold.
  - **The latch is a recorded fact.** The decision that trips it carries `latch: true`, so restoring under another
    policy cannot release it.
  - **A record outlives a policy change.** Restore applies the record under the current policy: windows, intents,
    receipts and the latch carry over. `replay` under the old policy explains the old decisions.
  - **`replay(entries, policy)`** recomputes each decision from its bytes and compares allow, rule, intent key,
    message hash, amounts, posture, telemetry, clamp, expiry and latch. An ill-formed proposal is checked only for its
    rule, because the record keeps no more of it. `npm run replay -- <record> <policy.json>` runs it.
  - **Without a `log`, the guard keeps its record in memory,** and a restart forgets it. Pass a log path to run it
    for real.
- **Decided while building admission (milestone 2a.5):**
  - **What an outcome releases.** `failed` releases the value a decision reserved but keeps its fees, which may have
    been paid; `expired` releases both; `unknown` releases nothing. Only allowed decisions take reports, and a final
    outcome cannot be reported again.
  - **When an intent ends.** When an attempt lands, or once a window has passed since its first attempt with nothing
    still able to land. So an exhausted intent can try again a window later, never sooner.
  - **No timeout is assumed.** Without block heights, only a report ends an attempt. At exactly an attempt's
    `lastValidBlockHeight` it can still land.
  - **A release starts the stream over.** It clears the latch and the run of denials, resets Keel, and empties the
    sensor's memory. The windows and intents stand.
  - **Windows run on the latest recorded time.** A caller's clock that steps back cannot shrink a window.
  - **Receipts are redeemed.** `guard.redeem(bytes, decisionHash, blockHeight)` checks the bytes, the expiry and the
    policy, and records the use, so a receipt signs once.
- **Replay.** `replay(log, policy)` recomputes every decision and reports the first divergence. Anchoring the head
  on-chain is Alpha work (§9).

## 8. Adapters

- **`guardedWallet(wallet, guard)`** implements Solana Agent Kit's `BaseWallet`
  ([source](../kb/sources/2026-09-30_solana-agent-kit-basewallet.md)), so the kit adopts it in one line. It exposes
  exactly these members and never the wrapped wallet:
  - `publicKey`;
  - `signTransaction`: check, then sign or throw;
  - `signAllTransactions`: all or nothing;
  - `signAndSendTransaction`: check, sign, send, then report the outcome;
  - `sendTransaction`: check, sign, send and report, the same as above;
  - `signMessage`: denied. A raw ed25519 signature over a message's bytes is a valid transaction signature.
  - After signing, it compares the signed message with the admitted one and throws on any difference.
- **`SolanautDenied`** is the typed error carrying `{rule, reason, decision}`. A denied agent gets a named rule to act
  on, not a hang or a silent retry.
- **`@solana/kit` signer:** a `TransactionPartialSigner` whose `signTransactions` checks each transaction's message
  bytes, then delegates to the wrapped signer ([source](../kb/sources/2026-09-30_solana-kit-signers.md)). Wrapping a
  modifying or sending signer is out of scope in the Beta.
- **Decided while building the adapters (milestone 2a.8, `evals/sdk/adapters.md`):**
  - **No web3.js import.** `guardedWallet` reads web3.js transactions by their shape: `serializeMessage()` for a
    legacy transaction, `message.serialize()` for a versioned one. The SDK keeps one runtime dependency.
  - **An RPC is required, and the guard sends.** After the wallet signs, the guard sends the exact bytes it compared,
    through its own RPC, so nothing a wallet adds on send goes out. Then it waits for the outcome and reports it.
    A send the RPC refuses (`RpcRefused`, a JSON-RPC error answer) is reported `failed` and rethrown. Any other
    failed send, such as a dropped connection, a timeout or an HTTP error, is reported `unknown` and rethrown: its
    bytes may still land (D13).
  - **Expiry, bounded from above.** A transaction names its blockhash, not that blockhash's last valid height, so
    `guardedWallet` uses the current height plus 150. Too high a bound keeps an attempt in flight longer, and lets a
    receipt redeem a little late, for bytes the chain would refuse anyway. A kit transaction carries its lifetime, so
    `guardedSigner`'s expiry is exact.
  - **After signing**, the message must be the admitted one and the signature must verify by the wallet's key over
    it. Otherwise every signature on the caller's object is removed, the decision is released, and the call throws
    `SolanautDenied` with rule `wallet-changed-message`.
  - **All or nothing, and nothing held for nothing.** A batch is checked whole before the wallet sees any of it. When
    a batch is refused, or the wallet refuses to sign, every decision admitted for it is reported `expired`: its
    bytes were never signed, so they cannot land.
  - **`SolanautDenied`** carries `{ rule, reason, decision }`. Two rules have no decision behind them:
    `message-signing-denied` and `wallet-changed-message`.
  - **`jsonRpc(url)`** is the RPC client: `getBlockHeight`, `sendTransaction` with base64 bytes, and
    `getSignatureStatuses` polled until the signature lands or fails, its blockhash expires, or a timeout gives
    `unknown`, reading the height before the status. Reads back off and try again through a failed read, such as
    a public RPC's HTTP 429. A send is never retried by the client. `getSignatureStatus`, an optional `RpcLike`
    member, reads a signature's status with history searched, for following up what was only signed (D14).
- **Integrating with Solana Agent Kit (milestone 2b.3, `evals/agentkit/sak-local.md`).** With the one-line change,
  drains are refused on both of the kit's paths, and a whole transaction works unchanged. The kit's plugins hand it
  bare instructions, and the kit signs each such payment twice ([source](../kb/sources/2026-10-01_solana-agent-kit-signorsendtx.md)),
  so the guard refuses the second signature as `intent-in-flight`, rightly. Until the kit signs once, an integrator
  passes it whole transactions. The finding is recorded for SendAI; Solanaut does not relax the rule for it.
- **ElizaOS plugin (Alpha).** It wraps `plugin-solana`'s signing path; how is decided from its source when the Alpha
  starts.
- **`solanaut-signer` (Alpha):** a local process holding the key.
  - It answers `propose`, `report` and `status` over a Unix socket; every other method is refused.
  - It stamps time and fetches heights, blockhash validity and outcomes itself (§2.1).
  - Each request has a deadline of 30 s or less and an ID, so a retried request is safe.
  - The target is 500 lines or fewer, stated and then measured.
- **MCP firewall (Alpha).** It stands in front of Phantom's MCP agent wallet and allows only the tools the policy
  names (ADR-011).
- **Wallets that append instructions (Alpha).** A signed message returned by a wallet in scope passes only if every
  admitted instruction is byte-identical and in order, every appended instruction belongs to the Lighthouse program
  (`L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95`) with read-only accounts, and the fee check passes again
  ([source](../kb/sources/2026-09-30_phantom-lighthouse.md)).

## 9. On-chain backstop (ADR-006, ADR-011)

- **Squads v4 on devnet.** A controlled multisig whose config authority is the operator: a devnet operator key in the
  Beta, the operator's Phantom wallet in the canary.
  - **The agent's key is not a multisig member.** It is named only in the spending limit's members, which is all that
    Squads v4's `spending_limit_use` checks ([source](../kb/sources/2026-09-30_squads-v4-spending-limit-use.md)).
  - The limit: mint (SOL, or a devnet USDC), amount N per day, destinations the policy's allowed owners. The
    destination list is never empty, because an empty list allows any address
    ([source](../kb/sources/2026-09-30_squads-v4-add-spending-limit.md)).
  - A stolen agent key can then move at most N per day, only to those destinations, whatever runs off the chain.
  - **The kill switch** is removing the spending limit, by the config authority. Removing a member revokes nothing.
    The revoke is timed on devnet.
  - The config authority is a single point of control: it can add a limit to any destination. That is accepted and
    stated; an autonomous multisig with config transactions is the slower-to-revoke alternative.
- **`solanaut_anchor` (Alpha).** A tiny Anchor 1.2 program with one instruction, `anchor(head: [u8; 32], seq: u64)`.
  It writes the log head to a PDA for each guard and emits `DecisionAnchored`, which detects a wholesale rewrite of the
  log. It ships with a verified build and a `security.txt`.

## 10. Defects in the current slice, fixed first

Each is fixed test-first: the evaluator writes the failing test, and the builder fixes the code.

| ID | Defect | Where | Fix |
|---|---|---|---|
| D1 | `guard.policy` is the live internal object, and `Readonly<>` is shallow, so `guard.policy.allowedDestinations.push(x)` compiles and widens the allowlist | `guard.ts:45,98` | deep-freeze a private copy; expose a frozen clone |
| D2 | The policy is never validated: `maxLamportsPerTx: NaN` disables the cap (`amount > NaN` is false) | `policy.ts:54` | rule 0 |
| D3 | Telemetry is not validated before `tick()`, which coerces `null`, `"0.5"`, `true` and `[0.7]` (reported upstream, to reproduce) | `guard.ts:61` | §6 |
| D4 | The digest check compares two constants; the controller's bytes are never hashed | `guard.ts:41-44` | §6 |
| D5 | `describeTransaction` runs outside the fail-closed boundary: a decode error throws instead of denying | `describe.ts`, callers | `guard.check(bytes)` decodes inside it |
| D6 | Legacy transactions only; SPL, Token-2022, ComputeBudget, v0 and v1 are not decoded; allowlisting the System or the Token Program allows any of its instructions | `describe.ts` | §4 |
| D7 | Nothing binds an ALLOW to the bytes later signed, and no decision log exists | `guard.ts` | §7 |
| D8 | Sensor v0's rate term reads fast legitimate payments as full intensity on a real clock | `sensor.ts:35` | §6 |
| D9 | Lamports are JS numbers; precision is lost above 2^53 | `policy.ts`, `describe.ts:15` | `bigint` throughout |
| D10 | Only System Transfer is decoded: CreateAccount, CreateAccountWithSeed, TransferWithSeed, WithdrawNonceAccount and every other System instruction pass with 0 lamports counted when System is allowlisted | `describe.ts:11-16` | §4 |
| D11 | Reservations, sensor state and Keel's state live in memory; a restart resets the caps and would un-latch a guard | `guard.ts:47-51` | §7, ADR-010 |
| D12 | The core decodes through `@solana/web3.js` | `describe.ts:5`, `packages/sdk/package.json` | decode bytes without it, cross-checked in tests (ADR-009) |
| D13 | `guardedWallet` reported every rejected send `failed`, which frees the payment's value and admits a re-sign, though a dropped connection, a timeout or an HTTP error leaves the bytes able to land | `adapters/agent-kit.ts`, `adapters/rpc.ts` | `failed` only when the RPC refused the bytes (`RpcRefused`); otherwise `unknown` |
| D14 | An attempt nobody reports is treated as unable to land once its last valid height passes, so a retry of a payment that landed unreported is admitted. A sign-only integration, where the wallet signs and the caller sends, never reports | `state.ts` (`couldStillLand`), `adapters/agent-kit.ts` (`signTransaction`) | an unresolved attempt holds its intent until reported; `guardedWallet` follows up what it signed (§7) |

**Status:** closed at milestone 2a.5 (`evals/sdk/admission.md`), test-first: D1, D2, D5, D6, D7, D9, D10 and D12. D12
closed early: the guard decodes bytes itself, so `packages/sdk/src` imports no web3.js. D11 closed at milestone 2a.6
(`evals/sdk/durable.md`) for every guard given a `log`. D3, D4 and D8 closed at milestone 2a.7 (`evals/sdk/keel.md`).
**Every defect D1 to D12 is closed.**

**Found on 2026-10-01, preparing and running devnet:**
- **D13 is closed**, test-first ([sdk/adapters.md](../evals/sdk/adapters.md), section 4).
- **D14 is closed**, test-first (`evals/sdk/intents-d14.md`). It was found when the devnet run showed Solana Agent Kit
  reporting landed payments as failed, which invites a retry (`evals/agentkit/sak-devnet.md`), and was confirmed
  offline. An unreported attempt past its last valid height either landed or never will, and the old rule read that
  as "never will". The fix:
  - **The rule:** an unresolved attempt holds its intent until it is reported, or until the window has passed since
    the intent's first attempt.
  - **The adapter:** `guardedWallet` follows up the attempts it signed but did not see land, and reports what the
    chain says.
  - **The RPC client:** `confirm` reads the height before the status. Read the other way round, a payment processed
    at its last valid height could be called `expired`.

## 11. Batteries and acceptance

**The Beta gate** (milestone 2b.1 in `docs/ROADMAP.md`). Every case runs from a clean clone.

| Battery | Cases | Passes when |
|---|---|---|
| fail-closed | garbage bytes; an unknown version; an unpinned table and an index past a pin; NaN or non-number telemetry; tampered controller bytes; an invalid policy | every case denies with its named rule |
| drain, incident-shaped, at least 30 cases | a new recipient; Approve to an attacker; SetAuthority; an oversized send of a listed mint; an unlisted program; a token sent to a non-associated account; a durable-nonce transfer; CreateAccount funding a counterparty's key; a table index that points at an attacker; a v1 message with a ComputeBudget decoy; a price with no limit; another signer's instruction | every case denies with its named rule |
| double-send | re-sign before expiry; re-sign after an unknown outcome; re-sign after expiry with the outcome still unknown; re-sign after expiry once reported `expired`; the same effects under a new intent key | `intent-in-flight`, `intent-in-flight`, `intent-in-flight` (D14), allowed, `intent-in-flight` |
| concurrency | 50 proposals in one tick against the window cap | exactly the cap is admitted |
| restart | the guard killed at 20 random points, then restarted | the restored state equals the state before, checked by replay |
| latch | a valid operator release; the agent's key; a wrong seq; an expired message | released, refused, refused, refused |
| loop | identical retries; retries with rising fees; retries alternating two shapes | the stop turn is **measured and reported**, with no threshold assumed |
| benign | at least 500 varied payments at realistic rates | the false-stop rate is **measured and reported** with a 95% confidence interval |
| adapters | a Solana Agent Kit agent and a kit agent, each with a one-line change | the same verdicts as the SDK on every case |
| on-chain | a stolen-key script calling Squads directly | the program refuses past the limit on devnet |
| end to end | the incident-shaped scenarios on devnet, shown in the dashboard | each refusal is visible, with its rule |

**The Alpha's thresholds** (milestone 3.10) are in `docs/READINESS.md`: coverage, mutation, property and fuzz tests,
differential decoding, replay across Node versions, crash recovery, soak, performance, the red team and outside
developers.

Rates go into `docs/CLAIMS.md` only after they are measured, with their version, config and a command that
regenerates them.

## 12. Open questions

- Should a REGROUND on a proposal an earlier rule already denied trip the latch? In the cockpit's demo, one re-send of
  a payment whose outcome was unknown was denied as `intent-in-flight`, met REGROUND (repetition 1, valence -0.4), and
  latched the guard (`evals/cockpit/v0.md`). The latch guards double-sends, and may be heavy-handed for one retry.
  **Seen again on devnet, every run:** DEMO.md's scene 5, one re-sign while the first attempt is in flight, is denied
  by rule 14 and meets REGROUND at repetition 1 with valence 0.2. It latches the guard until the operator signs
  (`evals/e2e/scenes-devnet.md`). For the Alpha's red team; to decide before the demo is recorded.
  **Measured, and answered by a proposal:**
  - Four trip rules were run on the same streams (`evals/sdk/latch-variants.md`). None admits anything the policy
    forbids.
  - After two landed payments, today's rule latches on scene 5's single re-sign, at every share of the cap tried, and
    stops the next 10 good payments.
  - [ADR-012](../design/ADR-012-latch-on-reground.md), **proposed for the human:** a REGROUND denial latches when Keel
    is the reason, or when the denial before it was also at REGROUND. Identical retries still latch at turn 3.
- Should a run of failed outcomes trip the latch, as a run of denials does? A loop that alternates two shapes and
  changes its amount passes every rule while each send fails, and is bounded only by the fee window and the clamp
  under INHIBIT (`evals/sdk/keel.md`). For the Alpha's red team (milestone 3.10).
- ElizaOS: wrap the plugin's action handlers, or its wallet? Decided when the Alpha starts.
- Lighthouse's memory-write instructions fund and write an account. They need their own rule before any wallet that
  appends them is admitted (Alpha).
- Token-2022's mutable settings: which extension settings can change after initialisation, read against the
  `spl-token-2022` source (Alpha).
- Alpenglow is live on testnet, not yet on mainnet. The canary's pre-flight re-checks commitment and expiry
  assumptions (ADR-008).

**Answered 2026-09-30:** a Squads limit member need not be a multisig member (§9); v1's rollout (mainnet, 2026-09-15);
the kit signer interface to wrap (`TransactionPartialSigner`); and, at milestone 2a.2, kit's default version: in
`@solana/kit` 8.4.0 there is none. `createTransactionMessage({ version })` requires one, and the transaction planner
calls a factory the caller supplies, whose documented example uses version 0. Kit's separate plugin packages were not
checked. The guard decodes whatever version arrives, so the answer changes no rule.

## 13. The Alpha, as requirements (milestone 2c.1)

**A draft for the human to approve at 2c.1.** Each requirement has an ID, is stated so a test can fail it, and names
where it comes from and what will verify it. Every Beta rule and invariant (§3 to §8) still holds; these add to them.
A choice that needs research before it can be stated is marked **ADR owed**, and the ADR is written before that
milestone's code.

### 13.1 Signer process (milestone 3.1)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| SIG-1 | The key lives only in `solanaut-signer`. The agent gets receipts and signatures, never key material | §2, T9 | a test that no API reachable from the agent returns key bytes |
| SIG-2 | It answers `propose`, `report` and `status` over a Unix socket, and refuses every other method | §8 | one test per method, and an unknown method refused |
| SIG-3 | Every request has an ID and a deadline of 30 s or less. A retried ID returns the first answer, and admits nothing twice | §8 | retried and timed-out requests |
| SIG-4 | It stamps time from a monotonic clock, and fetches block height, blockhash validity and signature statuses from the operator's RPC. Values a caller sends are ignored, and every decision records `source: "signer"` | §2.1, T20, T21 | a caller lying about time and height changes no decision |
| SIG-5 | It resolves a lookup table that is not pinned only at finalized commitment, and records what it read | §2.1, T14 | a table extended after its read |
| SIG-6 | It signs only bytes whose receipt redeems (§3), then compares the signature over the admitted message | §3, §8 | each redeem condition broken once |
| SIG-7 | It follows up every attempt it signed, reporting landed, failed or expired from the chain | §7, D14 | the double-send battery with no caller reports |
| SIG-8 | One writer, restore by replay on start, and a failed write shuts it | §7 | the restart battery, 100 kills (`docs/READINESS.md`) |
| SIG-9 | Reads back off through rate limits; a send is never retried by the client | §8, RK16 | an RPC answering 429 |
| SIG-10 | It runs as its own OS user, or the documents state that it does not and what that leaves | T9, T29 | [ADR-013](../design/ADR-013-signer-process.md), proposed: its own user, a Unix socket in a group-only directory, and a same-user mode that says so |
| SIG-11 | 500 lines or fewer, stated before it is written and measured after | §8 | a line count in its receipt |

### 13.2 Operator-signed policy (milestone 3.2)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| POL-1 | A guard loads a policy only with the operator's ed25519 signature over a structured UTF-8 text naming the guard, the cluster, the policy hash and a version, which Phantom's `signMessage` can sign | ADR-011 §1 | a valid signature loads |
| POL-2 | No signature, a wrong key, another guard or cluster, a hash that differs, or a version older than the current one: the guard refuses to start | T11 | one test each |
| POL-3 | The agent's keys cannot sign a policy: the operator key is outside the principal and is not the fee payer | rule 0 | an invalid policy |
| POL-4 | The record holds each signed policy, so replay knows which policy made each decision | §7 | replay across a policy change |
| POL-5 | How a signed policy replaces the running one | §7 | [ADR-014](../design/ADR-014-operator-signed-policy.md), proposed: a restart, a recorded `policy` entry, versions that only rise, and a summary the operator reads in Phantom |

### 13.3 Token-2022 and token accounts (milestone 3.3)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| TOK-1 | Each listed Token-2022 mint's extension set is pinned in the policy. A mint whose extensions differ at admission is denied | §4, T15 | an extension added after listing |
| TOK-2 | The settings an extension lets an authority change after initialisation are re-read at admission, from the operator's RPC | §4, §12 | each mutable setting changed once |
| TOK-3 | TransferCheckedWithFee is value-moving: the amount and the fee count against the mint's caps | §4 | a fee that crosses the cap |
| TOK-4 | Associated Token Account Create and CreateIdempotent are decoded: the rent counts as SOL to the owner, who must be an allowed destination. RecoverNested is denied | §4, T27 | an account created for an unlisted owner |
| TOK-5 | Which settings are mutable, and whether a transfer hook is ever admitted, is decided from the `spl-token-2022` source | §12 | [ADR-016](../design/ADR-016-token-2022-settings.md), proposed: a permanent delegate not listable by default; the hook program and the fee ceiling pinned; the rest stated |

### 13.4 Opaque programs bounded (milestone 3.4)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| OPQ-1 | A transaction calling an allowlisted opaque program is simulated on the operator's RPC. Every change to a principal-controlled account (lamports, token amounts, owner, delegate, close authority) must be within the policy | ADR-009, T3 | a simulated drain denied |
| OPQ-2 | Lighthouse assertions are appended for every principal-controlled account, holding its balances to the simulated bound and its authorities unchanged. The receipt binds the bytes with the assertions | T3, ADR-009 | the receipt's hash covers them |
| OPQ-3 | A simulation that fails, is unavailable, or disagrees with the decoded effects is a denial | rule 19 | each failure mode |
| OPQ-4 | Only read-only assertion instructions are appended or admitted. Lighthouse's memory-write instructions are denied until they have a rule | T28, §12 | a memory-write instruction |
| OPQ-5 | If the assertions would push the transaction past its size or compute limit, the proposal is denied, never sent unbounded | T3 | an oversized route |
| OPQ-6 | On a Surfpool mainnet fork, a Jupiter route bounded this way lands, and the same route altered to drain fails on-chain by an assertion | `docs/ROADMAP.md` 3.4 | the fork run's receipt; if it cannot be met, the Alpha denies opaque programs and says so (RK6) |
| OPQ-7 | The assertion set, and how the simulated bound becomes it | — | **ADR owed:** bounding opaque programs |

### 13.5 Phantom paths (milestone 3.5)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| PHX-1 | A proposal denied only by a cap (rules 12, 16 or 18) may become a request for the operator to co-sign in Phantom. What comes back must pass §8's rule for appended instructions and the fee check again before it is sent | ADR-011 §4, T28 | a co-signed result with an appended write instruction is refused |
| PHX-2 | An escalation and its outcome are recorded, and replay explains them | §7 | replay of an escalated decision |
| PHX-3 | The MCP firewall exposes only the tools the policy names. `send_solana_transaction`'s bytes go through the guard; `transfer_tokens`' fields are checked, including the rent of the token account it creates by default; `sign_solana_message` and every other tool are denied | ADR-011 §3, T17 | one test per tool |
| PHX-4 | A `networkId` other than the policy's cluster is refused, including the tool's default, `solana:mainnet`, when the cluster is devnet | the Phantom MCP source note | the default refused on devnet |
| PHX-5 | Phantom's MCP server runs as a separate OS user, and its agent wallet is funded only through the spending limit. Against a compromise under that user, the firewall is advisory, and the documents say so | T29 | a devnet run record |

### 13.6 ElizaOS plugin (milestone 3.6)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| ELZ-1 | The guard sits in `plugin-solana`'s signing path, with the same verdicts as the SDK on the adapters battery's cases | §8 | the adapters battery |
| ELZ-2 | Whether it wraps the plugin's action handlers or its wallet is decided from the plugin's source | §12 | **ADR owed:** the ElizaOS integration point |

### 13.7 Log anchor (milestone 3.7)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| ANC-1 | `solanaut_anchor`, in Anchor 1.2, has one instruction, `anchor(head: [u8; 32], seq: u64)`, which writes the head to one PDA per guard and emits `DecisionAnchored` | §9 | a devnet anchor |
| ANC-2 | Only the guard's anchor authority may anchor, and `seq` must increase | T12 | a stale or foreign anchor refused |
| ANC-3 | Replay checked against the anchored head detects a record rewritten before that anchor | T12 | a rewritten record |
| ANC-4 | A verified build and a `security.txt` | §9 | the verification result |
| ANC-5 | The head is anchored at most once a minute while entries are new, and at once after a latch, a release or a policy entry, by a dedicated anchor key outside the principal | T12 | [ADR-015](../design/ADR-015-log-anchor-cadence.md), proposed |

### 13.8 Dashboard v1 (milestone 3.8)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| DSH-1 | A view across several guards: decisions, spend against caps, intents, latches and each Squads limit | ADR-011 §5 | screenshots and a run record |
| DSH-2 | Alerts: a latch, a run of denials, a window near its cap, a limit near its period's total | ADR-011 §5 | each alert triggered once |
| DSH-3 | Operator actions (release the latch, revoke the limit) are signed in Phantom through the Wallet Standard; the dashboard holds no keys | ADR-011 §5 | a release and a revoke on devnet |
| DSH-4 | Localhost only, until a hosted domain passes an OWASP ASVS level 2 review and Phantom's domain review | ADR-011 §5 | the server binds 127.0.0.1 |

### 13.9 CI hardened (milestone 3.9)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| CI-1 | The fault injections that showed each gate failing re-run on every push (the `bite` job) | `evals/README.md` | a planted fault fails CI |
| CI-2 | The coverage, mutation, property, fuzz, differential and performance gates in `docs/READINESS.md`, as confirmed at 2c.1, run in CI, each seen failing first | READINESS | each gate's receipt |

### 13.10 Tested hard (milestone 3.10)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| RT-1 | Every Leg 3 threshold in `docs/READINESS.md`, as confirmed at 2c.1, is met | READINESS | receipts |
| RT-2 | The red team: at least 40 cases in at least 10 classes, by an evaluator who did not build the code, given only the spec; each denied by its named rule or bounded on-chain | READINESS, RK12 | the red team's report |
| RT-3 | The open questions in §12 are decided, each with a measured stream: when REGROUND latches (ADR-012), runs of failed outcomes, and loops that alternate shapes | §12 | the loop battery |
| RT-4 | Threat model v3 is reviewed, and no critical or high finding is open | `docs/ROADMAP.md` 3.10 | the Alpha milestone review |

### 13.11 Decisions owed before Leg 3 builds

| ADR | Decides | Before |
|---|---|---|
| ADR-012 | when REGROUND latches the guard (proposed; the human's) | the demo is recorded |
| [ADR-013](../design/ADR-013-signer-process.md), proposed | the signer's process, OS user and transport (SIG-10) | 3.1 |
| [ADR-014](../design/ADR-014-operator-signed-policy.md), proposed | policy signing and policy changes (POL-5) | 3.2 |
| [ADR-016](../design/ADR-016-token-2022-settings.md), proposed | Token-2022's mutable settings and transfer hooks (TOK-5) | 3.3 |
| owed | bounding opaque programs: simulation and the assertion set (OPQ-7) | 3.4 |
| owed | the ElizaOS integration point (ELZ-2) | 3.6 |
| [ADR-015](../design/ADR-015-log-anchor-cadence.md), proposed | the anchor's cadence and payer (ANC-5) | 3.7 |

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft, from the research foundation (`kb/milestones/2026-09-27_R-research.md`). |
| Draft 2 | 2026-09-30 | The verified review (`runs/2026-09-30-verified-review-roadmap.md`): trust per mode; v1 decoded; tables pinned; an allowlist per instruction; durable nonces and other signers denied; the fee rule corrected; intents keyed by effects; the log as the state; the adapter surface; the structured latch release; the Squads membership question answered; D10 to D12; new battery cases. Phases are now the roadmap's milestones. |
| Draft 3 | 2026-10-01 | Built through milestone 2a.5 (`runs/2026-10-01-beta-build.md`): the effects model as implemented (`otherSigners`, outflow sources, denial rules, the intent key's definition); the record's four entry kinds; the decisions made while building, in §4 and §7; kit's default version answered; D1, D2, D5, D6, D7, D9, D10 and D12 closed; then 2a.6: the durable record, restore, the lock, replay, the latch as a recorded fact, and D11 closed; then 2a.7: Keel's bytes and telemetry checked, sensor v1 as built and measured, D3, D4 and D8 closed, an open question on runs of failures; then 2a.8: the adapters as built; then 2a.10: an open question on latching after a denied retry; then 2b.3: integrating with Solana Agent Kit; then devnet (2a.9, 2a.10, 2b.1, 2b.3): D13 found and closed, D14 found and closed (§7, §11's double-send battery), the open question on latching seen on devnet. |
| Draft 4 | 2026-10-01 | For milestone 2c.1: §13, the Alpha as requirements with IDs (SIG, POL, TOK, OPQ, PHX, ELZ, ANC, DSH, CI, RT), each traced to its source and the test that will verify it; six ADRs owed before Leg 3 builds. |
