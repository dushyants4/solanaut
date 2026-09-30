---
type: source
status: current
url: "https://solana.com/docs/tools/kora/operators/configuration"
title: "Kora configuration"
publisher: "Solana Foundation (solana.com)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Kora: the Solana Foundation's paymaster, and its transaction checks

Adjacent prior art: a service that validates transactions before it signs them as fee payer.

## Key facts

- Kora is a paymaster node: "Your Kora node will be signing transactions for your users".
- Its validation settings: `allowed_programs`, `allowed_tokens`, `allowed_spl_paid_tokens`, `max_allowed_lamports`, which "limits the Kora node's exposure to a single transaction", and `disallowed_accounts`.
- `fee_payer_policy` restricts what the fee-payer wallet may do, and defaults to false for every operation.
- Pricing is margin, fixed or free; the guide warns that fixed or free pricing needs strict security measures.

## What it supports

- `docs/papers/MARKET.md` §3.
- [kb/wiki/competitors/_index.md](../wiki/competitors/_index.md).

## Caveats

- Kora protects a fee payer's funds, not an agent's own spending.
