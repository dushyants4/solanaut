---
type: source
status: current
url: "https://solana.com/docs/advanced/lookup-tables"
title: "Address Lookup Tables"
publisher: "Solana Foundation (solana.com/docs)"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Address lookup tables (ALTs)

## Key facts

- ALTs "allow developers to create a collection of related addresses to efficiently load more
  addresses in a single transaction."
- "Address Lookup Tables are supported by v0 transactions only."
- Each address is referenced "by its 1-byte index within the table (instead of their full 32-byte
  address)".

## What it supports

- `docs/SPEC.md` and `design/ADR-005-transaction-coverage.md`: a v0 transaction's destinations are
  unknowable without the table's contents. The guard takes resolved tables from its caller, or
  denies.
- [kb/wiki/solana/_index.md](../wiki/solana/_index.md)

## Caveats

- **Inference:** whoever supplies the table contents decides what the guard sees. A caller that
  fetches them from a lying RPC misleads the guard. The on-chain spending limit is the backstop for
  that case.
