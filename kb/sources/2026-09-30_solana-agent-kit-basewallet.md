---
type: source
status: current
url: "https://github.com/sendaifun/solana-agent-kit/blob/v2/packages/core/src/types/wallet.ts"
title: "wallet.ts, BaseWallet"
publisher: "SendAI (GitHub)"
published: "undated; v2 branch"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Solana Agent Kit's BaseWallet interface

The interface that `guardedWallet` implements.

## Key facts

- Members: `readonly publicKey`; `signTransaction<T>`; `signAllTransactions<T>`; an optional `sendTransaction`; `signAndSendTransaction(transaction, options?)`, returning `{ signature }`; `signMessage(message: Uint8Array)`.
- The transaction type is `Transaction | VersionedTransaction` throughout.
- On npm, `solana-agent-kit` was at 2.0.10 on 2026-09-30.

## What it supports

- `docs/SPEC.md` §8, `guardedWallet`.

## Caveats

- Read on the v2 branch; the published package's types are checked against it at milestone 2a.8.
