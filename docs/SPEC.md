# SPEC.md — Solanaut's MVP baseline, v1

> **Draft 4.90** · 2026-10-10 · owner: architect · for: the builder, evaluator and integrator seats, and judges
> reading the code · public since 2026-10-12. Decisions: `design/ADR-004` (admission and receipts), `ADR-005` (transaction
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
  intent?: string;                            // the caller's grouping key, at most 256 characters; never used to decide "in flight"
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
  intentKey: string;                          // sha256(canonical {feePayer, signers, opaque, sol, tokens, nonce}), exactly as §4 states
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
  disclosure?: "full";                      // signed development mode; omitted under class/legacy policies
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
other version is denied as `unsupported-version`. Within a version, a message Solana could not execute does not parse
(`malformed-proposal`): an account listed twice, a lookup table listed twice, or header counts larger than the
account list.

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
The principal is not an allowed destination unless `destinations.allow` names it, so a principal key paying another,
or itself, is denied as `destination-not-allowed` until the policy lists it.

**Programs.** Every program a message calls must be on `programs.allow`, decoded or not (rule 7). Decoding a program,
such as System, Token, ComputeBudget or Memo, decides how its instructions are read, not whether it may run.

**Rules for tokens.**
- **Destination.** A token transfer's `toAccount` must be the associated token account of an allowed owner for that
  mint, derived offline with the mint's token program (Token and Token-2022 derive different addresses), or an
  address the policy names directly.
  - "The mint's token program" is the program the instruction runs under. The policy lists a mint with its program,
    so a transfer of a listed mint under the other token program is a pair the policy does not list:
    `mint-not-allowed`.
  - Without a known mint, no destination can be recognised as an associated account. So a plain `Transfer` whose mint
    cannot be inferred, to an address the policy does not name, is denied by rule 10 (`destination-not-allowed`),
    which comes before rule 11.
- **Mint.** TransferChecked names it. A plain `Transfer` names no mint, so the mint is inferred when the source is the
  principal's associated token account of a listed mint. Otherwise the transfer is denied as `token-mint-unknown`.
- **Token-2022 extensions** are not read in the Beta, because the SDK has no RPC. The operator lists only mints it has
  checked, and that check is point in time: some extension settings can change later. **(Alpha)** The signer pins
  each listed mint's extension set and re-reads its mutable settings at admission.

**Fees.**
- **Priority fee.** v1: the config's lamport total. Legacy and v0: `ceil(price × limit / 1,000,000)`, where the limit
  is SetComputeUnitLimit's value if present, else the runtime default of 200,000 per instruction and 3,000 per
  builtin instruction ([source](../kb/sources/2026-09-27_solana-docs-fees.md)). Either way the limit is at most
  1,400,000, as the runtime caps it. No price means no priority fee.
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
  - **Exactly:** `sha256(canonicalJSON({ feePayer, signers, opaque, sol, tokens, nonce }))`. In it, `signers` and
    `opaque` are sorted; `sol` and `tokens` are each outflow's own canonical JSON, as a string, sorted; and `nonce` is
    the boolean.
  - So the key does not depend on the order of instructions. The evaluator recomputed it from this text alone
    (`evals/independent/e1-decode/`, case S02).

## 5. The rules, in order

The first failing rule is the reason for the decision. Every rule has a failing test before its code exists.

| # | Rule | Denies when |
|---|---|---|
| 0 | `invalid-policy` | at creation: a non-finite or negative cap, an empty or invalid address, an empty principal, a release key in the principal (every fee payer the guard admits is a principal key, rule 6), a pinned table with an invalid entry. Creation throws; no guard exists |
| 1 | `malformed-proposal` | the bytes do not parse, or a field is missing or ill-typed: a time that is not a finite number, a height that is not a non-negative bigint, an intent that is not text of at most 256 characters |
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
  - **valence** = 0.2 less 0.3 for each denial, failed, expired or unknown outcome since the last landed one,
    clamped at −1, the lowest value Keel accepts; a landed transaction resets it.
  - **repetition**, over the last 8 parsed proposals: 1 for the same intent at the same fees, if that intent has not
    landed; 0.8 for the same intent at other fees, or the same shape at higher fees than a payment that has not landed
    (**fee escalation**); 0.5 for the
    same shape at another amount; otherwise 0. **A landed intent counts only as the same shape.**
  - Every coefficient is stated, and none was tuned after looking at a battery's result. **One definition changed
    after the first run:** the first run counted a landed payment, repeated, as a retry, which read recurring payments
    as a saturating loop. The change touched no coefficient, and the battery was re-run on fresh seeds.
  - **What the change costs.** A runaway loop of payments that all land reads as the same shape, so Keel does not
    stop it. The window caps bound it.
- **Measured** (synthetic streams, `evals/sdk/keel.md`): at a constant priority fee, sensor v1 stopped 0 of 600 benign
  payments arriving at the expected rate, and 0 of 600 in bursts (95% upper bound 0.64% each), where sensor v0 stopped
  82.8% and 21.7%, each after one stop, refusing every payment after it with no operator to release the latch. With the
  fee varied per payment, sensor v1 stopped none of 3,000 on fresh seeds, the operator releasing each latch, after its
  second definition change (below); before it, 15 of 3,000 on the independent evaluator's streams.
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
    window caps count the attempt. An attempt that a trusted height shows can still land stays in the windows past
    `windowMs`, until it is reported or its blockhash expires (D20). Without heights, the windows slide as written.
  - `guardedWallet` reports what it sends. What it only signs, or sends without learning the outcome, it follows up by
    signature before the next proposal: seen landed or failed, it reports that; unseen and past the last valid height,
    read before the status, it reports `expired`.
  - A `landed` intent is done; the same effects again make a new intent.
  - Report outcomes with `guard.report(decisionHash, "landed" | "failed" | "expired" | "unknown")`.
- **The latch.** It trips after `latch.afterDenials` consecutive denials. A REGROUND denial trips it when Keel
  is the reason (`loop-reground`), or the previous decision in the record was also a REGROUND denial
  (ADR-012 option C). Reports do not replace that predecessor; any intervening non-REGROUND decision breaks
  the pair. While latched, every proposal is denied as `latched`.
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
  - A release in the record is verified again on restore and in replay (D17). The checks are its signature by
    `latch.releaseKey` over its text, its guard and cluster, the seq of the latch it releases, and its expiry against
    its own recorded time. So an edited record cannot release a latch. A policy that changes `latch.releaseKey` cannot
    restore a record whose releases the old key signed, until ADR-014's `policy` entries carry each policy.
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
    Keel's posture differs from the record's, the guard refuses to start. Restore checks the chain, the releases (D17)
    and Keel's postures. It does not recompute each decision, so a record rewritten and re-sealed whole restores as
    written: threat T12's residual. `replay` recomputes every decision and finds such a rewrite. The Alpha closes it
    at start, once policies are in the record (ADR-014) and its head is anchored (ADR-015).
  - **The lock, revised under accepted ADR-019.** Manual SDK mode refuses every existing marker,
    including a dead owner. Linux kernel mode holds an exclusive `flock` for the writer's lifetime,
    retains the mutex inode on close and recovers only after acquiring that lock. Inode replacement
    closes the writer. Deployment requires an operator-owned local filesystem; see `STORAGE.md`.
    Established protected records use `create: false`; missing history never becomes an empty record.
  - **Complete writes.** Short writes advance until the whole line is written; zero progress or sync
    failure closes the writer. Newly created record and ownership names have their directory synced.
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
  - **Windows run on the latest recorded time.** A caller's clock that steps back cannot shrink a window. A
    release's expiry is judged the same way, so a clock that steps back cannot revive an expired release (D19).
  - **Receipts are redeemed.** `guard.redeem(bytes, decisionHash, blockHeight)` checks the bytes, the expiry and the
    policy, and records the use, so a receipt signs once. A receipt whose decision was already reported landed,
    failed or expired does not redeem (D18). A receipt with an expiry needs the current height to redeem; without one,
    it is refused.
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
- **`SolanautDenied`**, under accepted ADR-025, carries `{ref, class}` by default.
  Its message and stack contain only the class and reference, never a rule,
  reason, policy value, address or decision object. The reference is the recorded
  decision sequence; `-1` means this refusal has no associated recorded decision (including
  adapter-only refusals and failed persistence). No unrelated decision is substituted.
- **Operator channel:** `createGuard({onRefusal})` receives a detached, deeply
  frozen `{rule, reason, decision}` after a denied decision is persisted, exactly
  once. Adapter-only refusals use the same callback with their decision or null;
  adapters do not notify twice for a denial already delivered by `check`.
  Synchronous/asynchronous callback failures produce a fixed structured operator
  diagnostic on stderr, without the thrown text. They never change a decision or
  edit its sealed journal entry; this is an operator diagnostic outside the decision chain.
- **Disclosure policy:** omitted `disclosure` means `class`, preserving the
  canonical bytes/hash of legacy policies. Explicit `class` or `full` is copied,
  frozen and included in signed policy text. `full` requires verified operator
  authorisation and returns rule/reason for development; it never exposes the
  decision object. Full-mode decisions carry `disclosure: "full"`; replay checks
  that annotation. Legacy/class decisions omit it. No evaluation rule changes.
  The signer socket always uses class-only refusals, even under development full mode.

The class table is frozen before implementation tests. Unknown causes default
to `refused`; no class is inferred by searching reason text.

| Class | Rules / operational causes |
|---|---|
| `invalid` | `invalid-policy`, `malformed-proposal`, `unsupported-version` |
| `retry-later` | `intent-in-flight`, `blockhash-expired`, `rpc-unavailable` |
| `refused` | `lookup-table-unpinned`, `latched`, `durable-nonce-denied`, `other-signer`, `program-not-allowed`, `opaque-program`, `instruction-denied`, `destination-not-allowed`, `mint-not-allowed`, `token-mint-unknown`, `over-per-tx-cap`, `over-fee-cap`, `intent-attempts-exhausted`, `over-window-cap`, `loop-reground`, `inhibit-cap`, `fail-closed`, `message-signing-denied`, `wallet-changed-message`, `failure-budget` |

Operational/adapter causes in this table do not add admission rules. Retrying a
class must not automatically resend uncertain signed bytes. These choices implement
ADR-025 while retaining truthful unrecorded refusals and unchanged legacy history.
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
  - **After signing**, each message must be the admitted one, its signature must verify by the wallet's key over it,
    and the wallet must return one transaction for each it was given. Otherwise:
    - every signature is removed, from the caller's objects and from any the wallet returned;
    - a decision whose admitted message the wallet did validly sign is reported `unknown` and followed up, because
      those bytes existed and may land (D15); the rest are released as `expired`;
    - the call throws `SolanautDenied` with rule `wallet-changed-message`.
  - **All or nothing, and nothing held for nothing.** A batch is checked whole before the wallet sees any of it. When
    a batch is refused, every decision admitted for it is reported `expired`: its bytes were never signed, so they
    cannot land. When the wallet throws, the same holds, except for a message it signed in place before throwing,
    which is held as above.
  - Adapter-only `message-signing-denied` and `wallet-changed-message` retain
    their operator reason; class-only agent errors have no decision object.
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
| D15 | A batch the wallet signed in place but returned short kept a valid signature on a caller's object, and its decision was released as never signed | `adapters/agent-kit.ts` (`verify`), `adapters/kit.ts` | strip every caller object; hold a validly signed admission as `unknown`; refuse a short return |
| D16 | `wallet-changed-message` carried the admitted decision, against §8 | both adapters | `decision: null` |
| D17 | A release in the record was applied on restore and replay without its signature being checked | `state.ts` (`apply`) | verify each release as the live guard does |
| D18 | A receipt redeemed after its decision was reported `expired`, `failed` or `landed` | `guard.ts` (`redeem`) | a final outcome refuses the receipt |
| D19 | A release's expiry was judged on the caller's `at` | `guard.ts` (`release`) | the latest recorded time |
| D20 | An attempt that could still land left the window cap after `windowMs` | `state.ts` (`windowTotals`) | count it while a trusted height shows it can still land |
| D21 | A resealed malformed-proposal entry can inject non-null Keel fields into replay and restore, although live evaluation never ticks Keel for that input | `guard.ts` (`replay`, `reapply`), reproduced on 2026-10-07 | **closed in the builder candidate:** impossible fields refuse; genuine malformed and parsed history retain replay/restore. `evals/sdk/malformed-replay.md`; full snapshot and fresh mutation qualification remain owed |
| D22 | Resealed unsupported report outcome/attribution/time or reports after a final outcome are accepted on recovery; invalid reports may advance state or settle signing | `state.ts`, reproduced on 2026-10-08 | **closed in the builder candidate:** validate before every state change; preserve unknown reconciliation, signed-policy changes and late unresolved reports. `evals/sdk/report-replay.md`; broader qualification remains owed |
| D23 | Resealed absent/denied, duplicate, final, expired or malformed receipt redemption bypasses live checks on recovery | `state.ts`, reproduced on 2026-10-08 | **closed in the builder candidate:** validate before every state change and enforce chronological policy where signed history supplies it. Preserve unsigned-history compatibility and live canonical negative bigint heights. `evals/sdk/redeem-replay.md`; broader qualification remains owed |
| D24 | Missing/non-record sending-client arguments escape as ordinary TypeError or accept unsupported containers instead of the documented typed input refusal | `adapters/sending-client.ts`, reproduced on 2026-10-08 | **closed in the builder candidate:** check object containers before field access; preserve valid field validation, exact method surface and no automatic retry. `evals/sdk/sending-client-input.md`; broader qualification remains owed |
| D25 | Cached entries can change during asynchronous checkpoint validation without changing the disk file; publication can acknowledge inconsistent cached history | `record.ts`, reproduced on 2026-10-08 | **closed in the builder candidate:** repeat cached-history equality with ownership and disk-stat checks at publication boundaries. First failing regression and retained fault trials: `evals/sdk/owned-request-index.md`; live service and independent qualification remain owed |
| D26 | The new internal request-lookup helper can fold a caller-mutated history after validating its captured snapshot, returning unrecorded tail facts | `request-index-publication.ts`, reproduced on 2026-10-08 before integration | **closed in the builder candidate:** synchronously capture history, identity and policy pins, then use that same history for validation and folding. Actual owned callers already supply private history. First-red and retained faults: `evals/sdk/request-index-lookup.md`; no admission or bounded-state qualification |
| D27 | A fresh owned-admission reply shares nested data with cached log state, unlike authenticated lookup replies | new `guard.ts` companion, reproduced on 2026-10-08 before integration | **closed in the builder candidate:** detach and recursively freeze companion replies. The trusted synchronous SDK contract is unchanged. First-red: `evals/sdk/owned-request-admission.md`; broader qualification remains owed |
| D28 | Cloning a shared-buffer proposal preserves shared byte backing, so caller mutation changes queued admission bytes | new `guard.ts` companion, reproduced on 2026-10-08 before integration | **closed in the builder candidate:** copy captured message bytes into a private ordinary Uint8Array before binding/queueing. First-red: `evals/sdk/owned-request-admission.md`; no atomic concurrent-memory snapshot or isolated deployment claim |
| D29 | Replay command drops blank record lines, loads the entire file, follows final source links and exposes raw errors/detail values | `bin/replay.ts`, reproduced on 2026-10-09 | **closed in the local candidate:** compose verified streamed reads, bound public JSON inputs and redact diagnostics. First failures and fault evidence: `evals/sdk/replay-command.md`; complete release qualification remains separate |
| D30 | Joining trust field names with commas lets comma-containing names imitate the expected field set | initial replay-command candidate, reproduced on 2026-10-09 | **closed:** explicit key cardinality and membership; signed malformed-field regression fails before correction. No trust learned from history and no policy rule change |
| D31 | New owned-control dispatch calls mutable public SDK bookkeeping methods, so a caller can replace its start/response implementation | local owned-control candidate, reproduced on 2026-10-09 | **closed in the local candidate:** capture private start/completion functions before exposing the guard. Public-method replacement regression and planted dispatch faults are retained in `evals/sdk/owned-control-request.md`; no isolation or stable-release claim |
| D32 | The new private facade returns an unrecorded admission as a decision, including raw storage diagnostics after an append failure | local facade `36a1ae7`, reproduced on 2026-10-09 | **corrected in the builder candidate:** negative-sequence admissions throw the fixed typed `OwnedGuardError`; identity collision likewise refuses. Preserve real storage-failure and installed previous-candidate failures in `evals/sdk/owned-admission-error.md`. Broader qualification remains open |
| D33 | A held journal inode can change outside the writer while its cached history still acknowledges another decision | local `7a64856`, reproduced on 2026-10-09 in manual and kernel ownership | **corrected in the builder candidate:** before appending, require the descriptor size, nanosecond modification time and change time to match the last synced append or completed startup. A mismatch fails the store permanently without appending. Preserve real append/truncation/same-size overwrite regressions and fault misses in `evals/sdk/live-record.md`. This is storage consistency under the supported host boundary, not protection against privileged concurrent tampering |
| D34 | Hardlinked journal aliases can open with separate pathname mutexes; kernel startup accepts a linked mutex | local `8b1d29d`, reproduced on 2026-10-09 | **corrected in the builder candidate:** require descriptor and named journal/mutex inodes to have one link, preserving evidence and failed-startup cleanup. Source and installed prior-candidate failures are retained in `evals/sdk/record-alias.md`. Wider qualification is pending; the signer host remains trusted |
| D35 | Startup can seed its cache from stale descriptor bytes while adopting changed file metadata | local `84cac38`, reproduced on 2026-10-09 | **corrected in the builder candidate:** compare descriptor size/timestamps and current inode identity across record reads, before parsing or torn-tail repair. Preserve changed evidence and failed-startup cleanup in `evals/sdk/record-read-stability.md`. Wider qualification remains pending; this is observed-read consistency under the trusted host boundary |
| D36 | An incomplete full-file read is interpreted as a torn tail and can truncate acknowledged history | local `67948e6`, reproduced with read-result injection on 2026-10-09 | **corrected in the builder candidate:** verify raw bytes against descriptor size before repair, and repair using byte offsets. Preserve short-read data loss, oversized acceptance and genuine UTF-8 tail controls in `evals/sdk/record-read-completion.md`. Wider qualification is pending; full-history allocation remains unbounded |
| D37 | A reported completed write can be acknowledged without the expected physical append delta | local `72dde39`, reproduced with write-result suppression and actual extra append on 2026-10-09 | **corrected in the builder candidate:** require the post-sync descriptor size to equal prior size plus canonical entry bytes before acknowledgement/cache mutation. Preserve fault misses and positive nonempty-journal controls in `evals/sdk/record-write-completion.md`. Wider qualification remains pending; this is observed storage consistency, not authenticated content |
| D38 | Journal or mutex replacement during append can still be acknowledged through the old descriptor | local `3fe0f0d`, actual inode replacements reproduced on 2026-10-09 | **corrected in the builder candidate:** after syncing, verify held mutex and current named journal identity before size validation/cache mutation. Preserve both inodes and foreign markers; permanently fail on mismatch. `evals/sdk/record-write-identity.md` retains initial failures. Wider qualification remains pending; the signer host remains trusted |
| D39 | Wallet message inspection and serialisation can disagree, allowing changed or malformed wire bytes to reach RPC | local b5498e8, reproduced on 2026-10-10 | **corrected in the builder candidate:** capture serialised bytes once, decode and compare the admitted message, verify its wallet signature before RPC. Preserve already verified signing as unknown even if serialisation erases the object signature; strip caller/returned signatures on refusal. Initial failures and adversarial cases: `evals/sdk/adapter-wire.md`; full release qualification remains separate |
| D40 | Raw buffer serializer returns leave admitted messages or verified wire aliased to externally mutable storage | local 32abc73, reproduced on 2026-10-10 | **implementation corrected locally:** privately copy both legacy/versioned object-message captures and serialised send wire. `evals/sdk/adapter-buffer-current.md` records fresh tests-first reproduction, source/emitted/installed proof and full native/type passes. Serial coverage still fails H11; no floor or stable gate credit. Earlier deferral/failures remain in `evals/sdk/adapter-buffer.md`. Deterministic alias tests are not concurrent scheduler or isolated-service qualification |
| D41 | Wallet batch membership edits can make cleanup expire visible valid signing and omit caller objects; caller edits during awaits change requested membership | local fc3caff, reproduced on 2026-10-10 | **corrected and integrated on 2026-10-13:** `evals/release/integrated-fixes.md` records new first-failure reproduction, ordinary regressions, caught source omissions and passing full native/type checks. Earlier prepared/failed evidence remains in `evals/sdk/adapter-batch.md`. Hosted, isolated/live and stable qualification remain separate |
| D42 | RPC provider error/body text propagates into thrown refusals and provider health diagnostics | local 32ddf33, reproduced on 2026-10-11 | **corrected and integrated on 2026-10-13:** `evals/release/integrated-fixes.md` records new first-failure reproduction, ordinary regressions, caught source omissions and passing full native/type checks. Earlier prepared/failed evidence remains in `evals/signer/rpc-redaction.md`. Hosted, isolated/live and stable qualification remain separate |
| D43 | New key/config descriptor prototype accepts parent permission loss during its read | uncommitted native executable candidate, reproduced on 2026-10-13 | **corrected in the builder candidate:** recheck parent owner/mode after reading, in addition to inode/path identity. Public-file first failure and omission trial are retained; no key contents are printed or copied. Full qualification remains in progress |
| D44 | Production-style decoding failures before RPC are returned as passing RPC failures | same-user service at fe21906209b851a6592a9097218568adcabee7ac, reproduced on 2026-10-13 | **corrected in the builder candidate:** classify unavailable proposal tombstones using immutable canonical payload syntax; malformed/unsupported bytes are invalid. Decision rules, signing/control journals and reservations are unchanged. First failure and durable retry regression are retained; release qualification remains separate |
| D45 | Socket transport refusals use diagnostic codes instead of the accepted class/reference channel | same-user socket at fe21906209b851a6592a9097218568adcabee7ac, reproduced on 2026-10-13 | **corrected in the builder candidate:** only verdict/reference/class leave the transport, including busy, timeout, malformed frames and handler failure. The client validates that envelope and retains execution uncertainty; original framing, limits and fault populations remain. No private policy value was found in the old fixed transport codes |

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

**Found on 2026-10-03, by the independent evaluator run** (`evals/independent/`), each closed test-first:
- **D15 · signed bytes released as never signed.** A wallet that signed a whole batch in place but returned it short
  left a valid signature on the caller's object for the transaction it did not return. Both decisions were released
  as `expired`, so the guard would admit the same payment again while signed bytes for it existed: a double payment
  (evaluator case E78). Now every caller object is stripped, and a validly signed admission is held as `unknown` and
  followed up. `guardedSigner` also refuses a signer that returns fewer signatures than transactions, which it had
  let through.
- **D16 · `wallet-changed-message` carried a decision.** Both adapters attached the admitted decision, with
  `allow: true`, to a denial that §8 says has none (E22). Now it carries `null`.
- **D17 · a release in the record was not verified.** A sealed release entry with an all-zero signature un-latched a
  guard on restore, and `replay` called the record sound (e2-state, S83). Restore and replay now verify every
  release as the live guard does.
- **D18 · a released receipt still redeemed.** A decision reported `expired`, whose value and fees were freed, still
  redeemed, so its bytes could be signed outside the caps (S36). A decision with a final outcome no longer redeems.
- **D19 · a release's expiry read the caller's clock.** A clock stepped back accepted an expired release (S80). The
  expiry is now judged on the latest recorded time, as the windows are.
- **D20 · the window let go of an attempt that could still land.** With `windowMs` shorter than a blockhash's life, an
  attempt still able to land left the window cap. A second payment was then admitted beside it, so twice the cap could
  land (S82). A trusted height that shows the attempt can still land now keeps it in the windows.

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
  - [ADR-012](../design/ADR-012-latch-on-reground.md), **accepted by the human on 2026-10-05 (option C), now built
    and tested offline** (`evals/sdk/latch-c.md`): a REGROUND denial latches when Keel is the reason, or when the
    denial before it was also at REGROUND. The funded devnet rerun remains owed; S12 describes the historical run.
    Identical retries still latch at turn 3.
- **Benign payments with varied priority fees read as fee escalation.** **Answered 2026-10-03, and built.** The
  independent evaluator's varied-fee streams stopped 15 of 3,000 benign payments, because sensor v1 scored the same
  shape at higher fees as escalation even after the earlier payment landed. The definition now counts escalation only
  against a payment that has not landed: on fresh seeds, 0 of 3,000 stopped, and every loop's stop turn is unchanged
  (`evals/sdk/fee-escalation.md`; `docs/RISKS.md` RK20).
- Should a run of failed outcomes trip the latch, as a run of denials does? A loop that alternates two shapes and
  changes its amount passes every rule while each send fails, and is bounded only by the fee window and the clamp
  under INHIBIT (`evals/sdk/keel.md`). For the Alpha's red team (milestone 3.10).
- ElizaOS: wrap the plugin's action handlers, or its wallet? **Answered by a proposal:** neither. The plugin has no wallet
  and reads the key at five signing sites, so the key stays out of ElizaOS and Solanaut's own plugin signs through the
  guard ([ADR-017](../design/ADR-017-elizaos-integration.md)).
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

**Approved by the human on 2026-10-05 (milestone 2c.1).** Each requirement has an ID, is stated so a test can fail
it, and names where it comes from and what will verify it. Every Beta rule and invariant (§3 to §8) still holds; these
add to them. A choice that needed research before it could be stated was marked **ADR owed**; each such ADR is written
and accepted: ADR-013 to ADR-018 (§13.11).

### 13.1 Signer process (milestone 3.1)

Running-path allocation, 2026-10-13 (ADR-013/019/025): socket denial results are
`{status:"denied", ref, class}` even under signed development full disclosure.
The private signing/control journals keep their original response evidence;
projection occurs on every return, including historical retries. A malformed
proposal is invalid; pre-admission RPC/deadline failure is retry-later with −1.
Agent status exposes only mode, keyIsolation, recoveryIncomplete and degraded;
policy identity/version, denial counters and rule-named latch state remain operator-side.
Live follow-up uses the same recover/report path as startup, runs serially,
backs off on incomplete passes, and is cancelled/drained before ownership release.
Transport refusals also carry only `{ok:false,error:{ref:-1,class}}`: busy/timeout
are retry-later, malformed framing/unknown methods invalid, and unknown internal
failures refused. A missing reference cannot establish absence of an admission;
clients retain execution uncertainty and never automatically resend.

Executable allocation (same accepted ADRs): native development runs
`node apps/signer/src/main.ts --same-user --config <absolute-public-config>`;
`--init` is a separate explicit history-creation operation. The config is an
owned real regular file, mode 0600, in a real owned 0700 directory, bounded to
128 KiB. It contains only cluster, keypair/record/socket absolute paths, policy
and signed authorization. Cluster must be devnet and the loaded public key must
be the policy's sole principal. Serving requires SOLANAUT_RPC_A/B from the
environment; endpoints/credentials are never printed or written into config.
The key is an owned real regular 0400 file in a real owned 0700 directory, with
one link and a bounded descriptor read. Validate the complete Solana keypair
format and matching public half; expose only its address and signing function.
Fixed-category failures discard paths, raw key bytes and underlying exceptions.
SIGTERM/SIGINT drain the service before exit; restart uses established history.

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
| SIG-10 | It runs as its own OS user, or the documents state that it does not and what that leaves | T9, T29 | [ADR-013](../design/ADR-013-signer-process.md), accepted: its own user, a Unix socket in a group-only directory, and a same-user mode that says so |
| SIG-11 | 1,000 physical source lines or fewer, stated before writing and measured after; all signer app source and signer-specific helpers in any directory count, including comments/blank lines | accepted ADR-021 | explicit file list and line count in the receipt; no moving code to evade the budget |

### 13.2 Operator-signed policy (milestone 3.2)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| POL-1 | A guard loads a policy only with the operator's ed25519 signature over a structured UTF-8 text naming the guard, the cluster, the policy hash and a version, which Phantom's `signMessage` can sign | ADR-011 §1 | a valid signature loads |
| POL-2 | No signature, a wrong key, another guard or cluster, a hash that differs, or a version older than the current one: the guard refuses to start | T11 | one test each |
| POL-3 | The agent's keys cannot sign a policy: the operator key is outside the principal and is not the fee payer | rule 0 | an invalid policy |
| POL-4 | The record holds each signed policy, so replay knows which policy made each decision | §7 | replay across a policy change |
| POL-5 | How a signed policy replaces the running one | §7 | [ADR-014](../design/ADR-014-operator-signed-policy.md), accepted: a restart, a recorded `policy` entry, versions that only rise, and a summary the operator reads in Phantom |

POL-1/5's operator preparation component is installed as `solanaut-prepare-policy`.
It accepts a public policy, explicit positive version and canonical UTC issuance, validates
them and returns public identity/hash plus the existing canonical signing text. Its bounded
regular-file read permits devnet/localnet only, rejects source changes and redacts failures.
It neither reads keys nor signs, installs or checks current history/version. Human signing
and the installed replacement ceremony remain owed (`docs/POLICY.md`, `evals/sdk/prepare-policy.md`).

### 13.3 Token-2022 and token accounts (milestone 3.3)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| TOK-1 | Each listed Token-2022 mint's extension set is pinned in the policy. A mint whose extensions differ at admission is denied | §4, T15 | an extension added after listing |
| TOK-2 | The settings an extension lets an authority change after initialisation are re-read at admission, from the operator's RPC | §4, §12 | each mutable setting changed once |
| TOK-3 | TransferCheckedWithFee is value-moving: the amount and the fee count against the mint's caps | §4 | a fee that crosses the cap |
| TOK-4 | Associated Token Account Create and CreateIdempotent are decoded: the rent counts as SOL to the owner, who must be an allowed destination. RecoverNested is denied | §4, T27 | an account created for an unlisted owner |
| TOK-5 | Which settings are mutable, and whether a transfer hook is ever admitted, is decided from the `spl-token-2022` source | §12 | [ADR-016](../design/ADR-016-token-2022-settings.md), accepted: a permanent delegate not listable by default; the hook program and the fee ceiling pinned; the rest stated |

### 13.4 Opaque programs bounded (milestone 3.4)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| OPQ-1 | A transaction calling an allowlisted opaque program is simulated on the operator's RPC. Every change to a principal-controlled account (lamports, token amounts, owner, delegate, close authority) must be within the policy | ADR-009, T3 | a simulated drain denied |
| OPQ-2 | Lighthouse assertions are appended for every principal-controlled account, holding its balances to the simulated bound and its authorities unchanged. The receipt binds the bytes with the assertions | T3, ADR-009 | the receipt's hash covers them |
| OPQ-3 | A simulation that fails, is unavailable, or disagrees with the decoded effects is a denial | rule 19 | each failure mode |
| OPQ-4 | Only read-only assertion instructions are appended or admitted. Lighthouse's memory-write instructions are denied until they have a rule | T28, §12 | a memory-write instruction |
| OPQ-5 | If the assertions would push the transaction past its size or compute limit, the proposal is denied, never sent unbounded | T3 | an oversized route |
| OPQ-6 | On a Surfpool mainnet fork, a Jupiter route bounded this way lands, and the same route altered to drain fails on-chain by an assertion | `docs/ROADMAP.md` 3.4 | the fork run's receipt; if it cannot be met, the Alpha denies opaque programs and says so (RK6) |
| OPQ-7 | The assertion set, and how the simulated bound becomes it | T3 | [ADR-018](../design/ADR-018-bounding-opaque-programs.md), accepted: floors on every held account's balances, its authorities held equal |

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
| ELZ-2 | The key never enters ElizaOS: the character holds only the public key, and Solanaut's own plugin signs through the guard | §12 | [ADR-017](../design/ADR-017-elizaos-integration.md), accepted |
| ELZ-3 | With only a public key set, each of `plugin-solana`'s signing actions signs nothing | ADR-017 | a test against the pinned published version |

### 13.7 Log anchor (milestone 3.7)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| ANC-1 | `solanaut_anchor`, in Anchor 1.2, has operator-authorised enrolment and authority rotation, and `anchor(head: [u8; 32], seq: u64)`, which writes the head to its configured guard PDA and emits `DecisionAnchored` | accepted ADR-022 | enrol/anchor/rotation signature and namespace refusals, then devnet evidence |
| ANC-2 | Only the guard's anchor authority may anchor, and `seq` must increase | T12 | a stale or foreign anchor refused |
| ANC-3 | Replay checked against the anchored head detects a record rewritten before that anchor | T12 | a rewritten record |
| ANC-4 | A verified build and a `security.txt` | §9 | the verification result |
| ANC-5 | The head is anchored at most once a minute while entries are new, and at once after a latch, a release or a policy entry, by a dedicated anchor key outside the principal | T12 | [ADR-015](../design/ADR-015-log-anchor-cadence.md), accepted |

ANC-3's structural component is implemented in `verifyArchive` and its read-only CLI:
an externally supplied exact sequence/head must occur in the verified archive, including
continuation segments. Pins are captured before asynchronous reads. A fully resealed
pre-anchor rewrite refuses; post-anchor rewrites remain outside its coverage. The caller
must authenticate pin provenance; this does not provide state replay or chain identity
verification (`evals/sdk/archive-anchor.md`). ADR-022's enrolment/rotation and
namespace contracts are accepted; the programme remains to be implemented.

| ANC-6 | Enrolment requires the namespace operator and proposed anchor authority, creates the configured identity once and permits the first actual anchor at sequence zero | accepted ADR-022 | missing/wrong signatures, duplicate enrolment and foreign identity/namespace fixtures |
| ANC-7 | Authority rotation requires the current operator and successor authorities; it preserves identity, head/sequence and anchoring status, without old-anchor veto or reset | accepted ADR-022 | old-anchor rejection after rotation, unchanged history and restarted-client pin mismatch |

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

Coverage preparation uses in-memory AST instrumentation after Node's native type stripping,
not emitted development builds or line counts labelled as statements. Inventory every SDK
and signer source file, including unimported files. Require unrounded SDK and signer totals
at the existing statement/branch floors, and the existing per-file branch floor for the
designated SDK files plus signed-policy/request/signing/client and every signer source file.
Calibration must distinguish multiple statements on one line and unexecuted branch arms.
Test instrumentation is explicit and is not used by the installed-package checks.

CI-1 maintained campaign runner now checks its complete executable inventory, runs sequentially
and checks source restoration before another mutation. Failed campaigns are retained; unrestored
source stops the remainder with explicit skipped work. The pinned CI job uses the same command
(`evals/ci/bite.md`). Historical manual findings still require maintained regressions; CI-1/2
and the milestone remain partial. No threshold or protected harness gate changed.

CI-2 properties use frozen synthetic domains (`evals/ci/properties.md`), explicit completed
run counts and replayable seeds. Each address, legacy/v0/v1 differential and arbitrary-byte
property requires 10,000 successful executions without skips on each approved runtime.
Reduced budgets, incomplete results and unexpected decoder exceptions fail. Maintained
faults exercise both the gate and product readers. This does not satisfy the separate
million-input fuzz, real-transaction differential, policy/firewall or remaining quality gates.

The separate synthetic decoder fuzz job (`evals/ci/fuzz.md`) requires a successful process,
the million-input floor and complete accepted/refused totals. It preserves the existing
mutation generator, prints its seed before execution and rejects missing or duplicate evidence.
Gate/product faults are maintained in bite. This does not establish real-transaction decoding,
policy/firewall fuzzing or independent security qualification.

Two synthetic SOL cap properties (`evals/ci/caps.md`) exercise unsigned-64 per-tx
boundaries and pending-window reservations against independent arithmetic. The same
completed-run floor now applies to asynchronous properties. Quiet telemetry isolates the
policy; token/fee cap properties, real storage/signing and Keel qualification remain owed.

The mixed-history replay gate (`evals/ci/replay.md`) requires 10,000 decisions, complete
recomputation and a pinned record head across the approved runtime matrix. Its initial
extended driver failed on old receipt selection; revision 2 bounds only the workload's
selection view and retains the entire production history. A per-tx mutation miss receives
a focused regression. This in-memory SDK profile does not qualify isolated signing,
power-loss durability, random kills or snapshot/restart performance.

A queued asynchronous SDK workload (`evals/ci/concurrency.md`) releases 1,000 callers
through one barrier and checks exact pending-window admissions, every decision and distinct
identities. Quiet telemetry isolates policy; native admission is synchronous. This is not
parallel-thread, multi-process, disk or isolated-signer concurrency qualification.

A persisted-prefix recovery battery (`evals/ci/kills.md`) verifies actual SIGKILL exits,
reopens exclusive kernel ownership and compares completed histories/replay with a reference.
It runs 100 independent SDK trials after acknowledged persistence. This does not exercise
unacknowledged write, signing/send or power-loss boundaries, nor isolated-user lifecycle.

CI-2 diagnostic S140 (`evals/release/installed-kills.md`) finds that the maintained
battery increments replay completion from `ok` without checking the returned
decision count. A planted zero-count success escapes the original gate. Separate
fresh-seed proposal proof checks count consistency; exact O9 remains unapplied.
Returned counters still assume a trusted backend and do not prove semantic replay.

PKG-2 / CI-2 diagnostic S154 (`evals/packaging/archive-head-declaration.md`)
finds that replacing the typed head example with anchor leaves head declaration
removal undetected by maintained consumer cases. Runtime head-pin refusal remains
checked and current product type is intact. A proposed copy retains both examples;
exact O10 remains unapplied. No full declaration/mutation/native or stable
qualification follows from these component controls.

CI-2 / handoff diagnostic S155 (`evals/release/assertion-reasons-complete.md`)
allocates exact builder reason references for the frozen named-test modification
inventory. Initial additions, supporting/later history and independent review
remain separate. The head declaration gap and unapplied O10 persist; complete
reference allocation grants no native gate or stable release qualification.

The mutation programme freezes full decoder/policy file scope and selected tests before
measurement (`evals/ci/mutation.md`). Its staged-source isolation and strict report checks
are maintained fault campaigns. The required Stryker score remains unmeasured at preparation;
no signer/firewall mutation qualification follows from these report checks.

Performance report checks preserve the existing timing/rate/restart/freshness/regression
targets (`evals/ci/performance.md`). Scoped SDK memory/synced-file measurements of
the frozen mixed replay history are in `evals/ci/sdk-timing.md`; they are not
pre-log isolation or complete qualification. The compatible reference baseline,
isolated signer, restart/freshness and full report observations remain owed;
authenticated snapshot/Keel evidence is required.
The offline differential gate pins complete public ledger wires and execution-time loaded
addresses, compares kit decoding/resolution and the observed supported program-client fields
(`evals/ci/differential.md`). Conservative trailing-data refusals are tested explicitly.
Token-2022 extensions, CPI, live signing and independent security remain outside that receipt.

### 13.10 Tested hard (milestone 3.10)

| ID | Requirement | From | Verified by |
|---|---|---|---|
| RT-1 | Every Leg 3 threshold in `docs/READINESS.md`, as confirmed at 2c.1, is met | READINESS | receipts |
| RT-2 | The red team: at least 40 cases in at least 10 classes, by an evaluator who did not build the code, given only the spec; each denied by its named rule or bounded on-chain | READINESS, RK12 | the red team's report |
| RT-3 | The open questions in §12 are decided, each with a measured stream: when REGROUND latches (ADR-012), runs of failed outcomes, and loops that alternate shapes | §12 | the loop battery |

Frozen synthetic traffic/loop measurement is in `evals/ci/traffic-definition.md` and
`evals/ci/traffic.md`: complete refusal counting, fixed seed/profile inventory, confidence
bound, reconciled outcomes and explicit first-refusal horizon. Alternating and distinct
failed-outcome streams remain unrefused within that horizon. No sensor coefficient or rule
changes, no independent evidence, and no automatic RT-3 or full RT-1 closure.
| RT-4 | Threat model v3 is reviewed, and no critical or high finding is open | `docs/ROADMAP.md` 3.10 | the Alpha milestone review |

### 13.11 Decisions before Leg 3 builds: all accepted on 2026-10-05

| ADR | Decides | Before |
|---|---|---|
| [ADR-012](../design/ADR-012-latch-on-reground.md), accepted (option C) | when REGROUND latches the guard | the demo is recorded |
| [ADR-013](../design/ADR-013-signer-process.md), accepted | the signer's process, OS user and transport (SIG-10) | 3.1 |
| [ADR-014](../design/ADR-014-operator-signed-policy.md), accepted | policy signing and policy changes (POL-5) | 3.2 |
| [ADR-016](../design/ADR-016-token-2022-settings.md), accepted | Token-2022's mutable settings and transfer hooks (TOK-5) | 3.3 |
| [ADR-018](../design/ADR-018-bounding-opaque-programs.md), accepted | bounding opaque programs: simulation and the assertion set (OPQ-7) | 3.4 |
| [ADR-017](../design/ADR-017-elizaos-integration.md), accepted | the ElizaOS integration point (ELZ-2) | 3.6 |
| [ADR-015](../design/ADR-015-log-anchor-cadence.md), accepted | the anchor's cadence and payer (ANC-5) | 3.7 |

### 13.12 ADR-012 acceptance tests (RT-3)

These IDs name obligations of the already accepted option C, not new latch rules.

| ID | Requirement | Verified by |
|---|---|---|
| LAT-1 | one REGROUND denial from a rule before Keel does not latch by REGROUND alone | `latch-c.test.ts` |
| LAT-2 | consecutive REGROUND denials latch; the previous decision is restored from the record, across non-decision entries; a non-REGROUND decision breaks the pair | restart, report and malformed-decision cases |
| LAT-3 | Keel's `loop-reground` denial immediately latches | hostile telemetry with an otherwise permitted payment |
| LAT-4 | `afterDenials` remains sufficient without REGROUND | quiet telemetry and denied destinations |
| LAT-5 | replay reports the accepted Beta-to-C difference at `latch` | sealed V0-style fixture |
| LAT-6 | archived scripted streams reproduce option C and current records replay | the original stream definitions and expected table |

### 13.13 Release package acceptance tests

These IDs trace the human-approved release-only build. They do not mark milestone 5.3 achieved.
Development exports remain native TypeScript; a separate generated manifest exports JavaScript.

| ID | Requirement | Verified by |
|---|---|---|
| PKG-1 | packed SDK installs outside the monorepo without loader flags or workspace symlinks; only compiled runtime, declarations and declared runtime dependencies are included | installed payment/drain verdicts, Keel byte verification and tarball checks |
| PKG-2 | installed declarations resolve and reject incorrect caller types | standalone strict consumer typecheck |
| PKG-3 | installed replay and table-pin commands execute as ordinary Node commands | executable usage/error exits |

The candidate remains private at the existing source version. Node 22.18.0 is its runtime
floor; the approved matrix also includes Node 24 and 26. Full readiness thresholds remain unchanged.

### 13.14 Accepted stable history contracts

ADR-019 and ADR-020 were accepted by the human after their explicit review request.
These IDs allocate their initial policy/version obligations; other lifecycle, ownership,
snapshot and RPC IDs are allocated with their implementation steps. Existing SIG/POL gates stand.

| ID | Requirement | Verified by |
|---|---|---|
| VER-1 | signed authorization versions cannot roll back; equal version requires identical canonical content and signed text; a change preserves pending admission state | `signed-policy.test.ts` restarts and cap/latch/receipt cases |
| VER-2 | recorded format and evaluation profile are separately identified; unsupported profiles/formats refuse restore/replay; the profile binds rule, decoder, sensor and Keel identity | resealed format/profile fixtures and sensor substitution |
| OWN-1 | manual SDK mode refuses stale ownership without removing its marker | stale dead-PID fixture and unchanged marker bytes |
| OWN-2 | Linux kernel ownership survives helper exit, excludes concurrent writers, releases on process death and retains its mutex inode | same-process exclusion and competing processes after SIGKILL |
| OWN-3 | established protected history must exist; initial creation is explicit | missing history rejection and explicit bootstrap fixture |
| OWN-4 | journal and mutex inodes must have a single link; aliases cannot open through separate pathname locks | manual/kernel journal aliases, kernel mutex alias, evidence preservation and failed-startup cleanup |
| STO-1 | a short write cannot acknowledge an incomplete record | forced short writes, complete JSON line and matching decision hash |
| STO-2 | write, permission, progress, sync or post-sync physical byte-delta failure denies and closes the writer | ENOSPC, EACCES, zero progress and fsync injection; manual/kernel missing/extra physical append faults and positive nonempty journals under SIG-8 |
| STO-3 | before appending, a file writer refuses an external size or timestamp change and remains failed after repair | manual/kernel append, truncation, same-size overwrite, stale timestamp injection and direct store refusal |
| STO-4 | a record read verifies descriptor size/timestamps and named inode identity before using its bytes or repairing a torn tail | manual/kernel append, truncation and same-size overwrite during actual startup reads; evidence preservation and failed-startup cleanup |
| STO-5 | complete record reads must match the observed physical byte count before repair; genuine torn tails use byte offsets | short/oversized read results cannot truncate acknowledged entries; incomplete UTF-8 tails retain complete entries in both ownership modes |
| SNP-1 | immutable archive verification uses bounded line buffering, validates record framing/hash chain/continuation identity and optional external head/digest pins; malformed, changing or non-regular sources fail with typed errors | streamed archive positive/negative/boundary and source-change/resource fixtures; this is structural integrity, not signed snapshot/state or policy authentication |
| SNP-2 | an installed read-only archive command accepts explicit head/digest/continuation/line-limit options, rejects unknown/duplicate/malformed arguments and prints JSON receipts or typed errors; exits distinguish success, archive refusal and usage | command positive/negative/boundary cases, unchanged source bytes and actual installed npm executable |
| SNP-3 | a canonical checkpoint and authenticated Keel prefix bind externally pinned checkpoint authority, guard/cluster, format/profile, policy version/hash, sequence/head, archive digests and admission state; principal and anchor authority are not repurposed | valid signatures; wrong/missing signatures, authority substitution, cross-guard/cluster/profile/policy substitution and altered state/prefix/archive fixtures |
| SNP-4 | checkpoints are atomically published after each 10,000 decisions and at orderly maintenance stop; incomplete publication never becomes the accepted checkpoint | faults before/after write, sync and publication; short writes, permission loss and concurrent checkpoint attempts; previous valid checkpoint survives interruption |
| SNP-5 | restore rebuilds Keel from authenticated telemetry/reset events and the verified tail, never from serialized controller numbers; state agrees with retained full replay | mixed admissions, denials, reports, signing stages, latch/release and policy changes; differential full/checkpoint restore on approved runtimes; missing/reordered prefix and injected controller-state fixtures |
| SNP-6 | unsupported, corrupt, foreign or missing checkpoints trigger verified full replay; failure to establish history refuses startup and cannot create empty state | corrupt signatures/state/prefix, missing/truncated/resealed archive, unsupported versions and anchor mismatch; observed fail-closed admissions and preserved reservations/latch |
| SNP-7 | streamed replay and immutable segments retain full historical evidence while active state and request lookup avoid complete history retention in memory | ordered segment/tail continuity, historical request collisions/replies, competing index writers and storage faults; predeclared restart/memory workloads at unchanged readiness targets |
| SNP-8 | backup/upgrade recovery verifies history, checkpoint/prefix and format/profile compatibility before resuming; policy rollback still needs a newly signed higher version | offline backup corruption, compatible/incompatible binary rollback, policy-content reversal, unresolved attempts and latch preservation; operator drills remain separate from component tests |
| LIF-1 | request identity is namespaced by guard/client/ID and bound to canonical message/group payload in the admission entry; a same-payload retry returns that entry without evaluation, and changed payload or duplicate recorded identity is refused | request-identity battery, restore and replay |
| LIF-2 | signed wire/signature, send-started intent and response are synced in the admission chain; signed evidence requires durable redemption and admitted bytes, send intent requires valid lifetime, and stages cannot repeat | signing-history battery, forged wire/signature and out-of-order replay |
| LIF-3 | executor signs only after durable redemption and sends only after durable send intent; recovery never re-signs an unresolved redemption or resends send-started bytes; deadlines and payload identity remain enforced | fake-RPC core battery across persistence boundaries and reconstructed restarts |
| LIF-6 | each recovery pass reports incomplete attempt work without aborting later attempts, and still follows signed bytes from chain evidence after a pre-send refusal; no error releases reservations or reopens a failed writer | expired admission/signed bytes, provider recovery and response-storage failure fixtures |
| LIF-7 | final outcome evidence permanently forbids new signing/send intent for a request, live and on replay; unknown evidence does not settle; interrupted replies may still complete conservatively | settled signed/unsigned histories, resealed invalid stages, signed-policy recovery and executor no-send regression |
| CLT-1 | sending client exposes propose/report/status distinctly from partial signing and captures exact IDs/message/group before asynchronous work | local socket framing, caller mutation and actual service/installed consumer cases |
| CLT-2 | transport never automatically retries and typed errors conservatively identify possible proposal execution after transmission | lost-reply count and pre-connect failure; second-write planted fault |
| CLT-3 | Non-null object argument containers other than arrays, IDs, payload bounds, response framing, canonical envelopes and method result shapes are validated; peer exception text is not returned | missing/primitive/array/function arguments and malformed/duplicate/wrong-ID/oversized reply and payload fixtures |
| CLT-4 | connection wait has an absolute bounded timer, independent of response activity | trickle response fixture and extended-timeout fault |
| RPC-1 | providers pin devnet identity and obtain message blockhash validity and bounded lifetime at confirmed commitment | genesis/hash/validity substitution fixtures |
| RPC-2 | requests have bounded deadlines; response envelopes, integer/base58 shapes, context and size are validated; reads back off and sends never retry | malformed/hung/late response, rate limit and send-count tests |
| RPC-3 | two providers expose health; reads fail over conservatively, total loss denies, stale or conflicting observations cannot relax lifetime | outage, lifetime conflict and context fixtures |
| RPC-4 | final outcomes require agreeing committed provider evidence; missing, stale, processed, conflicting or incomplete history remains unresolved | two-provider status fixtures |

Initial RPC lifetime strategy refuses an older valid hash rather than accepting caller expiry:
the message must match the provider's currently returned blockhash. Absence after expiry is not
proof of non-landing, so it never releases an unresolved reservation. Live usability and outage
qualification remain owed; `docs/RPC.md` states the availability costs and provider trust residual.

SIG-4/10 attribution foundation: signer-host `authority` is validated and copied before await;
decisions carry source/mode/clock anchor and reports carry source. The monotonic clock anchors wall
time once. Authority requires devnet. These flags are not an OS-isolation proof; operational wiring,
permissions and the human-created user remain requirements. Ordinary SDK attribution is unchanged.

SIG-1/2/3/8/10 transport foundation: one canonical JSON frame and one bounded response,
each at most 16,384 bytes; fixed protocol/internal errors and absolute connection deadline
at most thirty seconds. Real owned mode-0750 parent and mode-0660 socket; live listeners,
symlinks and ordinary files refused. Abandoned-socket recovery requires the caller to hold
record kernel ownership first. Transport is not yet operationally wired. Evidence:
`evals/signer/socket.md`; accepted final signer budget and isolation requirements remain.
Completed and busy socket connections close after writing; client half-open connections
cannot retain completed slots (`evals/signer/socket-slots.md`).

LIF-4: status/report starts bind method and exact canonical payload before work; immutable
bounded responses share the record and request namespace with admissions. Restore/replay
validate bindings and ordering. SDK host APIs perform bookkeeping only. Response body maximum
12,288 bytes leaves transport-envelope space. Operational service wiring and pre-admission
proposal refusal journalling remain owed (`evals/sdk/control-request.md`).
The method handler now coalesces active identities, preserves completed control replies across
deadlines and records fixed expired/unavailable denials. Report hints carry their request deadline
through the chain read and refuse late outcome recording (`evals/signer/handler.md`). Operational
service wiring and pre-admission proposal refusal journalling remain owed.
LIF-5 closes the latter foundation gap: non-admission proposal errors persist the exact bounded
message/group payload and fixed refusal answer. Interrupted starts complete conservatively;
errors after admission remain owned by signing history. Proposal strings above 8192 characters
are invalid protocol frames before dispatch. Refusal shape/limits/codes are reversible codec
choices inside ADR-019, not new socket methods. Evidence: `evals/signer/refusal.md`.

LIF-1 foundation: optional `check(proposal, { clientId, id })` derives the payload digest itself.
IDs are ASCII letters/digits or `._:-`, length 1–128. Authoritative time/heights and deadlines
are excluded. Existing SDK calls are unchanged. Full request history remains in memory until
the accepted disk index; signed bytes, send-started, responses and deadlines remain signer work.

Implemented foundation: `authorization` opts into signed SDK history. Legacy unsigned SDK
mode remains advisory; an established signed history requires an external pin on reopening.
The isolated signer must require authorization. Canonical summary uses exact rational minutes
where needed, and UTC issued timestamps include milliseconds. Policies remain restart-only.

SNP-3 reversible authentication codec inside ADR-019: descriptor format 1 binds checkpoint
public key, guard/cluster, seq/head, policy version/hash, exact evaluation profile and SHA-256
digests of admission-state bytes, the Keel prefix and ordered archive catalogue. Snapshot and
prefix signatures use distinct `solanaut checkpoint` / `solanaut checkpoint keel prefix`
domains over the same canonical descriptor. Trust pins the dedicated key externally and
forbids principal/anchor reuse. Independently computed digests must match. Sequence zero
requires the empty genesis head; positive sequences require a full head. `seq` is the next
record sequence and `head` is the preceding entry hash, unlike an archive pin's anchored
entry sequence. The checkpoint cadence counts decisions, not all record entries. This authenticates
opaque bindings, not state semantics, prefix replay, archive availability or freshness.
No guard restore path may use it alone; SNP-4–8 remain required and unbuilt.

CI-2 reversible diagnostic choice: only planted cap trials select first-counterexample
reporting without shrinking. Ordinary property runs retain their existing options. Successful
generation/count floors, domains, assertions and containment deadlines are unchanged.
Unknown trial modes refuse; spawn errors or signals cannot count as a caught fault even
when the child prints a failure and exits one. Reproduction seeds are not fresh qualification.

CI-2 completion-record foundation: format 1 records exact externally pinned run/input/command
identity, completed state, distinct supervisor/child process identities, canonical ordered
timestamps and actual status/signal/error/timeout fields. Only status zero with no signal,
error or timeout is structurally eligible. Operator TypeScript participates in fault-source
restoration fingerprints. These checks do not authenticate a producer or establish actual
child execution; detached supervision, atomic result publication and process-loss tests
remain required before mutation qualification consumes this record.

CI-2 operator helper now freezes commands in private fresh Linux directories and detaches
actual child supervision from the launching process group. Completion records retain the
observed close status, signal, launch error, interruption and deadline state. File and
directory sync precede a separately checked commit digest; ticket identity remains external.
Inherited environment and escaped descendants are outside this component's assurance.
Supervisor SIGKILL needs external containment and cannot supply inferred success. This
helper is not yet consumed by mutation qualification (`evals/ci/run-supervisor.md`).

CI-2 explicit evaluation environment permits only PATH, LANG, LC_ALL, FUZZ_RUNS,
FUZZ_SEED and NO_COLOR with string values and no NUL. It is captured with the command
and delivered separately to both supervisor and child. Qualification must select this
mode; legacy omission inherits caller environment. TERM marks interruption even if the
child exits zero. Supervisor KILL produces no eligible completion; external child
containment remains required (`evals/ci/run-environment.md`). No mutation integration yet.

CI-2 definition 4 now integrates actual supervision into mutation execution. Frozen
input inventories, lockfile, environment, command and copied supervisor sources bind
completion; repeated inspection never relaunches. Baseline success is not a mutation
score. Full population qualification remains owed (`evals/ci/mutation-recovery.md`).

### 13.15 Publication-review preparation

| ID | Requirement | Verified by |
|---|---|---|
| PUB-1 | a read-only inventory captures HEAD and every local ref, all reachable commits and historical file blobs/paths/modes/sizes, including deleted content, symlinks and gitlinks; shallow/incomplete/changing history refuses; inventory is explicitly not confidentiality, secret, source-rights or publication clearance | independent Git fixture oracles, divergent/tagged/deleted histories, unusual paths, missing objects, shallow history and changed-ref cases; retained manifest identifies the exact inspected revision and scope |

PUB-1 supplementary review convention: the separate read-only blob companion
requires the original complete inventory before and after reads. It refuses
gitlinks or sensitive path classifications before file contents; on a permitted
complete scope it verifies every blob's byte length/Git object hash/SHA-256, and never emits a completed
receipt on partial failure. Its fixed per-object containment is 64 MiB and its
Git-read deadline is thirty seconds; exceeding either refuses rather than skips.
These are evaluator resource bounds, not lowered release targets. Actual current
history preflight refuses a private-directory classification before blob reads;
H15 and `evals/release/history-bytes.md` retain the finding. The protected inventory
gate, product and publication clearance remain unchanged.

### 13.16 Individual deployment and operator lifecycle

Allocated from the approved mission and accepted ADR-019/020; targets remain in READINESS
and the mission. `docs/plans/2026-10-06_linux-qualification.md` maps owners and dependencies.
These are requirements, not current support claims or permission for human-owned actions.

| ID | Requirement | Verified by |
|---|---|---|
| OPR-1 | reviewed release artefacts install on the reference Linux image without workspace symlinks, undeclared dependencies or undocumented loaders | clean-machine install, actual package graphs/hashes and approved runtime matrix |
| OPR-2 | configuration validation refuses wrong identity/network/policy/profile, missing established history and unsafe ownership/permissions before admissions; diagnostics are keyless and redacted | positive/negative filesystem, signature/version/cluster and secret-redaction fixtures |
| OPR-3 | dedicated signer-user and client-group permissions establish actual key isolation; same-user mode is explicit | human-provisioned cross-user key/config/history/socket checks and deployment attribution |
| OPR-4 | installed service starts only after verified recovery, holds exclusive ownership, drains before stop and restarts conservatively; socket RPC remains propose/report/status | competing starts, crash/drain/restart and uncertain-send drills |
| OPR-5 | operator policy preparation/signing/installation preserves pending state and monotonic signed versions | installed ceremony and human signatures; wrong-key/cluster/version and policy-reversal fixtures |
| OPR-6 | backup captures an exact durable boundary, excludes keys/secrets, verifies history/checkpoint/archives and restores before resuming | frozen workload, corruption/missing/foreign-history cases, reservation/latch comparison and existing backup-time target |
| OPR-7 | upgrade and binary rollback check compatibility and a verified backup before resuming; policy-content rollback requires a higher signed version | compatible/incompatible reader drills with pending sends and latch; restore validation |
| OPR-8 | two-provider loss/disagreement denies conservatively, revocation meets its existing target and removal drains/revokes access while preserving state by default | outage/degraded-status drills, human devnet revoke, installed removal and explicit data-retention checks |

### 13.17 Adapter serialised-wire boundary

Allocation under accepted ADR-009 §9 and the existing §8 send contract; no new
wallet/RPC authority, public method, policy rule or signer budget expansion.

| ID | Requirement | Verified by |
|---|---|---|
| ADP-1 | The sending adapter privately copies admitted messages and serialised wire, including raw ArrayBuffer/SharedArrayBuffer returns, and verifies the admitted message and wallet signature before RPC. Invalid/malformed wire refuses as wallet-changed-message and strips exposed object signatures even if unknown reporting fails. Previously verified signing remains unresolved if serialisation erases evidence; no premature reservation release | altered message/signature/malformed wire, raw-buffer aliasing at admission/send, destructive serializer, failed-report cleanup, one-call positive control and source/installed fault cases |

### 13.18 Denial disclosure and failure-budget allocations

These implement accepted ADR-025 and ADR-024. They allocate formats before code;
they are not claims that these behaviours are already built.

| ID | Requirement | Verified by |
|---|---|---|
| DISC-1 | Class-only adapter errors expose ref/class and no rule/reason/decision, cause, policy text, addresses or amounts, using §8's frozen table | every rule, both adapters, malformed/adapter-only refusals and serialised/stack inspection |
| DISC-2 | The operator receives a detached frozen full refusal once after recording; callback errors are fixed operator diagnostics and do not change decisions | journal-before-callback, duplicate prevention, mutation and synchronous/asynchronous callback faults |
| DISC-3 | Full disclosure requires signed policy authority; full decisions are marked and replay verifies the marker; omitted class preserves legacy canonical policy bytes | unsigned/wrong signature, tampering, round-trip and unchanged legacy-policy hashes |
| FAIL-1 | Policy schema 2 carries positive safe-integer outcomes.maxFailures/windowMs; the accepted preset is 5/600000 | malformed fields, missing budget and authorised activation |
| FAIL-2 | Count each admitted decision's first terminal failed report once in (now-windowMs,now], across all intents; unknown/expired/denied and duplicates add none | threshold-minus-one/threshold, boundaries, changed shapes, interleaved success and late outcomes |
| FAIL-3 | Persist the report and resulting latch atomically before acknowledgement; prior pending attempts retain their reservations | append/crash/competing-writer faults and restored latch |
| FAIL-4 | Verified release starts a new durable epoch; success/time/policy changes do not release the latch; later failures of old pending attempts count in the new epoch | release, pending attempts and unsigned reset faults |
| FAIL-5 | Budget/window activation reconstructs eligible history and can latch immediately; missing history refuses activation | larger windows, lowered limits and cache/history omission faults |
| FAIL-6 | New-profile decisions/reports/checkpoints replay under explicitly versioned semantics; legacy histories never acquire retrospective failure latches | mixed profiles, snapshots, installed readers and incompatible rollback |
| FAIL-7 | Signer hints cannot create failed evidence or release reservations; agreeing provider evidence is required | caller-authority, provider loss and conflict fixtures |

Allocated policy schema 2 retains prior policy fields and adds `outcomes`; it is
distinct from the monotonically increasing operator authorisation version.
Its evaluation profile uses `record: 2`, `rules: "policy-v2-failure-budget"`,
and retains the pinned decoder/sensor/Keel identities. Failure-budget activation
is an authenticated policy entry, not an unsigned reset. New-profile entries use
envelope version 2; legacy entries retain version 1 and their original profile.
Readers must reject unsupported profile/envelope combinations and incompatible
rollback. Mixed-history replay selects the authenticated active profile per entry.

New-profile checkpoint state uses format 2, binding `failureBudget` with
`epochSeq` (latest verified release or null), and eligible failed-report references
`{decision, seq, at}`. Counts are derived from verified reports, never trusted as
standalone numbers. Rebuilding Keel through replay remains required. Future compact
retention must retain/reconstruct these references under accepted ADR-023.
These allocations do not activate the new budget in legacy policy-v1 history.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft, from the research foundation (`kb/milestones/2026-09-27_R-research.md`). |
| Draft 2 | 2026-09-30 | The verified review (`runs/2026-09-30-verified-review-roadmap.md`): trust per mode; v1 decoded; tables pinned; an allowlist per instruction; durable nonces and other signers denied; the fee rule corrected; intents keyed by effects; the log as the state; the adapter surface; the structured latch release; the Squads membership question answered; D10 to D12; new battery cases. Phases are now the roadmap's milestones. |
| Draft 3 | 2026-10-01 | Built through milestone 2a.5 (`runs/2026-10-01-beta-build.md`): the effects model as implemented (`otherSigners`, outflow sources, denial rules, the intent key's definition); the record's four entry kinds; the decisions made while building, in §4 and §7; kit's default version answered; D1, D2, D5, D6, D7, D9, D10 and D12 closed; then 2a.6: the durable record, restore, the lock, replay, the latch as a recorded fact, and D11 closed; then 2a.7: Keel's bytes and telemetry checked, sensor v1 as built and measured, D3, D4 and D8 closed, an open question on runs of failures; then 2a.8: the adapters as built; then 2a.10: an open question on latching after a denied retry; then 2b.3: integrating with Solana Agent Kit; then devnet (2a.9, 2a.10, 2b.1, 2b.3): D13 found and closed, D14 found and closed (§7, §11's double-send battery), the open question on latching seen on devnet. |
| Draft 4 | 2026-10-01 | For milestone 2c.1: §13, the Alpha as requirements with IDs (SIG, POL, TOK, OPQ, PHX, ELZ, ANC, DSH, CI, RT), each traced to its source and the test that will verify it; six ADRs owed before Leg 3 builds. |
| Draft 4.1 | 2026-10-05 | The human approved §13 and accepted ADR-012 (option C) and ADR-013 to ADR-018. Nothing else changed. |
| Draft 4.2 | 2026-10-05 | ADR-012 C implemented offline; LAT requirement IDs and preserved historical replay differences. Devnet rerun and the remaining RT-3 questions are still open. |
| Draft 4.3 | 2026-10-05 | PKG acceptance IDs for the approved release-only build; private compiled SDK candidate and installed consumer checks. |
| Draft 4.4 | 2026-10-05 | ADR-019/020 accepted; signed policy and version/profile foundation, with policy-aware restore/replay and external trust. Full isolated signer qualification remains owed. |
| Draft 4.5 | 2026-10-05 | OWN/STO foundation: Linux kernel recovery, stale SDK refusal and complete synced writes. Remaining SIG-8 qualification unchanged. |
| Draft 4.6 | 2026-10-05 | LIF-1 atomic admission identity and replay validation foundation. Full signer lifecycle still owed. |
| Draft 4.7 | 2026-10-05 | LIF-2 checked signing/send-intent/response journal foundation; executor and authoritative RPC still owed. |
| Draft 4.8 | 2026-10-05 | LIF-3 conservative executor tested with fake RPC; transport, authoritative RPC and kill qualification still owed. |
| Draft 4.9 | 2026-10-05 | RPC-1–4 boundary tested with fake providers; conservative lifetime and unresolved-outcome costs stated. |
| Draft 4.10 | 2026-10-05 | Host attribution and monotonic clock foundation for SIG-4/10; operational wiring still owed. |
| Draft 4.11 | 2026-10-05 | RPC-2 owns its referenced deadline timer across fetch/body processing after a Node 22 cancellation and standalone reproduction. No target changed. |
| Draft 4.12 | 2026-10-05 | Bounded Unix transport and socket recovery foundation; operational wiring and identity persistence across all methods still owed. |
| Draft 4.13 | 2026-10-05 | LIF-4 control request/response journal; pending and immutable answer recovery, shared namespace and older-reader compatibility costs. |
| Draft 4.14 | 2026-10-05 | Close completed and busy connections after writing; held-open slot regression and shutdown failure preserved. |
| Draft 4.15 | 2026-10-05 | Method handler deadline/coalescing wiring and bounded report reads; operational service still owed. |
| Draft 4.16 | 2026-10-06 | LIF-5 pre-admission refusal history and interrupted-answer recovery; transport/core message bounds aligned. |
| Draft 4.17 | 2026-10-06 | LIF-6 isolates recovery attempt failures and reports incomplete work without skipping signed-byte chain follow-up. Completion describes a pass, not a landed outcome. |
| Draft 4.18 | 2026-10-06 | LIF-7 closes settled signing/send-intent loophole; signed-policy recovery preserves reservations across pending stages. |
| Draft 4.19 | 2026-10-06 | Same-user host composition requires protected established history and signed policy; shutdown drains host and socket work. SIG-11 is unachieved under recorded count; ADR-021 awaits human decision. |
| Draft 4.20 | 2026-10-06 | CLT-1–4 sending client and typed ambiguity errors; installed exports tested; existing partial signer unchanged. |
| Draft 4.21 | 2026-10-06 | CI-1 sequential maintained fault job, inventory and source-restoration checks; stale request selector corrected; historical/CI-2 gates remain owed. |
| Draft 4.22 | 2026-10-06 | CI-2 frozen synthetic property domains, enforced completion floor and maintained gate/product faults; other qualification remains owed. |
| Draft 4.23 | 2026-10-06 | CI-2 million-input synthetic decoder wrapper with enforced process/completion evidence; separate pinned job and maintained faults. |
| Draft 4.24 | 2026-10-06 | CI-2 asynchronous property floor and SOL per-tx/pending-window arithmetic oracles; other cap/security qualification remains owed. |
| Draft 4.25 | 2026-10-06 | CI-2 pinned mixed-history replay matrix; driver failure and mutation miss retained, focused regression added. |
| Draft 4.26 | 2026-10-06 | CI-2 queued SDK admission workload, evidence counts and maintained faults; broader concurrency qualification remains owed. |
| Draft 4.27 | 2026-10-06 | CI-2 verified persisted-prefix SIGKILL recovery and pinned Linux job; other crash boundaries remain owed. |
| Draft 4.28 | 2026-10-06 | SNP-1 bounded structural archive verification, immutable option pins and installed SDK exports; authenticated snapshots and streamed state replay remain owed. |
| Draft 4.29 | 2026-10-06 | SNP-2 installed read-only archive command, strict arguments and typed JSON receipts/errors; full recovery gates unchanged. |
| Draft 4.30 | 2026-10-06 | CI-2 complete AST coverage inventory, native test instrumentation, count/report validation and fixed SDK/signer/critical-file floors; missing failure paths covered without product-rule changes. |
| Draft 4.31 | 2026-10-06 | CI-2 frozen Stryker preparation, staged-source isolation and strict report gate; actual mutation-score qualification remains owed. |
| Draft 4.32 | 2026-10-06 | CI-2 performance-report preparation and pinned real-transaction differential analysis, with fresh-block evidence and maintained refusal checks; actual performance and wider qualification remain owed. |
| Draft 4.33 | 2026-10-06 | Frozen synthetic benign/loop definitions, complete counts and maintained faults; changing-intent failed streams remain a measured limitation, with decisions and wider qualification owed. |
| Draft 4.34 | 2026-10-06 | ANC-3 structural exact-sequence/head verification and installed command; pin authentication/replay/programme remain owed. Mutation definition 2 keeps the complete scope/tests/floor and uses a fresh seed with one test process per worker. |
| Draft 4.35 | 2026-10-06 | POL-1/5 public signing-request preparation command, strict inputs, bounded/redacted source reads and installed evidence; signing/history installation remain owed. |
| Draft 4.36 | 2026-10-06 | SNP-3–8 allocate accepted ADR-019 checkpoint, replay, retention and maintenance obligations; implementation/qualification remain owed. No architecture or threshold change. |
| Draft 4.37 | 2026-10-06 | PUB-1 allocates a read-only history inventory for the approved original-repository publication review; inventory is not secrets, confidentiality, rights or publication clearance. |
| Draft 4.38 | 2026-10-06 | SNP-3 checkpoint descriptor/signature domains and independently computed payload digest bindings; authentication component only, complete state restore remains owed. |
| Draft 4.39 | 2026-10-06 | OPR-1–8 allocate the approved individual Linux lifecycle, verification and human dependencies; no support or deployment gate is claimed. |
| Draft 4.40 | 2026-10-07 | CI-2 planted-cap first-counterexample diagnostics and actual fault-process completion; ordinary shrinking, successful floors, domains and deadlines stay unchanged. |
| Draft 4.41 | 2026-10-07 | CI-2 externally bound completion-record checks and operator-tool restoration; actual detached producer and qualification remain owed. |
| Draft 4.42 | 2026-10-07 | CI-2 actual detached supervisor and ordered result publication; environment, supervisor-death containment and mutation integration remain owed. |
| Draft 4.43 | 2026-10-07 | CI-2 explicit evaluation environment and actual supervisor-interruption evidence; killed-worker recovery and mutation integration remain owed. |

DEP-1 requires the Stryker query route to resolve the reviewed exact qs version;
malicious constructor and nullable comma arrays cannot crash serialization, and
ordinary REST query options remain compatible. Installed bytes and manifest pins are
checked by `evals/ci/dependency.test.ts`; full dependency clearance remains owed.

CI-2 definition 5 uses the documented cross-matrix baseline isolation option and
a fresh declared seed. Execution population, floors and deadlines remain unchanged;
corrected hosted confirmation and complete mutation qualification remain owed.

SNP-3 checkpoint signatures refuse invalid encoded size before base64 decoding;
equal-length noncanonical pad bits also refuse. Caller-owned JSON capture has not
been established as bounded. Complete payload/restore/publication remains owed
(`evals/sdk/checkpoint-signature.md`).

SNP-3 archive payload preparation uses canonical JSON plus a final newline, with
`format: 1`, `kind: "solanaut-checkpoint-archives"` and ordered SNP-1 segment receipts.
Receipts cover genesis through the checkpoint's next sequence without gaps or empty
segments, and end at its preceding head. Each retains its byte count, file digest,
sequence span and optional observed anchor. The payload digest binds the actual
catalogue bytes; metadata preparation alone does not verify the referenced files,
anchor authority, policy or admission state. Snapshot context is captured before
caller-owned receipts. This is a reversible encoding choice within accepted ADR-019.

CI-2 mutation definition 10 retains all previous whole files and selected tests,
adding envelope authentication and its tests after definitions 8/9 added prefix/state,
signed-policy and bundle scope. Fresh seed 23623 is declared before measurement. Authentication/catalogue and
D21 malformed-history regressions remain included.
Baseline population verification remains distinct from a full mutation score.
Existing score floors and all containment limits remain unchanged; a corrected
target freeze precedes the next long campaign. Retired target evidence cannot
qualify the corrected guard or stand in for the required hosted runtime matrix.
The retained original and added authentication populations each require the same
score floor and valid mutants; a strong added group cannot dilute an original
deficit. CI ordinary suites use serial file execution without excluding tests
or changing their deadlines or explicit concurrency batteries. The root ordinary
command places its scheduling option before file arguments; appending it after
paths leaves Node's file scheduling uncontrolled. A real overlapping-file regression
and planted omission protect this command, rather than checking an option string.
Hosted AST execution uses the existing serial option without filtering any test.

POL-2 captures policy signature text once and requires the canonical encoded size
before base64 decoding. Existing canonical-byte and cryptographic checks remain.
This bounds signature decoding only; it does not bound the whole policy object.
Checkpoint adversarial fixtures own their nested policy objects, so caller mutation
does not alter the shared workload in a process without test-file isolation.

SNP-3 internal bundle preparation captures endpoint, external policy/checkpoint
pins, history, policy seed and archive receipts before awaiting replay. It assembles
canonical archive, admission-state and Keel-prefix bytes from those captured inputs,
derives descriptor policy identity from validated state, and supplies the existing
snapshot/prefix signing domains. Current policy principals must be covered by the
external principal pins; checkpoint authority cannot be a principal or anchor key.
It neither signs nor publishes, and catalogue metadata does not verify archive files.
Independent replay, bounded memory and authenticated consumption remain separate.

SNP-3 internal envelope format 1 uses canonical JSON plus a final newline and kind
`solanaut-signed-checkpoint`, with descriptor, both signatures and opaque archive/
state/prefix text. Reading requires an explicit positive safe-integer UTF-8 byte
ceiling, checked before JSON parsing. Verification computes the three actual text
digests and checks both signatures under captured external pins; canonical framing
rejects duplicate or unsupported fields. It authenticates opaque bytes only, not
their admission-state meaning or referenced archive files. Encoder allocation is
not covered by the reader's pre-parse ceiling. Consumption still requires semantic
validation and replay before admissions.

SNP-3/5 prefix preparation uses canonical format 1, kind
`solanaut-checkpoint-keel-prefix`, profile, next sequence/head and ordered tick/reset
events with source sequence/hash. Full default-sensor replay validates copied history
before extraction; signed policy history requires external policy trust. Tick events
retain telemetry and posture, never controller state numbers. The separate signed
descriptor binds the payload digest to guard/cluster, authority, policy and archives.
This reversible ADR-019 encoding is an internal preparation component; authenticated
consumption, publication, admission state and restore remain owed.

SNP-3/5 signed-mode state preparation derives canonical format 1, kind
`solanaut-checkpoint-admission-state`, after full history/Keel replay. It binds the
current signed policy entry/version/hash, guard/cluster and profile, admission state
and previous decision. Map/set pairs retain replay order; bigint amounts/heights
use decimal strings. Request, response and unresolved signing facts remain present
until the accepted disk index replaces in-memory retention. The previous decision
survives release/report boundaries. This internal ADR-019 encoding is preparation,
not a loader or bounded-memory implementation; strict authenticated restore is owed.

PKG-1 qualification inspects compiled internal prefix/state modules from an
external tarball installation without adding root exports. CI-2 incomplete-baseline
assertions retain child output and run identity before cleanup; the existing wait,
selected workload, seeds and qualification floors are unchanged.

SNP-4 reversible owned publication convention inside ADR-019: internal record
capability requires the actual kernel-owned store. Compare a fresh read with cached
history, authenticate the envelope and derive all payloads from replay and verified
archive files. Recheck record identity/boundary and archives after asynchronous
validation. Concurrent publication refuses. Use exclusive same-directory temporary
files, file sync, predecessor hard-link/rename with directory sync, then current
rename and directory sync. Files are `<record>.checkpoint` and
`<record>.checkpoint.previous`; corrupt current evidence refuses replacement.
Storage failure fails the writer. No root export, signer method, cadence, restore
or bounded-memory contract is added. Component evidence: `evals/sdk/checkpoint-publication.md`.

SNP-5 internal prefix rebuilding validates the entire captured history under the
external policy trust pin, requires exact canonical prefix bytes, then creates a
fresh published Keel controller and consumes only derived tick/reset events.
Every tick posture is checked. The returned runtime controller is mutable for
continued evaluation; its event/endpoint receipt is immutable. No controller-state
numbers are deserialised. This is a component inside ADR-019; envelope/anchor
verification, admission-state loading and prefix-plus-tail guard restore remain
required. Evidence: `evals/sdk/checkpoint-rebuild.md`.

SNP-5/6 internal recovery preparation captures full signed history and external
policy/checkpoint pins. Full replay and optional external anchor agreement are
mandatory before inspecting a checkpoint. A valid checkpoint must match derived
prefix/state/archive payloads and verified archive files; fresh Keel consumes its
prefix and tail. Invalid or missing checkpoints use verified full history, retaining
unresolved reservations, signing, requests and latch. Missing archives may fall
back only when the supplied full history independently establishes state. Invalid
history or configuration, anchor disagreement or controller divergence refuses.
No owner/startup integration, state deserialisation or bounded-memory contract is
introduced. Component evidence: `evals/sdk/checkpoint-recovery.md`.

SNP-5/6 and OWN-2 internal owned recovery convention inside ADR-019: only the
actual kernel-owned file store has the recovery capability. Read full history on
a fresh no-follow descriptor and compare it with the store's cached entries before
checkpoint access. Capture external pins, bound reads of the current checkpoint,
and pass captured disk history through verified recovery preparation. Unsupported,
missing or damaged checkpoint sources permit only verified full replay; preserve
the source evidence. Publication and recovery share one maintenance exclusion.
Before returning, recheck live ownership, record identity, size/time boundary and
cached history. Named record and lock paths must remain regular files with the
held inode; a symlink to that same inode does not preserve the named boundary.
This is a read-only preparation receipt under the existing owner,
not guard startup, admission blocking, state loading, cadence or bounded retention.
The previous checkpoint remains publication evidence; recovery uses the current
checkpoint or complete verified history, without adding another authority path.
Component evidence: `evals/sdk/checkpoint-owned-recovery.md`.

PUB-1 inventory must read every enumerated commit's actual body and verify its
Git object hash under the inspected repository's object format, and compare actual
tree/ordered parent headers with enumerated metadata. Cached graph/tree
answers alone do not establish that the historical commit can be read. Missing,
unreadable or corrupt bodies refuse; incomplete valid blob-metadata batches also
refuse. This remains read-only metadata preparation, not confidentiality, source
rights or publication clearance. Evidence: `evals/ci/history-commit-read.md`.

SNP-1 internal streaming convention inside ADR-019: capture options when the
iterator is created. Yield deeply immutable entries only after framing, envelope,
hash, sequence/predecessor and applicable anchor checks. Pause reads while a
consumer is paused; keep bounded line/chunk buffers. Yielded entries are
provisional: natural completion alone verifies final source identity/time/size,
framing and external head/digest/anchor pins and produces an immutable receipt.
Cancellation or consumer failure closes the descriptor without a completion
receipt. The existing public verifier consumes that same iterator fully and
preserves its receipt/error surface. No root iterator export, policy authentication,
admission authority or complete bounded-state replay contract is added. Component
evidence: `evals/sdk/archive-stream.md`.

SNP-7 internal recomputation convention inside ADR-019: a replayable source factory
is consumed completely to capture the first signed policy, maximum historical
window and a canonical-record fingerprint. A second complete read uses the same
decision checker as array replay and must agree in count and fingerprint before
success. Capture policy/trust before asynchronous reads and copy each streamed
entry before it enters replay state. A source failure closes its iterator and
refuses; a decision divergence remains unsuccessful. The public array path keeps
its synchronous per-record loop. This prepares recomputation only: it neither
accepts admissions nor authenticates raw archive bytes, publishes restored state
or bounds retained request/signing maps. Actual archive factories supply pinned
structural verification through natural completion. Evidence:
`evals/sdk/replay-stream.md`.

SNP-4/5 reversible loader choice inside ADR-019: record-only operations load
lightweight checkpoint error constructors. Actual owned maintenance captures
caller pins before its asynchronous module load and performs all existing
publication/recovery validation under the held maintenance flag. Error constructors
remain re-exported from their original modules; no new root export, record format
or admission path. The unchanged baseline wait remains a separate open finding.

| Draft 4.63 | 2026-10-07 | Defer checkpoint evaluation imports until owned maintenance; preserve captured pins, error identity and all validation. Component evidence only. |

SNP-5/6 and LIF-2/7 recovery enforce report and redemption transitions before
changing the record head, clock, reservations, signing facts or sensors. Report
outcome/attribution enums and finite nonnegative time must be valid; only an
unresolved admitted attempt can receive another report. Repeated unknown reports
hold reservations and do not inflate the unknown streak. Redemption requires
an allowed reservation, unresolved attempt, unused receipt, canonical bigint
height where supplied and inclusive admitted expiry. Chronological signed policy
selection is supplied explicitly to shared application. Unsigned SDK history does
not record that selection, so reopening legitimate redeemed history under another
advisory policy retains its existing behaviour. No new state field, record format,
timestamp ordering or source-to-decision restriction is introduced. These fixes
reject impossible histories, without claiming authentication from a resealed chain.

SNP-7 internal index convention inside ADR-019: full signed replay and external
policy pins independently derive a small provenance root for an exact completed
prefix. Fixed hexadecimal shards include empty buckets and bind every historical
request namespace, payload start, immutable reply and signing/outcome evidence.
Read-only lookup captures identity/options, verifies the exact manifest and entire
selected shard under bounded line buffers, and checks regular single-link files,
source identity/change, directory identity and full digest before hit or absence.
Copied roots refuse. A restart derives a new root from retained verified history.
Preparation still captures full arrays. This is neither current-tail completeness
nor live admission authority, actual-owned publication or bounded retained state.
Component evidence: `evals/sdk/request-index.md`.

| Draft 4.64 | 2026-10-08 | D22/D23 recovery transition validation and accepted internal request-index convention; staged SDK/page preparation preserves all release gates. |
| Draft 4.65 | 2026-10-08 | D24 runtime argument-container refusal under existing CLT contracts; no export/signature/transport or readiness change. Fresh mutation definition 23 retains all populations and limits. |

Internal SNP-7 publication convention under accepted ADR-019: only the actual
kernel-owned store issues a publication capability. Fresh disk history must agree
with cached entries, then full signed replay under captured external policy pins
derives every generation byte. Immutable sibling generation directories retain
earlier evidence. A canonical pointer is replaced only after complete file and
directory syncs. Existing pointer/generation evidence must match an independently
replayed retained prefix; disk metadata never mints provenance. Validation refusal
preserves the writer; uncertain publication/storage failure fails it closed.
Index/checkpoint publication and recovery share the maintenance exclusion.
No root SDK export, signed checkpoint format, pruning, admission, cadence or
bounded-startup contract changes. Prefix absence is not current-tail absence.
Component evidence: `evals/sdk/owned-request-index.md`.

ElizaOS version selection remains within ADR-017: the published stable line is
the candidate for qualification. The inspected alpha generates a key when its
setting is absent and cannot support the historical keyless assumption. Actual
stable-framework route experiments require explicit keyless runtime settings as
well as a public-only character, and no key-carrying exchange providers. Import
and keyless route results do not clear its dependency advisories or ELZ-1/2/3.
Evidence: `evals/elizaos/published-routes.md`.

| Draft 4.66 | 2026-10-08 | Internal owned atomic index publication and D25 cache-race regression; definition 24 adds the component, then fresh definition 25/seed 25813 follows the declaration-only correction. Earlier populations and limits remain. Published ElizaOS experiments retain dependency and version findings without production dependency changes or milestone credit. |
| Draft 4.67 | 2026-10-08 | CI-2 teardown waits for bound supervisor completion before scratch removal and preserves the primary failure; separate ten-second shutdown containment, with the existing baseline wait and all product targets unchanged. No record/evaluation-profile or SDK behaviour change. |
| Draft 4.68 | 2026-10-08 | CI-2 missing committed result/marker evidence refuses before any fresh supervisor signal; only an existing empty private marker means pending. No completion format, evaluation profile, product or wait change. |

PHX-3/4 reversible offline selection convention under ADR-011: the internal
firewall filter captures explicit `{cluster: "devnet", tools: [...]}` operator
configuration, permits only configured transaction-send/transfer tool names and
requires an own explicit `solana:devnet` network on both. Empty tools denies all.
Configuration descriptors are captured once; only their own data values are
validated/copied, with unsupported names, duplicates, sparse arrays and accessors
refused. Calls are serialized JSON `{name, arguments}` objects, bounded at 65,536
UTF-8 bytes and value depth 32. Returned data is detached and deeply frozen;
errors are typed and fixed. Selection is neither a receipt nor authority to
forward. No raw text is forwarded; duplicate JSON fields use the parsed object's
last-value semantics. Policy-loading/authentication, transaction/field/rent checks,
guard admission, wallet revalidation and server/user isolation remain owed.
No signer RPC, SDK export, record/evaluation-profile or existing rule changes.
Evidence: `evals/firewall/filter.md`. Firewall source joins AST inventories with
the same statement/branch and critical floors; no earlier population is removed.

| Draft 4.69 | 2026-10-08 | Offline PHX-3/4 tool/network selection with captured immutable data, bounded/redacted parsing and maintained faults; corresponding firewall AST floors added without relaxing existing gates. Full MCP/Phantom integration remains owed. |

Internal SNP-7 current-evidence convention under accepted ADR-019: only the actual
kernel-owned store grants `lookupOwnedRequestIndex`. An existing published index
is required; this read-only operation never creates or repairs it. Capture identity,
history and external policy pins before asynchronous work. Fresh disk history must
match the cache; complete signed current replay independently derives the prefix
root. Authenticate the actual disk prefix row or absence, then fold the verified
tail for that identity. Return immutable lifecycle evidence plus current and index
sequence/head pairs. Recheck ownership, record/cache and pointer boundaries after
awaits, under the shared maintenance exclusion. Corrupt, missing or changed evidence
refuses. The answer is evidence through its captured head, not permission to admit;
future serialized admission must compare that head again before committing.
Full arrays/index construction remain retained; no eviction, signer expansion,
root SDK export, record/evaluator format change or bounded-memory claim.
Component evidence: `evals/sdk/request-index-lookup.md`.

| Draft 4.70 | 2026-10-08 | Internal owned current-head request evidence and D26 history-capture correction; fresh mutation definition 26/seed 26179 includes every earlier population and adds lookup tests. Admission wiring, bounded state and stable release remain owed. |

Internal SNP-7 serialized proposal convention under accepted ADR-019:
`checkOwnedRequest` binds genuine signed guards to their private store/state/check
context, captures input and privately copies actual bytes before a per-guard FIFO.
The actual owned index lookup must establish evidence through the live sequence
and head. Check closure and that head after lookup, then return a matching historical
decision or synchronously evaluate/commit verified absence, without another await.
Kind/digest collisions return an unrecorded fail-closed decision; unavailable or
changed evidence and invalid captured input use `OwnedRequestAdmissionError`, code
`owned-request-admission`. Append failure follows the existing unrecorded denial
and failed-writer semantics. Queue rejection does not poison later work. Companion
replies are detached and deeply frozen; public synchronous methods remain unchanged.
All maps, arrays and index construction remain retained. Never evict history from
the exposed synchronous guard; a future distinct async facade must privately own
it and route all relevant consultation first. No root SDK export, signer wiring,
record/evaluator change, isolation or completed SNP-7 claim.
Component evidence: `evals/sdk/owned-request-admission.md`.

| Draft 4.71 | 2026-10-08 | Internal serialized owned proposal consultation with D27 reply detachment and D28 shared-byte capture corrections. Definition 27/seed 27241 retains prior sources/tests/floors/limits and adds the companion tests. Bounded state, complete asynchronous facade, signer deployment and release gates remain owed. |

Read-only PKG-3/SNP operator replay convention under accepted ADR-010/014/019:
keep `<record.jsonl> <policy.json|-> [public-trust.json]`, the existing success
text and first-divergence sequence/field. Exit 0 means matched replay, 1 a replay
divergence (including policy/profile/history violations), and 2 usage or an unsafe,
unreadable or structurally invalid input. Both detail labels now print `[redacted]`;
diagnostics never print input values, source paths or raw exceptions.
The command composes complete `streamArchive` reads with `replayStream`. Public
JSON inputs have a specified inclusive 1,048,576-byte ceiling; archive lines use
the same inclusive ceiling excluding their newline. On Linux, require regular
single-link sources, refuse final source symlinks/nonblocking special files and
observed descriptor/path changes, and decode UTF-8 strictly. Capture public JSON
before asynchronous replay. Trust accepts exactly the three nonempty public pin
strings, independently provided; `-` selects recorded signed policies. No new
flags, stable exports, signer method, format/profile or policy semantics.
Streaming input does not bound retained replay state or qualify service recovery.

| Draft 4.72 | 2026-10-09 | Safe read-only replay command and D29/D30 corrections; definition 28/seed 28483 retains the complete prior selected population, floors, waits and limits. Installed command and source/compiled qualification remain separately scoped; H13 hosted account availability and all release gates remain open. |

Internal LIF-4/5 and SNP-7 owned-control convention under ADR-019: genuine signed
guards provide `beginOwnedRequest`, `finishOwnedRequest` and `ownedRequestResult`
alongside owned admission, all sharing one FIFO. Capture identity and canonical
payload/result before queueing; verify actual kernel-owned index evidence through
the current head before synchronous bookkeeping or reply capture. Matching starts
and completed responses return exact detached recursively frozen objects; method,
payload or start-hash collisions refuse. A known pending control has undefined
result; unknown identities or admissions are not control requests. Typed internal
failure is `OwnedControlRequestError`, code `owned-control-request`, with fixed
diagnostics. Preserve all existing codec bounds, formats and policy semantics.
Capture the private start/completion functions when creating the guard; later
replacement of public SDK methods does not replace owned bookkeeping (D31).
Trusted synchronous mutations can interrupt lookup and invalidate its head;
these methods neither sign/send nor release spending reservations. They are not
root exports, signer socket methods, bounded state or a completed SNP-7 claim.
Evidence: `evals/sdk/owned-control-request.md`.

| Draft 4.73 | 2026-10-09 | Shared owned control/admission FIFO and D31 private-dispatch correction. Preserve definition 29's inventory failure and definition 30's wait failure; final definition 31/seed 31907 retains nineteen new cases and batches all six actual gap scenarios without dropping assertions. All floors, waits and limits remain. Local commits only; no remote/hosted/release completion follows. |

Internal SNP-7 admission/control facade convention under accepted ADR-019:
`openOwnedGuard` captures signed configuration before awaiting and owns its guard
and kernel file store privately. Require an existing devnet history starting with
a signed policy, exactly the current signed content/version/text and an existing
authenticated request index. Refuse implicit policy installation or upgrade;
failed startup releases ownership. A fixed `OwnedGuardError`, code `owned-guard`,
hides raw configuration/storage diagnostics.

The frozen internal surface offers asynchronous admission, control start/finish/
result, status and close, plus a detached frozen policy and policy hash. It exposes
neither mutable guard/store nor history. Capture inputs before queueing, including
private ordinary message-byte backing; share a FIFO for operations and observations.
Close stops accepting immediately, drains earlier work and releases ownership;
repeat close returns the same completion. A refused operation does not poison the
queue. Status describes private in-memory state; it is not independent chain proof.

Trusted synchronous SDK exports remain unchanged. The facade does not implement
signing journal, outcome reporting, maintenance or
an executable signer. Full histories and state maps still remain in memory.
No SIG-11 budget pass, bounded recovery, process isolation or stable-release claim
follows. Component evidence: `evals/sdk/owned-guard.md`.

| Draft 4.74 | 2026-10-09 | Private asynchronous admission/control facade on established owned signed history. No mutable guard/store/history escapes; shared observations and orderly close. Definition 34/seed 34183 retains prior populations and limits, adds facade tests/source and its critical coverage designation. Preserve the prior concurrent definition 32 wait failure and definition 33 focused branch deficit; add malformed-input and valid foreign-cluster boundaries before final measurement. Broader qualification remains owed. |

Private facade admission convention under ADR-019: only a recorded decision with
nonnegative sequence is an admission reply. The trusted SDK's unrecorded denial
sentinel remains unchanged; the private facade converts it to fixed typed
`OwnedGuardError`, whether caused by storage failure or identity collision.
Nothing is recorded, signed or resent to manufacture a reply. Preserve failed
writer state and every existing durable denial/retry. Evidence:
`evals/sdk/owned-admission-error.md`.

| Draft 4.75 | 2026-10-09 | D32 rejects unrecorded facade replies with a fixed typed error. Real append-failure and collision tests fail first; maintain all old source/compiled trials and add regressions. Definition 35/seed 35447 retains all earlier inputs/limits with the additional storage case. No completed AST/driver, bounded recovery or release gate is inferred. |

Private redemption convention under accepted ADR-019: asynchronous `redeem`
captures ordinary byte backing before queueing on the same facade FIFO. Delegate
the trusted SDK's checked durable transition; only successful synced redemption
returns a detached frozen result. All refusals throw fixed `OwnedGuardError`,
including failed appends, without exposing storage diagnostics or reopening a
writer. A refusal consumes no receipt; a successful redemption remains used after
restart. No keys, signing, sends or reservation release follow from this method.
Internal only; public SDK and socket interfaces remain unchanged. Evidence:
`evals/sdk/owned-redemption.md`.

| Draft 4.76 | 2026-10-09 | Queue private redemption with captured bytes, checked synced success and fixed refusal errors. Preserve first source/installed failures and fixture/build setup findings. Definition 36/seed 36191 adds the redemption cases while retaining prior inputs and limits. Complete lifecycle, bounded recovery and release qualification remain owed. |

Private operator-release convention under accepted ADR-019 and existing latch
rules: asynchronous `releaseText` and `release` share the facade FIFO. Preparation
accepts primitive expiry text and refuses a noncanonical structured prompt or
non-finite parsed expiry. Expired canonical text may still be prepared; execution
checks the latest recorded clock as before. Capture signature bytes into ordinary
private backing before queueing. Only existing checked synced success returns a
detached frozen result; every refusal uses fixed `OwnedGuardError`. Preserve
pending reservations and used receipts through release, and latch state through
failed writes/restart. No signature, send, key, authority or policy change is
performed by preparation or by these wrappers. Trusted SDK caller time remains;
this is not the isolated signer or a public socket/root API.
Evidence: `evals/sdk/owned-release.md`.

| Draft 4.77 | 2026-10-09 | Queue private operator prompt/release with canonical preparation, captured signature backing and durable success only. Preserve absent APIs, rule-field fixture error and the overbroad FIFO trial failure. Definition 37/seed 37417 adds operator cases without changing prior inputs/limits. Full lifecycle, bounded state and release qualification remain owed. |
| Draft 4.78 | 2026-10-09 | Record D33 and STO-3: check live descriptor size/timestamps before append, fail the store permanently on change, and retain fixture/fault misses. Add stale timestamp and direct-store tests. Definition 38/seed 38653 retains earlier inputs/limits. Metadata consistency does not establish host tamper protection or any stable milestone. |
| Draft 4.79 | 2026-10-09 | Allocate OWN-4 inside ADR-019: refuse hardlinked journal/mutex aliases so a pathname alias cannot obtain a separate owner. Source and installed prior-candidate tests fail first; keep every earlier case/fault and declare definition 39/seed 39743 before full measurement. No host tamper-proof, bounded recovery or release milestone claim. |
| Draft 4.80 | 2026-10-09 | Allocate STO-4 and record D35: verify observed record-read metadata and inode identity before parse/torn-tail repair. Actual startup mutations fail first in both ownership modes; retain earlier cases/trials and declare definition 40/seed 40529 before full measurement. No atomic source freeze or stable milestone follows. |
| Draft 4.81 | 2026-10-09 | Allocate STO-5: match raw record bytes with descriptor size before torn-tail repair, and repair using byte offsets. Preserve short-read data-loss failures, initial fault diagnostic mismatch and full-run fixture failures. Scope checkpoint fault injection to its actual inode while retaining every fault/assertion. Corrected definition 42/seed 42719 follows definition 41's failed run with earlier inputs/limits retained. No bounded-read, power-loss or stable milestone claim. |
| Draft 4.82 | 2026-10-09 | Refine STO-1/2 and record D37: verify exact synced physical append delta before acknowledgement/cache mutation. Preserve missing/extra-write failures, moved mutation-site diagnostic and nonempty-journal test miss; add positive controls. Definition 43/seed 43907 retains prior inputs/limits. No authenticated-content, bounded-state or stable milestone claim. |
| Draft 4.83 | 2026-10-09 | Refine OWN-2/STO-2 and record D38: post-sync journal/mutex identity checks refuse replacement before acknowledgement/cache mutation, preserving foreign evidence. Four actual replacement cases fail first; retain prior cases/faults. Definition 44/seed 44317 retains earlier inputs/limits. No atomic-host or stable milestone claim. |
| Draft 4.84 | 2026-10-09 | Queue private trusted SDK reports with caller attribution and current journal time; preserve reservations on failed writes and used receipts across outcomes/restart. Primitive inputs refuse coercions; no socket/RPC authority or root export. Preserve absent-method failures and stalled FIFO fixture, adding cleanup. Definition 45/seed 45691 retains prior inputs/limits. Isolated lifecycle, bounded state and stable qualification remain owed. |
| Draft 4.85 | 2026-10-10 | Queue captured signing-history facts through the private facade under ADR-019; delegate the existing verifier and synced append, return immutable detached entries, drain before close. Preserve finality, unknown reservations and restart no-resend. No signing, sending, keys, root export, socket method or bounded-state claim. |
| Draft 4.86 | 2026-10-10 | D39/ADP-1 verifies one captured serialised wire before RPC, retains already verified signing on destructive serialisation and preserves cleanup on failed reporting. Initial failures and source/emitted/installed regressions are retained; existing SDK trust, public methods, policy and signer budget remain unchanged. |
| Draft 4.87 | 2026-10-10 | D40/ADP-1 privately copies raw buffer returns at legacy/versioned message capture and serialised send. Preserve reproduced alias failures and earlier D39 evidence; no public method or trust boundary change. |
| Draft 4.88 | 2026-10-10 | Integrate the exact D40 correction after fresh full native/type passes; preserve earlier deferral and current H11 serial-coverage failure. No public API, profile, policy, signer or readiness gate change. |
| Draft 4.89 | 2026-10-10 | D41 reproduces premature expiry after wallet array edits and prepares private batch membership under ADR-009. Native H11 failure prevents integration; preserve the candidate, first failures and component qualification without changing the gate. |
| Draft 4.90 | 2026-10-10 | PUB-1 separate blob-verification companion preserves complete scope, explicit refusal and no-clearance semantics. Actual history preflight refuses sensitive path metadata before reads; H15 remains human-owned. No protected gate or product changes. |

Internal SNP-5/7 convention under ADR-019: private `report(hash, outcome)` queues
the existing trusted SDK report operation with admission, control, redemption,
operator actions, observations and close. Inputs are primitive hash/outcome
values; invalid values refuse without invoking caller coercions. Outcomes retain
caller attribution and the latest journal time when executed. Synced append is
required before success; a failed append returns the fixed facade error and
preserves unresolved state. No report request identity or authoritative RPC
evidence is manufactured by this method. Socket reports remain payload-bound
request hints reconciled by the signer; isolated mode cannot trust this caller
outcome directly. Full state/history retention remains unchanged. Evidence:
`evals/sdk/owned-report.md`.

Internal LIF-2/7 and SNP-5/7 convention under ADR-019: private
`recordSigning(event)` captures a structured clone before entering the owned
facade's shared queue. The existing trusted SDK verifier and synced append
remain authoritative for journal validity; the method returns a detached frozen
entry only after append. It creates no signature or send, accepts no isolated
caller authority, and adds no socket method or root export. Final reports still
forbid new signed/send-started facts; unknown evidence retains reservations.
Restart cannot repeat durable stages. Full historical maps remain retained.
Evidence: `evals/sdk/owned-signing.md`.
