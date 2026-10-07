# THREAT-MODEL.md — what Solanaut defends, against whom, and what is left

> **Draft 5** · 2026-10-07 · owner: architect · builder-authored reconciliation for independent review,
> not an Alpha review or specialist audit. For: reviewers and auditors · not public.
> Design: `docs/SPEC.md`, ADR-004 to ADR-020; stable clarifications ADR-019/020 are accepted.
> ADR-008 remains deferred; ADR-021/022 remain proposed.
> Claims: `docs/CLAIMS.md`.
> Register: `kb/DOCUMENTS.md`.

## 1. Scope

- **In:** individual Linux/devnet use, with test funds. Trusted SDK mode is built; dedicated-user
  signing and MCP enforcement remain unfinished. A Squads spending limit is the separate
  stolen-principal-key and fleet bound, not a property of the SDK.
- **Out of this release:** mainnet and real funds. ADR-008 remains deferred; mainnet needs
  a separately approved qualification scope and release decision. Read-only public chain
  decoding evidence does not qualify execution on that network.
- **Out:** custody services, MEV, the safety of the model itself, and denial of service against the RPC.

## 2. Assets

| Asset | Why it matters |
|---|---|
| Funds: SOL and SPL tokens in the agent's wallet or the Squads vault | the thing lost |
| The agent's signing key | whoever holds it can sign anything the chain accepts |
| The policy | it decides what may be signed |
| The operator's wallet: the latch release key and the Squads config authority | they change what the agent may do |
| The decision log | the evidence of what was allowed, and the guard's state (ADR-010) |
| The checkpoint key and external authority pins | authenticate snapshot payload bindings under the signer-host trust boundary; distinct from principal and anchor authority |
| The Keel controller | a swapped controller changes what is called a loop |

## 3. Adversaries

| ID | Who | Can | Cannot (assumed) |
|---|---|---|---|
| A1 | a prompt injector | control content the model reads: token metadata, posts, pages, tool output, memory [M3] | run code in the agent's process |
| A2 | a confused agent | propose anything, repeatedly, with wrong beliefs about its own state [M4] | — |
| A3 | a malicious dependency or plug-in | run agent-process code [M6, M7]; in SDK/same-user mode, reach keys and falsify inputs | reach a correctly isolated dedicated user's key absent host/root compromise; that deployment is not yet qualified |
| A4 | a key thief | sign anything with the agent's key | exceed an on-chain spending limit |
| A5 | a lying RPC | return false blockhashes, heights or statuses | forge signatures |
| A6 | a careless operator | write a policy that is too loose; run two guards on one key | — |
| A7 | a supply-chain attacker upstream | compromise packages, tooling or an initially accepted lock/digest [M6] | substitute different pinned Keel bytes unnoticed by the tested creation-time checks [S4]; authenticity alone does not establish safe code |
| A8 | a wallet that changes a transaction after admission, maliciously or not | append instructions before it signs or sends [M11] | make the chain accept a signature over bytes it did not sign |
| A9 | a counterparty that builds a transaction for the agent to co-sign | add instructions, and pre-sign accounts it controls | make the agent's signature cover a message the guard did not admit |

## 4. Threats

**Status key:** *built* names a tested component in its stated environment, not complete
release qualification; *specified* has an accepted contract but owes implementation/evidence;
*residual* states what the mitigation cannot prevent. Builder evidence is distinct from
Claude's independent RT-2 and the specialist audit. Delivery risks are in `docs/RISKS.md`.

