---
type: source
status: current
url: "https://www.solanakit.com/docs/advanced-guides/signers"
title: "Signers"
publisher: "Anza (solanakit.com)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# @solana/kit's signer interfaces

The interfaces the kit adapter wraps, and which of them may change a transaction.

## Key facts

- `TransactionPartialSigner.signTransactions` returns a signature dictionary for each transaction "without modifying them".
- `TransactionModifyingSigner.modifyAndSignTransactions` "potentially modifies the provided Transactions before signing them".
- `TransactionSendingSigner.signAndSendTransactions` signs and sends, may modify, and must be the last signer.
- Message signers mirror these: `MessagePartialSigner` and `MessageModifyingSigner`.
- On npm, `@solana/kit` was at 8.4.0 on 2026-09-30.

## What it supports

- `docs/SPEC.md` §8, the kit signer.
- [ADR-009](../../design/ADR-009-trust-and-coverage.md), point 9.

## Caveats

- Read through the fetch tool's summary.
