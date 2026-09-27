# workflows/milestone_review.md — close a milestone into the knowledge base

**The archivist's workflow. Run it when a milestone ends, without being asked.**

## Objective

Everything a milestone taught (what shipped, what was measured, what was decided, what failed, and
what was learned) ends up summarised, sorted and stored in `kb/`, where the next milestone and the
next session can find it without re-deriving it.

## Why this workflow exists

A run record says what one session did. A milestone spans many sessions, and what it teaches is
spread across all of them: a measurement in one record, a decision in an ADR, a failure in a third,
a fact from a web page nobody saved. Unless someone gathers it at the end, the next milestone starts
from the summary instead of the detail, and the detail was the point.

## When

- A phase in `PROGRESS.md` reaches its "done when" (0, R, H1 to H5).
- A phase is abandoned or its scope changes materially: review what it was, before it becomes what
  it is.
- The human asks for one.

## Inputs

- `PROGRESS.md` and `docs/HACKATHON.md`: the milestone's "done when"
- `runs/` since the last milestone, and `git log milestone/<previous>..HEAD`
- `evals/`: the receipts the milestone produced
- `git diff milestone/<previous>..HEAD -- docs/CLAIMS.md design/`
- `kb/DOCUMENTS.md` and `kb/LOG.md`

## Steps

### 1. Gather

List every run record, ADR, receipt and claims change in the period. Anything measured without its
provenance is a finding: record it as one, do not quietly drop it.

### 2. Write the review

Copy `kb/templates/milestone-review.md` to `kb/milestones/YYYY-MM-DD_<id>-<slug>.md` (in Obsidian:
*Templates: Insert template*). Fill every section. A section with nothing in it says so and says
why; an empty heading reads as "not checked".

**Section 5 carries the failures at the same size as the passes.**

### 3. Compile the knowledge (ingest)

For each fact the milestone produced or relied on:

- **From outside:** one note in `kb/sources/` (template `source.md`), with its URL and dates. Facts
  headed for `docs/CLAIMS.md` are re-read first-hand, and the note says `checked: first-hand`.
- **Understanding:** create or update the page in `kb/wiki/<topic>/` (template `topic.md` or
  `entity.md`). Every sentence traces to a source note or a receipt.
- **Answers worth keeping:** file them back as pages, so the next question starts from them.

### 4. Update the registers

- `kb/INDEX.md`: a new topic, a new review, a topic whose meaning changed.
- `kb/DOCUMENTS.md`: every document reviewed. Bump the version on a substantive change; always
  update *last reviewed*.
- `PROGRESS.md`: the phase row, *Measured so far*, *Open*.
- `docs/CLAIMS.md`: only through a sourced change. It is a T3 file.

### 5. Lint

```
uv run --script tools/kb_lint.py
```

Then read for what a script cannot see: contradictions between pages, claims that went stale, ideas
mentioned three times with no page of their own. Put both results in section 11 of the review.

### 6. Log it

Append to `kb/LOG.md`:

```
## [YYYY-MM-DD HH:MM] review | milestone <id> · <slug> | kb/milestones/…, <pages touched>
```

### 7. Synchronise

Run `/sync` (`plugins/archivist/commands/sync.md`), then tag the milestone and push the tag:

```
git tag milestone/<id> && git push origin milestone/<id>
```

## Outputs

- `kb/milestones/YYYY-MM-DD_<id>-<slug>.md`, committed
- `kb/sources/` and `kb/wiki/` current, `kb/INDEX.md` and `kb/DOCUMENTS.md` updated
- a `kb/LOG.md` entry, and a pushed `milestone/<id>` tag

## Edge cases

- **Nothing was measured.** Say so in section 3. "Not measured" is a result.
- **A claim in the pitch turned out wrong.** Correct `docs/CLAIMS.md` first, then every document
  citing that row, and record it in section 7.
- **Confidential material taught something.** The review states the lesson in Solanaut's own words
  with a public source, or not at all; the detail stays in `kb/private/`.

## When to stop and ask

- Section 10 would change the scope the human approved.
- Writing the review honestly would put a secret or personal data in a committed file.
