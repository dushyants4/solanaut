---
type: source
status: current
url: "https://solana.com/docs/core/fees"
title: "Fees on Solana"
publisher: "Solana Foundation (solana.com/docs)"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Solana fees and compute budget

## Key facts

- **Base fee:** "5,000 lamports" per signature, "50% burned / 50% to the validator".
- **Priority fee:** "ceil(compute_unit_price * compute_unit_limit / 1,000,000) lamports". The price
  is in micro-lamports per compute unit.
- **Compute limits:** 200,000 CU per instruction by default (3,000 for builtins); at most 1,400,000
  CU per transaction.
- **How fees are set:** by `ComputeBudgetInstruction::SetComputeUnitLimit` and
  `SetComputeUnitPrice`.
- **In v1 transactions** the priority fee is "an absolute lamport total configured in the message
  settings" instead.

## What it supports

- `docs/SPEC.md`, the fee rules: the guard computes the priority fee from the decoded ComputeBudget
  instructions and caps it per transaction and per window.
- [kb/wiki/solana/_index.md](../wiki/solana/_index.md)

## Caveats

- v1 moves fees out of instructions and into the message. A guard that decodes only instructions
  would miss them, so Solanaut denies any message version it cannot decode.
