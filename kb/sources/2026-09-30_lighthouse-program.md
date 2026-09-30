---
type: source
status: current
url: "https://github.com/Jac0xb/lighthouse"
title: "Lighthouse"
publisher: "Jac0xb (GitHub)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Lighthouse: the Solana assertion program

The program Phantom appends assertions from, and the Alpha's tool for bounding opaque programs on-chain.

## Key facts

- "an open-source Solana program that provides assertion instructions to enhance transaction security."
- Program id `L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95`, the same on devnet and mainnet-beta.
- Assertions cover account data and account info, token account fields such as balance and delegate, and sysvars.
- Memory "write instructions" store runtime data in PDAs so later instructions can compare against it.
- MIT licence.

## What it supports

- `docs/SPEC.md` §8, the rule for appended instructions.
- [ADR-009](../../design/ADR-009-trust-and-coverage.md).
- `docs/ROADMAP.md`, milestone 3.4.
- [kb/wiki/competitors/phantom.md](../wiki/competitors/phantom.md).

## Caveats

- The README as read shows no completed audit. An OtterSec audit and a V2 release are reported by search results and by the author's post; not re-read.
- The memory-write instructions fund and write an account, so they need their own rule (`docs/SPEC.md` §12).
