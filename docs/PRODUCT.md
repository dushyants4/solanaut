# PRODUCT.md — what Solanaut is, why it exists, and how it works

> **1.0** · 2026-09-30 · **signed off by the human on 2026-09-30**, which achieves milestone 1.1 in `docs/ROADMAP.md` ·
> owner: architect ·
> for: every seat, judges, and anyone deciding whether to use Solanaut · public since 2026-10-12. Facts cite
> `docs/CLAIMS.md` rows as [S1] or [M4]; sentences about the design are marked *design* and describe what is
> specified, not what is built. Register: `kb/DOCUMENTS.md`.

## In one line

Solanaut decides what an AI agent's Solana wallet may sign, so a fooled model, a confused agent or a stolen key still
cannot pay an address the operator never allowed.

## Why: the problem

AI agents hold wallets, and a wallet signs whatever the agent's code hands it. The documented losses come from three
places:

| Cause | Documented case |
|---|---|
| Authority held by the model | an agent whose only rule lived in its prompt paid out on attempt 482 [M1]; a breached dashboard queued prompts that sent 55.5 ETH [M2]; a gifted NFT raised a wallet's permissions [M5] |
| Lost state | on Solana, an agent meant to spend about 4 SOL sent about 5% of a token's supply after a crash erased its wallet state [M4] |
| Keys in the agent's process | backdoored web3.js releases stole keys from projects that held them directly [M6]; malicious agent skills posed as Solana wallets [M7] |

Defences inside the model help little once its context is poisoned [M3]. Automated senders also fail far more often
than people, and expired validity windows are a common cause [M8]. An agent that re-signs before its first attempt
has expired can pay twice.

## Who it is for

| Who | What they need |
|---|---|
| Teams running trading, treasury or payment agents on Solana | a policy and caps they can adopt in one line, and an on-chain bound |
| Agent platforms and launchpads | a default guard for every agent they host |
| Framework maintainers: Solana Agent Kit, ElizaOS, kit-based agents | a guard they can ship in their signing path |

*Design, not a measured market:* the business case is in `docs/papers/BUSINESS-PLAN.md`, and the market in
`docs/papers/MARKET.md`.

## What it is, and what it is not

| Solanaut is | Solanaut is not |
|---|---|
| a transaction firewall between an agent and its key: the agent proposes, Solanaut admits or denies by a named rule, and only then is anything signed | a wallet, a custodian, or a key service |
| a deterministic policy the model cannot change, plus a control loop for retries and fee escalation | a prompt-injection detector: its injection defence is the policy, which does not need to notice anything [G1] |
| composed with Squads v4, whose spending limit bounds a stolen key on-chain [M9] | a replacement for on-chain limits |
| honest about limits: every denial names its rule, and every number has a source | "un-hackable", or "the only" anything (`docs/CLAIMS.md` §4) |

## How it works (*design*, `docs/SPEC.md` Draft 2)

1. **Decode the bytes.** Legacy, v0 and v1 messages are decoded from their serialized bytes; anything else is denied.
2. **Classify every instruction.** Each instruction of a known program moves value, grants authority, is benign, or is
   unknown. Value is checked against the policy; authority grants and unknown instructions are denied.
3. **Apply the policy.** Programs, destinations, mints, and per-transaction, per-window and fee caps: configuration the
   model cannot change.
4. **Stop loops and double-sends.** Keel, a pre-existing open-source control loop, reads three numbers about the
   proposal stream and can only restrict [G1]. Intents keep a payment from being re-signed while an earlier attempt
   could still land.
5. **Remember across restarts.** Every decision is logged in a hash chain that is also the guard's state.
6. **Bound it on-chain.** A Squads v4 spending limit names the agent's key and caps what it can move, per period and
   only to listed destinations, even if the key is stolen [M9].

## What is distinct

Caps and allowlists are table stakes: signing services, on-chain programs and at least one open-source agent wallet
already document them (`docs/papers/MARKET.md`). What Solanaut adds, and what the research found no one else
documenting, is control of the transaction stream: retry loops, fee escalation, and double-sends before expiry. That
is an observation about documentation, not a claim that no one does it (`docs/CLAIMS.md` §1).

## How success is measured

Each leg of `docs/ROADMAP.md` has its own gate. The measures that matter to a user are:
- every drain-shaped case in the batteries is denied with its named rule;
- the false-stop rate on benign traffic, measured and published with its confidence interval;
- the loop stop turn, measured for each kind of loop;
- how quickly outside developers reach a first guarded transaction (milestone 5.4);
- on-chain, a stolen key refused past its limit.

No rate is claimed before it is measured.

## Non-goals

- Holding anyone's keys or funds as a service.
- Judging whether a model is safe.
- A public challenge or a pay-to-attack game (ADR-003).
- Mainnet with real funds, apart from the one capped, human-run canary that ADR-008 proposes.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-30 | First draft, for milestone 1.1. |
| 1.0 | 2026-09-30 | Signed off by the human; milestone 1.1 achieved. The text is unchanged (`runs/2026-10-01-beta-build.md`). |
