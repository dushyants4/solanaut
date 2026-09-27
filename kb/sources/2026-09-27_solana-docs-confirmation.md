---
type: source
status: current
url: "https://solana.com/docs/advanced/confirmation"
title: "Transaction confirmation and expiration"
publisher: "Solana Foundation (solana.com/docs)"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Blockhash expiry, and when a re-sign is safe

## Key facts

- "a given blockhash can only be used by transactions for about 60 to 90 seconds before it will be
  considered expired". The queue keeps "the most recent 151 stored hashes".
- **`lastValidBlockHeight`** (from `getLatestBlockhash`) is the last block height at which the
  transaction can still be processed. After it, the transaction is permanently expired.
- **When a retry is safe:** "If a transaction doesn't get committed to a block and expires, users
  can try again knowing that their previous transaction will NOT ever be processed."

## What it supports

- `docs/SPEC.md`, intents: a new signature for the same intent is admitted only once the previous
  attempt has definitively failed or its `lastValidBlockHeight` has passed. Re-signing before that
  risks paying twice.
- [kb/wiki/solana/_index.md](../wiki/solana/_index.md)

## Caveats

- Durable-nonce transactions do not expire this way. The guard treats a durable-nonce transaction
  as an intent with no expiry, so its re-sign rule never releases it on its own.
