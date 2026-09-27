# PITCH.md — the pitch video script

> **Draft 1** · 2026-09-27 · owner: drafted for **the human, who records and delivers it (T4)** · for:
> Colosseum's judges · not public. Length: 2 to 3 minutes, per Colosseum's FAQ
> ([source](../../kb/sources/2026-09-27_colosseum-faq.md)). Every spoken fact carries its
> `docs/CLAIMS.md` ID; nothing is said that has no row.

## One line

Solanaut decides what an AI agent's Solana wallet may sign, so a fooled model, a confused agent or a
stolen key still cannot pay an address you never allowed.

## Thirty seconds

AI agents now hold wallets. One whose only rule, "never send the money", lived in its prompt paid out
on attempt 482 [M1]. Solanaut moves the rule out of the model. The agent proposes, Solanaut admits or
denies by a named rule, and only then is anything signed. A control loop stops agents that retry the
same failing transaction [S3], and on devnet a Squads spending limit bounds even a stolen key [M9].

## The script (about 2:40)

| Time | Say | Show | Claims |
|---|---|---|---|
| 0:00–0:20 | "In November 2024 an AI agent guarded a prize pool with one rule: never send the money. The rule lived in its prompt. On attempt 482, it sent the money." | the rule; the payout | M1 |
| 0:20–0:45 | "It keeps happening. A breached dashboard queued two prompts and moved 55.5 ETH. On Solana, an agent that lost its memory in a crash sent 5% of a token's supply. And a key sitting in an agent's process is exposed to the code beside it: a backdoored release of Solana's own JavaScript library once stole keys exactly that way." | three cards: authority, state, keys | M2, M4, M6 |
| 0:45–1:05 | "Research on agent frameworks shows defences inside the model don't hold once its memory is poisoned. So the rule has to live outside the model." | the quote | M3 |
| 1:05–1:40 | "Solanaut is a reference monitor for agent wallets. The agent proposes. Solanaut decodes the actual bytes and checks them against a policy the model never sees: programs, destinations, tokens, caps. It denies by a named rule, before anything is signed." | the architecture strip; a denial with its rule | S1, S2 |
| 1:40–2:05 | "Agents also loop: bots on Solana fail more than half their transactions. Solanaut uses Gubernaut Keel, an open-source control loop, to stop a retry loop, and it never re-signs a payment that could still land." | the loop stopped at turn 3 | M8, S3, G1 |
| 2:05–2:25 | "On-chain, we compose with Squads: the agent's key can spend only a daily amount, to listed addresses, even if it is stolen." | the Squads refusal on devnet | M9 |
| 2:25–2:40 | "Solanaut is open source, devnet-only, and says exactly what it has measured. [The human: who you are, and why you will keep building this.]" | the repository; the claims file | S5 |

## Rules for the recording

- **Say "in the sandbox"** after any number Solanaut measured [S3].
- **Never "prevents", "would have stopped", "the only" or "the first"** (`docs/CLAIMS.md` §4).
- **AIXBT was a breached dashboard, not a prompt injection** [M2].
- **The Solana-track demo is devnet** [S5].

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. The Squads and cockpit shots exist only after H3 and H4. |
