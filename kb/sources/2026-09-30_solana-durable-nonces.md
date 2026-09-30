---
type: source
status: current
url: "https://solana.com/developers/guides/advanced/introduction-to-durable-nonces"
title: "Introduction to Durable Nonces"
publisher: "Solana Foundation (solana.com)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Durable nonces: transactions that do not expire

Why an intent that waits for a blockhash to expire can never see a nonce transaction expire.

## Key facts

- "the first instruction of the transaction needs to be a `nonceAdvance` instruction".
- Durable nonces "are used in place of recent blockhashes".
- They remove "the mortality on the unexecuted transaction", so a signed transaction can be submitted much later.
- The guide cites Neodyme's article "Nonce Upon a Time, or a Total Loss of Funds".

## What it supports

- `docs/SPEC.md` §4 and rule 5, `durable-nonce-denied`.
- [ADR-009](../../design/ADR-009-trust-and-coverage.md), point 5.
- `docs/papers/THREAT-MODEL.md` T19.

## Caveats

- The guide does not detail the risks; the cited article does, and was not read here.
