---
type: milestone-review
milestone: "R"
status: current
period: "2026-09-27 to 2026-09-27"
commits: "fcf0ab9..(this milestone's tag)"
created: 2026-09-27
updated: 2026-09-27
---

# Milestone R · The research foundation

> Written with [workflows/milestone_review.md](../../workflows/milestone_review.md) at the milestone's
> close. The session that made it is
> [runs/2026-09-27-research-foundation.md](../../runs/2026-09-27-research-foundation.md).

**Milestone:** R · Research. The human asked for it before any development. "Done when":
- research on Gubernaut's governor architecture and on Solana DeFAI;
- a structured overview of the codebase;
- MVP recommendations;
- draft-1 papers, and the existing documents updated;
- an Obsidian vault, with a template and workflow for closing milestones.

**Tag:** `milestone/R`

## 1. Outcome

**Met, with two debts to the human** (section 9).

- The research is compiled into `kb/`: 31 sources and 9 topic pages.
- The overview and the spec are written: [docs/OVERVIEW.md](../../docs/OVERVIEW.md) and
  [docs/SPEC.md](../../docs/SPEC.md).
- The four papers and three submission drafts exist, all registered.
- The vault runs, and this review is its milestone workflow's second use.

## 2. Delivered

| What | Where | Evidence |
|---|---|---|
| The vault: the root as an Obsidian vault; index, log, registers, 8 templates | `.obsidian/`, [kb/INDEX.md](../INDEX.md), [kb/LOG.md](../LOG.md), [kb/DOCUMENTS.md](../DOCUMENTS.md), `kb/templates/` | [ADR-007](../../design/ADR-007-knowledge-vault.md) |
| Knowledge workflows | [workflows/knowledge.md](../../workflows/knowledge.md), [workflows/milestone_review.md](../../workflows/milestone_review.md); `/compile`, `/milestone` | — |
| Research | 31 source notes (30 re-read first-hand); topics: [DeFAI](../wiki/defai/_index.md), [incidents](../wiki/defai/incidents.md), [competitors](../wiki/competitors/_index.md), [Gubernaut](../wiki/gubernaut/_index.md), [Solana](../wiki/solana/_index.md), [security](../wiki/security/_index.md), [the admission pattern](../wiki/security/admission-pattern.md), [glossary](../wiki/glossary.md) | [kb/INDEX.md](../INDEX.md) |
| The MVP baseline | [docs/SPEC.md](../../docs/SPEC.md): data models, rules 0–17, receipts, intents, the log, adapters, the Squads backstop, batteries, defects D1–D9 | — |
| Decisions | [ADR-004](../../design/ADR-004-admission-and-receipts.md), [ADR-005](../../design/ADR-005-transaction-coverage.md), [ADR-006](../../design/ADR-006-onchain-backstop.md), [ADR-007](../../design/ADR-007-knowledge-vault.md) | — |
| Papers, draft 1 | [LITEPAPER](../../docs/papers/LITEPAPER.md), [THREAT-MODEL](../../docs/papers/THREAT-MODEL.md), [MARKET](../../docs/papers/MARKET.md), [BUSINESS-PLAN](../../docs/papers/BUSINESS-PLAN.md) | [the register](../DOCUMENTS.md) |
| Submission, draft 1 | [PITCH](../../docs/submission/PITCH.md), [DEMO](../../docs/submission/DEMO.md), [SUBMISSION](../../docs/submission/SUBMISSION.md) | — |
| Documents updated | README, CLAUDE.md, ARCHITECTURE, HACKATHON, CLAIMS, TOOLCHAIN, REGISTRY, the office's stale instructions | the run record, "Changed" |
| A new gate | [tools/kb_lint.py](../../tools/kb_lint.py), in `tools/session_close.py` | [its receipt](../../evals/harness/kb_lint.md) |

## 3. Measured

| Measurement | Value | Version · config · run | Regenerate |
|---|---|---|---|
| Sources | 31 notes: 30 first-hand, 1 via-agent. Several first-hand notes carry a via-agent caveat, marked in their text | 2026-09-27 | `grep -l "checked: first-hand" kb/sources/*.md \| wc -l` |
| The vault's lint | green (section 11) | `tools/kb_lint.py`, 2026-09-27 | `uv run --script tools/kb_lint.py` |
| The guard | unchanged: 9/9 tests, typecheck clean; no product code changed | Keel 1.0.1, sensor v0 | `npm test`, `npm run typecheck` |

Nothing about the guard was newly measured. This milestone was research.

## 4. Decisions

