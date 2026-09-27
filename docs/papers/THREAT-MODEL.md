# THREAT-MODEL.md — what Solanaut defends, against whom, and what is left

> **Draft 1** · 2026-09-27 · owner: architect, reviewed by the evaluator · for: reviewers, auditors and
> judges · not public. Design: `docs/SPEC.md`, ADR-004 to ADR-006. Claims: `docs/CLAIMS.md`.
> Register: `kb/DOCUMENTS.md`.

## 1. Scope

- **In:** one AI agent with a Solana wallet, on devnet. It is guarded by `@solanaut/sdk`, optionally
  run through `solanaut-signer`, and optionally funded through a Squads v4 spending limit.
- **Out:** mainnet, custody services, MEV, the safety of the model itself, and denial of service against
  the RPC.

## 2. Assets

| Asset | Why it matters |
|---|---|
| Funds: SOL and SPL tokens in the agent's wallet or the Squads vault | the thing lost |
| The agent's signing key | whoever holds it can sign anything the chain accepts |
| The policy | it decides what may be signed |
| The operator's release key and multisig membership | they change what the agent may do |
| The decision log | the evidence of what was allowed, and why |
| The Keel controller | a swapped controller changes what is called a loop |

## 3. Adversaries

| ID | Who | Can | Cannot (assumed) |
|---|---|---|---|
| A1 | a prompt injector | control content the model reads: token metadata, posts, pages, tool output, memory [M3] | run code in the agent's process |
| A2 | a confused agent | propose anything, repeatedly, with wrong beliefs about its own state [M4] | — |
| A3 | a malicious dependency or plug-in | run code in the agent's process [M6, M7] | run code in a separate signer process |
| A4 | a key thief | sign anything with the agent's key | exceed an on-chain spending limit |
| A5 | a lying RPC | return false lookup-table contents, blockhashes or statuses | forge signatures |
| A6 | a careless operator | write a policy that is too loose | — |
| A7 | a supply-chain attacker upstream | ship a changed Keel or web3.js | defeat a pinned version with a lockfile and an integrity check |

## 4. Threats

**Status key:** *built* = in the code and tested; *specified* = in `docs/SPEC.md`, not built; *residual*
= accepted, and stated.

| ID | Threat | By | Mitigation | Status | What is left |
|---|---|---|---|---|---|
| T1 | a drain to an attacker's address | A1, A2 | destination allowlist | built for SOL [S1]; specified for tokens | a transfer to an address the operator listed |
| T2 | a drain through an approval, authority change or account close | A1 | these instructions are denied | specified | none, within decoded programs |
| T3 | a drain through an allowlisted program that moves funds internally (a swap to someone else) | A1 | undecoded programs are denied, or allowed only knowingly as opaque | specified | the opaque programs the operator chooses to allow |
| T4 | a slow drain under the caps | A1, A2 | per-window caps, reserved at admission; the cockpit | built for SOL; specified for tokens and fees | at most the window cap per window |
| T5 | an oversized send of a listed token | A2 | a per-mint, per-transaction cap | specified | at most the cap |
| T6 | a retry loop burning fees | A2 | Keel's REGROUND [S3]; a fee cap; attempts per intent | built for identical retries in the sandbox; the rest specified | loops the sensor does not see: unmeasured until the H1 battery |
| T7 | a double payment from re-signing before expiry | A2 | intents | specified | durable-nonce transactions, which never expire, stay held by their intent |
| T8 | bytes changed between check and signature | A3 | receipts bound to the message hash; the signer verifies | specified | in-process: A3 can call the key directly (T9) |
| T9 | the guard bypassed by code in the agent's process | A3 | the signer process holds the key | specified (P1) | a compromised signer host |
| T10 | a stolen key used directly on-chain | A4 | a Squads spending limit: N per day, to listed destinations | specified (H3) | up to N per day, to those destinations, until the operator acts |
| T11 | the policy edited to widen it | A1, A3 | a deep-frozen private copy; its hash in every decision | **defect D1 open**; specified | A3 in the same process |
| T12 | the log rewritten | A3 | a hash chain and replay; the head anchored on-chain (P2) | specified | a wholesale rewrite before the first anchor |
| T13 | a swapped Keel controller | A7 | npm lockfile integrity; hashing the controller's bytes | **declared digest only** [S4]; bytes specified | a compromise at install time, before the lockfile was written |
| T14 | false lookup-table contents make a transfer look allowed | A5 | caller-supplied tables; unresolved tables denied | specified | a lying RPC: the on-chain limit is the backstop |
| T15 | a Token-2022 mint with a transfer hook or permanent delegate | A1, A6 | only listed mints are allowed | specified | extensions are not inspected in v1 |
| T16 | a loose policy | A6 | presets, with every number explained (H1) | specified | the operator's judgement |
| T17 | an off-chain signature that authorises something | A1 | `signMessage` denied | specified | none in v1 |
| T18 | a latch released by the agent | A1, A3 | only the operator's key releases it | specified | a compromised operator key |

## 5. Invariants every change must keep

1. **Fail closed:** any error, doubt or malformed input denies.
2. **Deny by default:** nothing is allowed that the policy does not name.
3. **Posture only restricts:** Keel never allows what the policy denies.
4. **No receipt, no signature.**
5. **No keys in the guard:** it decides, and the signer signs.
6. **Every denial names its rule.**

## 6. Out of scope, stated

- **Mainnet, real funds, and anything that invites attack for money** (ADR-003).
- **The model's own safety.** Solanaut assumes the model can be fully fooled.
- **A compromised operator.** Whoever owns the policy and the multisig can change them.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. |