| ID | Threat | By | Mitigation | Status | What is left |
|---|---|---|---|---|---|
| T1 | a drain to an attacker's address | A1, A2 | destination allowlist | built for SOL and tokens [S1, S8] | a transfer to an address the operator listed |
| T2 | a drain through an approval, authority change or account close | A1 | an allowlist per instruction: these are denied, and so is any unknown instruction of a decoded program (rule 9) | built [S8] | none within decoded programs (rule 9) |
| T3 | a drain through an opaque programme's CPI | A1 | accepted stable default denies opaque programmes (ADR-020); bounded execution needs a separately accepted execution-relative design | SDK denial available; bounded execution unbuilt | a trusted SDK policy can knowingly allow unbounded opaque calls; intervening deposits defeat the old absolute balance-floor design |
| T4 | a slow drain under the caps | A1, A2 | per-window caps, reserved at admission; the dashboard | built for SOL, tokens and fees: reserved at admission (`evals/sdk/admission.md`) | at most the window cap per window |
| T5 | an oversized send of a listed token | A2 | a per-mint, per-transaction cap | built [S8] | at most the cap |
| T6 | a retry loop burning fees | A2 | Keel, fee windows and attempts per intent | scoped synthetic evidence [S3, S45] | alternating and distinct failed-outcome streams remain unrefused within S45's horizon; policy limits still bind, without guaranteed changing-intent detection or an on-chain result |
| T7 | a double payment from re-signing before expiry | A2 | effects-keyed intents and conservative unresolved reservations | SDK handling, including D14–D20 (`docs/SPEC.md` §10) | false caller height/status in SDK mode; no fixed window may erase a still-live unresolved attempt. Durable nonces remain denied (T19) |
| T8 | bytes changed between check and signature | A3, A8 | receipts bound to the message hash; adapters compare the signed message with the admitted one | built: receipts, and adapters that compare the signed message (`evals/sdk/adapters.md`) | in process, A3 can call the key directly (T9) |
| T9 | agent-process code bypasses the guard | A3 | dedicated signer user and protected Unix socket (ADR-013) | local components [S23, S30]; installed isolation unqualified | SDK/same-user mode remains bypassable; an attribution flag is not permission evidence; signer-host/root compromise remains trusted |
| T10 | a stolen key used directly on-chain | A4 | a Squads spending limit: N per day to listed destinations; the agent's key is named only on the limit | built on devnet [S11] | up to N per day to those destinations, until the limit is removed |
| T11 | the policy edited to widen it | A1, A3 | frozen policy, signed content/identity/version and evaluator profile | SDK signed history [S15]; public preparation [S47]; partial host enforcement | SDK caller can bypass checks; unsigned preparation cannot check current history. Installed replacement and human Phantom evidence remain owed |
| T12 | the log rewritten | A3 | hash chain/replay and independently authenticated anchor metadata | structural archive/pin component [S39, S40, S46]; on-chain anchor/restore unbuilt | a resealed history without a trusted external pin; entries after the latest successful verified anchor. Cadence does not guarantee successful anchoring or fixed exposure (ADR-020); pin provenance and authority remain trust boundaries |
| T13 | a swapped Keel controller | A7 | npm lockfile integrity; hashing the controller's bytes | built: the module and the controller's bytes hashed [S4] | a compromise at install time, before the lockfile was written; a file swapped after Node loaded it |
| T14 | a lookup-table index maps to an attacker's address | A3, A5 | address/prefix pins and denial beyond a pin | SDK decoder checks; public byte/reference comparisons [S44] | incorrect operator pins or dishonest source evidence; operational finalized-table reads remain owed. Corpus agreement is not live-table authentication |
| T15 | a Token-2022 mint with a transfer hook, a transfer fee or a permanent delegate | A1, A6 | only listed mints; in the Alpha, the extension set pinned and mutable settings re-read at admission | specified (Alpha, ADR-016) | in the Beta, extensions are not read and the operator's check is point in time; in the Alpha, a permanent delegate the operator accepts, a fee within its ceiling, and a hook failing a transfer |
| T16 | a loose policy | A6 | presets, with every number explained | specified (Leg 5) | the operator's judgement |
| T17 | an off-chain signature that authorises something | A1 | `signMessage` denied; a signature over a message's bytes is a transaction signature | built: `signMessage` denied (`evals/sdk/adapters.md`) | none in v1 |
| T18 | a latch released by the agent | A1, A3 | only the operator's key releases it, over a message bound to guard, cluster, policy, seq and expiry | built: the latch battery (`evals/verify/beta-gate.md`) | a compromised operator wallet |
| T19 | a durable-nonce attempt lands after being counted as expired | A2, A3 | `durable-nonce-denied`, in every message version | built [S8] | none in the Beta; nonce support only with explicit tracking |
| T20 | a false height/status admits early re-signing | A5; A3 in SDK mode | validated host provider reads; disagreement/incomplete evidence retains reservations | fake-provider/deadline evidence [S20, S22]; executor recovery [S19, S29] | caller telemetry in SDK mode, dishonest configured providers and unqualified live outages; two providers are not a Byzantine quorum |
| T21 | time moved forward empties a spending window | A3 | host monotonic clock with one recorded wall anchor | local clock/attribution components [S21] | SDK caller time, compromised host/initial anchor and unqualified installed/reboot/upgrade paths |
| T22 | an unlisted instruction of an allowlisted program | A1 | rule 9, `instruction-denied` | built [S8] | none within decoded programs |
| T23 | a fee that escapes the cap: a price with no limit, a v1 config fee, or tips | A2 | the fee rule in `docs/SPEC.md` §4; ComputeBudget instructions denied in v1 | built [S8] | — |
| T24 | restart resets caps, intents and latch [M4] | A2 | verified persistent history, ownership and replay; established host refuses missing history | persisted-prefix SDK kills [S38]; host composition [S30] | signing/send kills, authenticated snapshots, archive loss, verified backup/upgrade and power-loss qualification remain owed; no exactly-once execution claim |
| T25 | two guards on one key double caps | A6 | Linux kernel ownership for one history; manual SDK refuses stale takeover | competing-owner/write-failure evidence [S16] | distinct histories/identities multiply off-chain caps; the on-chain limit bounds the fleet. Filesystem and dedicated-user deployment need equivalent evidence |
| T26 | a counterparty-built transaction moves value through another signer | A9 | ordinary other-signers denied; an operator exception binds exact bytes and narrow cap allowances (ADR-020) | ordinary rule [S8]; exception path unbuilt | operator compromise and unqualified exception/replay handling; an exception cannot waive non-cap rules |
| T27 | rent drained through account creation | A2 | new-account funding counts as SOL to an allowed destination; ATA rent counted in the Alpha | built for System; associated token accounts specified (TOK-4) | — |
| T28 | wallet-appended instructions widen signed bytes | A8 | ordinary adapters refuse changes; only the accepted narrow read-only assertion path may be added | Beta refusal; Alpha wallet/assertion path unbuilt | human Phantom rehearsals and altered/incomplete batch qualification remain owed; opaque fallback does not waive them |
| T29 | a same-user compromise bypasses the MCP firewall through Phantom's session file | A3 | the Phantom MCP server under a separate OS user; the agent wallet funded only through the limit | specified (Alpha, PHX-5) | the float in the agent wallet |
| T30 | the config authority adds a limit to any destination | a compromised operator wallet | stated as a single point of control; separate operator account for devnet operation | residual | a compromised operator (out of scope, §7) |

