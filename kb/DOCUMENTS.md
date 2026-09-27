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
| [README.md](../README.md) | 2 | current | integrator | everyone | 2026-09-27 | H1 |
| [docs/OVERVIEW.md](../docs/OVERVIEW.md) | Draft 1 | draft | integrator | engineers new to the repo, judges | 2026-09-27 | H1 |
| [docs/SPEC.md](../docs/SPEC.md) | Draft 1 | draft | architect | the builder, evaluator and integrator seats | 2026-09-27 | H1 |
| [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | 2 | current | architect | everyone | 2026-09-27 | H1 |
| [docs/HACKATHON.md](../docs/HACKATHON.md) | 2 | current | archivist | the human, every seat | 2026-09-27 | H1 |
| [docs/CLAIMS.md](../docs/CLAIMS.md) | 2 | current (T3) | archivist, sourced | every public sentence | 2026-09-27 | every milestone |
| [docs/papers/LITEPAPER.md](../docs/papers/LITEPAPER.md) | Draft 1 | draft | architect | judges, developers | 2026-09-27 | H4 |
| [docs/papers/THREAT-MODEL.md](../docs/papers/THREAT-MODEL.md) | Draft 1 | draft | architect, evaluator | reviewers, auditors, judges | 2026-09-27 | H1, H3 |
| [docs/papers/MARKET.md](../docs/papers/MARKET.md) | Draft 1 | draft | archivist | the human, judges | 2026-09-27 | H4 |
| [docs/papers/BUSINESS-PLAN.md](../docs/papers/BUSINESS-PLAN.md) | Draft 1 | review | drafted for the human | the human, judges | 2026-09-27 | before H5 |
| [docs/submission/PITCH.md](../docs/submission/PITCH.md) | Draft 2 | draft | the human (T4) | judges | 2026-09-27 | H4 |
| [docs/submission/DEMO.md](../docs/submission/DEMO.md) | Draft 1 | draft | integrator | judges | 2026-09-27 | H4 |
| [docs/submission/SUBMISSION.md](../docs/submission/SUBMISSION.md) | Draft 1 | review | the human (T4) | the human | 2026-09-27 | H5 |

**Records are not in this register:** the ADRs (`design/`, each with its own status line), run records
(`runs/`), plans (`docs/plans/`) and receipts (`evals/`). A record is kept as written, never revised.

## Changes

| Date | Documents | What changed | Record |
|---|---|---|---|
| 2026-09-27 | all | Register created. OVERVIEW, SPEC, the four papers and the three submission drafts written; README, ARCHITECTURE, HACKATHON and CLAIMS revised to version 2 | `runs/2026-09-27-research-foundation.md` |
| 2026-09-27 | PITCH | Draft 2: the written pitch in four paragraphs (what, why, how, results), traced to CLAIMS rows; the script's M8 line scoped to bots | `runs/2026-09-27-written-pitch.md` |
