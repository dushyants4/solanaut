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
updated: 2026-10-01
---

# Solana Agent Kit's BaseWallet interface

The interface that `guardedWallet` implements.

## Key facts

- Members: `readonly publicKey`; `signTransaction<T>`; `signAllTransactions<T>`; an optional `sendTransaction`; `signAndSendTransaction(transaction, options?)`, returning `{ signature }`; `signMessage(message: Uint8Array)`.
- The transaction type is `Transaction | VersionedTransaction` throughout.
- On npm, `solana-agent-kit` was at 2.0.10 on 2026-09-30.
- **Checked against the published package at milestone 2a.8:** `npm pack solana-agent-kit@2.0.10` (tarball SHA-256
  `11385851…62ee7b13`), `dist/index.d.ts` lines 229 to 270: the same six members. `signAndSendTransaction`'s options are
  web3.js `SendOptions`, and its result is `{ signature: TransactionSignature }`.
- The package's `KeypairWallet` signs the caller's transaction object in place: `partialSign` for a legacy
  transaction, `sign([payer])` for a versioned one.
- The package depends on `@langchain/core`, `@openai/agents`, `ai`, `@solana/spl-token` and `@solana/web3.js`, among
  others, which is why Solanaut copied the interface instead of installing the kit for a type.

## What it supports

- `docs/SPEC.md` §8, `guardedWallet`.

## Caveats

- Read on the v2 branch, then confirmed in the published 2.0.10 package. A type-level check against the installed kit,
  and a real agent, come with milestone 2b.3.
