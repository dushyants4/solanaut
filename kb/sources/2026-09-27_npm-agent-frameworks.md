---
type: source
status: current
url: "https://registry.npmjs.org/solana-agent-kit"
title: "npm registry records for Solana agent frameworks, and SAK's wallet interface"
publisher: "npm; unpkg"
published: "per package, below"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Solana agent frameworks on npm, and where to hook in

Registry records queried directly on 2026-09-27: each package's latest version, publish date, and its
Solana dependencies. Also the wallet interface Solana Agent Kit exports
(`https://unpkg.com/solana-agent-kit@2.0.10/dist/index.d.ts`).

## Key facts

| Package | Latest | Published | Built on |
|---|---|---|---|
| `solana-agent-kit` | 2.0.10 | 2025-09-24 | `@solana/web3.js` ^1.98.2 |
| `@elizaos/plugin-solana` | 1.2.6 | 2025-10-26 | `@solana/web3.js` ^1.98.0 (2.0 in alpha) |
| `@elizaos/core` | 1.7.2 | 2026-01-19 | — (2.0 in beta) |
| `@anchor-lang/core` (Anchor's TS client) | 1.2.0 | 2026-09-04 | `@solana/web3.js` ^1.69.1 |
| `@solana/web3.js` | 1.99.0 | 2026-09-08 | — |
| `@solana/kit` | 8.3.0 | 2026-09-09 | its own `@solana/*` 8.3.0 packages |

- **SAK's constructor** is `constructor(wallet: BaseWallet, rpc_url, config, evmWallet?)`.
- **`BaseWallet`** declares `publicKey`, `signTransaction<T extends Transaction | VersionedTransaction>`,
  `signAllTransactions`, `sendTransaction?`, `signAndSendTransaction` and
  `signMessage(message: Uint8Array)`.

## What it supports

- `design/ADR-005-transaction-coverage.md` and `docs/SPEC.md`, adapters: wrap `BaseWallet` for
  one-line adoption in SAK; decode bytes so any library's transactions are covered; add a
  `@solana/kit` signer.
- [kb/wiki/defai/_index.md](../wiki/defai/_index.md)

## Caveats

- Download counts are in the [via-agent landscape note](2026-09-27_agent-landscape-via-agent.md).
