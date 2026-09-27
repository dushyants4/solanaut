---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-27
---

# Agent-wallet incidents, and the control that bounds each

**Sources:**
- [Freysa](../../sources/2026-09-27_the-block-freysa.md)
- [AIXBT](../../sources/2026-09-27_cointelegraph-aixbt.md)
- [Fake Memories](../../sources/2026-09-27_arxiv-fake-memories.md)
- [Lobstar Wilde](../../sources/2026-09-27_substack-lobstar-wilde.md)
- [Grok and Bankr](../../sources/2026-09-27_giskard-grok-bankr.md)
- [the web3.js backdoor](../../sources/2026-09-27_thehackernews-web3js-backdoor.md)
- [ClawHavoc](../../sources/2026-09-27_thehackernews-clawhavoc.md)

The documented losses fall into three causes. None of them needed a clever jailbreak.

| Incident | When, chain | What happened | Cause | What bounds it |
|---|---|---|---|---|
| Freysa | 2024-11, Base | the rule "never send the money" lived in the prompt; attempt 482 of 195 players won $47,316.05 | authority held by the model | a destination allowlist outside the model |
| AIXBT | 2025-03-18, Base | a breached dashboard queued two prompts to send 55.5 ETH ($106,200); the maintainer says the AI itself was not manipulated | authority for whoever could prompt it | a destination allowlist; a per-transaction cap |
| Fake Memories (research) | 2025-03, ElizaOS | injected memories trigger unauthorised transfers; prompt defences "only provide limited protection" | poisoned context | a policy that never reads the context |
| Lobstar Wilde | 2026-02-22, **Solana** | a session crash erased wallet state; an agent meant to spend ~4 SOL sent ~5% of a token's supply | lost state, not an attack | a per-mint, per-transaction cap |
| Grok and Bankr | 2026-05, chain not stated | a gifted NFT raised the wallet's permissions; a Morse-coded reply moved 3B DRB ($150–174k) | permissions anyone could raise | a policy fixed outside the model and the wallet |
| web3.js 1.95.6/7 backdoor | 2024-12-02, Solana | a phished maintainer shipped key-stealing versions; 674.86 SOL stolen | a key in the agent's process | a signer in a separate process; an on-chain cap |
| ClawHavoc | 2026-02, OpenClaw | 341 of 2,857 audited skills were infostealers, some posing as Solana wallets | a key on the agent's host | the same |

## Key takeaways

- **Authority** (Freysa, AIXBT, Grok and Bankr) is stopped by a deterministic policy the model cannot
  read or change.
- **State** (Lobstar Wilde) is bounded by caps that hold whatever the agent believes.
- **Keys** (web3.js, ClawHavoc) are stopped only if the key lives outside the agent's process, or if
  the chain itself caps what the key can spend.
- **No incident here is a loop.** Loop and fee control is Solanaut's differentiator, backed by
  [bot failure data](../../sources/2026-09-27_arxiv-solana-failed-transactions.md), not by a loss.

## For Solanaut

- The cockpit demo (H4) replays **incident-shaped** scenarios on devnet: a new recipient, a misused
  function, an oversized send, a retry storm, a double-send after expiry.
- The pitch says "shaped like", never "would have prevented": none of these happened on Solanaut's
  stack.

## Related

- [DeFAI on Solana](_index.md)
- [security](../security/_index.md)
- `docs/papers/THREAT-MODEL.md`
- `docs/CLAIMS.md` §5

## Open questions

- Are there Solana agent losses with public post-mortems beyond Lobstar Wilde? None was found on
  2026-09-27.
