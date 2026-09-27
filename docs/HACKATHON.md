# HACKATHON.md — Crypto World's Fair: the rules, the scope, the dates

## The rules, from the official PDF

Source: *Crypto World's Fair Hackathon Rules* (8 pages), linked from
[colosseum.com/worldsfair](https://colosseum.com/worldsfair), read 2026-09-27.

| | |
|---|---|
| **Contest period (§5)** | 6:00am PT **2026-09-14** to **11:59pm PT 2026-10-12**. Winners announced by 2026-12-05 |
| **Registration (§6)** | every member registers on colosseum.com before the deadline; the team leader uploads the submission |
| **Limits (§7)** | one team per entrant, one submission per team |
| **Judging (§8)** | functionality (and code quality) · potential impact · novelty · UX · **open-source** and composability · business plan |
| **IP (§9)** | entrants keep their IP, and **must inform the administrator of any open-source or third-party code**: Gubernaut is declared as a pre-existing Apache-2.0 dependency |
| **Prizes (§14)** | Grand Champion $30,000; Public Goods $5,000; University $5,000; 20 × $15,000. The site lists a $100,000 Solana track, and accelerator entry with $250,000 in funding |

Colosseum's submission guide (blog, "Perfecting your hackathon submission") asks for a pitch
video of at most 3 minutes and a technical demo of 2–3 minutes that covers the Solana
integration, and for judges to be given access to the repository.

## Scope for the submission (MVP)

**In:** the guard SDK, measured; the plugin sandbox; one framework adapter (ElizaOS); the Anchor
vault on **devnet**; the cockpit showing live decisions; honest numbers from the batteries.

**Out:** mainnet, real funds, pay-to-attack fees (`design/ADR-003-devnet-only.md`); the RPC
proxy; token or entity decisions.

## Dates

| Phase | Dates | Delivers | Done when |
|---|---|---|---|
| **0 · Setup** | Sep 27 | isolated repo, office, law, docs, toolchain, first slice, remote, Colosseum entry | `runs/2026-09-27-setup.md` |
| **H1 · Guard** | Sep 28 – Oct 1 | sensor v1, presets, batteries for drain, loop, fee escalation and false stops; evals written failing first | batteries green, rates stated in `docs/CLAIMS.md` |
| **H2 · Adapters** | Oct 2 – 4 | ElizaOS plugin, AgentKit wrapper, sandbox scenarios through both | a scripted agent governed with a one-line change |
| **H3 · On-chain** | Oct 5 – 7 | Anchor vault on devnet: program-enforced caps and allowlist, decision events | deployed on devnet, its tests green |
| **H4 · Cockpit** | Oct 8 – 10 | web view of live devnet decisions; the adversarial battery run and recorded honestly | a stranger can watch a drain being refused |
| **H5 · Submit** | Oct 11 – 12 | pitch and demo videos, README, the §9 disclosure, the repo made public **on the human's word**, the submission **by the human** | submitted before 11:59pm PT Oct 12 |

**T4 in this plan:** making the repo public, the submission itself, and any post about it are
the human's, at the moment.
