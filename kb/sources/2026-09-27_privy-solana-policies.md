---
type: source
status: current
url: "https://docs.privy.io/controls/policies/example-policies/solana"
title: "Solana policy examples"
publisher: "Privy (a Stripe company)"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-30
---

# Privy's Solana policies

## Key facts

- **What a policy can inspect:** `programId`, `instructionName`, `Transfer.lamports`,
  `TransferChecked.mint`, `TransferChecked.amount` and `Transfer.to`.
- **Scope:** rules attach to `signAndSendTransaction` and are evaluated one transaction at a time.
- **Lookup tables:** "Solana policy evaluation does not support resolving addresses from Address
  Lookup Tables (ALTs)." Evaluation fails "only… if a policy condition needs to inspect an address
  that is stored in the ALT".

## What it supports

- [kb/wiki/competitors/privy.md](../wiki/competitors/privy.md)
- `docs/papers/MARKET.md`

## Caveats

- Vendor documentation, as it read on 2026-09-27. It describes the product's rules, not their
  effectiveness.
- Re-checked on 2026-09-30 through a search of this page: Solana policy evaluation still "does not support
  resolving addresses from Address Lookup Tables". The search result was not a full re-read.
