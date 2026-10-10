"""Bind current private component inputs and emitted tarball without release claims."""
import hashlib
import json
from pathlib import Path

previous = json.loads(Path("evals/sdk/owned-report/installed-candidate.json").read_text())
archive = Path(".sandbox/solanaut-1/owned-signing/solanaut-sdk-0.0.0.tgz")
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
result = dict(
    scope="private queued signing journal; no staged mutation or release qualification",
    reviewed_base="f6d5e298924e752ba05cb97eb02914634b95f42f",
    archive=str(archive), archive_sha256=digest(archive),
)
for name in ("product_sources", "evaluation_inputs", "compiled_files"):
    paths = list(previous[name])
    if name == "evaluation_inputs":
        paths += ["packages/sdk/test/owned-signing.test.ts", "evals/sdk/owned-signing/faults.py", "evals/sdk/owned-signing/install.py"]
    result[name] = {path: digest(path) for path in sorted(paths)}
Path("evals/sdk/owned-signing/candidate.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({name: len(result[name]) for name in ("product_sources", "evaluation_inputs", "compiled_files")}))
