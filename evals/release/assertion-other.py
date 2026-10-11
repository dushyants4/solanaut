"""Collect remaining small named-test edits from the frozen pending index."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-other"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another collection")
inventory = (root / "evals/release/assertion-history/actual.json").read_bytes()
pending = (root / "evals/release/assertion-review-map/pending.json").read_bytes()
assert hashlib.sha256(inventory).hexdigest() == "f813d4f9f5c54e8bfd0dd5e626680abb3978f1789a42c08309d35c7eb09eaf4b"
assert hashlib.sha256(pending).hexdigest() == "d9df72e8dd01c73d74b7d5a577c31ea2abf51ddf685388bbb38a2d889a1d31a1"
report = json.loads(inventory)
excluded = {"evals/ci/coverage.test.ts", "evals/ci/mutation-stage.test.ts", "evals/packaging/packed-sdk.test.ts"}
selected = [row for row in json.loads(pending) if row["path"] not in excluded]
assert len(selected) == 15
known = {(row["parent"], row["commit"], row["path"]) for row in report["edges"] if row["status"] == "M"}
assert all((row["parent"], row["commit"], row["path"]) in known for row in selected)
definition = {"baseline": report["baseline"], "head": report["head"],
              "inventorySha256": hashlib.sha256(inventory).hexdigest(), "pendingSha256": hashlib.sha256(pending).hexdigest(),
              "collectorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "selected": selected,
              "currentRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "scope": "remaining small modification patches from frozen index, not complete or independent history review"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
rows, patches = [], []
for edge in selected:
    target = edge["path"]
    patch = subprocess.check_output(["git", "--no-replace-objects", "diff", "--no-ext-diff", "--no-textconv", "--unified=2", edge["parent"], edge["commit"], "--", target], timeout=30)
    before = subprocess.check_output(["git", "--no-replace-objects", "show", edge["parent"] + ":" + target], timeout=30)
    after = subprocess.check_output(["git", "--no-replace-objects", "show", edge["commit"] + ":" + target], timeout=30)
    rows.append({**edge, "beforeSha256": hashlib.sha256(before).hexdigest(), "afterSha256": hashlib.sha256(after).hexdigest(),
                 "diffSha256": hashlib.sha256(patch).hexdigest(), "currentTestSha256": hashlib.sha256((root / target).read_bytes()).hexdigest()})
    patches.append(edge["commit"].encode() + b"\n" + patch)
(output / "edges.json").write_text(json.dumps(rows, indent=2) + "\n")
(output / "edges.diff").write_bytes(b"\n".join(patches))
(output / "result.json").write_text(json.dumps({"selectedEdgesCollected": len(rows), "automatedReasonReview": False,
    "completeHistoryReview": False, "independentReview": False, "releaseClearance": False}, indent=2) + "\n")
print("remaining small assertion patches collected; broader and independent review remain pending")
