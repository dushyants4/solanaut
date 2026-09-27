# HACKATHON.md — Crypto World's Fair: the rules, the scope, the dates

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

## Scope for the submission (MVP)

**In:**
- the guard SDK v1, measured (`docs/SPEC.md`);
- the plugin sandbox;
- wrappers for Solana Agent Kit and `@solana/kit`;
- the Squads spending-limit backstop on **devnet** (ADR-006);
- the cockpit showing live decisions;
- honest numbers from the batteries.

**P1, cut before anything in "In":** the ElizaOS plugin and the signer process.
**P2, cut first:** the log-anchor program.

**Out:**
- mainnet, real funds and pay-to-attack fees (`design/ADR-003-devnet-only.md`);
- simulation, swap decoding, the RPC proxy;
- token or entity decisions.

## Dates

| Phase | Dates | Delivers | Done when |
|---|---|---|---|
| **0 · Setup** | Sep 27 | isolated repo, office, law, docs, toolchain, first slice, remote, Colosseum entry | `runs/2026-09-27-setup.md` · **done** |
| **R · Research** | Sep 27 | research on Gubernaut, governor patterns and Solana DeFAI; the MVP spec; the draft-1 papers; the knowledge vault | `kb/milestones/2026-09-27_R-research.md` · **done** |
| **H1 · Guard** | Sep 28 – Oct 1 | defects D1–D9 fixed test-first; bytes in (legacy, v0), tokens, fees, receipts, intents, latch, log, replay; Keel bytes verified; sensor v1; the fail-closed, drain, double-send, concurrency, loop and benign batteries | batteries green; the loop stop turn and the false-stop rate measured and stated in `docs/CLAIMS.md` |
| **H2 · Adapters** | Oct 2 – 4 | `guardedWallet` (Solana Agent Kit), the kit signer; P1: the ElizaOS plugin, `solanaut-signer` | a scripted SAK agent governed with a one-line change, with the same verdicts as the SDK |
| **H3 · On-chain** | Oct 5 – 7 | a half-day Squads spike; the multisig and spending limit on devnet; a stolen-key script; P2: `solanaut_anchor` | the Squads program refuses the stolen key past the limit on devnet |
| **H4 · Cockpit** | Oct 8 – 10 | a web view of live devnet decisions; the incident-shaped scenarios; the adversarial battery run and recorded honestly | a stranger can watch a drain being refused, with its rule |
| **H5 · Submit** | Oct 11 – 12 | pitch and demo videos, README, the disclosure, repository access **on the human's word**, the submission **by the human** | submitted before 11:59pm PT Oct 12 |

**If a phase runs late, cut in this order:**
1. `solanaut_anchor` (P2);
2. the signer process (P1);
3. the ElizaOS plugin (P1);
4. polish in the cockpit.

Never cut the fail-closed tests, the claims discipline, or the milestone review.

## Risks to the delivery

| Risk | Signal | Response |
|---|---|---|
| H1 is the largest phase | not all of the batteries are green by Oct 1 | carry the loop and benign batteries into H2's first day; never ship an unmeasured rate |
| Squads members cannot use a spending limit without also getting vote or execute rights | the H3 spike | fund the hot wallet through the limit (ADR-006, option 1b), or take Swig |
| Devnet is congested on recording day | failed airdrops, slow confirmations | record the local-validator fallback (`docs/submission/DEMO.md`) and say so on screen |
| A claim outruns the evidence | a sentence with no `docs/CLAIMS.md` row | the claims check at every milestone review |

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
