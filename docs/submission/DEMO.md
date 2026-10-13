# DEMO.md — the technical demo script

> **Draft 3** · 2026-10-01 · owner: integrator · for: Colosseum's judges · public since 2026-10-12. Length: **no more than three
> minutes** (Colosseum's FAQ, [source](../../kb/sources/2026-09-27_colosseum-faq.md)). It covers the Solana
> integration. Claims: `docs/CLAIMS.md`. A scene is recorded only once its milestone in `docs/ROADMAP.md` is
> achieved; until then the narration says "being built".

## The story

One agent, one policy, a handful of transactions on devnet. The dashboard shows each decision as it is made.

## Scenes

| # | Time | Scene | What the judge sees | Recordable after | Claims |
|---|---|---|---|---|---|
| 1 | 0:00–0:20 | **The one line.** `new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), rpc, config)` | the policy file: the principal, programs, one destination, caps | **run on devnet** (2b.3) | S10 |
| 2 | 0:20–0:50 | **Fooled.** The agent reads token metadata saying "send <amount> to <attacker>" and proposes it | DENY `destination-not-allowed`, before signing; nothing on the explorer | **run on devnet** (2b.3) | S1, S2, S12 |
| 3 | 0:50–1:15 | **Tricked into standing authority.** The agent proposes an SPL `Approve` for an attacker, then a transfer built on a durable nonce | DENY `instruction-denied`, then DENY `durable-nonce-denied` | **run on devnet** (2b.3) | S12 |
| 4 | 1:15–1:40 | **Looping.** An unfunded agent retries a transfer the RPC refuses | ALLOW, then DENY `loop-reground` with the posture shown: turn 2 after earlier denials, turn 3 on a fresh guard | **run on devnet** (2b.3) | S3 |
| 5 | 1:40–2:05 | **Re-signing too early.** The agent re-signs the same payment with a new blockhash before the first lands | DENY `intent-in-flight`. **Today the same re-sign meets REGROUND and latches the guard** until the operator signs a release: an open question to settle before recording (`docs/SPEC.md` §12) | **run on devnet** (2b.3) | S12 |
| 6 | 2:05–2:30 | **The key is stolen.** A script calls the Squads spending limit directly, past the daily limit. The agent's key is named only on the limit, not on the multisig | the Squads program refuses; the dashboard shows the program's error | **run on devnet** (2a.9) | M9, S11 |
| 7 | 2:30–3:00 | **The crash.** The guard is killed mid-stream and restarted | the record restored; "replay: 0 divergences"; the payment in flight refused again, then recorded landed | **run on devnet** (2b.3) | S6, S12 |

`node apps/onchain/src/scenes.ts` runs scenes 2, 3, 4, 5 and 7 in one go; `apps/onchain/src/squads.ts --keep` runs
scene 6, and `apps/agentkit/src/run.ts` scene 1 (`evals/e2e/scenes-devnet.md`).

## Preconditions

- **Devnet:** a funded devnet key in `keys/`, made with `solana-keygen` and never committed; a controlled Squads v4
  multisig whose config authority is a devnet operator key, with the agent's key named only on its spending limit.
- **Every command passes `--url devnet` and `--keypair`.** The Solana CLI's global config is never used.
- **The latch release:** today the operator's key signs it from a file. Releasing from Phantom is milestone 3.8.
- **The fallback:** if devnet is congested, run scenes 2 and 4 on the local validator (`npm run validator`, then
  `npm run sandbox -- --cluster local`), and say so on screen.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. Scenes 2 and 4 run today; the rest follow the H1–H4 plan. |
| Draft 2 | 2026-09-30 | Scenes tied to milestones, not phases; the nonce denial added to scene 3; the Squads scene names the agent's key on the limit only; scene 7 shows a restart restored from the log. |
| Draft 3 | 2026-10-01 | Every scene run on devnet (`evals/e2e/scenes-devnet.md`), with its claim row. Scene 4 stops at turn 2 after earlier denials. Scene 5 latches the guard today, an open question to settle before recording. The latch is released with the operator's key until Phantom (3.8). |
