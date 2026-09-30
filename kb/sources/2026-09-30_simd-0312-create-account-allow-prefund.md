---
type: source
status: current
url: "https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0312-create-account-allow-prefund.md"
title: "SIMD 0312: CreateAccountAllowPrefund"
publisher: "Solana Foundation (GitHub)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# A new System Program instruction that funds a new account

Read to complete the System Program's instruction list for the allowlist per instruction.

## Key facts

- It adds `CreateAccountAllowPrefund`, a System instruction with discriminant 13.
- It will "transfer the specified number of lamports from the funding_account to the new_account" even when the new account already holds lamports.
- The funding account is optional, and required only when lamports are more than 0.
- "This SIMD requires a feature gate, as it adds a new System Program instruction."
- The proposal's status field reads "Review".

## What it supports

- `docs/SPEC.md` §4, the System row.
- [ADR-009](../../design/ADR-009-trust-and-coverage.md), context.

## Caveats

- Developer blogs, seen only in search results, date its mainnet activation to 2026-05-29, epoch 979; not re-read.
- Denying unknown instructions covers it whether or not it is active.
