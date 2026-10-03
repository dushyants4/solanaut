---
type: source
status: current
url: "https://registry.npmjs.org/@elizaos/plugin-solana"
title: "@elizaos/plugin-solana 1.2.6 and 2.0.0-alpha.6, published code"
publisher: "elizaOS (npm)"
published: "1.2.6: latest on 2026-06-16 (registry modified)"
fetched: 2026-10-03
checked: first-hand
created: 2026-10-03
updated: 2026-10-03
---

# @elizaos/plugin-solana: how it gets keys and signs

The published code of ElizaOS's Solana plugin, read from the npm tarballs because the package's repository link
(github.com/elizaos-plugins/plugin-solana) answered 404 on 2026-10-03. It decides how Solanaut can sit in its
signing path (`docs/SPEC.md` §12, requirement ELZ-2).

## Key facts

- **Versions:** `latest` is 1.2.6 and `next` is 2.0.0-alpha.6. Dependencies include `@solana/web3.js`,
  `@solana/spl-token`, `bs58` and `tweetnacl`.
- **Keys come from settings, at each use.** `getWalletKey(runtime, requirePrivateKey)` reads `SOLANA_PRIVATE_KEY` or
  `WALLET_PRIVATE_KEY`, decodes base58 or base64, and returns `Keypair.fromSecretKey`. Without a private key it throws
  "Private key not found in settings". With `requirePrivateKey` false it reads only `SOLANA_PUBLIC_KEY` or
  `WALLET_PUBLIC_KEY`.
- **Signing happens in place, in five sites in 1.2.6:**
  - the swap action: a Jupiter transaction, `transaction.sign([keypair])`, then `connection.sendTransaction` with
    `maxRetries: 3`;
  - the SOL transfer and token transfer actions: `transaction.sign([senderKeypair])`, then `sendTransaction`;
  - `SolanaWalletService`'s transfer, signed by the sender and the service's keypair;
  - the trading path's `executeSwap(wallets, signal)`, which decodes each passed wallet's `privateKey` and calls
    `sendRawTransaction`.
- **Keys can also enter from outside.** `createWallet()` returns a new private key in base58, and `registerExchange`
  accepts providers whose swaps pass wallets carrying private keys.
- **2.0.0-alpha.6 keeps the pattern:** `getWalletKey` 9 times, `SOLANA_PRIVATE_KEY` 3 times, `.sign([` 5 times.
  There is still no wallet object to wrap.

## What it supports

- [ADR-017](../../design/ADR-017-elizaos-integration.md), and requirements ELZ-1 to ELZ-3 in `docs/SPEC.md` §13.6.

## Caveats

- Read as bundled `dist/index.js`, not as source files; line numbers are the bundle's.
- What runs depends on which actions and services a character enables. The trading path needs a caller that passes
  wallets, which the plugin alone does not.
- The repository's new location, if it moved, was not found.
