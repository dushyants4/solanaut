"""Reproduce data-index controls in isolated copies; not a release gate."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

root = Path.cwd()
script = Path("evals/release/assertion-review-map.py")
scratch = Path(".sandbox/assertion-review-map-controls")
destination = Path("evals/release/assertion-review-map/controls.json")
assert not scratch.exists() and not destination.exists(), "preserve earlier controls before regeneration"
scratch.mkdir()
inputs = json.loads(Path("evals/release/assertion-review-map/inputs.json").read_text())
results = []
for fault in ["none", "duplicate-edge", "foreign-edge", "wrong-range"]:
    work = scratch / fault
    work.mkdir()
    for relative in inputs:
        target = work / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / relative, target)
    if fault in ["duplicate-edge", "foreign-edge"]:
        target = work / "evals/release/assertion-signer/edges.json"
        rows = json.loads(target.read_text())
        if fault == "duplicate-edge":
            rows.append(rows[0])
        else:
            rows[0]["commit"] = "0" * 40
        target.write_text(json.dumps(rows))
    if fault == "wrong-range":
        target = work / "evals/release/assertion-signer/definition.json"
        value = json.loads(target.read_text())
        value["head"] = "0" * 40
        target.write_text(json.dumps(value))
    child = subprocess.run([sys.executable, str(script)], cwd=work, capture_output=True, text=True, timeout=15)
    results.append({"fault": fault, "status": child.returncode, "stdout": child.stdout, "stderr": child.stderr})
    assert child.returncode == (0 if fault == "none" else 1)
    if fault == "none":
        report = json.loads(child.stdout)
        assert report["modificationEdges"] == 142 and report["edgesLinkedToScopedBuilderReasons"] == 63 and report["edgesWithoutIndexedReason"] == 79
        assert not any(report[field] for field in ["completeHistoryReview", "independentReview", "publicHistoryClearance", "releaseClearance"])
destination.write_text(json.dumps({"scriptSha256": hashlib.sha256(script.read_bytes()).hexdigest(), "results": results}, indent=2) + "\n")
print("data-index control passes; duplicate, foreign edge and wrong range refuse in isolated copies")
