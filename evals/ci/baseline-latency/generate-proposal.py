"""Generate the exact H11 review copy; never edit the protected original."""
import hashlib
import json
from pathlib import Path

root = Path.cwd()
path = root / "evals/ci/mutation-recovery.test.ts"
original = path.read_bytes()
source = original.decode()
edits = [("const end=Date.now()+20000;", "const end=Date.now()+60000;"),
         ("staged baseline incomplete after unchanged wait", "staged baseline incomplete after configured harness wait")]
for before, after in edits:
    assert source.count(before) == 1
    source = source.replace(before, after)
for relative in ("./mutation-recovery.ts", "../../tools/run-supervisor.ts", "../../tools/stop-supervised-run.ts"):
    assert source.count(json.dumps(relative)) == 1
    source = source.replace(json.dumps(relative), json.dumps(str((path.parent / relative).resolve())))
destination = root / ".sandbox/solanaut-1/status-diagnostic/proposed-wait.test.ts"
destination.write_text(source)
digest = lambda value: hashlib.sha256(value).hexdigest()
assert path.read_bytes() == original
manifest = {"scope": "unapplied H11 review copy only; original backend, tests and limits remain",
            "originalSha256": digest(original), "generatedSha256": digest(destination.read_bytes()),
            "patchSha256": digest((root / "evals/ci/baseline-latency/owner-wait.patch").read_bytes()),
            "edits": edits, "importRelocations": 3, "destination": str(destination)}
(root / "evals/ci/baseline-latency/proposal-inputs.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest))