| Decision | ADR | New, changed or superseded |
|---|---|---|
| Propose → admit → sign; receipts; intents; the latch; the log | ADR-004 | new, refining ADR-001 |
| Decode bytes: legacy and v0; System, SPL, Token-2022, fees; deny the rest | ADR-005 | new |
| Compose with Squads v4 spending limits; keep the own program tiny (**the human's choice**) | ADR-006 | new; **supersedes ADR-001, point 4** |
| The repository is an Obsidian vault, on the Karpathy pattern | ADR-007 | new |
| Confidential findings: public-safe in git, detail in `kb/private/` (**the human's choice**) | ADR-007, `CLAUDE.md` | new |
| The business plan sets out both paths and recommends one (**the human's choice**) | `docs/papers/BUSINESS-PLAN.md` | new |

## 5. What failed or surprised

- **Keel's digest is a constant.** Keel 1.0.1 never hashes its controller on load, whatever its README
  says. So Solanaut's claim that "an unverified Keel binary is refused" was overstated, and S4 is
  narrowed. Upstream finding U-1.
- **AIXBT was not a prompt injection.** Its maintainer says so. The research agent's summary had
  framed it as one, and the first-hand read corrected it (M2).
- **Two disclosure errors were in the draft.** `@gubernaut/core` was published on 2026-08-07, not in
  July. The office tooling is adapted from earlier private work, so "everything written during the
  contest" was untrue. Both are corrected in `docs/submission/SUBMISSION.md`.
- **Caps and allowlists are table stakes.** Signing services and on-chain programs already sell them.
  The pitch now leads with loop and double-send control.
- **The plan file was blocked by Solanaut's own guard.** Plan mode writes to `~/.claude/plans/`, which
  the guard denies, so the plan was delivered in chat. The fix, `plansDirectory`, is in the settings
  schema, but the edit to `.claude/settings.json` was refused by the permission classifier as
  self-modification. It is the human's to make.
- **`kb_lint.py`'s first run failed on itself.** git quotes non-ASCII paths, so the drop's `×` file
  dodged the exemption. The tool failed loudly, as designed, and was fixed.
- **Some things could not be verified.** Swig's program ID; the full text of the Anderson report (NIST's
  definition is cited instead); v1's rollout date.
- **One batch of reads was denied.** In the private research, a directory listing that included the
  workspace's git metadata and a personal-reports folder was refused by the permission classifier. It
  was not retried by any other route.

## 6. Knowledge compiled

- **Sources added:** 31, all listed in [kb/INDEX.md](../INDEX.md).
- **Topic pages created:** 9, including 2 entities and the glossary.
- **Private notes:** one, in `kb/private/`, untracked. Its public-safe distillation is
  [the admission pattern](../wiki/security/admission-pattern.md).

## 7. Claims

| `docs/CLAIMS.md` row | Added, changed or retired | Source |
|---|---|---|
| All rows | IDs added | — |
| S2 | the D1 caveat added | `docs/SPEC.md` §10 |
| S4 | **narrowed**: the declared digest, not the bytes | [npm source](../sources/2026-09-27_npm-gubernaut-core.md) |
| G2, G4 | scope sharpened | [LIMITS](../sources/2026-09-27_gubernaut-limits.md) |
| G6 | **corrected** dates | [releases](../sources/2026-09-27_gubernaut-releases.md) |
| G7, G8 | added | [receipts](../sources/2026-09-27_gubernaut-onchain-receipts.md), [LIMITS](../sources/2026-09-27_gubernaut-limits.md) |
| M1–M9 (§5) | added | the incident and Squads sources |
| §4 words | "the first", "prevents", "would have prevented" added | — |

## 8. Documents reviewed

| Document | Version before → after | What changed |
|---|---|---|
| README, ARCHITECTURE, HACKATHON, CLAIMS | 1 → 2 | the research folded in; see [the register](../DOCUMENTS.md) |
| OVERVIEW, SPEC, the 4 papers, the 3 submission drafts | — → Draft 1 | created |

## 9. Risks and debts

- **Owed to the human:**
  - add `"plansDirectory": "./docs/plans"` to `.claude/settings.json`;
  - choose a licence;
  - repository access for the judges;
  - the Colosseum fields, videos and submission;
  - run Colosseum Copilot against Sudont, AgentVeins and BlockHelix;
  - sign off this review and the business plan.
- **Owed upstream:** findings U-1 to U-4 ([kb/REGISTRY.md](../REGISTRY.md)). U-2 and U-3 are to be
  reproduced in H1's first evals.
- **Accepted:** `kb/private/` exists on this disk only.
- **Risk:** H1 is now the largest phase (`docs/HACKATHON.md`, "Risks to the delivery").

## 10. Next milestone

**H1 starts with defects D1–D9, each test-first,** then builds the guard v1 exactly as `docs/SPEC.md`
states it. The loop and benign batteries report their rates, and no rate is assumed.

Approving this section is the human's.

## 11. Lint

- `uv run --script tools/kb_lint.py`, at close:

  ```
  117 markdown files, 49 kb notes; 0 error(s), 0 warning(s)
  PASS — every link resolves, every note is sourced and reachable
  ```

  The gate was first shown failing on ten injected faults ([receipt](../../evals/harness/kb_lint.md)).
- **Also found at close:** four log entries carried estimated times later than the fact. They are
  corrected by a `fix` entry, per the append-only rule.
- **Found by reading:**
  - `kb/intake/2026-09-27_dashy-drop.md` was linked from nowhere; the index now links it.
  - The office's instructions cited a "project-context block" Solanaut does not have; corrected.
  - `kb/GAPS.md` citations do not resolve; now explained in `plugins/VENDORED.md`.

## 12. Sign-off

- [ ] The human has read this review and agrees with section 10.
