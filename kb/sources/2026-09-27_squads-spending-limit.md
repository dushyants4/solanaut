---
type: source
status: current
url: "https://docs.rs/squads-multisig/latest/squads_multisig/state/struct.SpendingLimit.html"
title: "squads_multisig::state::SpendingLimit"
publisher: "Squads (docs.rs)"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Squads v4 spending limits

The on-chain backstop that H3 composes with (`design/ADR-006-onchain-backstop.md`).

## Key facts

The fields and their doc comments:

- **`mint`:** "The token mint the spending limit is for. Pubkey::default() means SOL."
- **`amount`:** "The amount of tokens that can be spent in a period", in the mint's base units.
- **`period`:** "The reset period… When it passes, the remaining amount is reset, unless it's
  `Period::OneTime`."
- **`remaining_amount`:** when it reaches 0, "the spending limit cannot be used anymore until the
  period reset."
- **`members`:** "Members of the multisig that can use the spending limit."
- **`destinations`:** "The destination addresses the spending limit is allowed to sent funds to". If
  empty, "funds can be sent to any address."
- **Deployment:** program `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` is deployed and executable on
  devnet. Checked by `getAccountInfo` against `api.devnet.solana.com` on 2026-09-27.

## What it supports

- `design/ADR-006-onchain-backstop.md`
- `docs/SPEC.md`, the on-chain backstop.
- [kb/wiki/competitors/squads.md](../wiki/competitors/squads.md)

## Caveats

- The program ID is the well-known Squads v4 address and exists on devnet. The H3 spike confirms it
  against Squads' own docs before any code depends on it.
- A research agent read that the Squads Smart Account Program is audited (OtterSec) and formally
  verified (Certora). That is **via-agent**, and the smart-account program is not necessarily the v4
  multisig.
