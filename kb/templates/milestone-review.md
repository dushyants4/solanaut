---
type: milestone-review
milestone: "<id from PROGRESS.md, e.g. H1>"
status: draft
period: "<first day> to {{date}}"
commits: "<first>..<last>"
created: {{date}}
updated: {{date}}
---

# {{title}}

> Written with [workflows/milestone_review.md](../../workflows/milestone_review.md). The archivist
> writes it; the architect checks *Decisions*, the evaluator supplies *Measured*, and the human
> signs it off. Save it as `kb/milestones/YYYY-MM-DD_<id>-<slug>.md`.

**Milestone:** <name, and its "done when" exactly as `PROGRESS.md` or `docs/HACKATHON.md` states it>
**Run records:** <every `runs/` file in the period> · **Tag:** `milestone/<id>`

## 1. Outcome

<Met, partly met, or missed, against the "done when". One paragraph, linking the evidence.>

## 2. Delivered

| What | Where | Evidence |
|---|---|---|
| | | |

## 3. Measured

Every number carries its version, its config, a run ID and the command that regenerates it.

| Measurement | Value | Version · config · run | Regenerate |
|---|---|---|---|
| | | | |

## 4. Decisions

| Decision | ADR | New, changed or superseded |
|---|---|---|
| | | |

## 5. What failed or surprised

<The same size as what passed. A review that lists only successes teaches nothing.>

## 6. Knowledge compiled

- Sources added: <`kb/sources/…`>
- Topic pages created or changed: <`kb/wiki/…`>
- Answers filed back as pages: <…>

## 7. Claims

| `docs/CLAIMS.md` row | Added, changed or retired | Source |
|---|---|---|
| | | |

## 8. Documents reviewed

| Document | Version before → after | What changed |
|---|---|---|
| | | |

## 9. Risks and debts

- Open risks, each with an owner: <…>
- Owed to the human: <…>
- Owed upstream (written up, never patched): <…>

## 10. Next milestone

<What the next milestone's scope, dates or cut lines should change, and the evidence for it.>

## 11. Lint

- `uv run --script tools/kb_lint.py`: <result, pasted>
- Found by reading (contradictions, stale claims, ideas with no page): <…>

## 12. Sign-off

- [ ] The human has read this review and agrees with section 10.
