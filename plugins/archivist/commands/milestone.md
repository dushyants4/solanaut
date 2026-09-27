---
description: Close a milestone into the knowledge base — the review, compiled knowledge, registers, lint, log, sync and tag.
argument-hint: [milestone id and slug, e.g. H1 guard]
---

A milestone just ended: $ARGUMENTS

Run `workflows/milestone_review.md`, in order:

1. **Gather** the milestone's run records, ADRs, receipts and claims changes
   (`git log milestone/<previous>..HEAD`).
2. **Write the review** from `kb/templates/milestone-review.md` into
   `kb/milestones/YYYY-MM-DD_<id>-<slug>.md`. Every section is filled, or says why it is empty.
   **Failures at the same size as the passes.**
3. **Compile** what the milestone taught: `kb/sources/` for outside facts, `kb/wiki/` for
   understanding (`workflows/knowledge.md`).
4. **Update the registers:** `kb/INDEX.md`, `kb/DOCUMENTS.md`, `PROGRESS.md`. `docs/CLAIMS.md` changes
   only with a source.
5. **Lint:** `uv run --script tools/kb_lint.py`, then read for contradictions and stale claims.
6. **Log** the review in `kb/LOG.md`.
7. **Sync** (`/sync`), then `git tag milestone/<id>` and push the tag.

Then report: the outcome against the "done when", what failed, and section 10 (what the next
milestone should change). Scope changes are the human's to approve.
