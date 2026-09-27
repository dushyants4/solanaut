---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-27
---

# Competitors and adjacent tools

**Sources:**
- [Privy's policies](../../sources/2026-09-27_privy-solana-policies.md)
- [Privy's stateful policies](../../sources/2026-09-27_privy-stateful-policies.md)
- [Turnkey](../../sources/2026-09-27_turnkey-solana-policy-engine.md)
- [Squads spending limits](../../sources/2026-09-27_squads-spending-limit.md)
- [Swig](../../sources/2026-09-27_swig-wallet.md)
- [recurring delegation](../../sources/2026-09-27_solana-recurring-delegation.md)
- [the landscape, via-agent](../../sources/2026-09-27_agent-landscape-via-agent.md)

**Caps and allowlists are table stakes.** Signing services check each transaction, and on-chain
programs cap spending per period. What none of the documentation read so far describes is control of
retries, fee escalation, or re-sends after a blockhash expires.

| Product | Where it enforces | What its docs show | What they do not show |
|---|---|---|---|
| [Privy](privy.md) (Stripe) | signing service | per-transaction Solana rules: program, SOL amount, mint and amount, recipient | lookup-table addresses; window totals on Solana (EVM only, counted after signing) |
| Turnkey | signing service (enclave) | accounts, programs, SOL transfers, instruction data; per-transaction caps and co-approval (via-agent) | time-window totals |
| Coinbase CDP (via-agent) | signing service | per-transaction Solana rules; "Max per session" in its Agentic Wallet | loop or retry control |
| [Squads v4](squads.md) | **on-chain** | spending limits per mint, per period, per member, with optional allowed destinations | anything about the agent's other transactions |
| Swig | **on-chain** | roles, session keys, withdrawal and time limits (via-agent) | a documented program ID |
| Foundation allowances | **on-chain** | a per-period pull limit on SPL tokens | a destination allowlist; SOL |
| Sudont (via-agent) | RPC proxy | simulation, with structured errors for agents | caps, allowlists, fee or retry control |
| Blockaid, Blowfish (via-agent) | scanning | risk verdicts | enforcement |
| AgentVeins and other small guards (via-agent) | the agent's process | budgets, allowlists, kill switches, loop rules | adoption (0–6 stars) |

## Key takeaways

- **Counting a window after signing is a known trap.** Privy's docs say "multiple concurrent requests
  may all pass policy evaluation before any of their values are recorded." Solanaut reserves at
  admission.
- **Lookup tables blind address rules.** Privy says its Solana evaluation "does not support resolving
  addresses from Address Lookup Tables". Solanaut takes the resolved tables from its caller, or denies.
- **On-chain caps per period exist and are audited.** Solanaut composes with Squads instead of
  re-inventing them (ADR-006).

## For Solanaut

- **Position:** complement the signing services and compose with the on-chain programs. The novelty
  is loop, fee and double-send control, not caps.
- **Inference:** a startup selling only caps and allowlists competes with Stripe's and Coinbase's
  wallets. See `docs/papers/BUSINESS-PLAN.md`.

## Related

- [DeFAI on Solana](../defai/_index.md)
- [security](../security/_index.md)
- `docs/papers/MARKET.md`

## Open questions

- Do Turnkey or Coinbase resolve lookup tables? Unverified.
- Before the positioning is final, run Colosseum Copilot against Sudont, AgentVeins and BlockHelix.
  That is the human's, with a logged-in account.