## 5. Stable-release recovery and operator surfaces

This working model covers individual Linux/devnet use with test funds. Trusted SDK mode is
built; installed dedicated-user signing and MCP enforcement remain unqualified. Mainnet and
real funds require a separate approved programme. Public decoding data is not mainnet validation.

| Existing threats / surface | Accepted contract and component evidence | Remaining qualification |
|---|---|---|
| T7, T8, T24 / request reuse | Guard/client/ID bind canonical payload; checked journal and immutable responses [S17, S18, S26, S27] | Real malformed clients, deadline races, interrupted signing/send and installed isolation. Idempotency is not exactly-once execution. |
| T7, T11, T24 / ambiguous send | Sync signed bytes and send-started; never resend send-started bytes; conservative pending-policy handling [S19, S29] | Kills at every persistence/sign/send/answer boundary, lost responses and live reconciliation/provider drills. |
| T12, T24 / snapshots | Distinct pinned checkpoint key and signature/digest codec [S49, S58]; structural archive pins [S39, S46]; pending catalogue metadata component [S59] | Actual file authentication, state/prefix payload semantics, atomic publication, authenticated restore and corrupt/missing history fallback. Metadata receipts alone do not establish file availability or correctness. Never load arbitrary controller numbers. |
| T11, T18, T24, T30 / maintenance | Stop, verify backup/compatibility, restore/validate, resume; reverting content needs a higher signed version (ADR-019) | Lifecycle CLI, verified backups, compatible rollback, key rotation and revocation drills. Preparation [S47] does not perform the ceremony. |
| T6, T24, T25 / resource exhaustion | Bounded socket frames/slots and archive reads [S23, S25, S39] | Persistent request index, bounded active state, streamed replay, restart performance and soak. Current history retention is not the accepted bounded-memory product. |
| T9, T13 / supply chain | Packed private SDK checks [S47], dependency/digest checks [S4, S42] | Retained advisories, entire proposed-public history/rights review, reproducible artefacts, audit and public provenance. Authenticity is not release clearance. |

