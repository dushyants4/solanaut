# kb_lint — the fault matrix, before and after

`uv run --script tools/kb_lint.py`, 2026-09-27. The gate is shown failing on injected faults before
`tools/session_close.py` trusts it.

The faults were injected into **scratch copies** of the working tree, never into the repository itself.
The copies excluded `node_modules/`, `keys/`, `.sandbox/` and every private note.

## 0. The tool's own first run was a finding

Run against the real tree, it failed on itself:

```
[FAIL]  cannot read "Docs-Dashy-Drop/Gubernaut\303\227SolanaDeFAI\303\227Colosseum.md": [Errno 2] …
```

git quotes and escapes non-ASCII paths, so the drop's `×` file matched no exemption and opened
nothing. A checker that cannot see must fail, and it did. It was fixed with `git -c core.quotePath=false
… -z`.

## 1. The clean baseline (a copy)

```
  117 markdown files, 49 kb notes; 0 error(s), 0 warning(s)
  PASS — every link resolves, every note is sourced and reachable
```

## 2. Eight faults at once, each caught for its own reason

| Fault | How it was injected |
|---|---|
| a broken link | `[a page that is gone](nowhere.md)` appended to `kb/wiki/glossary.md` |
| an orphan | `kb/wiki/orphan.md`, valid in every other way, linked from nowhere |
| provenance removed | the `fetched:` line deleted from a source note |
| a non-public source | a source note's `url` set to a `file://` URL |
| a tracked private file | `kb/private/probe-note.md`, force-added with `git add -f` |
| the private folder un-ignored | the two `kb/private` lines deleted from `.gitignore` |
| seat-table drift | the builder's model changed to `haiku` in `CLAUDE.md` |
| an unregistered document | `docs/papers/UNREGISTERED.md` created |

```
  [FAIL]  kb/wiki/glossary.md: broken link → nowhere.md
  [FAIL]  kb/sources/2026-09-27_solana-docs-fees.md: url is not a public http(s) URL
  [FAIL]  kb/sources/2026-09-27_the-block-freysa.md: frontmatter lacks fetched
  [FAIL]  kb/wiki/orphan.md: orphan: no other note links to it
  [FAIL]  kb/DOCUMENTS.md: docs/papers/UNREGISTERED.md exists but is not registered
  [FAIL]  kb/private/probe-note.md: tracked by git, but kb/private/ must stay on this disk
  [FAIL]  kb/private/ is not gitignored: a confidential note could be committed
  [FAIL]  CLAUDE.md: seat builder model is 'haiku'; scaffold.py says 'sonnet'
  120 markdown files, 51 kb notes; 8 error(s), 0 warning(s)
  FAIL — fix the vault, never this list.        exit=1
```

## 3. A dangling register row, and a drop file changed after registration

`docs/submission/DEMO.md` was deleted, and a line was appended to a drop file. The deletion is an
error; the changed drop is a **warning**, because the drop is the human's and an ingest is merely owed.

```
  [FAIL]  kb/DOCUMENTS.md: broken link → ../docs/submission/DEMO.md
  [FAIL]  kb/milestones/2026-09-27_R-research.md: broken link → ../../docs/submission/DEMO.md
  [FAIL]  kb/DOCUMENTS.md: lists docs/submission/DEMO.md, which does not exist
  [WARN]  Docs-Dashy-Drop/Gubernaut Solana Colosseum Research Plan.md: not registered in kb/intake/ (sha256 009ad69edf35…); run /compile
  116 markdown files, 49 kb notes; 3 error(s), 1 warning(s)                 exit=1
```

## 4. Wired into the session close, shown biting

With one orphan note injected, `tools/session_close.py` fails its new gate 4:

```
  [FAIL]  the knowledge vault lints clean
            [FAIL]  kb/wiki/orphan.md: orphan: no other note links to it
```

The same copy also showed `boundary guard passes its fault matrix` failing at 32/34. **That is by
design, not a regression:** the guard's policy is pinned to the real repository's path
(`required_roots`), so a copy elsewhere is not its home. In the repository itself it is 34/34.

## 5. After

The real tree, with every fault absent:

```
  117 markdown files, 49 kb notes; 0 error(s), 0 warning(s)
  PASS — every link resolves, every note is sourced and reachable
```
