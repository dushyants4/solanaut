---
type: source
status: current
url: "https://github.com/Squads-Protocol/v4/blob/main/programs/squads_multisig_program/src/instructions/multisig_add_spending_limit.rs"
title: "multisig_add_spending_limit.rs"
publisher: "Squads Protocol (GitHub)"
published: "undated; main branch"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Squads v4: who may add a spending limit, and to whom

The instruction a controlled multisig uses to create a spending limit.

## Key facts

- `validate()` requires the signer to be the multisig's `config_authority`.
- Its comment says spending-limit members "are NOT tied to multisig membership; this list is managed independently of the multisig's members."
- On destinations: "If empty, funds can be sent to any address."

## What it supports

- `docs/SPEC.md` §9.
- [ADR-006](../../design/ADR-006-onchain-backstop.md), [ADR-008](../../design/ADR-008-mainnet-canary.md) and [ADR-011](../../design/ADR-011-phantom-roles-and-dashboard.md).
- `docs/CLAIMS.md` M9.

## Caveats

- An autonomous multisig adds limits through config transactions instead; that path was not read here.
