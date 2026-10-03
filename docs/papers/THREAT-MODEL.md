# THREAT-MODEL.md — what Solanaut defends, against whom, and what is left

> **Draft 3** · 2026-10-03 · owner: architect, reviewed by the evaluator · for: reviewers, auditors and judges · not
> public. Design: `docs/SPEC.md` (Draft 4), ADR-004 to ADR-018. Claims: `docs/CLAIMS.md`.
> Register: `kb/DOCUMENTS.md`.

## 1. Scope

- **In:** one AI agent with a Solana wallet, on devnet. It is guarded by `@solanaut/sdk`, optionally run through
  `solanaut-signer` or Solanaut's MCP firewall (both Alpha), and funded through a Squads v4 spending limit.
- **Proposed, not yet in:** one capped, human-run mainnet canary with a Phantom operator wallet (ADR-008), deferred by
  the human on 2026-09-30: devnet only for now. If the human accepts it, its caps and abort criteria become part of
  this model.
- **Out:** custody services, MEV, the safety of the model itself, and denial of service against the RPC.

## 2. Assets

| Asset | Why it matters |
|---|---|
| Funds: SOL and SPL tokens in the agent's wallet or the Squads vault | the thing lost |
| The agent's signing key | whoever holds it can sign anything the chain accepts |
| The policy | it decides what may be signed |
| The operator's wallet: the latch release key and the Squads config authority | they change what the agent may do |
| The decision log | the evidence of what was allowed, and the guard's state (ADR-010) |
| The Keel controller | a swapped controller changes what is called a loop |

## 3. Adversaries

| ID | Who | Can | Cannot (assumed) |
|---|---|---|---|
| A1 | a prompt injector | control content the model reads: token metadata, posts, pages, tool output, memory [M3] | run code in the agent's process |
| A2 | a confused agent | propose anything, repeatedly, with wrong beliefs about its own state [M4] | — |
| A3 | a malicious dependency or plug-in | run code in the agent's process [M6, M7]; in SDK mode, lie about time, heights and outcomes | run code in a separate signer process |
| A4 | a key thief | sign anything with the agent's key | exceed an on-chain spending limit |
| A5 | a lying RPC | return false blockhashes, heights or statuses | forge signatures |
| A6 | a careless operator | write a policy that is too loose; run two guards on one key | — |
| A7 | a supply-chain attacker upstream | ship a changed Keel or web3.js | defeat a pinned version with a lockfile and an integrity check |
| A8 | a wallet that changes a transaction after admission, maliciously or not | append instructions before it signs or sends [M11] | make the chain accept a signature over bytes it did not sign |
| A9 | a counterparty that builds a transaction for the agent to co-sign | add instructions, and pre-sign accounts it controls | make the agent's signature cover a message the guard did not admit |

## 4. Threats

**Status key:** *built* = in the code and tested, with its evidence; *specified* = in `docs/SPEC.md`, not built;
*residual* = accepted, and stated. Delivery risks are in `docs/RISKS.md`.

