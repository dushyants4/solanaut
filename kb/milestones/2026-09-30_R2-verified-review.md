---
type: milestone-review
milestone: "R2"
status: current
period: "2026-09-30 to 2026-09-30"
commits: "0b76e5a..(this milestone's tag)"
created: 2026-09-30
updated: 2026-09-30
---

# Milestone R2 · The verified review, and a roadmap by achievement

> Written with [workflows/milestone_review.md](../../workflows/milestone_review.md) at the milestone's close. The
> session that made it is [runs/2026-09-30-verified-review-roadmap.md](../../runs/2026-09-30-verified-review-roadmap.md).

**Milestone:** R2 · Verified review and roadmap. "Done when": the docs are fact-checked against current primary
sources; the design is reviewed adversarially and the findings verified; every document is updated, `CLAUDE.md`
included; a five-leg roadmap and a readiness-and-certification plan exist, with measurable gates, written as
achievement-based milestones.
**Run records:** [runs/2026-09-30-verified-review-roadmap.md](../../runs/2026-09-30-verified-review-roadmap.md) ·
**Tag:** `milestone/R2`

## 1. Outcome

**Met, with a change of method and one debt to the human** (section 9). The planned wide research workflow was lost
to the session limit, so the fact-check ran as about 30 direct reads of primary sources, and the adversarial review
as 26 findings checked by two independent refuters. Every document now follows `docs/SPEC.md` Draft 2, and the
roadmap is milestones, not dates, as the human asked mid-session.

## 2. Delivered

| What | Where | Evidence |
|---|---|---|
| The product definition, for Leg 1 | [docs/PRODUCT.md](../../docs/PRODUCT.md) | awaiting the human's sign-off |
| The parlay, by achievement | [docs/ROADMAP.md](../../docs/ROADMAP.md) | every milestone states its criteria, dependencies and evidence |
| The readiness and certification plan | [docs/READINESS.md](../../docs/READINESS.md) | stages R.1 to R.5, QA thresholds, performance targets, standards, operations |
| The MVP baseline, Draft 2 | [docs/SPEC.md](../../docs/SPEC.md) | rules 0 to 19; defects D1 to D12; the Beta gate |
| Decisions | [ADR-008](../../design/ADR-008-mainnet-canary.md) (proposed), [ADR-009](../../design/ADR-009-trust-and-coverage.md), [ADR-010](../../design/ADR-010-log-is-state.md), [ADR-011](../../design/ADR-011-phantom-roles-and-dashboard.md) | — |
| The threat model, Draft 2 | [docs/papers/THREAT-MODEL.md](../../docs/papers/THREAT-MODEL.md) | adversaries A8 and A9; threats T19 to T30 |
| Knowledge | 22 source notes; [Phantom](../wiki/competitors/phantom.md) and [readiness standards](../wiki/security/readiness-standards.md) pages; five pages updated | [kb/INDEX.md](../INDEX.md) |

## 3. Measured

| Measurement | Value | Version · config · run | Regenerate |
|---|---|---|---|
| The guard | unchanged: 9/9 tests, typecheck clean | Keel 1.0.1, sensor v0; no product code changed | `npm test`, `npm run typecheck` |
| The write boundary | 34/34 | `tools/boundary_guard.py`, 2026-09-30 | `uv run --script tools/boundary_guard.py --selftest` |
| The vault's lint | green (section 11) | `tools/kb_lint.py`, 2026-09-30 | `uv run --script tools/kb_lint.py` |
| The adversarial review | 26 findings; every one survived at least one of two refuters | two verifier agents, one on the repository's evidence, one on Solana's behaviour | the run record, "Did" |

Nothing about the guard was newly measured. This milestone was a review.

## 4. Decisions

