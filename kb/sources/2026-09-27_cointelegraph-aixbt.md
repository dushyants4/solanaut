---
type: source
status: current
url: "https://cointelegraph.com/news/hacker-breaches-ai-crypto-bot-aixbt-steals-55-eth"
title: "Hacker breaches AI crypto bot Aixbt, steals 55 ETH"
publisher: "Cointelegraph"
published: "2025-03-19"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# AIXBT: 55.5 ETH moved by prompts queued from a breached dashboard

## Key facts

- **The attack:** on 2025-03-18 at 01:58 UTC, an attacker breached the agent's dashboard and "made
  two prompts for it to transfer 55.5 Ether… from its wallet". The amount was worth $106,200.
- **The chain:** the Base network.
- **The maintainer's view:** "its core systems weren't impacted, and the breach wasn't the result of
  manipulating the AI."

## What it supports

- `docs/CLAIMS.md` M2
- [kb/wiki/defai/incidents.md](../wiki/defai/incidents.md)

## Caveats

- **Not a prompt injection.** It was a dashboard compromise. The honest lesson is authority: whoever
  could prompt the agent could move its funds anywhere. A destination allowlist outside the model
  addresses exactly that.
- The chain was Base, not Solana.
