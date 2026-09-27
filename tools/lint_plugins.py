#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""lint_plugins.py — audit Office's own harness.

WAT layer 3. This is the `harness-audit` skill's checkable half: everything in that
skill that a script can decide, decided by a script.

    uv run --script tools/lint_plugins.py
    uv run --script tools/lint_plugins.py --verbose

Exits non-zero on any ERROR, so it gates a commit. WARN does not gate.

Checks, each traced to the gap it answers (kb/GAPS.md):
  1  every plugin.json parses and names itself           (packaging)
  2  every SKILL.md / agent has name + description       (spec)
  3  descriptions read as triggers, not summaries        (gap 3, retrieval)
  4  no dated model ids anywhere                         (gap 4, silent rot)
  5  every agent declares a model                        (gap 4)
  6  the six-section contract on every authored skill    (gap 5, exit conditions)
  7  evaluator's write boundary is ENFORCED              (gap 1, the headline)
  8  no two descriptions collide on the same trigger     (gap 3)
  9  a declared licence has a LICENSE file behind it      (gap 6, licence-by-filename)
 10  a declared hooks file actually exists                (a manifest cannot claim
                                                           enforcement it does not ship)

Check 9 exists because Office committed gap 6's exact defect: seven manifests
asserted "license": "MIT" over a repo that granted nothing. Documenting a failure
mode and then shipping it is the strongest possible argument for a machine check.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

OFFICE = Path(__file__).resolve().parent.parent
PLUGINS = OFFICE / "plugins"
MARKETPLACE = OFFICE / ".claude-plugin" / "marketplace.json"
# A licence is a grant, not a filename. These are the files that actually grant.
LICENCE_FILES = ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING")

REQUIRED_SECTIONS = [
    "When to use", "Process", "Red flags",
    "Rationalizations", "Verification", "When to stop and ask",
]
DATED_MODEL = re.compile(r"-\d{8}$|\d{8}")
TRIGGER_START = re.compile(r"^use\s+(when|to|for|before|after|whenever)\b", re.I)

# The seat that must not be able to edit what it reviews. kb/GAPS.md gap 1.
ENFORCED_BOUNDARY = {"evaluator": {"Write", "Edit"}}


def frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    out = {}
    for line in text[3:end].splitlines():
        m = re.match(r"^([A-Za-z_][\w.-]*)\s*:\s*(.*)$", line)
        if m:
            out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Audit Office's plugins.")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    errors: list[str] = []
    warns: list[str] = []
    checked = {"plugins": 0, "agents": 0, "skills": 0}
    descriptions: list[tuple[str, str]] = []

    print()
    print("lint_plugins.py — Office harness audit")
    print("=" * 70)

    # --- 1. marketplace + plugin manifests -------------------------------
    if not MARKETPLACE.exists():
        errors.append("ERROR  .claude-plugin/marketplace.json missing")
    else:
        try:
            mk = json.loads(MARKETPLACE.read_text(encoding="utf-8"))
            listed = {p["name"] for p in mk.get("plugins", [])}
            print(f"  marketplace  {len(listed)} plugin(s) listed")
        except json.JSONDecodeError as e:
            errors.append(f"ERROR  marketplace.json does not parse: {e}")
            listed = set()

    for pdir in sorted(p for p in PLUGINS.iterdir() if p.is_dir()):
        seat = pdir.name
        checked["plugins"] += 1
        mf = pdir / ".claude-plugin" / "plugin.json"
        if not mf.exists():
            errors.append(f"ERROR  {seat}: no .claude-plugin/plugin.json")
            continue
        try:
            pj = json.loads(mf.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"ERROR  {seat}: plugin.json does not parse: {e}")
            continue
        if not pj.get("name"):
            errors.append(f"ERROR  {seat}: plugin.json has no name")
        elif pj["name"] not in listed:
            errors.append(f"ERROR  {seat}: '{pj['name']}' not in marketplace.json")

        # --- 9. a licence claim needs a grant behind it (gap 6) ----------
        if pj.get("license") and not any((OFFICE / f).exists() for f in LICENCE_FILES):
            errors.append(f"ERROR  {seat}: plugin.json claims "
                          f"'{pj['license']}' but no LICENSE file exists in the "
                          f"repo. A licence is a grant, not a string (gap 6)")

        # --- 10. a declared hooks file must exist ------------------------
        if pj.get("hooks"):
            hp = (pdir / pj["hooks"].lstrip("./")).resolve()
            if not hp.exists():
                errors.append(f"ERROR  {seat}: plugin.json declares hooks at "
                              f"'{pj['hooks']}' which does not exist. A manifest "
                              f"must not claim enforcement it does not ship")
            else:
                try:
                    json.loads(hp.read_text(encoding="utf-8"))
                except json.JSONDecodeError as e:
                    errors.append(f"ERROR  {seat}: hooks file does not parse: {e}")

        # --- 2/3/4/5/7. agents ------------------------------------------
        for af in sorted((pdir / "agents").glob("*.md")):
            checked["agents"] += 1
            fm = frontmatter(af.read_text(encoding="utf-8"))
            rel = af.relative_to(OFFICE)
            if not fm.get("name"):
                errors.append(f"ERROR  {rel}: no name in frontmatter")
            if not fm.get("description"):
                errors.append(f"ERROR  {rel}: no description in frontmatter")
            else:
                descriptions.append((str(rel), fm["description"]))
                if not TRIGGER_START.match(fm["description"]):
                    warns.append(f"WARN   {rel}: description is a summary, not a "
                                 f"trigger (should start 'Use when/to/for...')")
            model = fm.get("model", "")
            if not model:
                errors.append(f"ERROR  {rel}: no model declared (gap 4)")
            elif DATED_MODEL.search(model):
                errors.append(f"ERROR  {rel}: dated model id '{model}' rots "
                              f"silently (gap 4) — use a family alias")
            # gap 1: the enforced boundary
            if seat in ENFORCED_BOUNDARY:
                need = ENFORCED_BOUNDARY[seat]
                denied = {x.strip() for x in fm.get("disallowedTools", "").split(",")}
                # A `tools:` ALLOWLIST that simply omits Write and Edit enforces the same
                # boundary, and arguably harder: a denylist forbids what it names, an
                # allowlist forbids everything it does not. This check only understood
                # `disallowedTools`, so it failed the website's `inspector` -- a seat whose
                # boundary was enforced, by the stronger of the two mechanisms.
                allowed = {x.strip() for x in fm["tools"].split(",")} if "tools" in fm else None
                missing = need - denied if allowed is None else (need & allowed) - denied
                if missing:
                    errors.append(
                        f"ERROR  {rel}: seat '{seat}' must enforce its write "
                        f"boundary. It is granted {sorted(missing)} and neither "
                        f"disallowedTools nor a tools allowlist removes them "
                        f"(kb/GAPS.md gap 1)")
                elif args.verbose:
                    how = ("disallowedTools" if denied - {""} else "a tools allowlist")
                    print(f"  boundary     {seat}: enforced via {how}")

        # --- 2/3/6. skills ----------------------------------------------
        for sf in sorted((pdir / "skills").glob("*/SKILL.md")):
            checked["skills"] += 1
            text = sf.read_text(encoding="utf-8")
            fm = frontmatter(text)
            rel = sf.relative_to(OFFICE)
            if not fm.get("name"):
                errors.append(f"ERROR  {rel}: no name in frontmatter")
            elif fm["name"] != sf.parent.name:
                errors.append(f"ERROR  {rel}: name '{fm['name']}' != directory "
                              f"'{sf.parent.name}'")
            if not fm.get("description"):
                errors.append(f"ERROR  {rel}: no description in frontmatter")
            else:
                descriptions.append((str(rel), fm["description"]))
                if not TRIGGER_START.match(fm["description"]):
                    warns.append(f"WARN   {rel}: description is a summary, not a "
                                 f"trigger")
            heads = set(re.findall(r"^##\s+(.+?)\s*$", text, re.M))
            for need in REQUIRED_SECTIONS:
                if not any(h.lower().startswith(need.lower()) for h in heads):
                    errors.append(f"ERROR  {rel}: missing '## {need}' "
                                  f"(section contract, ADR-001 §4)")

    # --- 8. description collisions ---------------------------------------
    STOP = set("use when to for the a an and or of in on with that this it is are be "
               "before after whenever invoke used using".split())

    def keywords(d: str) -> set[str]:
        return {w for w in re.findall(r"[a-z]{4,}", d.lower()) if w not in STOP}

    for i in range(len(descriptions)):
        for j in range(i + 1, len(descriptions)):
            a, b = keywords(descriptions[i][1]), keywords(descriptions[j][1])
            if not a or not b:
                continue
            overlap = len(a & b) / min(len(a), len(b))
            if overlap > 0.6:
                warns.append(
                    f"WARN   trigger collision {overlap:.0%}: "
                    f"{descriptions[i][0]} vs {descriptions[j][0]} (gap 3)")

    # --- report -----------------------------------------------------------
    print(f"  checked      {checked['plugins']} plugins, {checked['agents']} agents, "
          f"{checked['skills']} skills")
    print("-" * 70)
    for w in warns:
        print(f"  {w}")
    for e in errors:
        print(f"  {e}")
    if not errors and not warns:
        print("  no findings")
    print("-" * 70)
    print(f"  {len(errors)} error(s), {len(warns)} warning(s)")
    if errors:
        print("  FAIL")
        return 1
    print("  PASS — every boundary enforced, every contract met")
    return 0


if __name__ == "__main__":
    sys.exit(main())
