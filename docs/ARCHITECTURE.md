# ARCHITECTURE.md — Solanaut, long term

**Solanaut decides what an AI agent's Solana wallet may sign.** Two independent defences, each
doing only what it can actually do, and a record of every decision.

```
agent (ElizaOS · Solana AgentKit · any code)
   │  proposes a transaction
   ▼
@solanaut/sdk   guard.evaluate(proposal)                        runs in-process, before signing
   ├─ policy    program + destination allowlists, per-tx and per-window caps
   │            configuration the model never sees: holds even if the model is fully compromised
   ├─ sensor    the proposal stream → intensity, valence, repetition
   ├─ Keel      @gubernaut/core (pinned, wasm digest checked) → DEFAULT / INHIBIT / REGROUND
   └─ log       every decision, with its telemetry and posture
   │
   ├─ ALLOW → sign → RPC → report(success | failure) back into the sensor
   └─ DENY  → never signed; a typed error goes back to the agent, so it stops rather than retries
```

## The two defences, and what each one is for

| | Policy | Control loop (Keel) |
|---|---|---|
| Stops | drains: a transfer to an address, or a call to a program, that was never allowed; amounts over a cap | loops and escalation: the same failing transaction re-proposed, fees ratcheting up |
| Decides from | the transaction's content, against configuration | three numbers about the stream of proposals |
| Can the model talk it round? | **no**: it never reads the model's text, and the model cannot set it | its input comes from Solanaut's sensor, so its quality is the sensor's quality. Keel's own README says so |
| Measured | sandbox and unit tests (`docs/CLAIMS.md` §1) | sandbox only, sensor v0. H1 measures it properly |

**Why not rely on the loop for injection?** Gubernaut's published limits say its text sensor
misses calmly worded hostile input, and Keel acts faithfully on whatever numbers it is given. A
prompt injection hidden in token metadata is calm text. So the injection defence is the policy,
which does not depend on noticing anything.

## Components, now and planned

| Component | Phase | What it is |
|---|---|---|
| `packages/sdk` (`@solanaut/sdk`) | **0 (exists)** | `policy.ts`, `sensor.ts` (v0), `guard.ts`, `describe.ts` (web3.js transaction → proposal) |
| `apps/sandbox` | **0 (exists)** | the plugin sandbox: benign, drain and loop scenarios, offline or on a local validator |
| sensor v1 | H1 | measured against labelled proposal streams; fee-escalation and near-duplicate detection; the false-stop rate stated |
| presets | H1 | named policies (conservative treasury, trading bot) with every number explained, none tuned blind |
| `@solanaut/plugin-eliza`, AgentKit wrapper | H2 | the guard as a signer wrapper, so adoption is one line; a denial returns a typed error the framework surfaces instead of retrying |
| `programs/solanaut_vault` (Anchor 1.2) | H3 | on-chain enforcement: the vault program itself refuses transfers outside its allowlist and caps, so even a stolen agent key cannot drain it; `emit!` events carry each decision |
| `apps/cockpit` | H4 | a web view of live decisions on devnet: proposal, telemetry, posture, verdict |
| `solanaut-rpc-proxy` | post | a JSON-RPC firewall for non-JavaScript agents, the same guard behind `sendTransaction` |
| audits, calibrated presets, mainnet | post | the human's decisions: an external audit first, then mainnet if ever |

## Invariants

1. **Fail closed.** A guard error, a controller boundary rejection, a digest mismatch, a
   malformed proposal: all deny.
2. **Deterministic.** The guard keeps no clock. Proposals carry their time, so the same stream
   always produces the same decisions, and a recorded run replays.
3. **Every denial names its rule.** `destination-not-allowed`, `program-not-allowed`,
   `over-per-tx-cap`, `over-window-cap`, `malformed-proposal`, `loop-reground`, `fail-closed`.
4. **Denied proposals still reach the controller.** An agent re-proposing a refused transfer is
   a loop too.
5. **No keys in the guard.** It decides; the caller signs. Solanaut never holds a key it does
   not need.

## Upstream

`@gubernaut/core` 1.0.1 from npm, digest `834015d7…`, checked when a guard is created. Gubernaut
is a pre-existing Apache-2.0 dependency and is disclosed as one (hackathon rules §9). Solanaut
never forks or edits it. A defect found there is written up for the human (`kb/REGISTRY.md`).
