# 2026-10-13 · Public: the history rewrite, publication, and bridging what it left behind

## Asked

The human wanted this repository, not a fresh one, made public: its own history is the evidence of when the work was
done. "Move things into a new archive repo from here, and we make this one public." Afterwards: "plan to prepare
everything that can be corrected on GitHub. The gaps have to be bridged … make sure that the repo is up to date and
everything is good for public eyes."

## Did

1. **Archived the original history.**
   - Created the human's private `solanaut-archive` in their browser, at their request.
   - Pushed every branch and tag to it, after the human directed it explicitly; the auto-mode classifier had refused
     it once before.
   - Refreshed the local verified bundle under `.sandbox/backups/`.
2. **The rewrite was the human's.** The classifier refused it to Claude three times, as a destructive git operation:
   once on 2026-10-12, and twice again after the human's explicit instruction. Claude stopped each time, and the human
   ran the `filter-branch` and force-pushed. Claude then verified it:
   - local and GitHub refs agree: `main` is `4de85af`, and the four tags are rewritten;
   - 197 commits, none touching the drop;
   - a fresh mirror of GitHub holds neither drop blob among its 9,162 objects, and no drop phrase.
3. **Publication was the human's.** The classifier refused Claude's click on GitHub's confirmation step, so the human
   finished it. Anonymous checks then showed:
   - the repository, README and licence served, with the licence detected as Apache-2.0;
   - the removed folder returning 404 at the new first commit and at `main`;
   - the original creation date kept: 2026-09-27.
4. **Bridged the commit IDs** (`c7ba219`):
   - `docs/HISTORY-MAP.md`, plus `map.tsv` with full IDs;
   - the receipt, `evals/release/history-rewrite.md`. Its check fails on two planted faults (195 and 400 problems) and
     passes on the real histories: 197 pairs with identical metadata and parents, and content identical outside the
     removed folder.
5. **Ran everything on GitHub's copy.** A fresh single-branch clone, with no old object to fall back on, passes 900 of
   901 tests, and the typecheck passes. No test depended on an old commit ID.
6. **CI runs again, now the repository is public.** On `c7ba219`:
   - **9 of 15 jobs pass:** replay on three runtimes, differential decoding, the million-input fuzz, benign traffic,
     kill recovery, the vault and write boundary, and one fault partition;
   - **4 fail:** the Node 24 tests on the H11 wait alone (read in the job's log), two fault partitions, and the AST
     floors;
   - **2 test jobs were cancelled** at the 10-minute job limit.

   These are Codex's open findings, not effects of the rewrite.
7. **The GitHub page.** Added nine topics to the About box and hid its empty Packages panel. The description already
   read well. Checked the README renders, then switched its diagram to top-down, for legibility in GitHub's column.
8. **Closed the way back to the old history:**
   - `AGENTS.md` law 10: push only `main`, never an old branch, and port by cherry-pick or patch;
   - `.codex/rules/solanaut.rules` refuses pushing the three `codex/*` branches, and `--all`. Checked with
     `codex execpolicy check`: `git push origin main` still passes;
   - a note at the top of `docs/HANDOFF.md` §5.
9. **Recorded the human's decision:** pushing stays a standing grant, now that every push publishes (`CLAUDE.md`,
   `AGENTS.md`, T3s).

## Found

- **GitHub still serves the old commits by their IDs,** and the removed folder is visible inside them. The records cite
  those IDs (39 of a sample of 40), and the repository's Activity view shows the force-push. Only GitHub Support can
  purge unreachable commits and cached views. The human chose to skip the request unless it matters; Claude's view is
  that it is the one remaining exposure of the drop.
- **The three `codex/*` worktrees hold uncommitted work** that is in no archive. They were left untouched; their branches
  are refused by Codex's rules.
- **Evidence generated from the old history** (Codex's history inventories and assertion indexes: 182 code or data
  files) cites old IDs. It is kept as written, and the map translates. Regenerating it needs the old objects, which are
  only in the private archive.
- **The classifier also refused two read-only commands** in this stretch (`ls-remote` of the archive, and a read of the
  README) as destructive. Claude used other evidence, or the file tool, rather than retrying them.

## Open

1. **The human's:**
   - the GitHub Support purge request (optional);
   - H9 to H16 in `docs/HANDOFF.md` §5;
   - whether to apply H11's proposed wait, the change that would turn the Node 24 test job green.
2. **Codex, on resuming:** read `docs/HANDOFF.md` §5's public note first; port anything worth keeping from the old
   worktrees by patch; never push their branches.
3. **`refs/original/*`,** kept locally so `check.py` can be re-run. It is never pushed by a plain push of `main`.

## Provenance

- **Regenerate:**
  - `python3 evals/release/history-rewrite/check.py .`, in a clone holding both histories;
  - `npm test`, with `TMPDIR` on a disk with space;
  - `npm run typecheck`;
  - `uv run --script tools/session_close.py`.
- **CI:** run `38359096501` on `c7ba219`.
- **Backups:** the private `solanaut-archive`, and `.sandbox/backups/pre-rewrite-3c349d2.bundle`.
