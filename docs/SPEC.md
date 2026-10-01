# SPEC.md — Solanaut's MVP baseline, v1

> **Draft 2** · 2026-09-30 · owner: architect · for: the builder, evaluator and integrator seats, and judges
> reading the code · not public. Decisions: `design/ADR-004` (admission and receipts), `ADR-005` (transaction
> coverage, partly superseded), `ADR-006` (on-chain backstop), `ADR-009` (trust and coverage), `ADR-010` (the log is
> the state), `ADR-011` (Phantom and the dashboard). Claims: `docs/CLAIMS.md`. Roadmap: `docs/ROADMAP.md`.
> Register: `kb/DOCUMENTS.md`.

This is what the Beta MVP builds (milestones 2a.1 to 2a.10 in `docs/ROADMAP.md`), stated concretely enough to write
the failing tests from. What the Alpha adds is marked **(Alpha)**. The code that exists today is described in
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

interface DecisionV1 {
  v: 1;
  seq: number;
  prev: string;                               // hash of the previous decision; "" for the first
  at: number;
  source: "caller" | "signer";                // where time, heights and outcomes came from (§2.1)
  message: string;                            // the proposal's bytes, base64, so the log replays on its own
  intentKey: string | null;
  group: string | null;                       // the caller's intent key, if any
  messageHash: string | null;                 // null if the bytes could not be parsed
  allow: boolean;
  rule?: RuleV1;                              // on every denial
  reason: string;
  posture: "DEFAULT" | "INHIBIT" | "REGROUND" | null;
  telemetry: { intensity: number; valence: number; repetition: number } | null;
  policyHash: string;
  keel: { version: "1.0.1"; digest: string; verified: "bytes" | "declared" };
  expires?: { lastValidBlockHeight: string }; // receipts only
  hash: string;                               // sha256(canonicalJSON(decision without hash))
}
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

- **Verify the bytes.** `createGuard` decodes Keel's embedded controller, hashes it, and requires
  `834015d7…ded7d8`. On success `keel.verified` is `"bytes"`. This fixes D4.
- **Validate before ticking.** Telemetry is checked with `Governor.accepts()` and `typeof === "number"` before
  `tick()`. This fixes D3.
- **Restore only by replay.** Keel's state is rebuilt by replaying the log (ADR-010), never loaded from stored numbers
  (upstream finding U-3).
- **Sensor v1:**
  - **intensity** = max(value against the per-transaction cap, rate against `sensor.expectedPerMinute`). The rate
    term no longer reads normal payments as full intensity (D8).
  - **valence** falls with failures, *unknown* outcomes and denials, and recovers with landed transactions.
  - **repetition** is 1 for identical effects; 0.8 for the same effects re-proposed, or the same shape with a rising
    priority fee (**fee escalation**); 0.5 for the same shape at a different amount; otherwise 0.
  - Every coefficient is stated. None is tuned after looking at a battery's result.

## 7. Receipts, intents, the latch, the log

- **Reserve at admission.** Caps count allowed amounts when they are allowed. An *unknown* outcome keeps its
  reservation. A `failed` or `expired` outcome releases it only when reported by a source §2.1 trusts in that mode.
- **Intents.** The intent key is the hash of the effects without fees, whatever key the caller sends. Each intent has
  attempts, each `pending`, `landed`, `failed` or `expired`.
  - Attempt *k*+1 is admitted only if attempt *k* is `failed`, or `expired`: the block height is past the
    `lastValidBlockHeight` that belongs to attempt *k*'s blockhash. In signer mode the signer gets that height with the
    blockhash and checks the blockhash's validity itself.
  - `pending` or `unknown` means `intent-in-flight`.
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

**Status:** D1, D2 and D9 are fixed in `packages/sdk/src/policy-v1.ts` (milestone 2a.4, `evals/sdk/policy.md`). They
close in the guard when admission takes policy v1 (milestone 2a.5).

## 11. Batteries and acceptance

**The Beta gate** (milestone 2b.1 in `docs/ROADMAP.md`). Every case runs from a clean clone.

| Battery | Cases | Passes when |
|---|---|---|
| fail-closed | garbage bytes; an unknown version; an unpinned table and an index past a pin; NaN or non-number telemetry; tampered controller bytes; an invalid policy | every case denies with its named rule |
| drain, incident-shaped, at least 30 cases | a new recipient; Approve to an attacker; SetAuthority; an oversized send of a listed mint; an unlisted program; a token sent to a non-associated account; a durable-nonce transfer; CreateAccount funding a counterparty's key; a table index that points at an attacker; a v1 message with a ComputeBudget decoy; a price with no limit; another signer's instruction | every case denies with its named rule |
| double-send | re-sign before expiry; re-sign after expiry; re-sign after an unknown outcome; the same effects under a new intent key | `intent-in-flight`, allowed, `intent-in-flight`, `intent-in-flight` |
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

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft, from the research foundation (`kb/milestones/2026-09-27_R-research.md`). |
| Draft 2 | 2026-09-30 | The verified review (`runs/2026-09-30-verified-review-roadmap.md`): trust per mode; v1 decoded; tables pinned; an allowlist per instruction; durable nonces and other signers denied; the fee rule corrected; intents keyed by effects; the log as the state; the adapter surface; the structured latch release; the Squads membership question answered; D10 to D12; new battery cases. Phases are now the roadmap's milestones. |
