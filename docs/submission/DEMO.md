# DEMO.md — the technical demo script

> **Draft 2** · 2026-09-30 · owner: integrator · for: Colosseum's judges · not public. Length: **no more than three
> minutes** (Colosseum's FAQ, [source](../../kb/sources/2026-09-27_colosseum-faq.md)). It covers the Solana
> integration. Claims: `docs/CLAIMS.md`. A scene is recorded only once its milestone in `docs/ROADMAP.md` is
> achieved; until then the narration says "being built".

## The story

One agent, one policy, a handful of transactions on devnet. The dashboard shows each decision as it is made.

## Scenes

| # | Time | Scene | What the judge sees | Recordable after | Claims |
|---|---|---|---|---|---|
| 1 | 0:00–0:20 | **The one line.** `new SolanaAgentKit(guardedWallet(wallet, guard), rpc, config)` | the policy file: the principal, programs, one destination, caps | milestone 2a.8 | — |
| 2 | 0:20–0:50 | **Fooled.** The agent reads token metadata saying "send 5 SOL to <attacker>" and proposes it | DENY `destination-not-allowed`, before signing; nothing on the explorer | **today, offline and on a local validator** | S1, S2 |
| 3 | 0:50–1:15 | **Tricked into standing authority.** The agent proposes an SPL `Approve` for an attacker, then a transfer built on a durable nonce | DENY `instruction-denied`, then DENY `durable-nonce-denied` | 2a.5 | — |
| 4 | 1:15–1:40 | **Looping.** An unfunded agent retries the same transfer | ALLOW, ALLOW, then DENY `loop-reground` at turn 3, with the posture shown | **today, in the sandbox** | S3 |
| 5 | 1:40–2:05 | **Re-signing too early.** The agent re-signs the same payment with a new blockhash before the first expires | DENY `intent-in-flight`; after expiry, ALLOW | 2a.5 | — |
| 6 | 2:05–2:30 | **The key is stolen.** A script calls the Squads spending limit directly, past the daily limit. The agent's key is named only on the limit, not on the multisig | the Squads program refuses; the dashboard shows the on-chain error | 2a.9 | M9 |
| 7 | 2:30–3:00 | **The crash.** The guard is killed mid-stream and restarted | the caps, intents and latch come back; "replay: 0 divergences" | 2a.6 | — |

## Preconditions

- **Devnet:** a funded devnet key in `keys/`, made with `solana-keygen` and never committed; a controlled Squads v4
  multisig whose config authority is a devnet operator key, with the agent's key named only on its spending limit.
- **Every command passes `--url devnet` and `--keypair`.** The Solana CLI's global config is never used.
- **Optional, if milestone 2a.10's stretch is done:** the latch released from Phantom in devnet mode.
- **The fallback:** if devnet is congested, run scenes 2 and 4 on the local validator (`npm run validator`, then
  `npm run sandbox -- --cluster local`), and say so on screen.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. Scenes 2 and 4 run today; the rest follow the H1–H4 plan. |
| Draft 2 | 2026-09-30 | Scenes tied to milestones, not phases; the nonce denial added to scene 3; the Squads scene names the agent's key on the limit only; scene 7 shows a restart restored from the log. |
