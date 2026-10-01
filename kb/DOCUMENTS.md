# DOCUMENTS.md — the document register

Every public document and paper Solanaut keeps, with its version, status, owner and next review. They
are updated over time, and this is how. `workflows/milestone_review.md` step 4 reviews each row at
every milestone, and `tools/kb_lint.py` fails if a document in `docs/`, `docs/papers/` or
`docs/submission/` is missing from this table, or if a row names a file that does not exist.

**Status:** `draft` (being written) → `review` (waiting for the human) → `current` (approved) →
`superseded` (kept, pointing at its replacement).
**Versions:** Draft 1, Draft 2… until the human approves; then 1.0, 1.1… The version moves on a
substantive change; *last reviewed* moves at every review.

| Document | Version | Status | Owner | For | Last reviewed | Next review |
|---|---|---|---|---|---|---|
| [README.md](../README.md) | 3 | current | integrator | everyone | 2026-09-30 | 2b.4 |
| [docs/PRODUCT.md](../docs/PRODUCT.md) | 1.0 | current | architect | every seat, judges | 2026-09-30 | 2c.1 |
| [docs/ROADMAP.md](../docs/ROADMAP.md) | Draft 2 | review | archivist, with the architect | the human, every seat, judges | 2026-09-30 | every leg |
| [docs/READINESS.md](../docs/READINESS.md) | Draft 1 | review | operator, with the evaluator | the human, every seat, auditors | 2026-09-30 | 2c.1 |
| [docs/OVERVIEW.md](../docs/OVERVIEW.md) | Draft 2 | draft | integrator | engineers new to the repo, judges | 2026-09-30 | 2a.5 |
| [docs/SPEC.md](../docs/SPEC.md) | Draft 2 | draft | architect | the builder, evaluator and integrator seats | 2026-09-30 | 2a.2 |
| [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | 3 | current | architect | everyone | 2026-09-30 | 2b.4 |
| [docs/HACKATHON.md](../docs/HACKATHON.md) | 3 | current | archivist | the human, every seat | 2026-09-30 | S.1 |
| [docs/CLAIMS.md](../docs/CLAIMS.md) | 3 | current (T3) | archivist, sourced | every public sentence | 2026-09-30 | every milestone |
| [docs/papers/LITEPAPER.md](../docs/papers/LITEPAPER.md) | Draft 2 | draft | architect | judges, developers | 2026-09-30 | 2b.4 |
| [docs/papers/THREAT-MODEL.md](../docs/papers/THREAT-MODEL.md) | Draft 2 | draft | architect, evaluator | reviewers, auditors, judges | 2026-09-30 | 2b.4, 3.10 |
| [docs/papers/MARKET.md](../docs/papers/MARKET.md) | Draft 2 | draft | archivist | the human, judges | 2026-09-30 | 2b.4 |
| [docs/papers/BUSINESS-PLAN.md](../docs/papers/BUSINESS-PLAN.md) | Draft 2 | review | drafted for the human | the human, judges | 2026-09-30 | S.1 |
| [docs/submission/PITCH.md](../docs/submission/PITCH.md) | Draft 3 | draft | the human (T4) | judges | 2026-09-30 | 2b.4 |
| [docs/submission/DEMO.md](../docs/submission/DEMO.md) | Draft 2 | draft | integrator | judges | 2026-09-30 | 2b.3 |
| [docs/submission/SUBMISSION.md](../docs/submission/SUBMISSION.md) | Draft 2 | review | the human (T4) | the human | 2026-09-30 | S.1 |

"Next review" names the milestone in `docs/ROADMAP.md` at which the document is reviewed next, never a date.

**Records are not in this register:** the ADRs (`design/`, each with its own status line), run records
(`runs/`), plans (`docs/plans/`) and receipts (`evals/`). A record is kept as written, never revised.

## Changes

| Date | Documents | What changed | Record |
|---|---|---|---|
| 2026-09-27 | all | Register created. OVERVIEW, SPEC, the four papers and the three submission drafts written; README, ARCHITECTURE, HACKATHON and CLAIMS revised to version 2 | `runs/2026-09-27-research-foundation.md` |
| 2026-09-27 | PITCH | Draft 2: the written pitch in four paragraphs (what, why, how, results), traced to CLAIMS rows; the script's M8 line scoped to bots | `runs/2026-09-27-written-pitch.md` |
| 2026-09-30 | all | The verified review: PRODUCT, ROADMAP and READINESS created; SPEC, OVERVIEW, THREAT-MODEL, LITEPAPER, MARKET, BUSINESS-PLAN, DEMO and SUBMISSION to their next draft; README, ARCHITECTURE, HACKATHON and CLAIMS to version 3; PITCH to Draft 3; "next review" now names milestones | `runs/2026-09-30-verified-review-roadmap.md` |
