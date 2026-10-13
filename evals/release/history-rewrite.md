# The history rewrite of 2026-10-12: what changed, and how it was checked

**Gate:** before going public, the repository's history must hold nothing from the human's private drop, and must
otherwise be the same history: the same commits, authors, dates, messages, parents and content.

## What was done

- **Archive first.** Every branch and tag, with the full original history, was pushed to a private repository the human
  owns (`solanaut-archive`), and bundled locally under `.sandbox/backups/`.
- **The rewrite.** `git filter-branch` with an index filter that drops `Docs-Dashy-Drop/` from every commit, over `main`
  and the four `milestone/*` tags. The human ran it: the auto-mode classifier refused it to Claude as a destructive git
  operation. The human then force-pushed `main` and the tags, and made the repository public.
- **The map.** [`docs/HISTORY-MAP.md`](../../docs/HISTORY-MAP.md) and, with full IDs,
  [`history-rewrite/map.tsv`](history-rewrite/map.tsv), from [`history-rewrite/check.py`](history-rewrite/check.py).

## Shown failing, then passing

`check.py` pairs the old history (`refs/original/*`, kept locally by the rewrite) with the new, in topological order.
For every pair, it checks that author, committer, dates and message are identical, that the parents correspond, and
that the trees differ only inside the removed folder. Each tag must follow its commit.

| Run | Result |
|---|---|
| planted fault `prefix`: the removed folder counted as ordinary content | **fails**: 195 problems, the first at the first commit |
| planted fault `offset`: each old commit paired with the wrong new one | **fails**: 400 problems, metadata and parents |
| the real histories | **passes**: 197 pairs. All metadata and parents are identical, and all content is identical outside the removed folder. 195 pairs differ by that folder only; 2 have identical trees, because the folder was already deleted at the top of `main`. 4 tags mapped, and no short-ID collision between old and new |

## Checked on GitHub's copy

- **A fresh mirror of the public repository** holds 197 commits, and none of them touches the removed folder.
- **None of its 9,162 objects is either drop file's blob**, and no blob contains three phrases unique to the drop.
- **A fresh single-branch clone**, which has no old object to fall back on, passes 900 of 901 tests, and the typecheck
  passes. The one failure is the known staged-baseline wait (H11). No test depends on an old commit ID.
- **Anonymous requests** get the repository, README and licence (licence detected: Apache-2.0). The removed folder
  returns 404 at the new first commit and at `main`. The repository keeps its creation date, 2026-09-27.

## Not closed

- **GitHub still serves the old commits by their IDs** (checked anonymously after publication), and the removed folder
  is visible inside them. Records written before 2026-10-12 cite those IDs. Only GitHub Support can purge unreachable
  commits and cached views; the request is the human's.
- **Records written before the rewrite cite old IDs**, including evidence files generated from the old history (Codex's
  history inventories and assertion indexes). They are kept as written. The map translates each ID, but regenerating
  that history-reading evidence needs the old objects, which live only in the private archive.
- **Three local Codex branches**, with uncommitted work in their worktrees, still descend from the old history. They
  must never be pushed (`AGENTS.md`).

## Regenerate

In a clone holding both histories, with the old `main` at `refs/original/refs/heads/main` and the old tags under
`refs/original/refs/tags/`, run `python3 evals/release/history-rewrite/check.py .` The planted faults run with
`HISTORY_MAP_FAULT=prefix` or `HISTORY_MAP_FAULT=offset` set in the environment, and write nothing.
