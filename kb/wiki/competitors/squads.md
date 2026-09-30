---
type: entity
status: current
kind: protocol
created: 2026-09-27
updated: 2026-09-30
---

# Squads v4 spending limits

**Sources:**
- [the SpendingLimit docs, and a devnet check](../../sources/2026-09-27_squads-spending-limit.md)
- [spending_limit_use.rs](../../sources/2026-09-30_squads-v4-spending-limit-use.md)
- [multisig_add_spending_limit.rs](../../sources/2026-09-30_squads-v4-add-spending-limit.md)
- [the landscape, via-agent](../../sources/2026-09-27_agent-landscape-via-agent.md)

A multisig program on Solana whose spending limits let named keys move a capped amount of one mint per period,
optionally only to listed destinations, without a multisig vote.

| | |
|---|---|
| Does | a per-mint amount per period (it resets unless one-time); the keys that may spend; an optional destination list |
| Does not | look at anything else the agent signs; stop loops; cap fees |
| Who may spend | only keys on the limit's own member list: `spending_limit_use` checks nothing else about the caller, and limit members "are NOT tied to multisig membership" |
| Who may add a limit | a controlled multisig's config authority, or a config transaction on an autonomous multisig |
| Destinations | "If empty, funds can be sent to any address", so Solanaut always sets them |
| Enforces where | on-chain, in the program |
| On Solana | yes. Program `SQDS4ep6…52pCf` is executable on devnet (checked 2026-09-27) |
| Licence, status | the audit status of the v4 multisig is confirmed before mainnet (ADR-008, pre-flight) |

## Relation to Solanaut

**It composes; milestone 2a.9 builds on it** (`design/ADR-006-onchain-backstop.md`, `docs/SPEC.md` §9):

- The treasury sits in the vault of a controlled multisig, whose config authority is the operator.
- The agent's key is named only on a spending limit: at most N per period, only to the policy's destinations. It is
  not a multisig member.
- A stolen agent key is then bounded by the chain at N per period. The SDK guard still decides what the agent signs.
- **The kill switch is removing the limit.** Removing a member revokes nothing.
- *Inference:* the config authority is a single point of control, since it can add a limit to any destination.

## Related

- [competitors](_index.md)
- [Phantom](phantom.md), the operator's wallet
- `docs/SPEC.md`, the on-chain backstop
