---
type: source
status: current
url: "https://solana.com/docs/rpc/http/simulatetransaction"
title: "simulateTransaction RPC Method"
publisher: "Solana Foundation (solana.com)"
published: "undated"
fetched: 2026-10-03
checked: first-hand
created: 2026-10-03
updated: 2026-10-03
---

# simulateTransaction

The RPC method that runs a transaction without landing it. Milestone 3.4 uses it to see what an opaque program would
do to the principal's accounts before admitting it.

## Key facts

- `sigVerify`: "If `true` the transaction signatures will be verified (conflicts with `replaceRecentBlockhash`)".
- `replaceRecentBlockhash`: "If `true` the transaction recent blockhash will be replaced with the most recent
  blockhash".
- `commitment` defaults to `finalized`, and `minContextSlot` sets "The minimum slot that the request can be evaluated
  at".
- `accounts.addresses`: "Account addresses to return … The list length must not exceed the number of account keys in
  the transaction", with `base64`, `base64+zstd` or `jsonParsed` encoding.
- The result carries `err`, `logs`, `accounts`, `unitsConsumed`, `returnData`, `innerInstructions` (when asked) and
  `loadedAccountsDataSize`.

## What it supports

- [ADR-018](../../design/ADR-018-bounding-opaque-programs.md), and requirements OPQ-1 and OPQ-3 in `docs/SPEC.md`
  §13.4.

## Caveats

- The page calls the result's `accounts` the "Accounts requested", without saying in so many words that they are the
  state after the simulated execution. ADR-018 relies on that reading, and milestone 3.4's first test confirms it on a
  validator before anything else is built on it.
- A simulation is evaluated against one slot's state. What lands later can differ, which is why ADR-018 binds the
  result on-chain with assertions.
