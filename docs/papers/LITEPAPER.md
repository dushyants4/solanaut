# Solanaut: a reference monitor for AI agents' Solana wallets

> **Draft 3** · 2026-10-01 · owner: architect · for: judges and developers · not public until the
> human says so. Figures cite `docs/CLAIMS.md` rows as [S1], [G6], [M4]. Register: `kb/DOCUMENTS.md`.

## Summary

AI agents now hold wallets, and a wallet signs whatever the agent's code hands it. So far, losses have
come from three causes, each documented [M1–M7]:

- an agent with authority it should not have had;
- an agent that lost track of its own state;
- a key sitting in a process that something else could read.

Defences inside the model help little once its context is poisoned [M3].

Solanaut puts a small, deterministic check between the agent and its key. The agent **proposes** a
transaction. Solanaut **admits** or denies it, by a named rule, against a policy the model never sees.
Only then is it **signed**.

A control loop, Gubernaut Keel [G1], watches the stream of proposals and stops one that has become a
loop. On devnet, the same policy is bounded on-chain by a Squads spending limit [M9], so even a stolen
agent key cannot move more than the limit allows.

## 1. The problem

| Cause | Documented case | What a fix has to hold against |
|---|---|---|
| Authority held by the model | Freysa's only rule lived in its prompt, and it paid out on attempt 482 [M1]; a breached dashboard queued prompts that sent 55.5 ETH [M2]; a gifted NFT raised a wallet's permissions [M5] | a model that has been persuaded, or a person who can prompt it |
| Lost state | on Solana, an agent meant to spend about 4 SOL sent about 5% of a token's supply after a crash erased its wallet state [M4] | a model that is simply wrong about its own balance |
| Keys in the agent's process | backdoored web3.js versions stole private keys [M6]; malicious agent skills posed as Solana wallets [M7] | code running beside the agent |

A fourth risk is measured on the chain but not yet seen in an agent loss: automated senders fail far
more often than people do. Bot accounts' transactions failed 58.43% of the time in a year of Solana
data, and expired validity windows caused 17.72% of all failures [M8]. An agent that retries blindly
pays fees on every failure. If it re-signs before its first attempt has expired, it can pay twice.

## 2. The principle

A **reference monitor** is "always invoked (i.e., complete mediation), tamperproof, and small enough to
be subject to analysis and tests" (NIST SP 800-53). Solanaut applies that definition to one resource:
an agent's signatures.

- **Always invoked.** Nothing reaches the key without passing the guard. The signer signs only bytes
  that carry a valid receipt.
- **Deny by default.** A program, destination or token mint is allowed only if the operator named it.
- **Small enough to verify.** The rules are ordered and deterministic, and every one of them has a test
  that was seen failing first.

## 3. The design

```
agent ── bytes ──▶ guard.check()                        ── receipt ──▶ signer ──▶ RPC
                    decode legacy, v0 (pinned lookup tables) and v1; unknown versions denied
                    an allowlist per instruction; durable nonces and other signers denied
                    policy: programs, destinations, mints, caps, fees      → DENY by rule
                    intents, keyed by effects: no re-sign while an attempt could still land → DENY
                    Keel (@gubernaut/core 1.0.1): REGROUND denies, INHIBIT tightens
                    log: hash-chained, replayable, and the guard's state after a restart
on-chain (devnet): Squads v4 spending limit naming the agent key: N per day, to listed destinations only
```

1. **The policy is the injection defence.** It reads the transaction's bytes, never the model's text,
   and the model cannot change it [S2]. A drain to an unlisted address is denied before signing [S1].
2. **The control loop is the loop defence.** Keel reads three numbers about the proposal stream and
   returns a posture [G1]. Solanaut lets the posture only *restrict*: a calm posture never allows what
   the policy denies. On the sandbox's retry loop, Keel stopped the third identical attempt [S3]. On synthetic
   streams at a constant priority fee, sensor v1 stopped none of 600 benign payments at the policy's expected rate,
   and none of 600 in bursts. With the fee varying per payment, it stopped none of 3,000, after a change of
   definition the independent evaluator's streams prompted [S7].
