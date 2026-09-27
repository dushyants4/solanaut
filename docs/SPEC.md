# SPEC.md — Solanaut's MVP baseline, v1

> **Draft 1** · 2026-09-27 · owner: architect · for: the builder, evaluator and integrator seats, and
> judges reading the code · not public. Decisions: `design/ADR-004` (admission and receipts), `ADR-005`
> (transaction coverage), `ADR-006` (on-chain backstop). Claims: `docs/CLAIMS.md`.
> Register: `kb/DOCUMENTS.md`.

This is what H1–H4 build, stated concretely enough to write the failing tests from. The code that exists
today (phase 0) is described in `docs/OVERVIEW.md`, and its defects are in §10. They are fixed first.

## 1. Scope

**In:**
- the guard core v1: bytes in, legacy and v0 decoded;
- policy v1;
- receipts, intents, the decision log and replay;
- Keel hardening and sensor v1;
- a web3.js `BaseWallet` wrapper and a `@solana/kit` signer;
- an ElizaOS plugin (P1) and a signer process (P1);
- the on-chain backstop (a Squads v4 spending limit, plus a tiny log-anchor program as P2);
- the cockpit;
- the batteries.

**Out:**
- mainnet and real funds (ADR-003);
- key custody as a service;
- transaction simulation (LiteSVM, Surfpool);
- decoding swap programs such as Jupiter (they are *opaque*, §4);
- an RPC proxy and an x402 payment guard;
- anything about model safety itself.

## 2. Actors and trust

| Actor | Trusted for | Not trusted for |
|---|---|---|
| Agent (model and framework code) | nothing: it **proposes** | anything it says about a transaction's effects |
| Guard (`@solanaut/sdk`) | **admission**: decoding bytes, applying policy, asking Keel | its own integrity when it shares a process with a compromised agent (hence the signer process) |
| Signer | **execution**: signing bytes that carry a valid receipt | deciding anything |
| Operator (the human) | writing the policy; holding the release key; owning the Squads multisig | — |
| RPC | sending transactions; lookup-table contents, when the caller fetches them | telling the guard what a transaction does |
| Squads v4 program | enforcing the spending limit on-chain, whatever the guard decided | anything outside that limit |
| Cockpit | display only; it holds no keys | — |

**Deployment modes:**
1. **SDK in-process** (P0). The guard and the key live in the agent's process. It stops a fooled or
   confused model, but not a compromised process.
2. **Signer process** (P1). The key lives in `solanaut-signer`, and the agent gets receipts and
   signatures, never the key.
3. **On-chain** (H3). Funds sit behind a Squads spending limit, so even a stolen key is bounded.

## 3. Data model v1

Amounts are `bigint`: lamports for SOL, base units for tokens. Addresses are base58 strings. Hashes are
lowercase hex SHA-256. "Canonical JSON" means sorted keys, no whitespace, and bigints as decimal
strings.

