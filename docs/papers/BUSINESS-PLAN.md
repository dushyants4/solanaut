# BUSINESS-PLAN.md — two paths for Solanaut, and a recommendation

> **Draft 1** · 2026-09-27 · owner: drafted by the architect **for the human, whose decision it is**
> (the entity, the licence and the funding are T4) · for: the human, and judges (rules §8 score a
> business plan) · not public. Figures cite `docs/CLAIMS.md` or `kb/sources/`. **Every price, target
> and threshold below is a hypothesis, not a measurement.** Register: `kb/DOCUMENTS.md`.

## Summary

Solanaut can grow as an **open-core company** (Path A) or as **public-good infrastructure** (Path B).

**Recommendation: Path B now, with Path A kept open behind three explicit triggers** (§4).

The evidence against leading with a company is threefold:
- caps and allowlists are already sold by Stripe's, Coinbase's and Turnkey's wallets;
- real agent payment volume is contested;
- AI is Colosseum's most crowded category.

The evidence for the public good is that the open-source, composable version is what the judging
rewards, and what can be adopted fastest.

## 1. The customer and the problem

| Who | What they lose today | What they would adopt |
|---|---|---|
| Teams running trading or treasury agents | funds, to authority the model should not have had, or to lost state [M1, M2, M4] | a policy and caps in one line; an on-chain bound |
| Agent platforms and launchpads | reputation, when an agent they host is drained [M5] | a default guard for every agent they host |
| Framework maintainers (ElizaOS, Solana Agent Kit) | users' trust | a guard to ship in their Solana plugins |
| Wallet infrastructure providers | nothing yet: loop and fee control is a feature gap | a component or a licence |

## 2. Path A: an open-core company

- **Free:** the SDK, the adapters and the Squads composition, all open source.
- **Paid** (hypothesis):
  - a hosted control plane for teams running many agents: policy management with review and roll-back,
    a fleet cockpit, alerts on denials and latches, and retained, exportable decision logs;
  - incident replay, and support.
- **Pricing** (hypothesis, unvalidated): per agent per month, with a free tier covering one agent.
- **Go to market:** framework integrations first; then agent platforms; then wallet providers as
  partners.
- **Funding:** the Colosseum accelerator, "$250,000 pre-seed funding" for accepted teams
  ([World's Fair](../../kb/sources/2026-09-27_colosseum-worldsfair.md)). The terms are not sourced.
- **Risks:**
  - platform risk: the wallet providers add loop control themselves;
  - a small, contested market;
  - a crowded category;
  - selling security to teams that have not yet lost money.

## 3. Path B: public-good infrastructure

- **Everything open**, under a permissive licence. The human chooses it; Apache-2.0 would match
  Gubernaut's.
- **Value:** a standard, audited-by-many way for any Solana agent to sign safely, composed with Squads
  and adopted inside the frameworks.
- **Funding:** the Public Good prize ($5,000), and ecosystem grants (not researched yet; no amounts
  stated). If adoption follows, maintenance can be sponsored.
- **Success, measured:** external integrations, downloads, and issues filed by users not on the team.
- **Risks:** sustaining maintenance, and no revenue.

## 4. The recommendation, and when to revisit it

Ship Path B through the hackathon and the following quarter. Revisit Path A when any one of these
happens (thresholds are hypotheses for the human to set):

1. **Adoption.** At least three teams outside the project run Solanaut in front of real funds.
2. **Demand.** A wallet provider or agent platform asks to license, host or embed the loop control.
3. **Invitation.** The Colosseum accelerator invites an interview.

## 5. Against Colosseum's criteria

| Criterion (rules §8; FAQ factors) | How Solanaut answers it | Evidence |
|---|---|---|
| Functionality and code quality | a small, deterministic guard; every gate shown failing first | `evals/`, `docs/SPEC.md` |
| Potential impact | every agent that signs on Solana | `docs/papers/MARKET.md` |
| Novelty | loop and double-send control at the signing layer | MARKET §4, which is an inference, not a claim |
| UX | one-line adoption; a denial that names its rule | `docs/SPEC.md` §8 |
| Open source and composability | Squads composition; framework adapters | ADR-006 |
| Business plan | this document | — |
| Founder–market fit, communication, traction | the human's to state | — |

## 6. What this plan does not decide

The entity, the licence, any fundraising, and whether to apply to the accelerator. All are the
human's.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft: both paths, one recommendation, as the human asked. |
