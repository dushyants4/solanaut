# PITCH.md — the pitch: one line, thirty seconds, four paragraphs, and the video script

> **Draft 3** · 2026-09-30 · owner: drafted for **the human, who delivers it (T4)** · for: Colosseum's
> judges · public since 2026-10-12. The video runs 2 to 3 minutes, per Colosseum's FAQ
> ([source](../../kb/sources/2026-09-27_colosseum-faq.md)). Every fact, spoken or written, carries its
> `docs/CLAIMS.md` ID; nothing is said that has no row. Corrected on 2026-10-13: "never sees" became
> "cannot change", with CLAIMS S2.

## One line

Solanaut decides what an AI agent's Solana wallet may sign, so a fooled model, a confused agent or a
stolen key still cannot pay an address you never allowed.

## Thirty seconds

AI agents now hold wallets. One whose only rule, "never send the money", lived in its prompt paid out
on attempt 482 [M1]. Solanaut moves the rule out of the model. The agent proposes, Solanaut admits or
denies by a named rule, and only then is anything signed. A control loop stops agents that retry the
same failing transaction [S3], and on devnet a Squads spending limit bounds even a stolen key [M9].

## The written pitch: what, why, how, results

For the long-form Colosseum fields, and for the README and any post once the human says so (T4).

**What.** Solanaut is a transaction firewall for Solana AI agents. Before an agent's wallet signs
anything, two independent checks decide whether it may: a deterministic policy of allowed programs,
allowed destinations and spending caps, which the model cannot change; and an open-source control loop,
Gubernaut Keel (Apache-2.0, pre-existing and disclosed), which stops an agent that keeps retrying the
same failing transaction. Every denial names the rule that made it, nothing denied is ever signed, and
any error denies. It runs on devnet only, with no real funds.

**Why (the problem).** AI agents now hold wallets, and a wallet signs whatever the agent's code hands
it. The losses so far come from three places:
- **Authority held by the model.** In a paid challenge on Base built to be attacked, an agent whose
  only rule, "never send the money", lived in its prompt paid out $47,316.05 on attempt 482. An
  attacker who breached AIXBT's dashboard queued two prompts that sent 55.5 ETH ($106,200).
- **Lost state.** On Solana, an agent meant to spend about 4 SOL sent about 5% of a token's supply
  after a session crash erased what it knew about its own wallet.
- **Keys in the agent's process.** Backdoored releases of Solana's own JavaScript library stole
  private keys from projects that held them directly.

Guarding the model does not hold. Research on ElizaOS found that once stored context is corrupted,
prompt-injection defences "only provide limited protection", so the rule has to live outside the model.
And automated senders fail constantly: in a year of Solana data, bots' transactions failed 58.43% of the
time against 6.22% for people, with expired validity windows behind 17.72% of failures. An agent that
retries blindly keeps paying for failures; one that re-signs before its first attempt expires can pay
twice.

**How (the solution).** Solanaut sits between the agent and its key: the agent proposes, Solanaut admits
or denies, and only then is anything signed. The policy reads the transaction itself (the programs it
calls, where the money goes, how much), never the model's text. So a model that has been talked into
paying an attacker still cannot pay one, as long as the policy is kept out of the agent's reach.

Keel is not the injection defence; the policy is. Keel has one job: it reads three numbers about the
stream of proposals (intensity, valence, repetition) and returns a posture, which Solanaut lets only
ever restrict, never allow.

The v1 now being built adds:
- decoding of legacy, v0 and v1 transactions from their bytes, with an allowlist for every instruction;
- receipts that bind each approval to the exact bytes signed;
- intents, so a payment is never re-signed while an earlier attempt could still land;
- a hash-chained log that replays every decision and is the guard's memory after a restart;
- one-line wrappers for Solana Agent Kit and `@solana/kit`;
- composed rather than reinvented, a Squads v4 spending limit on devnet. Squads' own program then caps
  what even a stolen agent key can move, per period and only to listed addresses.

**Results.** In the sandbox, on a local Solana validator, both defences work:
- **Drains are denied.** A scripted agent that had "read" a payment instruction planted in token
  metadata proposed paying an attacker twice. Both proposals were denied before signing and never
  sent; the chain held only the airdrop and the four allowed payments.
