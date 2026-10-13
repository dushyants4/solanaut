#!/usr/bin/env python3
"""Pair the pre-rewrite history (refs/original/*) with the rewritten one, prove that each pair differs only
by the removed private folder, and write the map: docs/HISTORY-MAP.md and a full-ID TSV beside its receipt."""
import os, subprocess, sys
from pathlib import Path

REPO = Path(sys.argv[1])
REMOVED = "Docs-Dashy-Drop/"
# Planted faults, to show the checks can fail: "prefix" treats the removed folder as ordinary content;
# "offset" pairs each old commit with the wrong new one. Neither writes any output.
FAULT = os.environ.get("HISTORY_MAP_FAULT", "")
if FAULT == "prefix":
    REMOVED = "no-such-folder/"
FMT = "%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%B"


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(REPO), *args], check=True, capture_output=True, text=True).stdout


old = git("rev-list", "--reverse", "--topo-order", "refs/original/refs/heads/main").split()
new = git("rev-list", "--reverse", "--topo-order", "refs/heads/main").split()
assert len(old) == len(new), (len(old), len(new))
if FAULT == "offset":
    new = new[1:] + new[:1]

rows, with_removal, problems = [], 0, []
for o, n in zip(old, new):
    if git("show", "-s", f"--format={FMT}", o) != git("show", "-s", f"--format={FMT}", n):
        problems.append(f"metadata differs: {o[:7]} {n[:7]}")
    po = git("show", "-s", "--format=%P", o).split()
    pn = git("show", "-s", "--format=%P", n).split()
    if [new[old.index(p)] for p in po] != pn:
        problems.append(f"parents differ: {o[:7]} {n[:7]}")
    changed = [p for p in git("diff", "--name-only", "-z", o, n).split("\0") if p]
    other = [p for p in changed if not p.startswith(REMOVED)]
    if other:
        problems.append(f"content differs outside the removed folder: {o[:7]} {n[:7]} {other[:3]}")
    if changed:
        with_removal += 1
    date = git("show", "-s", "--format=%as", n).strip()
    subject = git("show", "-s", "--format=%s", n).strip().replace("|", "\\|")
    rows.append((date, o, n, subject))

tags = []
for ref in git("for-each-ref", "--format=%(refname)", "refs/original/refs/tags").split():
    name = ref.removeprefix("refs/original/refs/tags/")
    to = git("rev-parse", f"{ref}^{{commit}}").strip()
    tn = git("rev-parse", f"refs/tags/{name}^{{commit}}").strip()
    if new[old.index(to)] != tn:
        problems.append(f"tag {name} does not follow its commit")
    tags.append((name, to, tn))

if problems or FAULT:
    print(f"{len(problems)} problem(s); first: {problems[:2]}")
    sys.exit(1)

receipt_dir = REPO / "evals" / "release" / "history-rewrite"
receipt_dir.mkdir(parents=True, exist_ok=True)
tsv = ["old_commit\tnew_commit\tdate\tsubject"] + [f"{o}\t{n}\t{d}\t{s}" for d, o, n, s in rows]
tsv += [f"tag:{name}\t{tn}\t\told commit {to}" for name, to, tn in tags]
(receipt_dir / "map.tsv").write_text("\n".join(tsv) + "\n", encoding="utf-8")

md = [
    "# HISTORY-MAP.md — old commit IDs to new ones",
    "",
    "> 1.0 · 2026-10-13 · owner: archivist · for: anyone following a commit ID cited in this repository's records.",
    "> Register: `kb/DOCUMENTS.md`.",
    "",
    "On 2026-10-12, before this repository went public, its history was rewritten to remove one private folder: the",
    "human's planning notes, which were never a source for any claim (`kb/intake/2026-09-27_dashy-drop.md`). Every",
    "commit kept its author, dates, message, parents and content; only its ID changed, because a commit's ID covers",
    "everything it contains.",
    "",
    "Records, receipts and claims written before that date cite the old IDs. Find an old ID in the left column to get",
    "the commit that now stands for it. The full 40-character IDs, for tools, are in",
    "[`evals/release/history-rewrite/map.tsv`](../evals/release/history-rewrite/map.tsv), and how this map was checked",
    "is in [`evals/release/history-rewrite.md`](../evals/release/history-rewrite.md).",
    "",
    "## Tags",
    "",
    "| Tag | Old commit | New commit |",
    "|---|---|---|",
]
md += [f"| `{name}` | `{to[:7]}` | `{tn[:7]}` |" for name, to, tn in tags]
md += ["", f"## Commits, oldest first ({len(rows)})", "", "| Date | Old | New | Subject |", "|---|---|---|---|"]
md += [f"| {d} | `{o[:7]}` | `{n[:7]}` | {s} |" for d, o, n, s in rows]
(REPO / "docs" / "HISTORY-MAP.md").write_text("\n".join(md) + "\n", encoding="utf-8")

print(f"pairs: {len(rows)}; metadata, parents identical; content identical outside the removed folder in all;")
print(f"pairs differing by the removed folder only: {with_removal}; identical trees: {len(rows) - with_removal}")
print(f"tags mapped: {len(tags)}")
print(f"short-ID collisions between old and new: {len({o[:7] for _, o, _, _ in rows} & {n[:7] for _, _, n, _ in rows})}")