| ID | Threat | By | Mitigation | Status | What is left |
|---|---|---|---|---|---|
| T1 | a drain to an attacker's address | A1, A2 | destination allowlist | built for SOL and tokens [S1, S8] | a transfer to an address the operator listed |
| T2 | a drain through an approval, authority change or account close | A1 | an allowlist per instruction: these are denied, and so is any unknown instruction of a decoded program (rule 9) | built [S8] | none within decoded programs (rule 9) |
| T3 | a drain through an allowlisted program that moves funds by CPI (a swap to someone else) | A1 | undecoded programs are denied, or allowed only knowingly as opaque; the Alpha bounds them by simulation and Lighthouse assertions | built: undecoded programs denied, or allowed knowingly as opaque; the Alpha's bound specified (ADR-018) | the opaque programs the operator allows, unbounded until milestone 3.4 |
| T4 | a slow drain under the caps | A1, A2 | per-window caps, reserved at admission; the dashboard | built for SOL, tokens and fees: reserved at admission (`evals/sdk/admission.md`) | at most the window cap per window |
| T5 | an oversized send of a listed token | A2 | a per-mint, per-transaction cap | built [S8] | at most the cap |
| T6 | a retry loop burning fees | A2 | Keel's REGROUND [S3]; a fee window that counts priority fees, base fees and tips; attempts per intent | built: identical retries stop at turn 3 [S3]; rising fees at turn 4, by the attempts cap (`evals/sdk/keel.md`) | a loop that changes its shape and amount each turn: not stopped in 12 turns, bounded by the fee window and the INHIBIT clamp (`docs/RISKS.md`, RK1) |
| T7 | a double payment from re-signing before expiry | A2 | intents keyed by effects | built: intents keyed by effects, holding an unreported attempt (D14, `evals/sdk/intents-d14.md`) | a false height or status in SDK mode (T20); the hold ends a window after the first attempt. Durable nonces are denied outright (T19) |
| T8 | bytes changed between check and signature | A3, A8 | receipts bound to the message hash; adapters compare the signed message with the admitted one | built: receipts, and adapters that compare the signed message (`evals/sdk/adapters.md`) | in process, A3 can call the key directly (T9) |
| T9 | the guard bypassed by code in the agent's process | A3 | the signer process holds the key | specified (Alpha, ADR-013) | a compromised signer host |
| T10 | a stolen key used directly on-chain | A4 | a Squads spending limit: N per day to listed destinations; the agent's key is named only on the limit | built on devnet [S11] | up to N per day to those destinations, until the limit is removed |
| T11 | the policy edited to widen it | A1, A3 | a deep-frozen private copy; its hash in every decision; an operator-signed policy (Alpha) | built: D1 closed, a deep-frozen private copy [S2]; the operator-signed policy specified (ADR-014) | A3 in the same process, until the signer process and ADR-014 |
| T12 | the log rewritten | A3 | a hash chain and replay; the head anchored on-chain (Alpha) | built: a hash chain and replay [S6]; the anchor specified (ADR-015) | a wholesale rewrite before the first anchor; then at most a minute of entries (ADR-015) |
| T13 | a swapped Keel controller | A7 | npm lockfile integrity; hashing the controller's bytes | built: the module and the controller's bytes hashed [S4] | a compromise at install time, before the lockfile was written; a file swapped after Node loaded it |
| T14 | a lookup-table index that maps to an attacker's address | A3, A5 | tables pinned by address and prefix; unpinned tables and indexes past a pin denied | built (`evals/sdk/decode.md`) | none for pinned prefixes: entries are append-only, and a closed table's address cannot be re-created |
| T15 | a Token-2022 mint with a transfer hook, a transfer fee or a permanent delegate | A1, A6 | only listed mints; in the Alpha, the extension set pinned and mutable settings re-read at admission | specified (Alpha, ADR-016) | in the Beta, extensions are not read and the operator's check is point in time; in the Alpha, a permanent delegate the operator accepts, a fee within its ceiling, and a hook failing a transfer |
| T16 | a loose policy | A6 | presets, with every number explained | specified (Leg 5) | the operator's judgement |
| T17 | an off-chain signature that authorises something | A1 | `signMessage` denied; a signature over a message's bytes is a transaction signature | built: `signMessage` denied (`evals/sdk/adapters.md`) | none in v1 |
| T18 | a latch released by the agent | A1, A3 | only the operator's key releases it, over a message bound to guard, cluster, policy, seq and expiry | built: the latch battery (`evals/verify/beta-gate.md`) | a compromised operator wallet |
| T19 | a durable-nonce attempt lands after being counted as expired | A2, A3 | `durable-nonce-denied`, in every message version | built [S8] | none in the Beta; nonce support only with explicit tracking |
| T20 | a false block height or status admits an early re-sign | A5; A3 in SDK mode | the signer fetches heights and statuses itself; SDK mode records each input's source | built for SDK mode as stated: each input's source recorded; the signer specified (ADR-013) | the SDK mode, stated |
| T21 | time moved forward to empty a spending window | A3 | the signer stamps time from a monotonic clock | built for SDK mode as stated: a clock that steps back cannot shrink a window; the signer specified (ADR-013) | a clock moved forward, in SDK mode |
| T22 | an unlisted instruction of an allowlisted program | A1 | rule 9, `instruction-denied` | built [S8] | none within decoded programs |
| T23 | a fee that escapes the cap: a price with no limit, a v1 config fee, or tips | A2 | the fee rule in `docs/SPEC.md` §4; ComputeBudget instructions denied in v1 | built [S8] | — |
| T24 | a restart resets the caps, intents and latch [M4] | A2 | the log is the state, restored by replay (ADR-010) | built [S6] | a deleted log, bounded by the on-chain limit |
| T25 | two guards on one key double the caps | A6 | one writer per guard identity | built: one writer, by the record's lock (`evals/sdk/durable.md`) | separate identities by design; the on-chain limit bounds the fleet |
| T26 | a counterparty-built transaction moves value through another signer, or funds an account the counterparty controls | A9 | `other-signer` denied; lamports into a new account need an allowed destination | built [S8] | co-signing, designed in the Alpha |
| T27 | rent drained through account creation | A2 | new-account funding counts as SOL to an allowed destination; ATA rent counted in the Alpha | built for System; associated token accounts specified (TOK-4) | — |
| T28 | a wallet's appended instructions widen what is signed | A8 | adapters throw on any difference; in the Alpha, only read-only Lighthouse instructions pass | built for the Beta: any difference throws; the Alpha's rule specified (ADR-018, OPQ-4) | Lighthouse's memory-write instructions, denied until they have a rule |
| T29 | a same-user compromise bypasses the MCP firewall through Phantom's session file | A3 | the Phantom MCP server under a separate OS user; the agent wallet funded only through the limit | specified (Alpha, PHX-5) | the float in the agent wallet |
| T30 | the config authority adds a limit to any destination | a compromised operator wallet | stated as a single point of control; a fresh operator account for the canary | residual | a compromised operator (out of scope, §6) |

## 5. Invariants every change must keep

1. **Fail closed:** any error, doubt or malformed input denies.
2. **Deny by default:** nothing is allowed that the policy does not name, down to the instruction.
3. **Posture only restricts:** Keel never allows what the policy denies.
4. **No receipt, no signature.**
5. **No keys in the guard:** it decides, and the signer signs.
6. **Every denial names its rule.**
7. **The log is the state:** what the guard remembers is what its verified log replays to.
8. **Trust only what is derived or verified:** each input's source is known and recorded (`docs/SPEC.md` §2.1).
9. **Nothing changes after admission:** a signed message that differs from the admitted one is never sent.

## 6. Out of scope, stated

- **Mainnet and real funds,** beyond the capped, human-run canary that ADR-008 proposes. **Anything that invites attack
  for money** stays out (ADR-003).
- **The model's own safety.** Solanaut assumes the model can be fully fooled.
- **A compromised operator.** Whoever owns the policy and the config authority can change them.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. |
| Draft 2 | 2026-09-30 | The verified review: adversaries A8 and A9; T2, T7, T14 and T15 corrected; T19 to T30 added; invariants 7 to 9; the proposed canary in scope. |
| Draft 3 | 2026-10-03 | The Beta review: each threat's status as built, with its claim row or receipt; the Alpha's mitigations named by ADR (013 to 018); residuals narrowed where the Beta closed them, and T6's shape-changing loop named. |
