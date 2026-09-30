# HACKATHON.md — Crypto World's Fair: the rules, the scope, the milestones

## The rules, from the official PDF and Colosseum's FAQ

Sources:
- *Crypto World's Fair Hackathon Rules* (8 pages), linked from
  [colosseum.com/worldsfair](https://colosseum.com/worldsfair), read 2026-09-27;
- [Colosseum's FAQ](../kb/sources/2026-09-27_colosseum-faq.md) and
  [the World's Fair page](../kb/sources/2026-09-27_colosseum-worldsfair.md), read 2026-09-27.

| | |
|---|---|
| **Contest period (§5)** | 6:00am PT **2026-09-14** to **11:59pm PT 2026-10-12**. Winners announced by 2026-12-05 |
| **Registration (§6)** | every member registers on colosseum.com before the deadline; the team leader uploads the submission |
| **Limits (§7)** | one team per entrant, one submission per team |
| **Judging (§8)** | functionality (and code quality) · potential impact · novelty · UX · **open source** and composability · business plan. The FAQ adds: founder–market fit, insight, product and execution, market size, communication, viability, traction |
| **IP and prior work (§9, FAQ)** | entrants keep their IP, and **must disclose open-source, third-party and "all relevant past development work"** in the submission form (`docs/submission/SUBMISSION.md`) |
| **Videos (FAQ)** | a pitch video of **two to three minutes**; a product demo of **no more than three minutes** |
| **Repository (FAQ)** | open source is encouraged; a private repository is allowed if access is granted to hackathon@colosseum.com |
| **Prizes (§14, the page)** | Grand Champion $30,000; the next 20 teams $15,000 each; Public Good $5,000; University $5,000; the Solana track $100,000 (10 × $10,000). Total pool $840,000. Winners are considered for the accelerator: "$250,000 pre-seed funding" |

The fair is **multi-chain**: it has ecosystem tracks for Solana, Ethereum, Hyperliquid, Base, Tempo,
Arbitrum, Zcash and Robinhood Chain. Solanaut enters the Solana track and the overall prizes.

## Milestones, not dates

Solanaut's plan is a sequence of milestones, each reached when its gate passes (`docs/ROADMAP.md`), at the human's
instruction of 2026-09-30. The contest's deadline above is a fact about the contest, not a milestone. The rule for it:

> **When the human decides to submit, the submission shows exactly the milestones that have passed their gates.**
> Anything not yet achieved is described as "being built", and nothing unmeasured is claimed.

| Milestone | State | Record |
|---|---|---|
| 0 · Setup | **achieved 2026-09-27** | `runs/2026-09-27-setup.md` |
| R · Research foundation | **achieved 2026-09-27** | `kb/milestones/2026-09-27_R-research.md` |
| R2 · Verified review and roadmap | **achieved 2026-09-30** | `runs/2026-09-30-verified-review-roadmap.md` |
| 1.1 · The product is defined | next: the human's sign-off of `docs/PRODUCT.md` | — |
| 2a.1 to 2a.10 · The Beta MVP, built | after 1.1 | `docs/ROADMAP.md`, Leg 2 |
| 2b.1 to 2b.4 · QC, validation and verification | after the Beta milestones | `docs/SPEC.md` §11 |
| S.1 · Submitted | the human's decision, with whatever has passed its gate | `docs/submission/SUBMISSION.md` |

## What the submission can show

**The Beta MVP** (`docs/SPEC.md` Draft 2):
- the guard v1: legacy, v0 and v1 decoded; an allowlist per instruction; receipts, intents, the latch, and the log as
  the guard's state;
- the plugin sandbox;
- wrappers for Solana Agent Kit and `@solana/kit`;
- the Squads spending-limit backstop on **devnet** (ADR-006), with the agent's key named only on the limit;
- dashboard v0, on localhost;
- honest numbers from the batteries.

**The build order, most valuable first**, decides what exists if the human submits before every Beta milestone is
achieved. It is in `docs/ROADMAP.md`, Leg 2. v1 decoding, the kit wrapper, sensor v1, Token-2022 beyond
TransferChecked and Phantom operator actions come last.

**Never dropped:** the fail-closed tests, the nonce denial, the instruction-level deny, receipts, intents, restore on
start, the claims discipline, and the milestone review.

**Out of the submission:**
- mainnet and real funds: the canary ADR-008 proposes is Leg 4, after the Alpha, and only if the human accepts it;
- pay-to-attack fees and public challenges (`design/ADR-003-devnet-only.md`);
- simulation, swap decoding, the RPC proxy, the signer process, the ElizaOS plugin and the log-anchor program, which
  are Alpha work;
- token or entity decisions.

## Risks to the delivery

| Risk | Signal | Response |
|---|---|---|
| The Beta is large, and the contest window may close before all of it is achieved | Beta milestones still open when the human decides to submit | submit what passed its gate, in the build order; describe the rest as being built; never ship an unmeasured rate |
| v1 decoding and pinned lookup tables add scope | milestone 2a.2 is not yet achieved | v1 comes last in the build order; while undecoded it stays denied, and the docs say so |
| Devnet is congested on recording day | failed airdrops, slow confirmations | record the local-validator fallback (`docs/submission/DEMO.md`) and say so on screen |
| A claim outruns the evidence | a sentence with no `docs/CLAIMS.md` row | the claims check at every milestone review |
| Phantom warns about an unreviewed dashboard domain | a hosted dashboard | keep the dashboard on localhost for the submission |

**Resolved on 2026-09-30:** the risk that Squads members could not use a spending limit without vote or execute
rights. Squads v4 checks only the limit's own member list, and the agent's key need not be a multisig member at all
(`docs/SPEC.md` §9).

## The Colosseum entry

**A draft was created on 2026-09-27** at
[colosseum.com/arena/projects/solanaut](https://colosseum.com/arena/projects/solanaut), on the human's
approval of the exact text:
- name: *Solanaut*;
- category: *Security Tools*;
- the 432-character description in `runs/2026-09-27-setup.md`;
- the GitHub link (`github.com/dushyants4/solanaut`, private).

It is a draft, not a submission.

The checklist of what remains, and the **corrected** prior-work disclosure, are in
`docs/submission/SUBMISSION.md`. The first draft kept here said `@gubernaut/core` had been public since
July 2026; it was published on 2026-08-07. It also said everything in the repository was written during
the contest, but the office tooling is adapted from earlier work.

**T4 in this plan:** making the repository public or granting judges access, the submission itself, and
any post about it are the human's, at the moment.
