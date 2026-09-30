---
type: source
status: current
url: "https://github.com/ExpertVagabond/coldstar-agent-signer"
title: "coldstar-agent-signer"
publisher: "ExpertVagabond (GitHub)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# coldstar-agent-signer: a policy-gated Solana Agent Kit wallet

An open-source project close to Solanaut's adapter design, found on 2026-09-30.

## Key facts

- It describes policy-gated signing for AI agents on Solana, with the root key air-gapped and agents using session keys.
- Its policies: allowlists and blocklists for recipients and programs; per-transaction limits; daily caps per mint and for SOL overall; escalation thresholds; per-mint token limits.
- Its engine is fail-closed and returns AUTO_SIGN, ESCALATE or REJECT; its decoder refuses unknown instructions; a batch is rejected whole if one transaction fails.
- It decodes System, SPL Token, Token-2022, Associated Token Account, Compute Budget with priority fees counted as spending, Stake, Memo, and Squads v4 with privilege-escalation refusal.
- It is a drop-in `BaseWallet` for Solana Agent Kit, and also runs as an MCP server; its policy envelope is signed by the root key and verified at startup.
- MIT licence; "Beta, devnet"; 0 stars when read.

## What it supports

- `docs/papers/MARKET.md` §3 and §4.
- `docs/CLAIMS.md` §1: caps are not new.
- [kb/wiki/competitors/_index.md](../wiki/competitors/_index.md).

## Caveats

- Read through the fetch tool's summary of the README. Nothing there covered retry, fee-escalation or double-send control. Re-read the README directly before any public comparison.
