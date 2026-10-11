"""Collect owned-guard historical assertion diffs for manual handoff review."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-owned"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another collection")
inventory = (root / "evals/release/assertion-history/actual.json").read_bytes()
assert hashlib.sha256(inventory).hexdigest() == "f813d4f9f5c54e8bfd0dd5e626680abb3978f1789a42c08309d35c7eb09eaf4b"
report = json.loads(inventory)
target = "packages/sdk/test/owned-guard.test.ts"
selected = {"944579d", "4d9d1fe", "7a64856", "4addaa4", "f1e253f"}
definition = {"baseline": report["baseline"], "head": report["head"],
              "inventorySha256": hashlib.sha256(inventory).hexdigest(),
              "collectorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "selectedCommitPrefixes": sorted(selected), "path": target,
              "currentRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "currentTestSha256": hashlib.sha256((root / target).read_bytes()).hexdigest(),
              "scope": "owned-guard test modification edges only, not complete or independent history review"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
rows, patches = [], []
for edge in report["edges"]:
    if edge["path"] != target or edge["status"] != "M" or edge["commit"][:7] not in selected:
        continue
    patch = subprocess.check_output(["git", "--no-replace-objects", "diff", "--no-ext-diff", "--no-textconv", "--unified=3", edge["parent"], edge["commit"], "--", target], timeout=30)
    before = subprocess.check_output(["git", "--no-replace-objects", "show", edge["parent"] + ":" + target], timeout=30)
    after = subprocess.check_output(["git", "--no-replace-objects", "show", edge["commit"] + ":" + target], timeout=30)
    rows.append({**edge, "beforeSha256": hashlib.sha256(before).hexdigest(), "afterSha256": hashlib.sha256(after).hexdigest(),
                 "diffSha256": hashlib.sha256(patch).hexdigest(), "currentTestEqualsSelectedRevision": hashlib.sha256(after).hexdigest() == definition["currentTestSha256"]})
    patches.append(edge["commit"].encode() + b"\n" + patch)
assert {row["commit"][:7] for row in rows} == selected
(output / "edges.json").write_text(json.dumps(rows, indent=2) + "\n")
(output / "edges.diff").write_bytes(b"\n".join(patches))
(output / "result.json").write_text(json.dumps({"selectedEdgesCollected": len(rows), "automatedReasonReview": False,
    "completeHistoryReview": False, "independentReview": False, "releaseClearance": False}, indent=2) + "\n")
print("owned-guard assertion diffs collected; broader and independent review remain pending")
