---
type: source
status: current
url: "https://docs.phantom.com/developer-powertools/lighthouse"
title: "Transaction Validation"
publisher: "Phantom (docs.phantom.com)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Phantom may add Lighthouse assertions to a transaction

Phantom's own statement that the transaction it submits can differ from the one a dApp handed it.

## Key facts

- "When you submit a transaction to Phantom, it may be augmented with Lighthouse assertion instructions before being submitted to the network."
- "the transaction onchain will be different from what you originally submitted."
- "these assertions can cause a transaction to fail even when it would otherwise execute successfully."

## What it supports

- `docs/SPEC.md` §8, the rule for wallets that append instructions.
- [ADR-009](../../design/ADR-009-trust-and-coverage.md), point 9, and [ADR-011](../../design/ADR-011-phantom-roles-and-dashboard.md).
- `docs/CLAIMS.md` M11.
- `docs/papers/THREAT-MODEL.md`, adversary A8 and threat T28.

## Caveats

- The page does not say which methods or platforms add assertions, or whether a dApp can opt out.
- Code changes in other projects, and an issue in the Solana Foundation's Kora, report a fee-payer balance assertion appended under `signTransaction`; those were seen only in search results.
