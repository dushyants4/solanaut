---
type: source
status: current
url: "https://solana.com/docs/core/transactions"
title: "Transactions"
publisher: "Solana Foundation (solana.com/docs)"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Transaction formats: legacy, v0, v1

## Key facts

- Standard maximum size: "1,232 bytes maximum, derived from the IPv6 minimum MTU (1,280 bytes)
  minus 48 bytes for network headers".
- Three formats exist: legacy, v0 (address lookup tables), and v1: "The v1 format raises this to
  4,096 bytes".

## What it supports

- `design/ADR-005-transaction-coverage.md`: the guard decodes legacy and v0, and denies v1 and any
  unknown version until it can decode them.
- [kb/wiki/solana/_index.md](../wiki/solana/_index.md)

## Caveats

- This page gives no rollout date or SIMD number for v1. The versioned-transactions page is the next
  read, owed to H1.
