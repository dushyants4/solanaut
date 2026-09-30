# ADR-011 · Phantom's roles, and a dashboard that holds no keys

**Status:** accepted 2026-09-30 for the Beta and the Alpha, in the verified-review plan the human approved. Any use
with real funds depends on [ADR-008](ADR-008-mainnet-canary.md).

## Context

- **The request.** The human wants a live Phantom wallet in the final test, and a dashboard that is a sample of what
  an end user would see.
- **What Phantom's agent wallet is.** Its MCP server gives an agent a dedicated wallet whose keys stay in Phantom's
  key service. `send_solana_transaction` takes a base64 transaction, simulates first, and sends only when called
  again with `confirmed: true`; it supports mainnet, devnet and testnet. `transfer_tokens` takes structured fields.
  The session sits in `~/.phantom-mcp/session.json` with owner-only permissions
  ([source](../kb/sources/2026-09-30_phantom-mcp-server.md)).
- **What Phantom does to transactions.** It may append Lighthouse assertion instructions, so the on-chain transaction
  can differ from the one submitted ([source](../kb/sources/2026-09-30_phantom-lighthouse.md)).
- **What a new dApp domain sees.** Phantom warns that a new domain "has not been reviewed yet" until its review
  completes ([source](../kb/sources/2026-09-30_phantom-domain-warnings.md)).
- **Squads.** Adding a spending limit to a controlled multisig needs only its config authority
  ([source](../kb/sources/2026-09-30_squads-v4-add-spending-limit.md)).

## Decision

1. **Phantom is the operator's wallet first.**
   - It is the config authority of a controlled Squads v4 multisig: it creates and revokes the agent's spending limit.
   - It releases the latch by signing a structured UTF-8 message (`docs/SPEC.md` §7).
   - In the Alpha it signs the policy hash, and a guard loads only an operator-signed policy.
2. **The agent's key is never in Phantom's extension.** It is either a key held by the guard's signer, or, in the
   Alpha, Phantom's MCP agent wallet behind Solanaut's MCP firewall.
3. **The MCP firewall (Alpha).** It exposes only the tools the policy allows. It decodes `send_solana_transaction`'s
   bytes through the guard and checks `transfer_tokens`' fields, including its automatic token-account creation. It
   denies every other tool. The Phantom MCP server runs as a separate OS user, and the agent wallet is funded only
   through the spending limit. Against a compromise under the same OS user, the firewall is advisory, and the
   documents say so.
4. **Human escalation (Alpha).** A proposal over the agent's caps can become a request the operator co-signs in
   Phantom. The signed result must pass ADR-009's narrow Lighthouse rule before it is sent.
5. **The dashboard (`apps/cockpit`).**
   - It reads the decision log and the chain, and holds no keys.
   - Operator actions (release the latch, revoke the limit) are signed in Phantom through the Wallet Standard.
   - Every chain read passes `maxSupportedTransactionVersion: 1`, the integer.
   - It runs on localhost until a hosted domain passes an OWASP ASVS level 2 review and Phantom's domain review.
6. **The single point of control is stated.** A controlled multisig's config authority can add a limit to any
   destination. That is accepted for devnet and the canary; an autonomous multisig with config transactions is the
   alternative, with a slower revoke.

## Consequences

- The Beta can use a devnet operator key as config authority, with Phantom in devnet mode as a stretch
  (`docs/ROADMAP.md`, milestone 2a.10).
- The Alpha owes the MCP firewall, escalation, the operator-signed policy, and a Lighthouse rule for any Lighthouse
  instruction that writes memory.
- A hosted dashboard needs its domain reviewed by Phantom before any recording that uses it.

## Would show this was wrong

- Phantom's MCP server stops accepting raw transactions, or starts modifying them in ways the firewall cannot check.
- Operators need a revoke faster than a config-authority transaction allows.
