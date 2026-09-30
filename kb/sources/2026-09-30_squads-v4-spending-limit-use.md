---
type: source
status: current
url: "https://github.com/Squads-Protocol/v4/blob/main/programs/squads_multisig_program/src/instructions/spending_limit_use.rs"
title: "spending_limit_use.rs"
publisher: "Squads Protocol (GitHub)"
published: "undated; main branch"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Squads v4: who may use a spending limit

The Squads v4 instruction that moves funds under a spending limit, read to settle whether the agent's key must be a multisig member.

## Key facts

- `validate()` checks the caller with one line: `require!(spending_limit.members.contains(&member.key()), MultisigError::Unauthorized)`.
- There is no check that the caller is a multisig member, and no permission check.
- For SOL the limit takes no mint account; for a token, the mint must equal `spending_limit.mint`.
- Destinations: "if !spending_limit.destinations.is_empty()", the destination must be on the list.
- The amount comes off `remaining_amount` with `checked_sub`, failing as `SpendingLimitExceeded`; the period resets first when it has elapsed.
- Arguments: `amount` (u64), `decimals` (u8) and an optional `memo`.

## What it supports

- `docs/SPEC.md` §9, and the answer recorded in [ADR-006](../../design/ADR-006-onchain-backstop.md).
- [ADR-008](../../design/ADR-008-mainnet-canary.md).
- `docs/CLAIMS.md` M9.
- [kb/wiki/competitors/squads.md](../wiki/competitors/squads.md).

## Caveats

- The `main` branch as read on 2026-09-30. Before mainnet, the deployed program's version is re-verified (ADR-008, pre-flight).
