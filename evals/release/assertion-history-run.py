"""Freeze and qualify the metadata-only assertion-review inventory."""
import hashlib
import json
import os
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-history"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another run")
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
paths = ["evals/release/assertion-history.py", "evals/release/assertion-history.test.mjs", "evals/release/assertion-history-run.py"]
inputs = {path: sha(root / path) for path in paths}
baseline = "e925f1dfaabc7eedae361764a401baf7f9e9868b"
head = "753769dcd435b9334e59e921727c04afd6cb6859"
assert subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() == head
definition = {"baseline": baseline, "head": head, "inputs": inputs, "scope": "bounded named Node tests, all ancestry/parent edges, metadata only"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
scratch = root / ".sandbox/assertion-history"
scratch.mkdir(exist_ok=True)
(scratch / "job.json").write_text(json.dumps({"pid": os.getpid(), "group": os.getpgrp(), "state": "running"}, indent=2) + "\n")
original = (root / paths[0]).read_text()
faults = [
    ("omit-modified", "if not test_name.search(path):", 'if status == "M" or not test_name.search(path):'),
    ("first-parent-only", '"--topo-order"', '"--first-parent"'),
    ("omit-deleted", "if not test_name.search(path):", 'if status == "D" or not test_name.search(path):'),
    ("skip-scope-refusal", "if not bounded(path):", "if False and not bounded(path):"),
    ("skip-mode-check", 'mode not in (b"100644", b"100755")', "False"),
    ("skip-pin-check", "for pin in (baseline, head):", "for pin in ():"),
    ("false-review-clearance", '"assertionEditsReviewed": False', '"assertionEditsReviewed": True'),
]
results = []
candidate = scratch / "candidate.py"
try:
    for name, before, after in faults:
        assert original.count(before) == 1
        candidate.write_text(original.replace(before, after))
        environment = {**os.environ, "ASSERTION_HISTORY_HELPER": str(candidate)}
        run = subprocess.run(["node", "--test", paths[1]], env=environment, capture_output=True, text=True, timeout=60)
        (output / (name + "-red.txt")).write_text(run.stdout + run.stderr)
        assert run.returncode == 1 and "tests 6" in run.stdout and "skipped 0" in run.stdout
        assert "cancelled 0" in run.stdout and "todo 0" in run.stdout
        results.append({"fault": name, "exit": run.returncode})
finally:
    candidate.unlink(missing_ok=True)
for version in ("26.7.0", "24.19.0"):
    run = subprocess.run(["mise", "exec", "node@" + version, "--", "node", "--test", paths[1]], capture_output=True, text=True, timeout=60)
    (output / (version + "-green.txt")).write_text(run.stdout + run.stderr)
    assert run.returncode == 0 and "tests 6" in run.stdout and "fail 0" in run.stdout
run = subprocess.run(["python", paths[0], "--baseline", baseline, "--head", head], capture_output=True, text=True, timeout=60)
(output / "actual.json").write_text(run.stdout)
(output / "actual-stderr.txt").write_text(run.stderr)
assert run.returncode == 0
report = json.loads(run.stdout)
assert report["head"] == head and report["baseline"] == baseline
assert report["fileBlobsRead"] is False and report["assertionEditsReviewed"] is False
assert all(sha(root / path) == digest for path, digest in inputs.items())
edited = sorted({edge["path"] for edge in report["edges"] if edge["status"] != "A"})
(output / "result.json").write_text(json.dumps({"faults": results, "actualCounts": report["counts"],
    "commits": len(report["commits"]), "editedTestFiles": edited, "boundInputsUnchanged": True,
    "candidateRemoved": True, "reviewComplete": False, "releaseClearance": False}, indent=2) + "\n")
(scratch / "complete.json").write_text(json.dumps({"pid": os.getpid(), "state": "completed", "exit": 0}) + "\n")
print("all-parent assertion metadata inventory complete; content/reason review remains pending")
