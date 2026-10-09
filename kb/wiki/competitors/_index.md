---
type: topic
status: current
created: 2026-09-27
updated: 2026-10-08
---

# Competitors and adjacent tools

**Sources:**
- [Privy's policies](../../sources/2026-09-27_privy-solana-policies.md)
- [Privy's stateful policies](../../sources/2026-09-27_privy-stateful-policies.md)
- [Turnkey](../../sources/2026-09-27_turnkey-solana-policy-engine.md)
- [Squads spending limits](../../sources/2026-09-27_squads-spending-limit.md)
- [Squads: who may use a limit](../../sources/2026-09-30_squads-v4-spending-limit-use.md)
- [Swig](../../sources/2026-09-27_swig-wallet.md)
- [recurring delegation](../../sources/2026-09-27_solana-recurring-delegation.md)
- [Phantom's MCP server](../../sources/2026-09-30_phantom-mcp-server.md)
- [Phantom's inspected published routes](../../sources/2026-10-08_phantom-published-routes.md)
- [coldstar-agent-signer](../../sources/2026-09-30_coldstar-agent-signer.md)
- [Kora](../../sources/2026-09-30_kora-configuration.md)
- [the landscape, via-agent](../../sources/2026-09-27_agent-landscape-via-agent.md)

**Caps and allowlists are table stakes.** Signing services check each transaction, on-chain programs cap spending per
period, and at least one open-source agent wallet documents caps for Solana Agent Kit. What none of the documentation
read so far describes is control of retries, fee escalation, or re-sends after a blockhash expires.

| Product | Where it enforces | What its docs show | What they do not show |
|---|---|---|---|
| [Privy](privy.md) (Stripe) | signing service | per-transaction Solana rules: program, SOL amount, mint and amount, recipient | lookup-table addresses, still unsupported on 2026-09-30; window totals on Solana (EVM only, counted after signing) |
| Turnkey | signing service (enclave) | accounts, programs, SOL transfers, instruction data; per-transaction caps and co-approval (via-agent) | time-window totals |
| Coinbase CDP (via-agent) | signing service | per-transaction Solana rules; "Max per session" in its Agentic Wallet | loop or retry control |
| [Phantom's MCP server](phantom.md) | Phantom's key service | a dedicated agent wallet; transactions simulated before sending; mainnet, devnet and testnet | spending limits the user sets; loop or retry control |
| coldstar-agent-signer | the agent's machine, with the root key air-gapped | a policy-gated Solana Agent Kit wallet: allowlists, per-transaction and daily caps, priority fees counted as spend, escalation to a human, a signed policy; MIT, a beta on devnet | retry, fee-escalation or double-send control |
| Kora, the Solana Foundation's paymaster | a fee-payer relay | allowed programs and tokens, and a lamport cap, checked before it pays fees | the agent's own spending |
| [Squads v4](squads.md) | **on-chain** | spending limits per mint and period, for named keys that need not be multisig members, with optional destinations | anything about the agent's other transactions |
| Swig | **on-chain** | roles, session keys, withdrawal and time limits (via-agent) | a documented program ID |
| Foundation allowances | **on-chain** | a per-period pull limit on SPL tokens | a destination allowlist; SOL |
| Sudont (via-agent) | RPC proxy | simulation, with structured errors for agents | caps, allowlists, fee or retry control |
| Blockaid, Blowfish (via-agent) | scanning | risk verdicts | enforcement |
| AgentVeins and other small guards (via-agent) | the agent's process | budgets, allowlists, kill switches, loop rules | adoption (0–6 stars) |

## Key takeaways

- **Counting a window after signing is a known trap.** Privy's docs say "multiple concurrent requests may all pass
  policy evaluation before any of their values are recorded." Solanaut reserves at admission.
- **Lookup tables blind address rules.** Privy says its Solana evaluation "does not support resolving addresses from
  Address Lookup Tables", re-checked on 2026-09-30. Solanaut pins the tables a policy allows.
- **On-chain caps per period exist.** Swig's documentation reports an audit by Accretion; the Squads v4 multisig's
  audit status is confirmed before mainnet (ADR-008). Solanaut composes with Squads instead of re-inventing a cap
  (ADR-006), and names the agent's key on the limit rather than making it a multisig member.
- **Phantom's agent wallet keeps keys out of the agent's process** and its send tool takes raw transaction bytes.
  Input filtering can stand in front of it (ADR-011); the inspected MCP routes do not expose the pre-send signed-byte
  interception required for wallet revalidation. See the [signing-seam brief](../../briefs/2026-10-08_phantom-signing-seam.md).

## For Solanaut

- **Position:** complement the signing services and compose with the on-chain programs. The novelty is loop, fee and
  double-send control, not caps.
- **Inference:** a startup selling only caps and allowlists competes with Stripe's and Coinbase's wallets, and with
  free open-source ones. See `docs/papers/BUSINESS-PLAN.md`.

## Related

- [DeFAI on Solana](../defai/_index.md)
- [security](../security/_index.md)
- `docs/papers/MARKET.md`

## Open questions

- Do Turnkey or Coinbase resolve lookup tables? Unverified.
- Does coldstar-agent-signer, or any other wallet, add loop or double-send control? Re-check at each milestone review.
- Before the positioning is final, run Colosseum Copilot against Sudont, AgentVeins, BlockHelix and
  coldstar-agent-signer. That is the human's, with a logged-in account.
