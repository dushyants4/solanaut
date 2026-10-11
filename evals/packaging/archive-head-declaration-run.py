"""Reproduce the copied declaration fault; no maintained gate/product edits."""
import hashlib
import json
import subprocess
import tarfile
from pathlib import Path

root = Path.cwd()
scratch = root / ".sandbox/archive-head-declaration-reproduce"
assert not scratch.exists(), "preserve earlier reproduction before rerunning"
inputs = json.loads((root / "evals/packaging/archive-head-declaration/inputs.json").read_text())
source = root / "evals/packaging/packed-sdk.test.ts"
original = source.read_bytes()
assert hashlib.sha256(original).hexdigest() == inputs["maintainedTestSha256"]
archive = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
assert hashlib.sha256(archive.read_bytes()).hexdigest() == inputs["archiveSha256"]
scratch.mkdir()
for kind in ["baseline", "head-fault", "anchor-fault"]:
    directory = scratch / kind
    directory.mkdir()
    with tarfile.open(archive) as package:
        package.extractall(directory, filter="data")
    declaration = directory / "package/dist/src/archive.d.ts"
    text = declaration.read_text()
    if kind != "baseline":
        token = ' | "' + ("head" if kind == "head-fault" else "anchor") + '"'
        assert text.count(token) == 1
        declaration.write_text(text.replace(token, ""))
proposed = original.decode()
for name in ["craft", "workload"]:
    old = "../../packages/sdk/test/support/" + name + ".ts"
    assert proposed.count(old) == 1
    proposed = proposed.replace(old, str(root / "packages/sdk/test/support" / (name + ".ts")))
old_root = 'const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");'
assert proposed.count(old_root) == 1
proposed = proposed.replace(old_root, "const root = " + json.dumps(str(root)) + ";")
old = "    const code: ArchiveErrorCode = 'anchor';"
assert proposed.count(old) == 1
proposed = proposed.replace(old, old + "\n    const headCode: ArchiveErrorCode = 'head';\n    void headCode;")
assert hashlib.sha256(proposed.encode()).hexdigest() == inputs["proposedTestSha256"]
copied = scratch / "proposed.test.ts"
copied.write_text(proposed)
cases = [("baseline", source, 0, 19), ("head-fault", source, 0, 19),
         ("anchor-fault", source, 1, 18), ("head-fault", copied, 1, 18), ("baseline", copied, 0, 19)]
results = []
for index, (kind, test, expected_status, passed) in enumerate(cases):
    import os
    env = {**os.environ, "SOLANAUT_PACKAGE": str(scratch / kind / "package")}
    child = subprocess.run(["node", "--test", str(test)], cwd=root, env=env, capture_output=True, text=True, timeout=60)
    (scratch / (str(index) + ".txt")).write_text(child.stdout + child.stderr)
    assert child.returncode == expected_status
    for token in ["tests 19", "pass " + str(passed), "fail " + str(19 - passed), "cancelled 0", "skipped 0", "todo 0"]:
        assert token in child.stdout, "incomplete or unexpected control population"
    if expected_status:
        missing = "anchor" if kind == "anchor-fault" else "head"
        assert "TS2322" in child.stdout and "Type '\"" + missing + "\"' is not assignable" in child.stdout
    results.append({"kind": kind, "proposed": test == copied, "status": child.returncode, "tests": 19, "pass": passed})
assert source.read_bytes() == original
assert hashlib.sha256(archive.read_bytes()).hexdigest() == inputs["archiveSha256"]
(scratch / "result.json").write_text(json.dumps({"results": results, "maintainedGateChanged": False, "releaseClearance": False}, indent=2) + "\n")
print("complete declaration controls reproduce the maintained head miss, active anchor refusal and proposed head refusal")
