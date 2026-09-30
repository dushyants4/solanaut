---
type: source
status: current
url: "https://docs.phantom.com/phantom-mcp-server"
title: "Phantom MCP server"
publisher: "Phantom (docs.phantom.com)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# Phantom's MCP server: an agent wallet held in Phantom's key service

Phantom's documentation of its MCP server, with its tool reference and setup pages, read to design the Phantom paths.

## Key facts

- An agent receives "a new dedicated wallet on authentication". A Phantom Connect sign-in sets up an OIDC stamper; the key service "validates the stamp, enforces policy, and then signs and submits."
- Tools include `get_wallet_addresses`, `get_token_balances`, `transfer_tokens`, `send_solana_transaction`, `sign_solana_message`, `simulate_transaction`, `buy_token`, `portfolio_rebalance`, `pay_api_access`, and tools for Hyperliquid perpetuals.
- `send_solana_transaction` takes a base64 `transaction`, a `networkId` (default `solana:mainnet`; `solana:devnet` and `solana:testnet` supported), and `confirmed`: omitted, it simulates; `true`, it signs and sends.
- `transfer_tokens` takes `networkId`, `to`, `amount`, `amountUnit`, `tokenMint`, and `createAssociatedTokenAccount`, which defaults to true.
- `sign_solana_message` signs a UTF-8 message.
- The session is stored at `~/.phantom-mcp/session.json` with owner-only permissions, holding "wallet and organization identifiers, stamper keys, and user authentication details".
- "You must fund the agent's wallet before it can transact."
- On npm, `@phantom/mcp-server` was at 1.2.8 on 2026-09-30.

## What it supports

- [ADR-008](../../design/ADR-008-mainnet-canary.md) and [ADR-011](../../design/ADR-011-phantom-roles-and-dashboard.md).
- `docs/SPEC.md` §8, the MCP firewall.
- `docs/papers/MARKET.md`.
- [kb/wiki/competitors/phantom.md](../wiki/competitors/phantom.md).

## Caveats

- The policy the key service enforces is described only as "enforces policy"; no spending limits the user can set are documented.
- The setup page does not label the product beta or generally available.
