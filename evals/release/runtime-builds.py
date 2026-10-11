"""Compare fresh approved builds under existing runtimes; preserve prior scratch."""
import copy
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/runtime-builds"
scratch = root / ".sandbox/solanaut-1/runtime-builds"
stage = root / ".sandbox/releases/sdk"
output.mkdir(exist_ok=True)
scratch.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()

def fingerprint(directory):
    rows = {}
    for path in sorted(directory.rglob("*")):
        assert not path.is_symlink(), "build outputs must be regular files"
        if path.is_file():
            rows[str(path.relative_to(directory))] = {"sha256": sha(path.read_bytes()), "mode": path.stat().st_mode & 0o777}
    return rows

def command(args, name):
    with (output / name).open("w") as log:
        result = subprocess.run(args, stdout=log, stderr=subprocess.STDOUT, timeout=120)
    assert result.returncode == 0, name + " failed; raw evidence retained"

reference = json.loads((root / "evals/sdk/adapter-buffer/candidate.json").read_text())
product = {path: sha((root / path).read_bytes()) for path in reference["product_sources"]}
assert product == reference["product_sources"], "current product does not match integrated D40"
paths = ["packages/sdk/bin/prepare-release.ts", "packages/sdk/package.json", "packages/sdk/tsconfig.release.json", "package-lock.json", "evals/packaging/packed-sdk.test.ts", "evals/release/runtime-builds.py"]
inputs = {path: sha((root / path).read_bytes()) for path in paths}
before = fingerprint(stage)
backup = scratch / "prior-stage"
assert not backup.exists(), "preserve existing scratch; choose a fresh qualification directory"
shutil.copytree(stage, backup)
assert fingerprint(backup) == before
definition = {"revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(), "scope": "same-host build and installed package only; existing Node 26 and 24", "product": product, "inputs": inputs, "priorStage": before, "runtimeVersions": ["26.7.0", "24.19.0"], "referenceArchiveSha256": reference["archive_sha256"]}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
builds = []
try:
    for version in definition["runtimeVersions"]:
        prefix = ["mise", "exec", "node@" + version, "--"]
        node = subprocess.check_output(prefix + ["node", "--version"], text=True).strip()
        assert node == "v" + version
        npm = subprocess.check_output(prefix + ["npm", "--version"], text=True).strip()
        destination = scratch / version
        destination.mkdir()
        command(prefix + ["npm", "run", "release:prepare"], version + "-build.txt")
        files = fingerprint(stage)
        command(prefix + ["npm", "pack", str(stage), "--ignore-scripts", "--json", "--pack-destination", str(destination)], version + "-pack.json")
        archives = list(destination.glob("*.tgz"))
        assert len(archives) == 1
        archive = archives[0].read_bytes()
        build = {"node": node, "npm": npm, "files": files, "archiveSha256": sha(archive), "archiveBytes": len(archive)}
        builds.append(build)
        (output / (version + "-manifest.json")).write_text(json.dumps(build, indent=2) + "\n")
        assert build["archiveSha256"] == reference["archive_sha256"], "current archive differs from integrated D40"
        command(prefix + ["node", "--test", "evals/packaging/packed-sdk.test.ts"], version + "-installed.txt")
    comparable = lambda build: {key: build[key] for key in ("files", "archiveSha256", "archiveBytes")}
    first, second = map(comparable, builds)
    assert first == second, "runtime builds differ"
    caught = []
    for name in ("file-bytes", "executable-mode", "archive-bytes", "omitted-file"):
        damaged = copy.deepcopy(second)
        if name == "file-bytes": damaged["files"]["dist/src/index.js"]["sha256"] = sha(b"damaged")
        elif name == "executable-mode": damaged["files"]["dist/bin/replay.js"]["mode"] = 0o644
        elif name == "archive-bytes": damaged["archiveSha256"] = sha(b"damaged archive")
        else: damaged["files"].pop("dist/src/index.js")
        (output / (name + "-fault.json")).write_text(json.dumps(damaged, indent=2) + "\n")
        try: assert damaged == first, "runtime build comparison refused"
        except AssertionError as error:
            caught.append(name)
            (output / (name + "-refusal.txt")).write_text(str(error) + "\n")
        else: raise AssertionError("comparison missed " + name)
    assert {path: sha((root / path).read_bytes()) for path in product} == product
    assert {path: sha((root / path).read_bytes()) for path in inputs} == inputs
    (output / "result.json").write_text(json.dumps({"ok": True, "runtimeVersions": definition["runtimeVersions"], "archiveSha256": builds[0]["archiveSha256"], "comparisonFaultsCaught": caught, "clearance": False}, indent=2) + "\n")
finally:
    shutil.rmtree(stage)
    shutil.copytree(backup, stage)
    assert fingerprint(stage) == before, "prior stage restoration differs"
    (output / "restoration.json").write_text(json.dumps({"priorStageRestored": True, "productUnchanged": {path: sha((root / path).read_bytes()) for path in product} == product}, indent=2) + "\n")
print("existing-runtime build/pack comparison and installed checks complete; prior stage restored")
