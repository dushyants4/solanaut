#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""kb_lint.py — the knowledge vault's checkable half.

WAT layer 3. `workflows/knowledge.md` (the lint operation) is the judgement; this is what a
script can decide. `design/ADR-007-knowledge-vault.md` says why the vault is shaped this way.

    uv run --script tools/kb_lint.py
    uv run --script tools/kb_lint.py --verbose

Exits non-zero on any ERROR, so it gates a session close. WARN does not gate.

Checks:
  1  every relative link in the vault's markdown resolves      (links rot silently)
  2  kb notes carry their frontmatter; sources a public URL     (provenance)
  3  no orphan kb note: each is linked from another note        (unreachable is unknown)
  4  kb/DOCUMENTS.md and the documents on disk agree           (the register is the truth)
  5  nothing in kb/private/ but its README is tracked           (confidential stays local)
  6  CLAUDE.md's seat table matches tools/scaffold.py SEATS     (a copy nothing checked)
  7  WARN: a drop file not registered in kb/intake/ by SHA-256  (an ingest is owed)

A checker that cannot see must fail loudly: an unreadable file, a missing register or a git
that will not answer is an ERROR, never a skip.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
KB = ROOT / "kb"
DROP = "Docs-Dashy-Drop/"

# Not linted for links: the human's drop is theirs, templates hold placeholders.
LINK_EXEMPT = (DROP, "kb/templates/")
# Records are kept as written: a broken link in one is reported, never "fixed" into a rewrite.
RECORDS = ("runs/", "docs/plans/", "evals/")
# The register must list exactly these.
REGISTERED_DIRS = ("docs/", "docs/papers/", "docs/submission/")

LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+\"[^\"\n]*\")?\s*\)")
WIKILINK = re.compile(r"\[\[[^\]\n]+\]\]")
FENCE = re.compile(r"^(```|~~~).*?^\1", re.M | re.S)
INLINE = re.compile(r"`[^`\n]*`")
COMMENT = re.compile(r"<!--.*?-->", re.S)

REQUIRED = {
    "kb/sources/": ("source", ["type", "status", "url", "fetched", "checked", "created", "updated"]),
    "kb/wiki/": (("topic", "entity"), ["type", "status", "created", "updated"]),
    "kb/milestones/": ("milestone-review", ["type", "milestone", "status", "created", "updated"]),
}


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warns: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warns.append(msg)


