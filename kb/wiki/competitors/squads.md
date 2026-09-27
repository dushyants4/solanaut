---
type: entity
status: current
kind: protocol
created: 2026-09-27
updated: 2026-09-27
---

# Squads v4 spending limits

**Sources:**
- [the SpendingLimit docs, and a devnet check](../../sources/2026-09-27_squads-spending-limit.md)
- [the landscape, via-agent](../../sources/2026-09-27_agent-landscape-via-agent.md)

A multisig program on Solana whose spending limits let named members move a capped amount of one
mint per period, optionally only to listed destinations, without a full multisig vote.

| | |
|---|---|
| Does | a per-mint amount per period (it resets unless one-time); members who may spend; optional destination list |
| Does not | look at anything else the agent signs; stop loops; cap fees |
| Enforces where | on-chain, in the program |
| On Solana | yes. Program `SQDS4ep6…52pCf` is executable on devnet (checked 2026-09-27) |
| Licence, status | audit status of the v4 multisig to be confirmed in the H3 spike |

## Relation to Solanaut

**It composes; H3 builds on it** (`design/ADR-006-onchain-backstop.md`):

- The treasury sits in a Squads vault.
- A spending limit funds the agent's hot wallet: at most N SOL per period, with the hot wallet as the
  only destination.
- A stolen agent key is then bounded by the chain at N per period plus whatever the hot wallet holds.
  The SDK guard still decides what the hot wallet signs.

## Related

- [competitors](_index.md)
- `docs/SPEC.md`, the on-chain backstop
