"""Exercise reason-index refusals in isolated data copies, not a release gate."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

root = Path.cwd()
script = Path("evals/release/assertion-reasons-complete.py")
scratch = Path(".sandbox/assertion-reasons-controls")
destination = Path("evals/release/assertion-reasons-complete/controls.json")
assert not scratch.exists() and not destination.exists(), "preserve earlier controls before regeneration"
inputs = json.loads(Path("evals/release/assertion-reasons-complete/inputs.json").read_text())
for relative, digest in inputs.items():
    assert hashlib.sha256((root / relative).read_bytes()).hexdigest() == digest, "original index input changed"
scratch.mkdir()
results = []
for fault in ["none", "duplicate-edge", "foreign-edge", "wrong-range", "missing-edge", "invalid-binding"]:
    work = scratch / fault
    work.mkdir()
    for relative in inputs:
        target = work / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / relative, target)
    target = work / "evals/release/assertion-consumers/edges.json"
    rows = json.loads(target.read_text())
    if fault == "duplicate-edge":
        rows.append(rows[0])
    elif fault == "foreign-edge":
        rows[0]["commit"] = "0" * 40
    elif fault == "missing-edge":
        rows.pop()
    elif fault == "invalid-binding":
        rows[0]["beforeSha256"] = "unbound"
    target.write_text(json.dumps(rows))
    if fault == "wrong-range":
        target = work / "evals/release/assertion-consumers/definition.json"
        value = json.loads(target.read_text())
        value["head"] = "0" * 40
        target.write_text(json.dumps(value))
    child = subprocess.run([sys.executable, str(script)], cwd=work, capture_output=True, text=True, timeout=15)
    results.append({"fault": fault, "status": child.returncode, "stdout": child.stdout, "stderr": child.stderr})
    assert child.returncode == (0 if fault == "none" else 1)
    if fault == "none":
        summary = json.loads(child.stdout)
        assert summary["modificationEdges"] == summary["edgesLinkedToScopedBuilderReasons"] == 142
        assert summary["edgesWithoutIndexedReason"] == 0 and summary["reasonReceipts"] == 10
        assert not any(summary[field] for field in ["initialAdditionsReviewed", "completeHistoryReview", "independentReview", "publicHistoryClearance", "releaseClearance"])
for relative, digest in inputs.items():
    assert hashlib.sha256((root / relative).read_bytes()).hexdigest() == digest, "original input changed during controls"
destination.write_text(json.dumps({"scriptSha256": hashlib.sha256(script.read_bytes()).hexdigest(),
    "controlSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "results": results}, indent=2) + "\n")
print("positive reason index passes; duplicate/foreign/range/missing/binding faults refuse; original inputs unchanged")
