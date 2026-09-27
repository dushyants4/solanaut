#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""doctor.py — is this machine's toolchain the one TOOLCHAIN.md pins?

    uv run --script tools/doctor.py

Exits non-zero on the first tool that is missing, unparseable, or off-pin, and names it. A
version string it cannot read is a FAILURE, never a skip (a checker that cannot see must fail).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HOME = Path.home()
# The Solana and Anchor bins are not on a non-interactive PATH; say where they live, once.
EXTRA = [HOME / ".local/share/solana/install/active_release/bin", HOME / ".avm/bin"]
os.environ["PATH"] = os.pathsep.join([str(p) for p in EXTRA] + [os.environ.get("PATH", "")])

# (label, command, regex capturing the version, check). check is an exact pin (str), or a
# callable for a floor.
def at_least(floor: tuple[int, ...]):
    def ok(v: str) -> bool:
        return tuple(int(x) for x in v.split(".")[: len(floor)]) >= floor
    ok.__doc__ = ">= " + ".".join(map(str, floor))
    return ok

CHECKS = [
    ("node", ["node", "--version"], r"v(\d+\.\d+\.\d+)", "26.7.0"),
    ("npm", ["npm", "--version"], r"(\d+\.\d+\.\d+)", at_least((11,))),
    ("solana", ["solana", "--version"], r"solana-cli (\d+\.\d+\.\d+)", "3.1.10"),
    ("solana-test-validator", ["solana-test-validator", "--version"], r"(\d+\.\d+\.\d+)", "3.1.10"),
    ("solana-keygen", ["solana-keygen", "--version"], r"(\d+\.\d+\.\d+)", "3.1.10"),
    ("cargo-build-sbf", ["cargo-build-sbf", "--version"], r"cargo-build-sbf (\d+\.\d+\.\d+)", "3.1.10"),
    ("anchor", ["anchor", "--version"], r"anchor-cli (\d+\.\d+\.\d+)", "1.2.0"),
    ("avm", ["avm", "--version"], r"avm (\d+\.\d+\.\d+)", "1.2.0"),
    ("rustc", ["rustc", "--version"], r"rustc (\d+\.\d+\.\d+)", at_least((1, 85))),
    ("uv", ["uv", "--version"], r"uv (\d+\.\d+\.\d+)", at_least((0, 8))),
    ("git", ["git", "--version"], r"git version (\d+\.\d+\.\d+)", at_least((2, 40))),
    ("chrome", ["google-chrome-stable", "--version"], r"(\d+\.\d+\.\d+)", at_least((120,))),
]


def main() -> int:
    print("\ndoctor.py — the toolchain against TOOLCHAIN.md\n" + "=" * 66)
    failed = 0
    for label, cmd, rx, want in CHECKS:
        if not shutil.which(cmd[0]):
            print(f"  [FAIL]  {label:22} not found on PATH")
            failed += 1
            continue
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        m = re.search(rx, (r.stdout or "") + (r.stderr or ""))
        if not m:
            print(f"  [FAIL]  {label:22} version unreadable: {(r.stdout or r.stderr).strip()[:60]!r}")
            failed += 1
            continue
        got = m.group(1)
        ok = (got == want) if isinstance(want, str) else want(got)
        wanted = want if isinstance(want, str) else want.__doc__
        print(f"  [{'PASS' if ok else 'FAIL'}]  {label:22} {got:12} want {wanted}")
        failed += not ok
    print("-" * 66)
    if failed:
        print(f"  {failed} tool(s) off-pin or missing. Fix the machine or TOOLCHAIN.md, never this list.")
        return 1
    print(f"  all {len(CHECKS)} tools match")
    return 0


if __name__ == "__main__":
    sys.exit(main())
