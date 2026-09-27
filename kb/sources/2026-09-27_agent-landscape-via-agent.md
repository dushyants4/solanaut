---
type: source
status: current
url: "https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/"
title: "Agent-wallet landscape, compiled by a research agent (several sources)"
publisher: "several; listed below"
published: "2025-01-02 to 2026-09-22"
fetched: 2026-09-27
checked: via-agent
created: 2026-09-27
updated: 2026-09-27
---

# The agent-wallet landscape, as a research agent reported it

Several sources, each read by a research agent on 2026-09-27 and **not re-read first-hand**. Nothing
here is quotable in public until it is. The URL above is the first of them; the rest are listed.

## Key facts

- **Coinbase CDP** Solana policies check each transaction: sender and recipient, SOL value, token
  mint, program ID and network. Its Agentic Wallet adds "Max per call" and "Max per session".
  - https://docs.cdp.coinbase.com/server-wallets/v2/using-the-wallet-api/policies/solana-policies
  - The Block, 2026-02-11.
- **Sudont** (a Colosseum Frontier winner, 2026-06-26) is an RPC proxy that simulates every
  transaction (LiteSVM, revm) and returns "structured JSON errors designed for Agentic ReAct loops".
  It is in private alpha, and no caps, allowlists, fee or retry controls are documented.
  - https://www.sudont.xyz/
- **MoonPay's Open Wallet Standard** (2026-03-23) is a local key vault with spending limits and
  allowlists. Open issue #254 (2026-09-18) reports the daily total hard-coded to 0, so daily caps
  never block.
  - https://github.com/open-wallet-standard/core/issues/254
- **Phantom's MCP server** gives an agent a dedicated wallet whose key service "enforces policy". No
  spending limits are documented.
  - https://docs.phantom.com/phantom-mcp-server
- **Blockaid and Blowfish** (Blowfish is now part of Phantom) scan and simulate. They return a risk
  verdict and enforce no budget.
- **Small open-source guards:** AgentVeins (budgets, allowlists, a kill switch, rules against
  runaway loops; Solana devnet only), IntentProof, onchain-agent-wallets. Each has 0–6 GitHub stars.
- **Sol CLI:** in-process per-transaction and rolling 24-hour USD caps and a config lock. Its docs say
  the limits "do not prevent other software on the same machine from reading the key files".
- **Framework usage** (npm downloads, 2026-08-28 to 2026-09-26):
  - `@elizaos/core` 42,713; `@coinbase/agentkit` 33,443; `@goat-sdk/core` 13,138;
    `solana-agent-kit` 4,327 (41,347 in January 2025); `@solana/kit` 8,978,364.
  - GOAT's main repository is marked archived.
- **x402 payment volume:**
  - Artemis, via Solana Compass (2026-09-22): 23.2M Solana x402 transactions in four weeks (76%
    share); across chains, $24.24M moved in 75.41M transactions in 30 days.
  - Allium puts genuine agent volume near $1.6M a month.
  - Estimates differ by about 20×, so keep x402 volume out of the pitch.
- **Colosseum history:**
  - Breakout AI-track winners (2025-07-02) included Latinum and Agent Arc; Cypherpunk (2025-12-13)
    included MCPay, Mercantill, Corbits and Seer; Frontier had 493 AI submissions of 2,857.
  - The accelerator's cohort 5 took Clawpump and Flovia, and not Sudont.
- **Lobstar Wilde's value** is reported as ~$250k (Solana Compass, 2026-02-25) and $441,780
  (Cointelegraph).

## What it supports

- `docs/papers/MARKET.md`, as context only.
- [kb/wiki/competitors/_index.md](../wiki/competitors/_index.md)
- [kb/wiki/defai/_index.md](../wiki/defai/_index.md)

## Caveats

- **Every line is via-agent.** A line needed publicly is re-read first-hand, moved into its own
  source note, and given a `docs/CLAIMS.md` row.
- The research agent could not verify ElizaOS's "50,000 agents", ClawHavoc's losses, or whether
  Turnkey or Coinbase resolve lookup tables.
