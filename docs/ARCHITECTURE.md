# ARCHITECTURE.md — Solanaut, long term

**Solanaut decides what an AI agent's Solana wallet may sign.** It does so with two independent
defences, each doing only what it can actually do, a receipt that binds every decision to the bytes
signed, and a record of every decision. On-chain, a Squads spending limit bounds what even a stolen key
can move.

It is a **reference monitor** for the agent's signatures (ADR-004): always invoked, fail-closed, and
small enough to verify.

```
agent (ElizaOS · Solana Agent Kit · @solana/kit · any code)
   │  proposes: serialized transaction bytes (+ resolved lookup tables, intent key)
   ▼
@solanaut/sdk   guard.check(bytes)                                   before anything is signed
   ├─ decode    legacy and v0; System, SPL, Token-2022, ComputeBudget, Memo; v1 and unknown → DENY
   ├─ policy    programs · destinations · mints · per-tx, per-window and fee caps; denied instructions
   │            configuration the model never sees: holds even if the model is fully compromised
   ├─ intents   no new attempt while an earlier one could still land (blockhash not yet expired)
   ├─ sensor    the proposal stream → intensity, valence, repetition
   ├─ Keel      @gubernaut/core 1.0.1 (pinned) → DEFAULT / INHIBIT / REGROUND: may only restrict
   └─ log       hash-chained decisions, replayable; head anchored on-chain (stretch)
   │
   ├─ ALLOW → receipt (message hash, expiry, policy hash, Keel identity) → signer → RPC → report(outcome)
   └─ DENY  → never signed; SolanautDenied {rule, reason} goes back to the agent, so it stops, not retries

on-chain (devnet): Squads v4 multisig → spending limit: N per period, to listed destinations only
```

## The two defences, and what each one is for

| | Policy | Control loop (Keel) |
|---|---|---|
| Stops | drains: a transfer to an address, a program or a mint that was never allowed; approvals; amounts over a cap | loops and escalation: the same failing transaction re-proposed, fees ratcheting up |
| Decides from | the transaction's decoded bytes, against configuration | three numbers about the stream of proposals |
| Can the model talk it round? | **no**: it never reads the model's text, and the model cannot set it | its input comes from Solanaut's sensor, so its quality is the sensor's quality. Keel's own README says so |
| Measured | sandbox and unit tests (`docs/CLAIMS.md` S1) | the sandbox only, sensor v0 (S3). H1 measures it properly |

**Why not rely on the loop for injection?** Gubernaut's published limits say its text sensor misses
calmly worded hostile input, and Keel acts faithfully on whatever numbers it is given. A prompt injection
hidden in token metadata is calm text. So the injection defence is the policy, which does not depend on
noticing anything.

**Why receipts and intents?** A decision is worth nothing if the bytes signed are not the bytes checked,
or if a re-sign pays twice while the first attempt can still land. The receipt and the intent close both
gaps (ADR-004).

## Deployment modes, and what each cannot do

| Mode | Where the key lives | Stops | Cannot stop |
|---|---|---|---|
| SDK in-process | the agent's process | a fooled or confused model | code in the same process using the key directly |
| Signer process | `solanaut-signer`, a separate local process | the above, plus the agent's own code reading the key | a compromised signer host |
| Squads spending limit | on-chain | a stolen key spending past the limit | spending within the limit |

## Components, now and planned

| Component | Phase | What it is |
|---|---|---|
| `packages/sdk` (`@solanaut/sdk`) | **0 (exists)**, v1 in H1 | today: `policy.ts`, `sensor.ts` (v0), `guard.ts`, `describe.ts` (a web3.js legacy transaction → a proposal). v1: bytes in, receipts, intents, the log (`docs/SPEC.md`) |
| `apps/sandbox` | **0 (exists)** | the plugin sandbox: benign, drain and loop scenarios, offline or on a local validator |
| Sensor v1 and batteries | H1 | measured against labelled proposal streams: loops, fee escalation, double-sends, benign traffic; the false-stop rate stated |
| Presets | H1 | named policies with every number explained, none tuned blind |
| `guardedWallet` and a `@solana/kit` signer | H2 | one-line adoption for Solana Agent Kit and kit-based agents; a denial is a typed error, not a hang |
| ElizaOS plugin; `solanaut-signer` | H2 (P1) | the guard inside ElizaOS's Solana plugin; the key out of the agent's process |
| Squads v4 spending limit | H3 | on-chain bound on a stolen key, composed rather than re-implemented (ADR-006) |
| `programs/solanaut_anchor` (Anchor 1.2) | H3 (P2, cut first) | anchors the decision log's head on-chain and emits `DecisionAnchored` |
| `apps/cockpit` | H4 | a web view of live decisions on devnet: proposal, rule, telemetry, posture, verdict, receipt |
| Simulation, swap decoding, RPC proxy, x402 guard | after the hackathon | LiteSVM or Surfpool simulation for inner-call effects; Jupiter decoding; a JSON-RPC firewall for non-JavaScript agents |
| Audits, calibrated presets, mainnet | after the hackathon | the human's decisions: an external audit first, then mainnet if ever |

## Invariants

1. **Fail closed.** A guard error, a malformed or undecodable transaction, an unresolved lookup table,
   an unknown message version, a controller boundary rejection, a digest mismatch: all deny.
2. **Deterministic.** The guard keeps no clock. Proposals carry their time and block height, so the
   same stream always produces the same decisions, and a recorded log replays.
3. **Every denial names its rule** (`docs/SPEC.md` §5, rules 0–17).
4. **Denied proposals still reach the controller.** An agent re-proposing a refused transfer is a loop
   too.
5. **No keys in the guard.** It decides; the signer signs, and only bytes that carry a receipt.
6. **Posture only restricts.** Keel can turn an ALLOW into a DENY, never the reverse.
7. **Deny by default.** Nothing is allowed that the policy does not name.

## Upstream

`@gubernaut/core` 1.0.1 comes from npm, pinned by the lockfile. Gubernaut is a pre-existing Apache-2.0
dependency and is disclosed as one (rules §9; `docs/submission/SUBMISSION.md`). Solanaut never forks or
edits it.

Today `createGuard` refuses a build whose **declared** digest is not `834015d7…`. Keel 1.0.1 checks only
the controller's length on load, so hashing the bytes themselves is owed in H1 (`docs/SPEC.md` §10, D4).
Findings about upstream go to `kb/REGISTRY.md` for the human.
