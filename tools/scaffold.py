#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""scaffold.py — generate the marketplace and plugin manifests from SEATS.

Vendored into Solanaut 2026-09-27 from office-core 182b7a9 (see plugins/VENDORED.md). The
seat table is unchanged; the names are Solanaut's, so its seats never collide with the
Office seats this machine enables globally.

WAT layer 3. The seat table is the single source of truth; the JSON is derived.
Hand-editing a plugin.json is how seven manifests drift apart, so they are generated.

    uv run --script tools/scaffold.py --check    # report drift, write nothing
    uv run --script tools/scaffold.py            # write the manifests

Exits non-zero when --check finds drift, so it can gate a commit.

Manifest shape re-verified with Claude Code 2.1.251 on Linux on 2026-08-30:
  - only `name` is required in plugin.json
  - standard `skills/`, `commands/`, and `agents/` directories are auto-discovered
  - standard `hooks/hooks.json` is auto-discovered and must not also be declared
  - legacy string-valued `skills` and `agents` fields are rejected by validation
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

OFFICE = Path(__file__).resolve().parent.parent
PLUGINS = OFFICE / "plugins"
MARKETPLACE = OFFICE / ".claude-plugin" / "marketplace.json"

OWNER = {"name": "Dushyant", "email": "dushyantstyle@gmail.com"}
VERSION = "0.1.0"
PREFIX = "solanaut"
MARKET = "solanaut-office"

# The seven seats. `writes` and `never` are the write boundary, and for evaluator
# `disallowed` makes it real rather than aspirational (kb/GAPS.md gap 1).
SEATS = [
    {
        "name": "architect",
        "display": "Architect",
        "model": "opus",
        "desc": "Designs the AI system before anything is built: agent topology, "
                "context strategy, model choice, and the ADR that records why.",
        "writes": "design/ — ADRs, topology, context strategy",
        "never": "implementation code",
        "question": "What shape should this system be, and what is the evidence?",
    },
    {
        "name": "harness",
        "display": "Harness",
        "model": "sonnet",
        "desc": "Owns the agent's own environment — skills, agents, commands, hooks, "
                "MCP wiring and CLAUDE.md files — and audits them as a system.",
        "writes": ".claude/ assets and CLAUDE.md files",
        "never": "product code",
        "hooks": "./hooks/hooks.json",
        "question": "What does the agent need in its environment to get this right?",
    },
    {
        "name": "builder",
        "display": "Builder",
        "model": "sonnet",
        "desc": "Implements against an accepted design. Writes source, refactors, and "
                "makes the code read like the code around it.",
        "writes": "src/, implementation, refactors",
        "never": "design docs, evals",
        "question": "Does it work, and does it read like the code around it?",
    },
    {
        "name": "integrator",
        "display": "Integrator",
        "model": "sonnet",
        "desc": "Owns the public surface: SDK and API design, versioning, packaging, "
                "and the docs a consumer outside the repo actually needs.",
        "writes": "public API surface, packaging, consumer docs",
        "never": "internals",
        "question": "Can someone outside this repo use it without asking me?",
    },
    {
        "name": "evaluator",
        "display": "Evaluator",
        "model": "opus",
        "desc": "Writes and runs the test battery, then reports failures as specific "
                "edits for another seat to make. Cannot edit what it finds.",
        "writes": "evals/ and test batteries — nothing else",
        "never": "any fix for what it finds",
        "question": "Does it actually pass, on a case that could fail?",
        # The one enforced boundary. 0 of 1435 corpus agents do this.
        "disallowed": "Write, Edit, NotebookEdit",
    },
    {
        "name": "operator",
        "display": "Operator",
        "model": "sonnet",
        "desc": "CI, containers, release preparation and deploy readiness. Proves it "
                "comes up clean on a machine that is not this one.",
        "writes": "CI config, containers, release scripts",
        "never": "product code, evals",
        "question": "Will it come up clean on a machine that isn't mine?",
    },
    {
        "name": "archivist",
        "display": "Archivist",
        "model": "haiku",
        "desc": "Keeps runs/, PROGRESS.md and kb/ current, and enforces provenance on "
                "anything measured: version, config, run ID.",
        "writes": "runs/, PROGRESS.md, kb/",
        "never": "source of any kind",
        "question": "What happened, and what is owed?",
    },
]


def plugin_manifest(seat: dict) -> dict:
    m = {
        "name": f"{PREFIX}-{seat['name']}",
        "displayName": f"Solanaut · {seat['display']}",
        "version": VERSION,
        "description": seat["desc"],
        "author": OWNER,
        "keywords": ["solanaut", "office", "sdk", seat["name"]],
    }
    # No "license" until the human chooses Solanaut's licence: lint_plugins.py fails a
    # manifest that claims one with no LICENSE file beside it, which is the right check.
    return m


def marketplace_manifest() -> dict:
    return {
        "name": MARKET,
        "owner": OWNER,
        "metadata": {
            "description": "Solanaut's office: seven seats, vendored from the Office pattern. "
                           "A seat is a write boundary.",
            "version": VERSION,
        },
        "plugins": [
            {
                "name": f"{PREFIX}-{s['name']}",
                "source": f"./plugins/{s['name']}",
                "description": s["desc"],
            }
            for s in SEATS
        ],
    }


def emit(path: Path, data: dict, check: bool, drift: list[str]) -> None:
    text = json.dumps(data, indent=2) + "\n"
    rel = path.relative_to(OFFICE)
    if check:
        if not path.exists():
            drift.append(f"missing: {rel}")
        elif path.read_text(encoding="utf-8") != text:
            drift.append(f"differs from SEATS: {rel}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"  wrote  {rel}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate Office plugin manifests.")
    ap.add_argument("--check", action="store_true",
                    help="report drift between SEATS and the manifests; write nothing")
    args = ap.parse_args()

    print()
    print("scaffold.py — manifests from the seat table")
    print("=" * 66)
    print(f"  seats     {len(SEATS)}: {', '.join(s['name'] for s in SEATS)}")
    print(f"  version   {VERSION}")
    print(f"  mode      {'CHECK' if args.check else 'WRITE'}")
    print("-" * 66)

    drift: list[str] = []
    emit(MARKETPLACE, marketplace_manifest(), args.check, drift)
    for seat in SEATS:
        root = PLUGINS / seat["name"]
        emit(root / ".claude-plugin" / "plugin.json",
             plugin_manifest(seat), args.check, drift)
        if not args.check:
            for sub in ("skills", "agents", "commands"):
                (root / sub).mkdir(parents=True, exist_ok=True)

    print("-" * 66)
    if args.check:
        if drift:
            print(f"  DRIFT ({len(drift)}):")
            for d in drift:
                print(f"    ! {d}")
            print("  The seat table in this file is the source of truth. Re-run "
                  "without --check.")
            return 1
        print(f"  {1 + len(SEATS)} manifest(s) match the seat table. No drift.")
        return 0

    print(f"  {1 + len(SEATS)} manifest(s) written")
    print(f"  evaluator carries disallowedTools in its AGENT frontmatter "
          f"({SEATS[4]['disallowed']}) — the enforced boundary, kb/GAPS.md gap 1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
