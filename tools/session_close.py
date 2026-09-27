#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""session_close.py — run every gate before a session closes.

WAT layer 3. `workflows/session_close.md` is the judgement; this is the checkable half.

    uv run --script tools/session_close.py            # check everything
    uv run --script tools/session_close.py --slug my-work

Exits non-zero if any gate fails, so a session cannot be closed on a red tree.
It CHECKS and REPORTS. It never commits, never pushes, never writes a run record for
you — the record is judgement, and a generated one would be worthless.

Gates:
  1  the manifests match the seat table        (scaffold.py --check)
  2  the harness audits clean                  (lint_plugins.py)
  3  the boundary guard passes its matrix      (boundary_guard.py --selftest)
  4  nothing key-shaped in the tree            (secret scan)
  5  a run record exists for today             (workflows/session_close.md step 1)
  6  the remote is configured, or said loudly  (the rule this office exists for)
  7  HEAD is pushed to origin                  (standing rule 9, the milestone rule)

Gates 3 and 7 were added in pass 2. Gate 7 matters most: before it,
"synchronise at every milestone" was a sentence in CLAUDE.md that nothing
checked -- the same shape of defect as a boundary described and never enforced.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

OFFICE = Path(__file__).resolve().parent.parent
RUNS = OFFICE / "runs"

# Anything key-shaped. Deliberately noisy: a false positive costs a glance, a false
# negative costs a secret in permanent git history.
SECRET = re.compile(
    r"(api[_-]?key\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{16,}"
    r"|secret\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{16,}"
    r"|password\s*[:=]\s*['\"]?\S{8,}"
    r"|BEGIN\s+[A-Z ]*PRIVATE KEY"
    r"|sk-[A-Za-z0-9]{20,}"
    r"|ghp_[A-Za-z0-9]{20,}"
    r"|xox[baprs]-[A-Za-z0-9-]{10,})",
    re.I,
)
# Files that legitimately discuss secret-shaped things. Each declares itself, once,
# rather than the pattern being tuned until the noise happens to disappear.
EXEMPT_MARKER = "session_close: discusses-secret-patterns"


def run(args, cwd=OFFICE):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return p.returncode, (p.stdout or "").strip(), (p.stderr or "").strip()


def gate(name: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'PASS' if ok else 'FAIL'}]  {name}")
    # Detail is failure evidence. Printing it under a PASS reads as a finding
    # and trains people to skim the verdict line -- see release_gate.py, same fix.
    if detail and not ok:
        for line in detail.splitlines():
            print(f"          {line}")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser(description="Run Office's session-close gates.")
    ap.add_argument("--slug", help="expected run-record slug for today")
    args = ap.parse_args()

    print()
    print("session_close.py — gates")
    print("=" * 70)
    results = []

    # --- 1 & 2: the tool gates -------------------------------------------
    for label, script in (("manifests match the seat table",
                           ["tools/scaffold.py", "--check"]),
                          ("harness audits clean", ["tools/lint_plugins.py"]),
                          ("boundary guard passes its fault matrix",
                           ["tools/boundary_guard.py", "--selftest"])):
        rc, out, err = run(["uv", "run", "--script"] + script)
        tail = "\n".join((out or err).splitlines()[-4:]) if rc != 0 else ""
        results.append(gate(label, rc == 0, tail))

    # --- 3: secret scan ---------------------------------------------------
    rc, out, _ = run(["git", "ls-files"])
    hits = []
    for rel in out.splitlines():
        p = OFFICE / rel
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if EXEMPT_MARKER in text:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if SECRET.search(line):
                hits.append(f"{rel}:{i}")
    results.append(gate(
        f"no secrets in {len(out.splitlines())} tracked files",
        not hits,
        "\n".join(hits[:10]) + ("\n(and more)" if len(hits) > 10 else ""),
    ))

    # --- 4: run record ----------------------------------------------------
    today = date.today().isoformat()
    found = sorted(RUNS.glob(f"{today}-*.md")) if RUNS.exists() else []
    detail = ""
    if not found:
        detail = (f"no runs/{today}-<slug>.md. The record is judgement and is "
                  f"written by hand — see workflows/session_close.md step 1.")
    elif args.slug and not any(f.name == f"{today}-{args.slug}.md" for f in found):
        detail = f"expected runs/{today}-{args.slug}.md, found: " \
                 f"{', '.join(f.name for f in found)}"
    results.append(gate(f"run record exists for {today}", not detail, detail))

    # --- 5: the remote ----------------------------------------------------
    rc, remotes, _ = run(["git", "remote"])
    has_remote = bool(remotes.strip())
    results.append(gate(
        "remote configured",
        has_remote,
        "" if has_remote else
        "NO REMOTE. Everything in this folder is one disk failure from gone,\n"
        "and that failure has already happened to this project once.\n"
        "Nothing durable stays local — say so out loud when closing.",
    ))

    # --- 6: pushed? the milestone rule, made checkable ---------------------
    # Before this gate, "synchronise at every milestone" was a sentence in
    # CLAUDE.md that nothing checked -- the same shape of defect as a boundary
    # described and never enforced.
    if not has_remote:
        results.append(gate(
            "HEAD is pushed to origin", False,
            "no remote, so nothing can be pushed. See the gate above."))
    else:
        _, local, _ = run(["git", "rev-parse", "HEAD"])
        rc2, remote_head, _ = run(["git", "rev-parse", "origin/main"])
        if rc2 != 0:
            pushed, detail = False, (
                "origin/main is unknown here. Push for the first time:\n"
                "  git push -u origin main")
        else:
            pushed = local == remote_head
            detail = "" if pushed else (
                "HEAD is ahead of origin/main. Standing rule 9: synchronise at\n"
                "every milestone, not once at the end. Unpushed work is one disk\n"
                "failure from gone, and that has already happened here once.\n"
                "  git push origin main")
        results.append(gate("HEAD is pushed to origin", pushed, detail))

    # --- gate: the working tree is actually committed ---------------------
    # Until 2026-08-29 this was cosmetic advice printed BESIDE the verdict, so
    # the tool announced "ready to close" and exited 0 with a dirty tree. A
    # close-out check exists to assert that nothing is left behind; one that
    # merely MENTIONS what is left behind has stopped being a gate.
    #
    # The gate above makes it worse rather than better: "HEAD is pushed to
    # origin" is perfectly true and completely useless while the session's work
    # sits outside HEAD. Two green gates, and the work still only on this disk
    # -- which is the exact way this project lost its charter once already.
    rc2, dirty, _ = run(["git", "status", "--short"])
    detail = "" if not dirty else (
        f"{len(dirty.splitlines())} uncommitted change(s). A pushed HEAD proves\n"
        "nothing while work sits outside it.\n"
        "  git add -A && git commit -m \"office: <what changed>\"")
    results.append(gate("working tree committed", not dirty, detail))

    # --- summary ----------------------------------------------------------
    print("-" * 70)

    failed = sum(1 for r in results if not r)
    print(f"  {len(results) - failed}/{len(results)} gates passed")
    if failed:
        print("  NOT READY TO CLOSE — a failing gate is a finding, never a formality.")
        return 1
    print("  ready to close" + ("" if has_remote else " (LOCAL ONLY — say so)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
