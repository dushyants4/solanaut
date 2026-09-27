---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-27
---

# DeFAI on Solana: AI agents that hold wallets

**Sources:**
- [agent frameworks on npm](../../sources/2026-09-27_npm-agent-frameworks.md)
- [failed transactions study](../../sources/2026-09-27_arxiv-solana-failed-transactions.md)
- [the landscape, via-agent](../../sources/2026-09-27_agent-landscape-via-agent.md)
- [Colosseum World's Fair](../../sources/2026-09-27_colosseum-worldsfair.md)

"DeFAI" is AI agents acting in DeFi with a wallet of their own: trading, paying, managing treasuries.
On Solana they are built with a handful of frameworks. Their losses so far come from authority,
state and keys, and the chain's own data shows automated senders failing far more than people do.

## Key takeaways

- **Frameworks still build on `@solana/web3.js` 1.x:** Solana Agent Kit 2.0.10, ElizaOS's
  `plugin-solana` 1.2.6 and Anchor's TS client. `@solana/kit` 8.3.0 is the modern line.
  - A research agent reports about 9M monthly downloads for `@solana/kit`, 42.7k for `@elizaos/core`
    and 4.3k for Solana Agent Kit (via-agent).
- **Solana Agent Kit takes any `BaseWallet`.** Its constructor accepts one, and `BaseWallet` signs both
  legacy and versioned transactions. Wrapping it is one line of adoption.
- **Automated senders fail far more than people.** From Aug 2023 to Jul 2024, bot accounts' non-vote
  transactions failed 58.43% of the time against 6.22% for human accounts, and 17.72% of failures were
  expired validity windows.
- **Agent payments are the story; their volume is contested.** x402 figures differ by about 20× between
  estimates (via-agent), so none of them goes in the pitch.

## Details

See [incidents](incidents.md) for the documented losses, and
[competitors](../competitors/_index.md) for who already sells caps and allowlists.

## For Solanaut

- **Hook in at the signer, not in one framework.** Decode the serialized transaction, then wrap
  `BaseWallet` and a `@solana/kit` signer, with an ElizaOS plugin as P1.
- **Loops are a risk the data suggests,** not an incident class. No documented loss has been found
  from an AI agent raising its own fees. Pitch accordingly.

## Related

- [incidents](incidents.md)
- [Solana transactions](../solana/_index.md)
- [security](../security/_index.md)

## Open questions

- How many live Solana agents sign with a raw keypair in their own process? No source counts them.
