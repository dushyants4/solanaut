---
type: source
status: current
url: "https://docs.anza.xyz/proposals/versioned-transactions"
title: "Versioned Transactions"
publisher: "Anza (docs.anza.xyz)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Address lookup tables are append-only, and a closed table's address never returns

The design proposal behind v0 transactions, read to confirm that pinning a prefix of a lookup table is sound.

## Key facts

- "Address lookup tables are append-only and may only be closed if it's no longer possible to create a new lookup table at the same derived address."
- Tables are initialised at an address derived from a recent slot, so a closed table cannot be re-created at the same address.
- "Address lookup tables cannot be closed until the deactivation slot is no longer 'recent' (not accessible in the `SlotHashes` sysvar)".
- "Newly appended addresses require one slot to warmup before being available to transactions for lookups".

## What it supports

- `docs/SPEC.md` §4, v0 and pinned tables.
- [ADR-009](../../design/ADR-009-trust-and-coverage.md), point 2.
- `docs/papers/THREAT-MODEL.md` T14.

## Caveats

- A design proposal; that the runtime behaves as it says is assumed here, and a pin-soundness test is owed at milestone 2a.2.
