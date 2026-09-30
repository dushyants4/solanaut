---
type: source
status: current
url: "https://solana.com/docs/programs/verified-builds"
title: "Verifying Programs"
publisher: "Solana Foundation (solana.com)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Solana verified builds

The standard for proving that a deployed program matches its source, for `solanaut_anchor`.

## Key facts

- A verified build ensures "the executable program you deploy to Solana's network matches the source code in your repository."
- The `solana-verify` CLI builds deterministically in Docker; OtterSec runs a public verification API whose results explorers show.
- Programs whose upgrade authority is a Squads multisig verify through a transaction exported to the multisig.
- "Verification confirms source matches deployment—NOT that your code is secure."

## What it supports

- `docs/READINESS.md`, R.4, and `docs/ROADMAP.md`, milestone 3.7.
- [kb/wiki/security/readiness-standards.md](../wiki/security/readiness-standards.md).

## Caveats

- Fully trustless verification means running it locally from the on-chain data, not relying on the API.