A signer-host/root compromise can reach principal, checkpoint and anchor keys and fabricate
locally signed evidence. Dedicated-user isolation addresses agent-process compromise, not
that host compromise. Independently retained anchor evidence and the on-chain spending limit
remain separate trust boundaries. Operator compromise can widen or remove those bounds.
The configured providers remain trusted evidence sources; agreeing responses are not a quorum proof.

Prefix review reproduces impossible controller observations on a resealed malformed
proposal entry (D21). The candidate checks null Keel fields before replay/restore
application [S60]; focused and installed builder evidence passes, while the required
root gate previously failed under mutation load; final quiet ordinary and AST checks
pass. Fresh mutation qualification remains owed. This is a local history-semantic finding,
not a demonstrated remote signing bypass. Full snapshot derivation must validate
record semantics as well as hashes and signatures. The current signature-size bound
does not establish bounded memory for caller-owned JSON.

ADR-021/022 remain proposed; do not count their budget or enrolment/rotation/PDA changes as
accepted or deployed. This draft is builder-authored and awaits Claude's independent RT-2,
the Alpha review and the specialist audit. It establishes no security or release clearance.

## 6. Invariants every change must keep

1. **Fail closed:** any error, doubt or malformed input denies.
2. **Deny by default:** nothing is allowed that the policy does not name, down to the instruction.
3. **Posture only restricts:** Keel never allows what the policy denies.
4. **No receipt, no signature.**
5. **No keys in the guard:** it decides, and the signer signs.
6. **Every denial names its rule.**
7. **The log is the state:** what the guard remembers is what its verified log replays to.
8. **Trust only what is derived or verified:** each input's source is known and recorded (`docs/SPEC.md` §2.1).
9. **Nothing changes after admission:** a signed message that differs from the admitted one is never sent.

## 7. Out of scope, stated

- **Mainnet and real funds** are outside Solanaut 1.0 and need a separate approved programme.
  **Anything that invites attack for money** stays out (ADR-003).
- **The model's own safety.** Solanaut assumes the model can be fully fooled.
- **A compromised operator.** Whoever owns the policy and the config authority can change them.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. |
| Draft 2 | 2026-09-30 | The verified review: adversaries A8 and A9; T2, T7, T14 and T15 corrected; T19 to T30 added; invariants 7 to 9; the proposed canary in scope. |
| Draft 3 | 2026-10-03 | The Beta review: each threat's status as built, with its claim row or receipt; the Alpha's mitigations named by ADR (013 to 018); residuals narrowed where the Beta closed them, and T6's shape-changing loop named. |
| Draft 4 | 2026-10-06 | Builder-authored stable/devnet reconciliation for independent review: scoped component evidence, unresolved-intent/anchor/loop wording and recovery/operator surfaces; no independent-review or release claim. |
| Draft 5 | 2026-10-07 | Checkpoint-key asset, scoped signature/catalogue components and reproduced D21 history-semantic gap; integrated snapshot and independent qualification remain owed. |
