"""Run complete controls against isolated copies; never mutate measured sources."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

directory = Path(__file__).parent
module = directory / "package-inventory.py"
tests = directory / "package-inventory.test.py"
output = directory / "package-inventory"
source, test_source = module.read_bytes(), tests.read_bytes()
faults = {
    "root": ('raise ValueError("root identity differs from artifact manifest")', "pass"),
    "archive": ('raise ValueError("archive hash differs from artifact bytes")', "pass"),
    "graph": ('raise ValueError("dependency graph differs from pinned manifest")', "pass"),
    "alias": ("result = copy.deepcopy(raw)", "result = raw"),
}
results = []
for name, (before, after) in faults.items():
    if source.decode().count(before) != 1:
        raise ValueError("fault target is not unique")
    with tempfile.TemporaryDirectory(prefix="solanaut-inventory-fault-") as temporary:
        trial = Path(temporary)
        (trial / module.name).write_text(source.decode().replace(before, after))
        (trial / tests.name).write_bytes(test_source)
        run = subprocess.run(["python", str(trial / tests.name)], capture_output=True, text=True, timeout=30)
        (output / ("fault-" + name + ".txt")).write_text(run.stdout + run.stderr)
        if run.returncode != 1 or "Ran 6 tests" not in run.stderr or "FAILED (failures=" not in run.stderr:
            raise ValueError(f"fault {name} was missed or controls did not complete")
        results.append({"name": name, "exit": run.returncode, "completeControls": True})
if module.read_bytes() != source or tests.read_bytes() != test_source:
    raise ValueError("original inputs changed")
run = subprocess.run(["python", str(tests)], capture_output=True, text=True, timeout=30)
(output / "controls.txt").write_text(run.stdout + run.stderr)
if run.returncode:
    raise ValueError("restored controls failed")
(output / "faults.json").write_text(json.dumps({"faults": results, "originalModuleSha256": hashlib.sha256(source).hexdigest(),
    "testSha256": hashlib.sha256(test_source).hexdigest(), "originalsUnchanged": True, "controlsExit": run.returncode}, indent=2) + "\n")
print("isolated inventory faults caught; original inputs unchanged")