- **Loops are stopped.** An unfunded agent retrying the same failing transfer every 400 ms was stopped
  by Keel on its third attempt (DEFAULT → DEFAULT → REGROUND). That is one scenario, with the first
  version of the sensor, not a benchmark.
- **Errors deny.** The guard fails closed on telemetry the controller refuses, and refuses to start
  with a Keel build that declares a different controller digest.

No detection, block or false-stop rate is claimed yet. The batteries that measure loops, fee
escalation, double-sends and false stops on normal traffic come next, and only measured numbers will be
published.

*Traces to `docs/CLAIMS.md`:*
- *What:* S2, S4, S5, G6.
- *Why:* M1, M2, M4, M6, M3, M8.
- *How:* S1; S2, only while the policy is kept out of the agent's reach; G1; M9, designed but not yet
  built.
- *Results:* S1, S3, S4, and §1's list of what cannot be claimed yet.

## The script (about 2:40)

| Time | Say | Show | Claims |
|---|---|---|---|
| 0:00–0:20 | "In November 2024 an AI agent guarded a prize pool with one rule: never send the money. The rule lived in its prompt. On attempt 482, it sent the money." | the rule; the payout | M1 |
| 0:20–0:45 | "It keeps happening. A breached dashboard queued two prompts and moved 55.5 ETH. On Solana, an agent that lost its memory in a crash sent 5% of a token's supply. And a key sitting in an agent's process is exposed to the code beside it: a backdoored release of Solana's own JavaScript library once stole keys exactly that way." | three cards: authority, state, keys | M2, M4, M6 |
| 0:45–1:05 | "Research on agent frameworks shows defences inside the model don't hold once its memory is poisoned. So the rule has to live outside the model." | the quote | M3 |
| 1:05–1:40 | "Solanaut is a reference monitor for agent wallets. The agent proposes. Solanaut decodes the actual bytes and checks them against a policy the model cannot change: programs, destinations, tokens, caps. It denies by a named rule, before anything is signed." | the architecture strip; a denial with its rule | S1, S2 |
| 1:40–2:05 | "Automated senders also fail constantly: bots on Solana fail more than half their transactions. Solanaut uses Gubernaut Keel, an open-source control loop, to stop a retry loop, and it never re-signs a payment that could still land." | the loop stopped at turn 3 | M8, S3, G1 |
| 2:05–2:25 | "On-chain, we compose with Squads: the agent's key can spend only a daily amount, to listed addresses, even if it is stolen." | the Squads refusal on devnet | M9 |
| 2:25–2:40 | "Solanaut is open source, devnet-only, and says exactly what it has measured. [The human: who you are, and why you will keep building this.]" | the repository; the claims file | S5 |

## Rules for every version

- **Say "in the sandbox"** after any number Solanaut measured [S3].
- **Never "prevents", "would have stopped", "the only" or "the first"** (`docs/CLAIMS.md` §4).
- **AIXBT was a breached dashboard, not a prompt injection** [M2].
- **Say "bots", not "agents",** for the failure-rate figures [M8].
- **The Solana-track demo is devnet** [S5].
- **Nothing is claimed before it is built.** Receipts, intents, the wrappers and the Squads limit
  stay "being built" until their `docs/CLAIMS.md` rows exist. Each milestone review updates the *How*
  and *Results* paragraphs above.
- **Nothing about mainnet** until the canary report exists (`docs/ROADMAP.md`, milestone 4.5), and then only within
  its scope.
- **Never "production-ready", "audited" or "certified"** until `docs/READINESS.md` says so, with its evidence.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. The Squads and cockpit shots exist only after H3 and H4. |
| Draft 2 | 2026-09-27 | The written pitch in four paragraphs (what, why, how, results), traced to CLAIMS rows. The script's line at 1:40 now says "automated senders", to keep M8's scope (bots, not AI agents). Two rules added. |
| Draft 3 | 2026-09-30 | The *How* list follows `docs/SPEC.md` Draft 2; two rules added: nothing about mainnet before the canary report, and no "production-ready", "audited" or "certified" before their evidence. |