def git(*args: str) -> list[str]:
    # -z and core.quotePath=false: git otherwise quotes and escapes any non-ASCII path (the
    # drop has one), which then matches no exemption and opens nothing. Found by this tool's
    # first run, 2026-09-27.
    p = subprocess.run(["git", "-c", "core.quotePath=false", *args, "-z"], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8")
    if p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {p.stderr.strip()}")
    return [f for f in p.stdout.split("\0") if f]


def vault_markdown() -> list[str]:
    """Tracked markdown plus new, not-ignored markdown: lint runs before a commit too."""
    return sorted(set(git("ls-files", "--cached", "--others", "--exclude-standard", "*.md")))


def read(rel: str, rep: Report) -> str | None:
    try:
        return (ROOT / rel).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        rep.error(f"cannot read {rel}: {e}")
        return None


def strip_code(text: str) -> str:
    return INLINE.sub("", FENCE.sub("", COMMENT.sub("", text)))


def frontmatter(text: str) -> dict[str, str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end < 0:
        return None
    fm: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" in line and not line.startswith((" ", "\t", "-")):
            key, _, value = line.partition(":")
            fm[key.strip()] = value.strip().strip('"')
    return fm


def check_links(files: list[str], rep: Report) -> dict[str, set[str]]:
    """Check 1. Returns the reverse index: target → the files that link to it."""
    inbound: dict[str, set[str]] = {}
    for rel in files:
        if rel.startswith(LINK_EXEMPT):
            continue
        text = read(rel, rep)
        if text is None:
            continue
        body = strip_code(text)
        if WIKILINK.search(body):
            rep.warn(f"{rel}: [[wikilink]] found; the vault uses relative markdown links (ADR-007)")
        for m in LINK.finditer(body):
            target = m.group(1).strip("<>")
            if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I) or target.startswith("#"):
                continue
            path = unquote(target.split("#", 1)[0].split("?", 1)[0])
            if not path:
                continue
            resolved = (ROOT / rel).parent / path
            try:
                key = resolved.resolve().relative_to(ROOT).as_posix()
            except ValueError:
                rep.error(f"{rel}: link leaves the repository: {target}")
                continue
            if not resolved.exists():
                msg = f"{rel}: broken link → {target}"
                (rep.warn if rel.startswith(RECORDS) else rep.error)(msg)
                continue
            if key != rel:
                inbound.setdefault(key, set()).add(rel)
    return inbound


def check_frontmatter(files: list[str], rep: Report) -> None:
    """Check 2."""
    for rel in files:
        for prefix, (want_type, keys) in REQUIRED.items():
            if not rel.startswith(prefix):
                continue
            text = read(rel, rep)
            if text is None:
                break
            fm = frontmatter(text)
            if fm is None:
                rep.error(f"{rel}: no frontmatter")
                break
            missing = [k for k in keys if not fm.get(k)]
            if missing:
                rep.error(f"{rel}: frontmatter lacks {', '.join(missing)}")
            types = want_type if isinstance(want_type, tuple) else (want_type,)
            if fm.get("type") and fm["type"] not in types:
                rep.error(f"{rel}: type is {fm['type']!r}, expected {' or '.join(types)}")
            if prefix == "kb/sources/":
                if fm.get("url") and not fm["url"].startswith(("https://", "http://")):
                    rep.error(f"{rel}: url is not a public http(s) URL")
                if fm.get("checked") and fm["checked"] not in ("first-hand", "via-agent"):
                    rep.error(f"{rel}: checked must be first-hand or via-agent")
            if prefix == "kb/wiki/" and "**Sources:**" not in text:
                rep.error(f"{rel}: no **Sources:** line")
            break


def check_orphans(files: list[str], inbound: dict[str, set[str]], rep: Report) -> None:
    """Check 3. Every kb note but the front page is reachable from another note."""
    for rel in files:
        if not rel.startswith("kb/") or rel.startswith(("kb/templates/", "kb/private/")):
            continue
        if rel == "kb/INDEX.md":
            continue
        if not inbound.get(rel):
            rep.error(f"{rel}: orphan: no other note links to it")


def check_register(files: list[str], rep: Report) -> None:
    """Check 4."""
    reg = "kb/DOCUMENTS.md"
    text = read(reg, rep)
    if text is None:
        return
    listed: set[str] = set()
    for line in text.splitlines():
        if not line.startswith("| ["):
            continue
        m = LINK.search(line)
        if m:
            target = unquote(m.group(1).strip("<>"))
            listed.add(((ROOT / "kb" / target).resolve()).relative_to(ROOT).as_posix())
    if not listed:
        rep.error(f"{reg}: no document rows found; the register cannot be checked")
        return
    expected = {"README.md"} | {
        f for f in files if any(f.startswith(d) and "/" not in f[len(d):] for d in REGISTERED_DIRS)
    }
    for f in sorted(expected - listed):
        rep.error(f"{reg}: {f} exists but is not registered")
    for f in sorted(listed - set(files)):
        rep.error(f"{reg}: lists {f}, which does not exist")


def check_private(rep: Report) -> None:
    """Check 5."""
    tracked = git("ls-files", "kb/private")
    for f in tracked:
        if f != "kb/private/README.md":
            rep.error(f"{f}: tracked by git, but kb/private/ must stay on this disk")
    probe = subprocess.run(["git", "check-ignore", "-q", "kb/private/probe.md"], cwd=ROOT)
    if probe.returncode != 0:
        rep.error("kb/private/ is not gitignored: a confidential note could be committed")


def check_seats(rep: Report) -> None:
    """Check 6. CLAUDE.md carries a copy of the seat table for reading; scaffold.py owns it."""
    spec = importlib.util.spec_from_file_location("scaffold", ROOT / "tools" / "scaffold.py")
    if spec is None or spec.loader is None:
        rep.error("cannot load tools/scaffold.py to read SEATS")
        return
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    text = read("CLAUDE.md", rep)
    if text is None:
        return
    rows: dict[str, list[str]] = {}
    for line in text.splitlines():
        m = re.match(r"^\| \*\*(\w+)\*\* \|(.*)\|\s*$", line)
        if m:
            rows[m.group(1)] = [c.strip() for c in m.group(2).split("|")]
    if not rows:
        rep.error("CLAUDE.md: no seat table found; the seats cannot be checked")
        return
    for seat in mod.SEATS:
        row = rows.pop(seat["name"], None)
        if row is None:
            rep.error(f"CLAUDE.md: seat {seat['name']} is missing from the table")
            continue
        want = [seat["model"], seat["writes"], seat["never"], seat["question"]]
        for label, got, exp in zip(("model", "writes", "never writes", "question"), row, want):
            if got != exp:
                rep.error(f"CLAUDE.md: seat {seat['name']} {label} is {got!r}; scaffold.py says {exp!r}")
    for name in rows:
        rep.error(f"CLAUDE.md: seat {name} is not in tools/scaffold.py SEATS")


def check_drop(rep: Report) -> None:
    """Check 7, a warning: the drop is the human's, and an ingest may simply be owed."""
    drop = ROOT / DROP
    if not drop.is_dir():
        rep.error(f"{DROP} is missing")
        return
    intake = "".join(p.read_text(encoding="utf-8") for p in sorted((KB / "intake").glob("*.md")))
    for p in sorted(drop.rglob("*")):
        if p.is_file():
            digest = hashlib.sha256(p.read_bytes()).hexdigest()
            if digest not in intake:
                rep.warn(f"{p.relative_to(ROOT)}: not registered in kb/intake/ (sha256 {digest[:12]}…); run /compile")


def main() -> int:
    ap = argparse.ArgumentParser(description="Lint the knowledge vault.")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    print("\nkb_lint.py — the knowledge vault\n" + "=" * 66)
    rep = Report()
    try:
        files = vault_markdown()
    except RuntimeError as e:
        print(f"  [FAIL]  {e}\n  A checker that cannot see must fail.")
        return 1
    inbound = check_links(files, rep)
    check_frontmatter(files, rep)
    check_orphans(files, inbound, rep)
    check_register(files, rep)
    check_private(rep)
    check_seats(rep)
    check_drop(rep)

    notes = sum(1 for f in files if f.startswith("kb/") and not f.startswith("kb/templates/"))
    if args.verbose or rep.errors or rep.warns:
        for e in rep.errors:
            print(f"  [FAIL]  {e}")
        for w in rep.warns:
            print(f"  [WARN]  {w}")
    print("-" * 66)
    print(f"  {len(files)} markdown files, {notes} kb notes; "
          f"{len(rep.errors)} error(s), {len(rep.warns)} warning(s)")
    if rep.errors:
        print("  FAIL — fix the vault, never this list.")
        return 1
    print("  PASS — every link resolves, every note is sourced and reachable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
