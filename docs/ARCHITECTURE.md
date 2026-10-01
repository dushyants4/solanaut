# ARCHITECTURE.md — Solanaut, long term

**Solanaut decides what an AI agent's Solana wallet may sign.** It does so with two independent defences, each doing
only what it can actually do, a receipt that binds every decision to the bytes signed, and a log of every decision
that is also the guard's memory. On-chain, a Squads spending limit bounds what even a stolen key can move.

It is a **reference monitor** for the agent's signatures (ADR-004): always invoked, fail-closed, and small enough to
verify. What it trusts is stated per deployment mode (ADR-009, `docs/SPEC.md` §2.1).

```
agent (ElizaOS · Solana Agent Kit · @solana/kit · MCP clients · any code)
   │  proposes: serialized message bytes (legacy, v0 or v1), and an optional grouping key
   ▼
@solanaut/sdk   guard.check(bytes)                                   before anything is signed
   ├─ decode    legacy · v0 with pinned lookup tables · v1 from its config; unknown versions → DENY
   ├─ classify  an allowlist per instruction; durable nonces and other signers → DENY
   ├─ policy    principal · programs · destinations · mints · per-tx, per-window and fee caps
   │            configuration the model never sees: holds even if the model is fully compromised
   ├─ intents   keyed by effects: no new attempt while an earlier one could still land
   ├─ sensor    the proposal stream → intensity, valence, repetition
   ├─ Keel      @gubernaut/core 1.0.1 (pinned) → DEFAULT / INHIBIT / REGROUND: may only restrict
   └─ log       hash-chained, synced before answering; the guard's state, restored by replay
   │
   ├─ ALLOW → receipt (message hash, expiry, policy hash, Keel identity) → signer → RPC → report(outcome)
   └─ DENY  → never signed; SolanautDenied {rule, reason} goes back to the agent, so it stops, not retries

on-chain: Squads v4 → a spending limit naming the agent key (not a multisig member): N per period, listed destinations
operator: a Phantom wallet → the Squads config authority, the latch release, and (Alpha) the policy's signature
dashboard: reads the log and the chain; holds no keys
```

## The two defences, and what each one is for

| | Policy | Control loop (Keel) |
|---|---|---|
| Stops | drains: a transfer to an address, a program, an instruction or a mint that was never allowed; approvals; amounts and fees over a cap | loops and escalation: the same failing transaction re-proposed, fees ratcheting up |
| Decides from | the transaction's decoded bytes, against configuration | three numbers about the stream of proposals |
| Can the model talk it round? | **no**: it never reads the model's text, and the model cannot set it | its input comes from Solanaut's sensor, so its quality is the sensor's quality. Keel's own README says so |
| Measured | 40 drain-shaped transactions denied by their named rules; the decoder against kit (`docs/CLAIMS.md` S1, S8, S9) | sensor v1 on synthetic streams: identical retries stopped at turn 3, no benign payment stopped (S3, S7) |

**Why not rely on the loop for injection?** Gubernaut's published limits say its text sensor misses calmly worded
hostile input, and Keel acts faithfully on whatever numbers it is given. A prompt injection hidden in token metadata is
calm text. So the injection defence is the policy, which does not depend on noticing anything.

**Why receipts and intents?** A decision is worth nothing if the bytes signed are not the bytes checked, or if a
re-sign pays twice while the first attempt can still land. The receipt and the intent close both gaps (ADR-004).
Durable nonces would reopen the second one, so they are denied.

**Why decode every version, and pin tables?** v1 transactions went live on mainnet on 2026-09-15 and carry their
priority fee in a config section, where a reader of instructions never looks [M10]. v0 transactions name addresses by
lookup-table index; a pinned prefix of a table stays true because entries are append-only (ADR-009).

**Why is the log the state?** A guard that forgets on restart resets its caps. That failure mode is documented [M4].
Replaying the verified log on start rebuilds everything the guard knew (ADR-010).

## Deployment modes, and what each cannot do

| Mode | Where the key lives | Stops | Cannot stop |
|---|---|---|---|
| SDK in-process | the agent's process | a fooled or confused model | code in the same process using the key directly, or lying about time and heights |
| Signer process (Alpha) | `solanaut-signer`, a separate local process | the above, plus the agent's own code reading the key or lying about time, heights and tables | a compromised signer host |
| MCP firewall (Alpha) | Phantom's key service, behind Solanaut's MCP server | agent tool calls and transactions outside the policy | a compromise under the same OS user that reads Phantom's session file; the float in that wallet |
| Squads spending limit | on-chain | a stolen key spending past the limit | spending within the limit |

## Components, by milestone