```ts
interface PolicyV1 {
  version: 1;
  programs: { allow: string[]; opaque: "deny" | "allow" }; // opaque: allowlisted but not decoded (§4)
  destinations: { allow: string[] };                       // owners: wallets that may receive SOL or tokens
  sol: { maxPerTx: bigint; maxPerWindow: bigint };
  tokens: { mint: string; maxPerTx: bigint; maxPerWindow: bigint }[]; // any mint not listed is denied
  fees: { maxPriorityPerTx: bigint; maxPriorityPerWindow: bigint };    // lamports
  windowMs: number;
  intents: { maxAttempts: number };
  latch: { afterDenials: number; releaseKey: string };     // the operator's key, never the agent's
  messages: { allow: false };                              // off-chain signatures are denied in v1
  sensor: { expectedPerMinute: number };                   // sensor v1's rate baseline (§6)
}
// policyHash = sha256(canonicalJSON(policy)). Validated at creation (§5, rule 0); frozen, deep.

interface ProposalV1 {
  message: Uint8Array;                        // the serialized message: legacy or v0
  at: number;                                 // ms, from the caller's clock; the guard keeps none
  blockHeight?: bigint;                       // the current block height, when the caller knows it
  lastValidBlockHeight?: bigint;              // from getLatestBlockhash, for the receipt's expiry
  lookupTables?: Record<string, string[]>;    // resolved contents of every table the message uses
  intent?: string;                            // the caller's key for one logical payment
}

// Derived by the guard from the bytes. Never taken from the agent's word.
interface EffectsV1 {
  version: "legacy" | 0;
  messageHash: string;                        // sha256(message): what the receipt binds
  feePayer: string;
  programs: string[];
  opaque: string[];                           // allowlisted programs whose instructions are not decoded
  sol: { to: string; lamports: bigint }[];
  tokens: { mint: string | null; toOwner: string | null; toAccount: string; amount: bigint }[];
  dangerous: { program: string; instruction: string }[]; // Approve, SetAuthority, CloseAccount, Assign
  priorityFee: bigint;                        // ceil(price × limit / 1e6); 0 if unset
  intentKey: string;                          // proposal.intent ?? sha256(canonical effects minus fee)
}

interface DecisionV1 {
  v: 1;
  seq: number;
  prev: string;                               // hash of the previous decision; "" for the first
  at: number;
  intentKey: string | null;
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
- the receipt has not been used;
- the current block height is at most `expires.lastValidBlockHeight`;
- `policyHash` equals its own policy's hash.

## 4. What the guard decodes (ADR-005)

| Program | Decoded | Effect |
|---|---|---|
| System | Transfer, TransferWithSeed, CreateAccount (its lamports), Assign | SOL moved to `to`; Assign is *dangerous* |
| SPL Token, Token-2022 | TransferChecked, Transfer, Approve(Checked), SetAuthority, CloseAccount | tokens moved; the last three are *dangerous* |
| ComputeBudget | SetComputeUnitLimit, SetComputeUnitPrice | `priorityFee` |
| Memo | any | none |
| any other | nothing | denied unless allowlisted; if allowlisted, *opaque* |

Rules for tokens:
- **Destination.** A token transfer's `toAccount` must be the associated token account of an allowed
  owner for that mint (derived offline, with no RPC), or an address the policy names directly.
- **Mint.** A plain `Transfer` names no mint, so the mint is inferred when the source is an associated
  token account of a listed mint. Otherwise the transfer is denied as `token-mint-unknown`.
- **Token-2022 extensions** (transfer hooks, permanent delegate) are not inspected in v1, because the
  guard has no RPC. The operator lists only mints it has checked; ADR-005 records this residual risk.

Message versions:
- **v1 and unknown versions are denied.** v1 moves the priority fee into the message itself, where an
  instruction decoder would never look.
- **A v0 message whose lookup tables are not all supplied is denied.**

## 5. The rules, in order

The first failing rule is the reason for the decision. Every rule has a failing test before its code
exists.

| # | Rule | Denies when |
|---|---|---|
| 0 | `invalid-policy` | at creation: a non-finite or negative cap, an empty or invalid address, a release key equal to the fee payer. Creation throws; no guard exists |
| 1 | `malformed-proposal` | the bytes do not parse, or a field is missing or ill-typed |
| 2 | `unsupported-version` | the message is v1, or an unknown version |
| 3 | `lookup-table-unresolved` | a v0 message uses a table whose contents were not supplied |
| 4 | `latched` | the guard is latched (§7) |
| 5 | `program-not-allowed` | a program is not on the allowlist |
| 6 | `opaque-program` | an allowlisted program is not decoded, and `programs.opaque` is `"deny"` |
| 7 | `instruction-denied` | Approve, SetAuthority, CloseAccount or Assign appears |
| 8 | `destination-not-allowed` | a SOL or token destination is not allowed |
| 9 | `mint-not-allowed`, `token-mint-unknown` | a token's mint is not listed, or cannot be known |
| 10 | `over-per-tx-cap` | the SOL total, or a mint's total, is over its per-transaction cap |
| 11 | `over-fee-cap` | the priority fee is over `fees.maxPriorityPerTx` |
| 12 | `intent-in-flight` | an earlier attempt of this intent could still land (§7) |
| 13 | `intent-attempts-exhausted` | the intent has used `intents.maxAttempts` |
| 14 | `over-window-cap` | allowing this would pass a per-window cap on SOL, a mint, or fees; counted at admission |
| 15 | `loop-reground` | Keel returns REGROUND |
| 16 | `inhibit-cap` | Keel returns INHIBIT, and the amount is over the per-transaction cap × `temperatureMax` (0.3). This mapping is Solanaut's design, not Gubernaut's |
| 17 | `fail-closed` | anything throws |

**Every parsed proposal reaches Keel,** allowed or denied: re-proposing a refused transfer is a loop
too. A malformed proposal has no effects to sense; it counts toward the latch instead.

## 6. Keel and sensor v1

- **Verify the bytes.** `createGuard` decodes Keel's embedded controller, hashes it, and requires
  `834015d7…ded7d8`. On success `keel.verified` is `"bytes"`. This fixes D4.
- **Validate before ticking.** Telemetry is checked with `Governor.accepts()` and `typeof === "number"`
  before `tick()`. This fixes D3.
- **Sensor v1:**
  - **intensity** = max(value against the per-transaction cap, rate against
    `sensor.expectedPerMinute`). The rate term no longer reads normal payments as full intensity (D8).
  - **valence** falls with failures, *unknown* outcomes and denials, and recovers with landed
    transactions.
  - **repetition** is 1 for identical effects; 0.8 for the same intent re-proposed, or the same shape
    with a rising priority fee (**fee escalation**); 0.5 for the same shape at a different amount;
    otherwise 0.
  - Every coefficient is stated. None is tuned after looking at a battery's result.

## 7. Receipts, intents, the latch, the log

- **Reserve at admission.** Caps count allowed amounts when they are allowed, and an *unknown* outcome
  keeps its reservation. Counting after signing lets concurrent requests all pass.
- **Intents.** Each intent has attempts, each `pending`, `landed`, `failed` or `expired`.
  - Attempt *k*+1 is admitted only if attempt *k* is `failed`, or `expired` (the reported block height
    is past its `lastValidBlockHeight`).
  - `pending` or `unknown` → `intent-in-flight`.
  - A `landed` intent is done; the same effects again make a new intent.
  - Report outcomes with `guard.report(decisionHash, "landed" | "failed" | "expired" | "unknown")`.
- **The latch.** It trips after `latch.afterDenials` consecutive denials, or on any REGROUND. While
  latched, every proposal is denied as `latched`.
  - Release is `guard.release(signature)`, verified with ed25519 against `latch.releaseKey`, over
    `solanaut-release:<policyHash>:<seq>`.
  - The agent's key cannot release it.
- **The log.** One `DecisionV1` per line, JSONL, append-only, with fsync per line. Each line's `prev`
  is the previous line's `hash`, and the log carries each proposal's bytes (base64) so it replays on
  its own.
- **Replay.** `replay(log, policy)` recomputes every decision and reports the first divergence.
  Anchoring the head on-chain is P2 (§9).

## 8. Adapters

- **`guardedWallet(wallet, guard)`** implements Solana Agent Kit's `BaseWallet`, so SAK adopts it in one
  line.
  - `signTransaction`: check, then sign or throw.
  - `signAllTransactions`: all or nothing.
  - `signAndSendTransaction`: check, send, then report the outcome.
  - `signMessage`: denied.
- **`SolanautDenied`** is the typed error carrying `{rule, reason, decision}`. A denied agent gets a
  named rule to act on, not a hang or a silent retry.
- **`@solana/kit` signer:** a guarded partial signer, with the same semantics (H2).
- **ElizaOS plugin** (P1): it wraps `plugin-solana`'s signing path. How exactly is decided at the start
  of H2, from `plugin-solana` 1.2.6's source.
- **`solanaut-signer`** (P1): a local process holding the key.
  - It answers `propose`, `report` and `status` over a Unix socket; every other method is refused.
  - Each request has a deadline of 30 s or less and an ID, so a retried request is safe.
  - The target is 500 lines or fewer, stated and then measured.

## 9. On-chain backstop (ADR-006)

- **Squads v4 on devnet.** The operator owns a multisig. The agent's key is a member with no vote or
  execute permission, and it is named on one spending limit:
  - mint: SOL, or a devnet USDC;
  - amount: N per day;
  - destinations: the policy's allowed owners.
  - A stolen agent key can then move at most N per day, only to those destinations, whatever runs off
  the chain.
  - Alternative: fund the agent's hot wallet through the limit (destinations: the hot wallet only) and
    guard the hot wallet in the SDK.
  - The H3 spike (half a day) chooses between them, and confirms the program ID and member permissions
    against Squads' docs.
- **`solanaut_anchor`** (P2, cut first). A tiny Anchor 1.2 program with one instruction:
  `anchor(head: [u8; 32], seq: u64)`. It writes the log head to a PDA for each guard and emits
  `DecisionAnchored`. This detects a wholesale rewrite of the log.

## 10. Defects in the current slice, fixed first in H1

Each is fixed test-first: the evaluator writes the failing test, and the builder fixes the code.

| ID | Defect | Where | Fix |
|---|---|---|---|
| D1 | `guard.policy` is the live internal object, and `Readonly<>` is shallow, so `guard.policy.allowedDestinations.push(x)` compiles and widens the allowlist | `guard.ts:45,98` | deep-freeze a private copy; expose a frozen clone |
| D2 | The policy is never validated: `maxLamportsPerTx: NaN` disables the cap (`amount > NaN` is false) | `policy.ts:54` | rule 0 |
| D3 | Telemetry is not validated before `tick()`, which coerces `null`, `"0.5"`, `true` and `[0.7]` (reported upstream, to reproduce) | `guard.ts:61` | §6 |
| D4 | The digest check compares two constants; the controller's bytes are never hashed | `guard.ts:41-44` | §6 |
| D5 | `describeTransaction` runs outside the fail-closed boundary: a decode error throws instead of denying | `describe.ts`, callers | `guard.check(bytes)` decodes inside it |
| D6 | Legacy transactions only; SPL, Token-2022, ComputeBudget and v0 are not decoded; allowlisting the Token Program allows any token transfer | `describe.ts` | §4 |
| D7 | Nothing binds an ALLOW to the bytes later signed, and no decision log exists | `guard.ts` | §7 |
| D8 | Sensor v0's rate term reads fast legitimate payments as full intensity on a real clock | `sensor.ts:35` | §6 |
| D9 | Lamports are JS numbers; precision is lost above 2^53 | `policy.ts`, `describe.ts:15` | `bigint` throughout |

## 11. Batteries and acceptance

| Battery | Cases | Passes when | Phase |
|---|---|---|---|
| fail-closed | garbage bytes, v1, unresolved lookup table, NaN or non-number telemetry, tampered controller bytes, invalid policy | every case denies with its named rule | H1 |
| drain, incident-shaped | new recipient; Approve to an attacker; an oversized send of a listed mint; an unlisted program; a token sent to a non-associated account | every case denies with its named rule | H1 |
| double-send | re-sign before expiry; re-sign after expiry; re-sign after an unknown outcome | `intent-in-flight`, allowed, `intent-in-flight` | H1 |
| concurrency | 50 proposals in one tick against the window cap | exactly the cap is admitted | H1 |
| loop | identical retries; retries with rising fees; retries alternating two shapes | the stop turn is **measured and reported**, with no threshold assumed | H1 |
| benign | varied payments at realistic rates | the false-stop rate is **measured and reported** | H1 |
| adapters | a SAK agent and a kit agent, each with a one-line change, through the sandbox | the same verdicts as the SDK | H2 |
| on-chain | a stolen-key script calling Squads directly | the program refuses past the limit | H3 |
| end to end | the incident-shaped scenarios on devnet, shown in the cockpit | each refusal is visible, with its rule | H4 |

Rates go into `docs/CLAIMS.md` only after they are measured, with their version, config and a command
that regenerates them.

## 12. Open questions

- Squads v4: can a member with no permissions use a spending limit? The program ID, confirmed against
  Squads' docs. The H3 spike answers both.
- The `@solana/kit` signer interface to wrap (`TransactionPartialSigner`, or a modifying signer). H2.
- ElizaOS: wrap the plugin's action handlers, or its wallet? H2.
- v1 transactions: the rollout date, and when to decode them rather than deny them.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft, from the research foundation (`kb/milestones/2026-09-27_R-research.md`). |
