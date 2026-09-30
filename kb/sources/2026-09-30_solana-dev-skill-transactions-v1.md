---
type: source
status: current
url: "https://github.com/solana-foundation/solana-dev-skill/blob/main/skills/solana-dev/references/transactions-v1.md"
title: "transactions-v1.md (solana-dev-skill)"
publisher: "Solana Foundation (GitHub)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# The v1 format, as the Solana Foundation's developer reference describes it

The Foundation's reference for building and parsing v1 transactions, including the pitfalls for parsers and firewalls.

## Key facts

- A v1 transaction begins with the byte `0x81`; signatures move to the tail.
- The message: version, header, a u32 config mask, the lifetime token, instruction and account counts, the static accounts, the config values, then the instructions.
- The config holds computeUnitLimit, priorityFeeLamports, loadedAccountsDataSizeLimit and heapSize. "Unset limits are zero, not defaults".
- At most 64 inline accounts; no lookup tables; duplicate addresses rejected; 4,096 bytes; base64 encoding, since base58 stays capped at 1,232 bytes.
- "Do not add ComputeBudget instructions to a v1 transaction", because they "execute as no-ops". A pipeline scanning ComputeBudget instructions reads "silent zeros".
- Readers pass maxSupportedTransactionVersion: 1, the integer. Without it, getTransaction fails with error -32015 and getBlock fails on any block holding one v1 transaction.
- Activated on mainnet on 2026-09-15 with Agave 4.2.2; feature gate `txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL`. solana-test-validator 4.2 and later, and Surfpool 1.5 and later, enable it at genesis.
- @solana/kit 8.0.0 and later builds v1, through `createTransactionMessage({ version: 1 })` or the plugin client.

## What it supports

- `docs/SPEC.md` §4, the v1 rules.
- [ADR-009](../../design/ADR-009-trust-and-coverage.md) and [ADR-011](../../design/ADR-011-phantom-roles-and-dashboard.md).
- `TOOLCHAIN.md`.
- `docs/CLAIMS.md` M10.

## Caveats

- A developer reference in a skills repository, not the normative specification; SIMD-0385 is normative.
- Whether kit's plugin client builds v1 by default is not settled here (`docs/SPEC.md` §12).
