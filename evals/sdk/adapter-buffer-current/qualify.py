"""Qualify the preserved D40 candidate without overwriting prior receipts."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

root = Path.cwd()
output = root / "evals/sdk/adapter-buffer-current"
scratch = root / ".sandbox/solanaut-1/adapter-buffer-current"
scratch.mkdir(parents=True, exist_ok=True)
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
mode = sys.argv[1]
assert mode in ("--source", "--compiled", "--installed", "--bind")
previous = json.loads(Path("evals/sdk/adapter-buffer/candidate.json").read_text())
for path in ("packages/sdk/src/adapters/agent-kit.ts", "packages/sdk/test/adapter-buffer.test.ts"):
    group = "product_sources" if "/src/" in path else "evaluation_inputs"
    assert digest(path) == previous[group][path], path
if mode == "--bind":
    archives = list(scratch.glob("*.tgz"))
    assert len(archives) == 1
    result = {"scope": "current D40 integration qualification; local only, not a release freeze",
              "reviewedBase": "11234ccf65d80c1a0d2162a53321b6c2e9acc9a7",
              "archive": str(archives[0].relative_to(root)), "archive_sha256": digest(archives[0])}
    for group in ("product_sources", "evaluation_inputs", "compiled_files"):
        result[group] = {path: digest(path) for path in previous[group]}
        assert result[group] == previous[group], group
    result["qualification_helper_sha256"] = digest(__file__)
    (output / "candidate.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"matchesPreservedCandidate": True, "archiveSha256": result["archive_sha256"]}))
else:
    helper = Path("evals/sdk/adapter-buffer/install.py" if mode == "--installed" else "evals/sdk/adapter-buffer/faults.py")
    original = helper.read_text()
    assert digest(helper) == previous["evaluation_inputs"][str(helper)]
    # Only output and scratch locations change; test populations and assertions stay exact.
    generated = original.replace("evals/sdk/adapter-buffer/", "evals/sdk/adapter-buffer-current/")
    generated = generated.replace('root / "evals/sdk/adapter-buffer"', 'root / "evals/sdk/adapter-buffer-current"')
    generated = generated.replace(".sandbox/solanaut-1/adapter-buffer", ".sandbox/solanaut-1/adapter-buffer-current")
    target = scratch / ("installed.py" if mode == "--installed" else "faults.py")
    target.write_text(generated)
    (output / (target.name + ".txt")).write_text(generated)
    args = [sys.executable, str(target)] + (["--compiled"] if mode == "--compiled" else [])
    result = subprocess.run(args)
    assert helper.read_text() == original
    assert result.returncode == 0, result.returncode
