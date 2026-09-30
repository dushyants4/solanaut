---
type: source
status: current
url: "https://solana.com/upgrades/larger-transaction-sizes"
title: "Larger Transaction Sizes"
publisher: "Solana Foundation (solana.com)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# v1 transactions and the 4,096-byte limit

Solana's own page on the v1 transaction format, which went live on mainnet during the hackathon and changes what a firewall must decode.

## Key facts

- Two proposals: SIMD-0296, "larger transactions", and SIMD-0385, "transaction-v1".
- Mainnet activation "September 15, 2026 at approximately 01:00 UTC", epoch 1035. Testnet and devnet were already live. A local validator needs Solana CLI v4.2 or later.
- The 4,096-byte ceiling applies only to v1. Legacy and v0 keep their "1232 bytes" maximum.
- A v1 message carries a config with computeUnitLimit, loadedAccountsDataSizeLimit, heapSize and priorityFee, which is "a total in lamports, not micro-lamports per CU".
- Address lookup tables are "not supported" in v1; accounts are inline, up to 64.
- SDKs: @solana/kit 8.0.0 and later, @solana/web3.js 3.x from 3.0.0-rc.3, and the Rust crates 4.2.x.
- Readers must pass maxSupportedTransactionVersion: 1, and indexers read limits from the config instead of ComputeBudget instructions.

## What it supports

- [ADR-009](../../design/ADR-009-trust-and-coverage.md), and `docs/SPEC.md` §4.
- `docs/CLAIMS.md` M10.
- [kb/wiki/solana/_index.md](../wiki/solana/_index.md).
- `TOOLCHAIN.md`, the v1 test validator.

## Caveats

- Read through the fetch tool's summary on 2026-09-30.
- Hardware-wallet support for v1 is not documented on this page.
