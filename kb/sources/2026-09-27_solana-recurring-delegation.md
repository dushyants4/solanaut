---
type: source
status: current
url: "https://solana.com/docs/payments/subscriptions/recurring-delegation"
title: "Recurring delegation (Subscriptions and Allowances)"
publisher: "Solana Foundation (solana.com/docs)"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# The Solana Foundation's recurring delegation (allowances)

## Key facts

- "A recurring delegation lets a user approve another wallet or service to pull up to a limit that
  resets every period."
- "The program checks the current period and rejects transfers that would exceed the period's
  remaining allowance."
- **Tokens only:** it works on SPL token accounts, not native SOL.
- **No destination allowlist:** none is described. The delegatee chooses the receiver.
- "The user signs setup and revoke transactions. The delegatee signs transfers."

## What it supports

- [kb/wiki/competitors/_index.md](../wiki/competitors/_index.md)
- `design/ADR-006-onchain-backstop.md`, as an alternative that was considered.

## Caveats

- A research agent read that the feature is live on mainnet and audited (Cantina, Spearbit), per
  Yahoo Finance on 2026-06-02. That is **via-agent**.
- Token-2022 is not mentioned on this page.
