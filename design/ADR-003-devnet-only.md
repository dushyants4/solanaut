# ADR-003 · The demo runs on devnet. No real funds, no pay-to-attack

**Status:** accepted 2026-09-27, **the human's decision** ("Devnet only"). On 2026-09-30 the human asked for a
final test with a live Phantom wallet and real money: [ADR-008](ADR-008-mainnet-canary.md) **proposes** a capped,
human-run mainnet canary that would supersede the "devnet only" line in part. Until the human accepts ADR-008, this
ADR stands whole. Its other decisions (no pay-to-attack fees, no public challenge, no real-funds key in this tree)
stand either way.

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
