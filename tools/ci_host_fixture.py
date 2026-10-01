#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""ci_host_fixture.py — make a CI runner look like the host the boundary policy names.

`tools/boundary_guard.py` refuses a policy written for another machine: the hostname must match,
the required roots must exist, and every path a rule denies must exist on disk. That is right on
a workstation, and it means `--selftest` fails closed on a fresh CI runner. This script recreates
the policy's host shape on the runner, read from `boundaries.toml` itself so it cannot drift:

  1  the hostname, from [meta] machine_hostname
  2  every deny_path, as an empty directory, or an empty file when the name has a suffix
  3  a copy of the checkout at the first required root, where the self-test's cases point

What CI then proves is the guard's decisions. The host binding itself is proven only on the
real host, by `tools/session_close.py`. `evals/ci/safety-net.md` states that limit.

    uv run --script tools/ci_host_fixture.py      # GitHub Actions only; refuses anywhere else
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POLICY = ROOT / "plugins" / "harness" / "hooks" / "boundaries.toml"


def sudo(*args: str) -> None:
    subprocess.run(["sudo", *args], check=True)


def main() -> int:
    # It renames the machine and writes under another user's home: never on a real host.
    if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("CI") != "true":
        print("ci_host_fixture.py runs only on a GitHub Actions runner; refusing.", file=sys.stderr)
        return 2

    policy = tomllib.loads(POLICY.read_text(encoding="utf-8"))
    meta = policy["meta"]
    host = meta["machine_hostname"]
    roots = [Path(r) for r in meta["required_roots"]]
    deny = sorted({Path(p) for r in policy["rule"] for p in r.get("deny_paths", [])})

    sudo("hostname", host)
    print(f"hostname: {os.uname().nodename}")

    # Own the whole fake home, so the copy and the fixtures need no further sudo.
    homes = sorted({Path(*p.parts[:3]) for p in [*roots, *deny]})
    for home in homes:
        sudo("mkdir", "-p", str(home))
        sudo("chown", f"{os.getuid()}:{os.getgid()}", str(home))

    # The checkout goes first: one deny_path (the intake drop) lives inside it.
    target = roots[0]
    if target.resolve() != ROOT:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(ROOT, target, symlinks=True, ignore=shutil.ignore_patterns("node_modules"))
        print(f"checkout: {ROOT} -> {target}")
    for r in roots[1:]:
        r.mkdir(parents=True, exist_ok=True)

    for p in deny:
        if p.exists():
            print(f"exists:   {p}")
            continue
        p.parent.mkdir(parents=True, exist_ok=True)
        if p.suffix:
            p.touch()
        else:
            p.mkdir()
        print(f"fixture:  {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