Milestones are defined in `docs/ROADMAP.md`. Each is reached by passing its gate, not by a date.

| Component | Milestone | What it is |
|---|---|---|
| `packages/sdk` (`@solanaut/sdk`) | **built**, 2a.2 to 2a.8 | v1: bytes in (legacy, v0 with pinned tables, v1) without web3.js; the allowlist per instruction; policy v1; receipts, intents and the latch; the log as the state, with replay; Keel's bytes verified; sensor v1; the adapters |
| `apps/sandbox` | **exists** | the plugin sandbox: benign, drain and loop scenarios, offline or on a local validator |
| Sensor v1 and the batteries | **built**, 2a.7 and 2b.1 | measured against labelled proposal streams: loops, fee escalation, double-sends, restarts, benign traffic |
| `guardedWallet` and a `@solana/kit` signer | **built**, 2a.8; validated with Solana Agent Kit on devnet at 2b.3 | one-line adoption for Solana Agent Kit and kit-based agents; a denial is a typed error, not a hang |
| Squads v4 spending limit on devnet | **achieved on devnet**, 2a.9 | the on-chain bound on a stolen key, composed rather than re-implemented (ADR-006) |
| `apps/onchain`, `apps/agentkit` | **built**, 2a.9 and 2b.3 | the stolen-key drill and the demo's scenes on devnet; a scripted Solana Agent Kit agent behind the guard |
| `apps/cockpit`, the dashboard | v0 **built** at 2a.10; v1 at 3.8; 1.0 at 5.1 | a read-only view of live decisions, spend against caps, intents, the latch and the chain (ADR-011) |
| `solanaut-signer` | 3.1 | the key out of the agent's process; time, heights and tables fetched by the signer |
| Operator-signed policy | 3.2 | a guard loads only a policy whose hash the operator's wallet signed |
| Token-2022 settings; associated token accounts | 3.3 | mint extensions pinned and re-read; ATA creation decoded, with its rent counted |
| Bounds for opaque programs | 3.4 | simulation on the operator's RPC, and Lighthouse assertions appended so the bound holds on-chain |
| Phantom escalation; MCP firewall | 3.5 | over-cap proposals co-signed by the operator in Phantom; Phantom's agent wallet behind Solanaut |
| ElizaOS plugin | 3.6 | the guard inside ElizaOS's Solana plugin |
| `programs/solanaut_anchor` (Anchor 1.2) | 3.7 | anchors the log's head on-chain and emits `DecisionAnchored`; verified build |
| The mainnet canary | 4.1 to 4.5, only if ADR-008 is accepted | one capped, human-run test with a Phantom operator wallet, recorded |
| An RPC proxy, an x402 guard, swap decoding | after the Alpha | a JSON-RPC firewall for non-JavaScript agents; payment checks; Jupiter decoding |
| Audit, bounty, general availability | R.1 to R.4 | `docs/READINESS.md` |

## Invariants

1. **Fail closed.** A guard error, a malformed or undecodable transaction, an unpinned lookup table, an unknown
   message version, a controller boundary rejection, a digest mismatch: all deny.
2. **Deterministic.** The guard keeps no clock. Proposals carry their time and block height, recorded with their
   source, so the same stream always produces the same decisions, and a recorded log replays.
3. **Every denial names its rule** (`docs/SPEC.md` §5, rules 0 to 19).
4. **Denied proposals still reach the controller.** An agent re-proposing a refused transfer is a loop too.
5. **No keys in the guard.** It decides; the signer signs, and only bytes that carry a receipt.
6. **Posture only restricts.** Keel can turn an ALLOW into a DENY, never the reverse.
7. **Deny by default, down to the instruction.** Nothing is allowed that the policy does not name.
8. **The log is the state.** What the guard remembers is what its verified log replays to.
9. **Trust only what is derived or verified.** Each input's source is known per mode and recorded.
10. **Nothing changes after admission.** A signed message that differs from the admitted one is never sent.

## Upstream

`@gubernaut/core` 1.0.1 comes from npm, pinned by the lockfile. Gubernaut is a pre-existing Apache-2.0 dependency and
is disclosed as one (rules §9; `docs/submission/SUBMISSION.md`). Solanaut never forks or edits it.

`createGuard` hashes the Keel module Node resolves, and the controller embedded in it, against pinned digests, and
refuses anything else (milestone 2a.7, `docs/SPEC.md` §6, S4). Keel 1.0.1 itself checks only the controller's length on
load (upstream finding U-1).
Findings about upstream go to `kb/REGISTRY.md` for the human.

Squads v4 is composed, not changed: `spending_limit_use` checks only the limit's own member list, and limit members
are independent of multisig membership (`docs/SPEC.md` §9).
