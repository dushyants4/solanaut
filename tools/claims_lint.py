#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""claims_lint.py — docs/CLAIMS.md's checkable half.

Milestone 2b.2 (docs/ROADMAP.md): every measured number has a row in docs/CLAIMS.md with its version,
config and the command that regenerates it. The version and config are judgement; this is what a
script can decide.

    uv run --script tools/claims_lint.py
    uv run --script tools/claims_lint.py --selftest    # each check, shown failing on a planted fault

Checks:
  1  §1, Solanaut's own claims, is a table with an ID, a claim, a status and evidence per row
  2  a measured row names the command that regenerates it: `npm …`, `node …` or `uv run …`
  3  a measured row names a receipt under evals/ that exists
  4  a measured row carries the date it was measured (YYYY-MM-DD)
  5  every repository path a row cites in backticks exists     (a claim whose evidence moved is broken)
  6  no row ID is used twice, in any table

A checker that cannot see must fail loudly: a missing file or a missing §1 is an ERROR, never a skip.
"""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOP = ("packages/", "apps/", "evals/", "docs/", "design/", "tools/", "kb/", "runs/", "programs/")
COMMAND = re.compile(r"`((?:npm|node|uv run)\s[^`]+)`")
RECEIPT = re.compile(r"`?(evals/[\w./-]+\.md)`?")
PATH = re.compile(r"`([\w./-]+/[\w.-]+\.[a-z]{2,4})`")
DATE = re.compile(r"\b20\d\d-\d\d-\d\d\b")


def rows(text: str) -> list[tuple[str, list[str]]]:
    """Every table row whose first cell is a claim ID, with its cells."""
    out = []
    for line in text.splitlines():
        m = re.match(r"\|\s*([SGM]\d+)\s*\|", line)
        if m:
            out.append((m.group(1), [c.strip() for c in line.strip().strip("|").split("|")]))
    return out


def section1(text: str) -> str | None:
    m = re.search(r"^## 1\..*?(?=^## \d|\Z)", text, re.S | re.M)
    return m.group(0) if m else None


def lint(text: str, root: Path) -> list[str]:
    errors = []
    s1 = section1(text)
    if s1 is None:
        return ["§1 (\"## 1. …\") not found: nothing to check is an error, not a pass"]
    own = rows(s1)
    if not own:
        errors.append("§1 has no claim rows")
    for cid, cells in own:
        if len(cells) < 4 or not all(cells[:4]):
            errors.append(f"{cid}: needs an ID, a claim, a status and evidence ({len(cells)} cells)")
            continue
        status, evidence = cells[2], " | ".join(cells[3:])
        if status.lstrip("*").lower().startswith("measured"):
            if not COMMAND.search(evidence):
                errors.append(f"{cid}: measured, but names no command that regenerates it (`npm …`, `node …` or `uv run …`)")
            receipts = RECEIPT.findall(evidence)
            if not receipts:
                errors.append(f"{cid}: measured, but names no receipt under evals/")
            if not DATE.search(evidence):
                errors.append(f"{cid}: measured, but says no date")
    seen: dict[str, int] = {}
    for cid, cells in rows(text):
        seen[cid] = seen.get(cid, 0) + 1
        for p in PATH.findall(" | ".join(cells)):
            if p.startswith(TOP) and not (root / p).exists():
                errors.append(f"{cid}: cites {p}, which does not exist")
    errors += [f"{cid}: the ID is used {n} times" for cid, n in seen.items() if n > 1]
    return errors


GOOD = """# CLAIMS
## 1. Solanaut's own claims
| ID | Claim | Status | Evidence |
|---|---|---|---|
| S1 | it denies | **measured (tests)** | `packages/x.ts` (`evals/x.md`), 2026-10-01. Regenerate: `npm test` |
| S2 | it is fine | **architectural** | design |
## 2. Others
| G1 | they say | quoted | a page |
"""
FAULTS = {
    "a measured row with no command": GOOD.replace(" Regenerate: `npm test`", ""),
    "a measured row with no receipt": GOOD.replace(" (`evals/x.md`)", ""),
    "a measured row with no date": GOOD.replace(", 2026-10-01", ""),
    "a cited path that does not exist": GOOD.replace("`packages/x.ts`", "`packages/gone.ts`"),
    "an ID used twice": GOOD.replace("| G1 |", "| S1 |"),
    "no §1 at all": GOOD.replace("## 1. Solanaut's own claims", "## Claims"),
    "a row missing its evidence": GOOD.replace("| S2 | it is fine | **architectural** | design |", "| S2 | it is fine | **architectural** | |"),
}


def selftest() -> int:
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        for f in ("packages/x.ts", "evals/x.md"):
            (root / f).parent.mkdir(parents=True, exist_ok=True)
            (root / f).write_text("x")
        cases = [("the clean fixture", GOOD, False)] + [(k, v, True) for k, v in FAULTS.items()]
        failed = 0
        for name, text, should_fail in cases:
            got = lint(text, root)
            ok = bool(got) == should_fail
            failed += not ok
            print(f"  [{'PASS' if ok else 'FAIL'}]  {'caught' if got else 'clean '}  {name}" + (f": {got[0]}" if got else ""))
    print(f"claims_lint selftest: {len(cases) - failed}/{len(cases)}")
    return 1 if failed else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Check docs/CLAIMS.md's provenance.")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    path = ROOT / "docs/CLAIMS.md"
    try:
        text = path.read_text()
    except OSError as e:
        print(f"ERROR  cannot read {path}: {e}")
        return 1
    errors = lint(text, ROOT)
    for e in errors:
        print(f"ERROR  {e}")
    n = len(rows(section1(text) or ""))
    print(f"claims_lint: {n} rows in §1, {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
