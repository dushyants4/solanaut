"""Bind the private corrected wallet candidate; preserve earlier manifests."""
import hashlib
import json
from pathlib import Path

previous = json.loads(Path("evals/sdk/adapter-wire/candidate.json").read_text())
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
archives = list(Path(".sandbox/solanaut-1/adapter-buffer").glob("*.tgz"))
assert len(archives) == 1
result = {"scope": "ADP-1 raw-buffer private copy correction; private local component, no release freeze",
          "reviewedBase": "32abc738f436b392f41a0a77643838a143eb3d35",
          "archive": str(archives[0]), "archive_sha256": digest(archives[0])}
changed = {}
for group in ("product_sources", "evaluation_inputs", "compiled_files"):
    paths = list(previous[group])
    if group == "evaluation_inputs":
        paths += ["packages/sdk/test/adapter-buffer.test.ts", "evals/sdk/adapter-buffer/faults.py", "evals/sdk/adapter-buffer/install.py"]
    result[group] = {path: digest(path) for path in sorted(paths)}
    changed[group] = [path for path in paths if previous[group].get(path) != result[group][path]]
Path("evals/sdk/adapter-buffer/candidate.json").write_text(json.dumps(result, indent=2) + "\n")
Path("evals/sdk/adapter-buffer/candidate-diff.json").write_text(json.dumps(changed, indent=2) + "\n")
print(json.dumps({"archiveSha256": result["archive_sha256"], "changed": changed}))
