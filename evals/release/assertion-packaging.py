"""Collect selected package-consumer test edits for a scoped manual review."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-packaging"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another collection")
input_bytes = (root / "evals/release/assertion-history/actual.json").read_bytes()
assert hashlib.sha256(input_bytes).hexdigest() == "f813d4f9f5c54e8bfd0dd5e626680abb3978f1789a42c08309d35c7eb09eaf4b"
report = json.loads(input_bytes)
target = "evals/packaging/packed-sdk.test.ts"
selected = {"805e8bb", "6162efb", "8a343d4", "4d9d1fe", "701372e"}
definition = {"baseline": report["baseline"], "head": report["head"], "inventorySha256": hashlib.sha256(input_bytes).hexdigest(),
              "collectorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "selectedCommitPrefixes": sorted(selected), "scope": "selected historical package-consumer assertions, not complete package or public-history review"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
rows, patches = [], []
for edge in report["edges"]:
    if edge["path"] != target or edge["status"] != "M" or edge["commit"][:7] not in selected:
        continue
    command = ["git", "--no-replace-objects", "diff", "--no-ext-diff", "--no-textconv", "--unified=2", edge["parent"], edge["commit"], "--", target]
    patch = subprocess.check_output(command, timeout=30)
    before = subprocess.check_output(["git", "--no-replace-objects", "show", edge["parent"] + ":" + target], timeout=30)
    after = subprocess.check_output(["git", "--no-replace-objects", "show", edge["commit"] + ":" + target], timeout=30)
    rows.append({**edge, "beforeSha256": hashlib.sha256(before).hexdigest(),
                 "afterSha256": hashlib.sha256(after).hexdigest(), "diffSha256": hashlib.sha256(patch).hexdigest()})
    patches.append(edge["commit"].encode() + b"\n" + patch)
assert {row["commit"][:7] for row in rows} == selected
(output / "edges.json").write_text(json.dumps(rows, indent=2) + "\n")
(output / "edges.diff").write_bytes(b"\n".join(patches))
(output / "result.json").write_text(json.dumps({"selectedEdgesCollected": len(rows), "automatedReasonReview": False,
    "completePackagingHistoryReview": False, "independentReview": False, "releaseClearance": False}, indent=2) + "\n")
print("selected package-consumer assertion evidence collected; complete review remains pending")
