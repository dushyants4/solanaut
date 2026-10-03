---
type: source
status: current
url: "https://solana.com/developers/guides/token-extensions/transfer-hook"
title: "How to use the Transfer Hook extension"
publisher: "Solana Foundation (solana.com)"
published: "2023-02-01"
fetched: 2026-10-03
checked: first-hand
created: 2026-10-03
updated: 2026-10-03
---

# How to use the Transfer Hook extension

Solana's guide to Token-2022's transfer hooks. It matters to Solanaut because it says what a hook program can do with
the accounts of the transfer that invokes it.

## Key facts

- "When the Token Extensions program CPIs to a Transfer Hook program, all accounts from the initial transfer are
  converted to read-only accounts." (the guide's explanation of the hook's CPI)
- "the signer privileges of the sender do not extend to the Transfer Hook program", a design made "to prevent
  malicious use of Transfer Hook programs".
- The extra accounts a hook needs are stored in a list that an optional `UpdateExtraAccountMetaList` instruction can
  replace; the guide notes the account "can be created by any instruction on a Transfer Hook program".
- A hook can reject a transfer: its example returns an error when "amount > 50", and the transfer fails with it.

## What it supports

- [ADR-016](../../design/ADR-016-token-2022-settings.md): a hook can fail a transfer, but cannot spend from the sender
  with the sender's signature.
- Threat T15 in `docs/papers/THREAT-MODEL.md`.

## Caveats

- A guide from 2023, not the program's source. The read-only conversion is the guide's statement; the processor code
  that performs it was not read.
- What a hook does with accounts it owns, or with lamports it is sent, is outside this statement.
