"""Reproduce the reviewed milestone count; no partial credit or readiness inference."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads(Path(__file__).with_name("progress-manifest.json").read_text())


def historical(path):
    data = subprocess.run(
        ["git", "show", MANIFEST["revision"] + ":" + path], cwd=ROOT,
        capture_output=True, check=True,
    ).stdout
    if hashlib.sha256(data).hexdigest() != MANIFEST["sources"][path]:
        raise ValueError("reviewed milestone source differs: " + path)
    return data.decode()


roadmap = historical("docs/ROADMAP.md")
readiness = historical("docs/READINESS.md")
historical("kb/milestones/2026-10-01_2b-beta.md")
scope = re.findall(r"^\| ((?:[1-5]\.\d+|2[abc]\.\d+)) ·", roadmap, re.M)
scope += re.findall(r"^\| (R\.[1-4]) ·", readiness, re.M)
if scope != MANIFEST["scope"] or len(scope) != len(set(scope)):
    raise ValueError("reviewed milestone scope differs")
completed = MANIFEST["completed"]
if len(completed) != len(set(completed)) or not set(completed) <= set(scope):
    raise ValueError("invalid reviewed achievements")
remaining = [value for value in scope if value not in completed]
print(json.dumps({
    "review_date": MANIFEST["review_date"], "revision": MANIFEST["revision"],
    "completed": len(completed), "total": len(scope), "remaining": len(remaining),
    "percent_exact": 100 * len(completed) / len(scope),
    "percent_rounded": round(100 * len(completed) / len(scope)),
    "completed_ids": completed, "remaining_ids": remaining,
    "basis": "equal-weight formal milestones through R.4, including approved Beta",
    "limits": "not effort, security assurance, time remaining or release readiness",
}, indent=2))
