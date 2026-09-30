---
type: source
status: current
url: "https://solana.com/upgrades/alpenglow"
title: "Alpenglow"
publisher: "Solana Foundation (solana.com)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Alpenglow, and what it changes about confirmation

Read because the intent logic depends on confirmation and expiry, and the mainnet canary must re-check them.

## Key facts

- Expected on mainnet "Q3 2026, on Anza's v4.3 release schedule"; each cluster migrates on its own schedule, and the `getAgGenesisCert` RPC method shows whether it is active.
- Under Alpenglow, "confirmed and finalized become the same thing", and finality falls from 12.8 seconds to about 150 milliseconds.
- "Votes are no longer transactions, so they no longer appear in blocks."
- Block time is being reduced separately, "from 400ms to 200ms in stages".
- The page says nothing about blockhash expiry changing.

## What it supports

- `docs/ROADMAP.md`, milestone 4.3, and `docs/READINESS.md`, network changes.
- `docs/SPEC.md` §12.

## Caveats

- News reports, seen only in search results, say Alpenglow went live on testnet on 2026-09-22 and was not on mainnet by 2026-09-28.
