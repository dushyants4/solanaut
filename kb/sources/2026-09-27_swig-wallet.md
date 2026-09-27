---
type: source
status: current
url: "https://github.com/anagrambuild/swig-wallet"
title: "swig-wallet"
publisher: "Anagram"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Swig smart wallet

## Key facts

- **Licence:** "GNU Affero General Public License v3.0".
- **Audit:** "independently auditted by Accretion with plans to undergo additional audits".
- **Features and program ID:** the README describes neither.
- **Colosseum lists it:** the World's Fair resources page lists "Swig Smart Wallets for permissioned
  account control" (per a research agent).

## What it supports

- `design/ADR-006-onchain-backstop.md`: Swig is the fallback if the Squads spike fails.
- [kb/wiki/competitors/_index.md](../wiki/competitors/_index.md)

## Caveats

- **Features are via-agent.** Anagram's launch post (2025-03-05) and Breakpoint coverage
  (2025-12-13) describe on-chain roles, session keys, and withdrawal and time-based limits.
- **The program ID is unconfirmed.** An address that exists on devnet was found, but no Swig source
  names it. Do not use it until Swig's docs do.
- **Licence caution:** calling an AGPL program on-chain imposes nothing, but linking an AGPL SDK
  into Solanaut's code may. Check before depending on it.
