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

Read to complete the System Program's instruction list for the allowlist per instruction. Re-read in full through
the GitHub API at milestone 2a.3, for its layout.

## Key facts

- It adds `CreateAccountAllowPrefund`, a System instruction with discriminant 13.
- It will "transfer the specified number of lamports from the funding_account to the new_account" even when the new account already holds lamports.
- The funding account is optional, and required only when lamports are more than 0.
- "This SIMD requires a feature gate, as it adds a new System Program instruction."
- The proposal's status field reads "Review".
- **Instruction data:** a `u32` discriminant `13`, then `lamports` (`u64`), `space` (`u64`) and `owner` (a 32-byte
  `Pubkey`): 52 bytes.
- **Accounts:** index 0, the new account, `[WRITE, SIGNER]`; index 1, the funding account, `[WRITE, SIGNER]`,
  optional.
- Security considerations: "since the lamport check is removed, a wallet account with lamports can be bricked by
  this instruction."
- `@solana-program/system` 0.15.0 implements it as `getCreateAccountAllowPrefundInstruction`.

## What it supports

- `docs/SPEC.md` §4, the System row; `packages/sdk/src/classify.ts` decodes it, and denies it when the new account
  is a principal key, which it would brick.
- [ADR-009](../../design/ADR-009-trust-and-coverage.md), context.

## Caveats

- Developer blogs, seen only in search results, date its mainnet activation to 2026-05-29, epoch 979; not re-read.
- Denying unknown instructions covers it whether or not it is active.
