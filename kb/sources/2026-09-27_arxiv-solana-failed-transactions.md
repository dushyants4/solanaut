---
type: source
status: current
url: "https://arxiv.org/html/2504.18055"
title: "Why Does My Transaction Fail? A First Look at Failed Transactions on the Solana Blockchain"
publisher: "arXiv"
published: "2025-04-25"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Failed transactions on Solana (Aug 2023 – Jul 2024)

The measured basis for Solanaut's loop and retry work. It is data about bots, not about AI agents.

## Key facts

- **Period:** "from August 1, 2023 to July 31, 2024, spanning 72,123,900 blocks".
- **Volume:** "2,898,175,006 non-vote transactions… 1,387,340,838 _successful_ and 1,510,834,168
  _failed_".
- **Bots against humans:**
  - "Bot accounts… exhibit a high transaction failure rate of 58.43%".
  - "the 1,359,772 human accounts show a considerably lower transaction failure rate of 6.22%".
- **Expiry:** "_validity expiration_ (17.72%)" of failed transactions: the transaction missed its
  validity window.

## What it supports

- `docs/CLAIMS.md` M8
- [kb/wiki/solana/_index.md](../wiki/solana/_index.md)
- [kb/wiki/defai/_index.md](../wiki/defai/_index.md)

## Caveats

- The data covers bots, not AI agents. No documented loss has been found from an AI agent escalating
  its own fees. Present loops and fees as a risk the data suggests, never as an incident class.
