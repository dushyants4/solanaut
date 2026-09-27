# ADR-003 · The demo runs on devnet. No real funds, no pay-to-attack

**Status:** accepted 2026-09-27, **the human's decision** ("Devnet only").

## Context

The drop documents planned a mainnet "Fortress Vault" with $5,000–10,000 of real SOL, and a
fee charged for each attempt to talk the agent into paying out, the fees growing the pot.

## Decision

- The vault, the cockpit and every scenario run on **devnet** with test SOL.
- **No pay-to-attack fees.** A paid chance to win a pot raises legal questions that need a
  lawyer, not a hackathon deadline.
- Mainnet, real funds and any public challenge are **T4**: the human's, after an adversarial
  test campaign and legal review, not before.

## Consequences

- The demo proves the mechanism, not a bounty. Its strongest moment is still available: the
  model is shown fully fooled, and the transfer is refused anyway.
- No key that holds real funds is ever created or stored in this project.