| Decision | ADR | New, changed or superseded |
|---|---|---|
| A capped, human-run mainnet canary with a Phantom operator wallet | ADR-008 | **proposed**; would supersede ADR-003's "devnet only" line in part, and only if the human accepts it |
| The guard trusts only what it derives or verifies: trust per mode, pinned tables, v1 decoded, an allowlist per instruction, nonce and other-signer denials, the fee rule, intents keyed by effects | ADR-009 | new; supersedes ADR-005 points 2 and 3 and one consequence |
| The log is the guard's state, restored by replay; one writer per identity | ADR-010 | new; completes ADR-004 point 8 |
| Phantom's roles, and a dashboard with no keys | ADR-011 | new |
| The agent's key is named on the Squads limit only, never a multisig member | ADR-006, status line | changed: the open question is answered |
| Roadmaps are achievement-based milestones, never dates (**the human's instruction**) | `docs/ROADMAP.md` | new |

## 5. What failed or surprised

- **The research workflow was lost.** 24 agents hit the account's session limit mid-flight; none finished, so nothing
  was cached. Wide fan-outs are now a known risk here.
- **v1 went live in the middle of the hackathon.** The spec treated it as future work, and ADR-005's own reversal
  condition had already been met.
- **The Squads risk was never real.** Squads v4 checks only the limit's member list, so the plan's top on-chain risk
  dissolved, and the design gained least privilege.
- **Draft 1 had holes a reader could exploit:** durable nonces, trusted caller inputs, unlisted instructions, a fee of
  0 for a price without a limit, and a guard that forgets on restart. None was built yet, so none cost anything.
- **A near twin exists.** coldstar-agent-signer documents much of the adapter design. Only loop, fee-escalation and
  double-send control remain distinct.
- **The boundary guard's heuristic blocked a legitimate write.** `member.key()` looked like a key file. It failed
  closed, as designed.
- **The plan's first version used dates.** The human's follow-up replaced them.

## 6. Knowledge compiled

- **Sources added:** 22, dated 2026-09-30, listed in [kb/INDEX.md](../INDEX.md); 3 are `via-agent`.
- **Topic pages created:** [Phantom](../wiki/competitors/phantom.md), [readiness standards](../wiki/security/readiness-standards.md).
- **Topic pages changed:** [Solana transactions](../wiki/solana/_index.md), [competitors](../wiki/competitors/_index.md),
  [Squads](../wiki/competitors/squads.md), [security](../wiki/security/_index.md), [the glossary](../wiki/glossary.md).
- **Answers filed back:** the verified findings, as `docs/SPEC.md` Draft 2 and ADR-009 to ADR-011.

## 7. Claims

| `docs/CLAIMS.md` row | Added, changed or retired | Source |
|---|---|---|
| M9 | **changed**: limit members need not be multisig members; empty destinations allow any address | [spending_limit_use.rs](../sources/2026-09-30_squads-v4-spending-limit-use.md), [multisig_add_spending_limit.rs](../sources/2026-09-30_squads-v4-add-spending-limit.md) |
| M10 | added: v1 transactions, live on mainnet since 2026-09-15 | [solana.com](../sources/2026-09-30_solana-upgrades-larger-transactions.md) |
| M11 | added: Phantom may append Lighthouse assertions | [Phantom's docs](../sources/2026-09-30_phantom-lighthouse.md) |
| S5 | a note: the canary is proposed, and S5 stays true until it runs | ADR-008 |
| §1 not yet claimable | extended: caps are not new; v1, pinning, restore; mainnet; production-ready, audited, certified | — |
| §4 words | production-ready, mainnet-ready, audited, certified, each until true | — |

## 8. Documents reviewed

| Document | Version before → after | What changed |
|---|---|---|
| SPEC | Draft 1 → Draft 2 | the verified findings |
| THREAT-MODEL | Draft 1 → Draft 2 | A8, A9, T19 to T30, corrections |
| ARCHITECTURE, README, HACKATHON, CLAIMS | 2 → 3 | the new design; milestones; sourced rows |
| OVERVIEW, LITEPAPER, MARKET, BUSINESS-PLAN, DEMO, SUBMISSION | Draft 1 → Draft 2 | D10 to D12; the roadmap; competitors; hosted-service needs; scenes; the integration answer |
| PITCH | Draft 2 → Draft 3 | the *How* list; two rules |
| PRODUCT, ROADMAP, READINESS | — → Draft 1 | created |

## 9. Risks and debts

- **Owed to the human:**
  - sign off `docs/PRODUCT.md` (milestone 1.1) and this review;
  - decide ADR-008, and whether a legal review comes first;
  - `.claude/settings.json`: add `"plansDirectory": "./docs/plans"`; if ADR-008 is accepted, a read-deny for the canary
    key's folder;
  - a licence; repository access for the judges; the Colosseum fields, videos and submission; a Copilot check.
- **Owed upstream:** findings U-1 to U-4, unchanged ([kb/REGISTRY.md](../REGISTRY.md)).
- **Open risks:**
  - the Beta is large, and the contest window may close before all of it is achieved; the build order decides what
    shows (`docs/ROADMAP.md`);
  - three facts are `via-agent`, and must be re-read before any public use.

## 10. Next milestone

**Milestone 1.1: the human signs off `docs/PRODUCT.md`.** Then Leg 2 in its build order: 2a.1, the safety net, and
2a.2, the byte decoder, first. The evidence for that order is in `docs/ROADMAP.md`.

Approving this section is the human's.

## 11. Lint

- `uv run --script tools/kb_lint.py`, at close:

  ```
  151 markdown files, 74 kb notes; 0 error(s), 0 warning(s)
  PASS — every link resolves, every note is sourced and reachable
  ```

- **Found by reading:** the competitor page said on-chain caps "are audited", but only Swig's audit is sourced. It
  now says so.

## 12. Sign-off

- [ ] The human has read this review and agrees with section 10.
