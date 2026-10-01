# ADR-008 · A capped, human-run mainnet canary with a Phantom wallet

**Status:** **proposed** 2026-09-30, for the human's decision; **deferred** by the human the same day: devnet only
for now. Leg 4's live Phantom test runs first on devnet, with the human's Phantom wallet in its Chrome extension as
the operator, after the Alpha is ready (milestone 3.10). The human offered to set up a dedicated account then, if that
suits the test better. Real funds wait until the human takes this ADR up again at milestone 4.1
(`runs/2026-10-01-beta-build.md`).

If accepted, it supersedes [ADR-003](ADR-003-devnet-only.md) **in part**: the "devnet only" line gives way to this
one canary. Everything else in ADR-003 stands: no pay-to-attack fees, no public challenge, and no key that holds real
funds in this tree. Until the human accepts it, Solanaut stays devnet-only.

## Context

- **The request.** On 2026-09-30 the human asked for a final test "with live Phantom wallet and real money", some of
  it recorded, as Leg 4 of the roadmap ([docs/ROADMAP.md](../docs/ROADMAP.md)).
- **ADR-003's conditions.** It put mainnet and real funds after "an adversarial test campaign and legal review".
- **What makes a small canary safe to reason about.** Squads v4 bounds what an agent key can move, per mint and
  period, to listed destinations, and it checks only the spending limit's own member list
  ([source](../kb/sources/2026-09-30_squads-v4-spending-limit-use.md)). Limit members are not tied to multisig
  membership ([source](../kb/sources/2026-09-30_squads-v4-add-spending-limit.md)).
- **What Phantom offers.** Phantom may append Lighthouse assertion instructions to transactions it submits
  ([source](../kb/sources/2026-09-30_phantom-lighthouse.md)). Its MCP server gives an agent a wallet whose keys stay in
  Phantom's key service, and supports mainnet, devnet and testnet
  ([source](../kb/sources/2026-09-30_phantom-mcp-server.md)).

## Decision (proposed)

1. **One canary, gated.** It runs only after the Leg 3 gate ([docs/ROADMAP.md](../docs/ROADMAP.md), milestone 3.10)
   and two clean devnet rehearsals of the exact runbook (milestone 4.2).
2. **The human runs every real-funds step (T4):** creating and funding the accounts, creating and revoking the
   spending limit, running the scenarios, recording. Agents prepare commands and never run them.
3. **Roles.**
   - **Operator:** a fresh Phantom account of the human's. It is the config authority of a controlled Squads v4
     multisig, releases the latch by signing a message, and signs the policy hash.
   - **Agent:** a key the human creates with `solana-keygen` **outside this tree**, named only on the spending
     limit and never a multisig member. It holds a small fee float and nothing else.
   - **Optional second track:** Phantom's MCP agent wallet behind Solanaut's MCP firewall
     ([ADR-011](ADR-011-phantom-roles-and-dashboard.md)), funded only through the spending limit.
4. **Caps, defaults the human sets or changes:**

   | Item | Default |
   |---|---|
   | vault | at most 0.25 SOL and 10 USDC |
   | spending limits | 0.02 SOL and 2 USDC per day |
   | destinations | two named addresses: the human's own second account and one test address |
   | agent fee float | at most 0.02 SOL |

5. **Pre-flight (milestone 4.3):** re-verify the Squads v4 and Lighthouse program ids; check Alpenglow's status and
   the commitment the intent logic uses; name at least two RPC providers; set the caps; time the revoke drill;
   set up the recording so no seed phrase or private key can appear on screen.
6. **Abort criteria:** any lamport that does not reconcile, any guard error other than a fail-closed denial, or an
   unstable RPC. Then stop, revoke the limit and sweep the funds.
7. **Exit (milestones 4.4 and 4.5):** every scenario gives its expected verdict and on-chain result, every lamport
   reconciles, the recordings are archived, a canary report is in `runs/`, `docs/CLAIMS.md` gains rows scoped to
   the canary's amounts, date and versions, the limit is revoked, the funds swept and the agent key deleted.
8. **ADR-003's conditions.** Leg 3's red team is the adversarial test campaign. Whether a private test with the
   human's own funds needs a legal review is the human's decision, recorded here when made.

## Consequences

- `CLAUDE.md`'s identity table says devnet by default, with this canary as the only proposed exception.
- The T4 row already covers mainnet and real funds; it does not change.
- Nothing about mainnet is claimed until the canary report exists (`docs/CLAIMS.md` §1).
- The controlled multisig's config authority is a single point of control. It can add a limit to any destination.
  That is accepted for the canary and stated; an autonomous multisig is the slower-to-revoke alternative.

## Would show this was wrong

- The Leg 3 gate is not met, or a devnet rehearsal fails: the canary waits.
- The human declines, or chooses a legal review first: the canary waits for it.
- A scenario on mainnet behaves differently from its devnet rehearsal: stop, and record why before any retry.