3. **Receipts and intents stop double-sends.** A receipt binds an admission to the exact bytes, an
   expiry and the policy's hash, and it is used once. A new attempt at the same payment is admitted only
   once the earlier one is reported failed or expired. An attempt whose outcome nobody reported holds its
   payment, because it may have landed.
4. **The chain bounds a stolen key.** The treasury sits behind a Squads v4 spending limit [M9], so
   whatever happens off the chain, the agent's key cannot exceed it. On devnet, Squads' program refused the
   agent's key past the limit, to an unlisted address, and after the operator removed the limit [S11].
5. **Every decision is logged** in a hash chain, and replay recomputes it. The log is the guard's state: killed
   at 20 random points, the guard restored an identical record [S6].

## 4. What each part can and cannot do

| Part | Stops | Does not stop |
|---|---|---|
| Policy | transfers to unlisted addresses, unlisted programs and mints, over-cap amounts, approvals | a transfer to an address the operator listed; a policy the agent itself can edit |
| Keel and the sensor | the same failing transaction retried; fee escalation | anything the sensor cannot see, and a loop that changes its shape and amount each turn; its quality is the sensor's quality [G1] |
| Receipts and intents | signing bytes other than those checked; paying twice while an attempt can still land | a compromised process that uses the key directly |
| Signer process | the agent's code reading the key | a compromised signer host |
| Squads spending limit | spending past the on-chain cap, even with a stolen key | spending within the cap |

## 5. Where it stands

- **Built and measured, the Beta:**
  - policy denials [S1], and 40 drain-shaped transactions each denied by its named rule [S8];
  - legacy, v0 and v1 decoded from their bytes, matching kit [S9];
  - the retry loop stopped [S3]; fail-closed, with the controller's bytes hashed [S4];
  - restart from the log [S6]; on synthetic streams, no benign payment stopped, at a constant fee or with varied
    fees [S7];
  - a Solana Agent Kit agent governed by one changed line [S10];
  - on devnet, the Squads bound on a stolen key [S11] and the demo's scenes end to end [S12].
- **Specified, not built (the Alpha):** the signer process; an operator-signed policy; Token-2022 settings; bounds for
  opaque programs; the MCP firewall in front of Phantom's agent wallet; the ElizaOS plugin; the log's head anchored
  on-chain (`docs/SPEC.md`).
- **Not claimed:** any detection or block rate; any false-stop rate beyond synthetic streams; any latency for the
  guard; any fee savings; that every double-send is prevented; anything about mainnet.

## 6. Roadmap

The roadmap is a sequence of milestones, each reached by passing its gate rather than by a date
(`docs/ROADMAP.md`). Each leg must be won before the next begins.

| Leg | Won when |
|---|---|
| 1 · Define | the product definition (`docs/PRODUCT.md`) is signed off by the human |
| 2 · Develop: the Beta MVP | the guard v1, both adapters, the Squads limit on devnet and a first dashboard pass the Beta batteries from a clean clone |
| 3 · The Alpha, tested hard | the signer process, the MCP firewall in front of Phantom's agent wallet, bounds for opaque programs and the other Alpha work meet every threshold in `docs/READINESS.md` |
| 4 · A live Phantom test | on devnet, with the human's Phantom wallet as the operator, as the human chose; a capped mainnet canary only if the human later accepts ADR-008 |
| 5 · Finish and polish | the dashboard and the developer experience pass their usability thresholds |
| Readiness | an independent audit, a bug bounty and a 1.0 release, each with its evidence |

## 7. Built on, and disclosed

Solanaut depends on Gubernaut Keel (`@gubernaut/core` 1.0.1, Apache-2.0), used unmodified. Gubernaut's
first public release was on 2026-07-29 [G6]. Its earlier public work includes stopping an agent's
failing on-chain retry loop on a local EVM devnet [G7]; nothing in it targets Solana. Keel's constants
are working defaults, not the configuration Gubernaut evaluated [G8].

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. |
| Draft 2 | 2026-09-30 | The verified review: the design strip follows `docs/SPEC.md` Draft 2; the status names what is specified; the roadmap is milestones, not dates. |
| Draft 3 | 2026-10-01 | The Beta review: the status is what was built and measured, S6 to S12; intents as D14 left them; the Squads bound measured on devnet; Leg 4 on devnet, as the human chose. |
