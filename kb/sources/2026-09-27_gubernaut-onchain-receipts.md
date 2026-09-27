---
type: source
status: current
url: "https://github.com/thegubernaut/gubernaut/tree/main/receipts/onchain"
title: "receipts/onchain/README.md — On-chain receipts"
publisher: "Gubernaut (github.com/thegubernaut)"
published: "runs 2026-07-21 and 2026-07-24; committed 2026-08-01"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Gubernaut's on-chain receipts (EVM, local devnet)

Gubernaut's public, **pre-existing** demonstration of stopping an agent's on-chain retry loop. It
matters to Solanaut twice: as prior art Colosseum's rules require be disclosed, and as scope. It ran
on EVM, not Solana.

## Key facts

- **Substrate:** "A **local ephemeral EVM devnet**: ganache, chain id **31337**. **This is not a
  public testnet and not a mainnet.**"
- **The agent:** ElizaOS running `@gubernaut/plugin-gcc` (Tiller's client, not Keel) against "a
  contract engineered to fail on every call".
- **Run 1, the intercept (2026-07-21):**
  - Ungoverned, the agent submitted 8 transactions; governed, 3.
  - All of them reverted.
  - The governed agent was "Severed at | never | **turn 4**".

## What it supports

- `docs/CLAIMS.md` G7: quotable only with its substrate stated.
- The corrected §9 disclosure in `docs/submission/SUBMISSION.md`: the idea of stopping an on-chain
  retry loop was demonstrated before the contest, on EVM.
- [kb/wiki/gubernaut/_index.md](../wiki/gubernaut/_index.md)

## Caveats

- **Nothing here touches Solana.** A research agent searched every public Gubernaut repository and
  page for Solana terms and found none.
- Run 2 (the treasury run, 2026-07-24) was read by a research agent only, and is not cited.
