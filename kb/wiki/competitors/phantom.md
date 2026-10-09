---
type: entity
status: current
kind: product
created: 2026-09-30
updated: 2026-10-08
---

# Phantom

**Sources:**
- [the MCP server](../../sources/2026-09-30_phantom-mcp-server.md)
- [exact published signing routes](../../sources/2026-10-08_phantom-published-routes.md)
- [Lighthouse assertions](../../sources/2026-09-30_phantom-lighthouse.md)
- [domain warnings](../../sources/2026-09-30_phantom-domain-warnings.md)
- [the Lighthouse program](../../sources/2026-09-30_lighthouse-program.md)

A self-custodial wallet for Solana and other chains, with a browser extension, mobile apps, and an MCP server that
gives AI agents a wallet held in Phantom's key service.

| | |
|---|---|
| Does | signs for a user in the extension and apps; gives an agent "a new dedicated wallet" through its MCP server, whose send tool simulates first and takes raw transactions; may append Lighthouse assertions to transactions it submits |
| Does not | document spending limits a user sets for the agent wallet; say, in its docs, when assertions are appended or whether a dApp can opt out |
| Enforces where | its key service, for the agent wallet; on-chain, through Lighthouse assertions |
| On Solana | yes: mainnet, devnet and testnet for the MCP tools |
| Licence, status | proprietary; `@phantom/mcp-server` 1.2.8 on npm on 2026-09-30 |

## Relation to Solanaut

**It composes** (`design/ADR-011-phantom-roles-and-dashboard.md`):

- **The operator's wallet.** Phantom holds the operator's key: the Squads config authority, the latch release by a
  signed UTF-8 message, and, in the Alpha, the policy's signature.
- **The agent's wallet, in the Alpha.** Solanaut's MCP firewall stands in front of Phantom's MCP server. It decodes
  `send_solana_transaction`'s bytes through the guard, checks `transfer_tokens`' fields, and refuses the other tools.
  *Inference:* against a compromise under the same OS user the firewall is advisory, because Phantom's session file
  can be read.
- **Appended instructions.** The accepted Alpha requirement is to compare returned wallet bytes before sending,
  allowing only the narrow Lighthouse additions in `docs/SPEC.md` §8. Exact inspected MCP send/transfer routes
  expose results after broadcast; a compatible pre-send seam remains unqualified. See the
  [signing-seam brief](../../briefs/2026-10-08_phantom-signing-seam.md). The inspected client has a
  sign-only API, but its live support and nonbroadcast behaviour are not established; its presign callback
  runs before the signature.
- **The live test.** The human deferred ADR-008's mainnet canary. The approved mission and rehearsals remain devnet.

## Related

- [competitors](_index.md)
- [Squads v4](squads.md)
- [Solana transactions](../solana/_index.md)
