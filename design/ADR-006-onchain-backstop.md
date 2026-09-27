# ADR-006 · Compose with Squads v4 spending limits; keep Solanaut's own program tiny

**Status:** accepted 2026-09-27. **The human's choice**, from three options put to them: compose plus
a tiny program (chosen), Solanaut's own Anchor vault as the setup plan had it, or compose only.
It **supersedes ADR-001, point 4** ("On-chain enforcement (H3) repeats the policy in the vault
program").

## Context

- **The goal.** The setup plan's H3 was `programs/solanaut_vault`: Solanaut's own Anchor program
  enforcing caps and an allowlist, so a stolen agent key is bounded too.
- **Audited on-chain caps already exist:**
  - **Squads v4 spending limits:** one mint per period, named members, optional destinations
    ([docs](../kb/sources/2026-09-27_squads-spending-limit.md)).
  - **Swig:** roles, session keys, withdrawal and time limits; AGPL-3.0; audited by Accretion
    ([source](../kb/sources/2026-09-27_swig-wallet.md)).
  - **The Foundation's recurring delegation:** SPL tokens only, with no destination allowlist
    ([docs](../kb/sources/2026-09-27_solana-recurring-delegation.md)).
- **Both main candidates are on devnet.** The Squads v4 program is deployed and executable there
  (checked 2026-09-27).
- **The judges reward composition.** Colosseum judges "open source and composability" (rules §8), and
  its World's Fair resources list Swig for permissioned accounts.
- **The time is short.** H3 has three days. Re-implementing an audited cap as unaudited code spends
  them on the weaker version.

## Decision

1. **H3 composes with a Squads v4 spending limit on devnet.**
   - The operator owns the multisig.
   - The agent's key is a member without vote or execute permission, named on one limit: SOL or a
     devnet USDC, N per day, destinations set to the policy's allowed owners.
   - The alternative is to fund the agent's hot wallet through the limit and guard the hot wallet in
     the SDK.
   - A half-day spike chooses between them, and confirms the program ID and member permissions
     against Squads' docs.
2. **Swig is the fallback** if the spike fails. Calling an AGPL program on-chain imposes nothing, but
   its licence is checked before any of its SDK code is linked into Solanaut.
3. **The Foundation's recurring delegation is not used:** it has no destination allowlist and no SOL.
4. **`solanaut_anchor` (P2)** is Solanaut's own program: one instruction, `anchor(head, seq)`, which
   writes the decision log's head hash to a PDA and emits `DecisionAnchored`. It is small enough to
   test fully in LiteSVM, and **it is cut first** if H3 runs late.

## Consequences

- **The on-chain guarantee is Squads', and is described as Squads'** (`docs/CLAIMS.md` M9).
  Solanaut's claim is the composition: the same policy, enforced in the SDK and bounded on-chain.
- **More of the demo is Solana:** a multisig, a spending limit, a stolen-key script refused by the
  program.
- **Less original on-chain code** than a full vault. `solanaut_anchor` is the part Solanaut owns.
- **Every descriptive document follows ADR-006:** `docs/ARCHITECTURE.md`, `docs/SPEC.md` §9 and the
  papers.

## Would show this was wrong

- The spike finds that Squads v4 members cannot use a spending limit without permissions that would
  also let them vote or execute. Then take Swig, or fund the hot wallet (option 1b).
- Squads v4 is not available on devnet in a usable form.
