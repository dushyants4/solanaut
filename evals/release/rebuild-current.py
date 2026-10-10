"""Repeat the approved private build/pack; compare bytes and executable modes."""
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/rebuild-current"
scratch = root / ".sandbox/solanaut-1/rebuild-current"
output.mkdir(parents=True, exist_ok=True)
scratch.mkdir(parents=True, exist_ok=True)
stage = root / ".sandbox/releases/sdk"
sha = lambda data: hashlib.sha256(data).hexdigest()


def fingerprint(directory):
    result = {}
    for path in sorted(directory.rglob("*")):
        assert not path.is_symlink(), "build outputs must be regular files"
        if path.is_file():
            result[str(path.relative_to(directory))] = {"sha256": sha(path.read_bytes()), "mode": path.stat().st_mode & 0o777}
    return result


def command(args, name):
    with (output / name).open("w") as log:
        result = subprocess.run(args, stdout=log, stderr=subprocess.STDOUT)
    assert result.returncode == 0, name + " failed; raw output retained"


def require_same(actual, expected):
    assert actual == expected, "rebuild bytes or executable modes differ"


before = fingerprint(stage)
reference = json.loads((root / "evals/sdk/owned-signing/candidate.json").read_text())
definition = {"scope": "same-host private SDK rebuild only; not clean machine or release freeze", "before": before,
              "lockSha256": sha((root / "package-lock.json").read_bytes()), "referenceArchiveSha256": reference["archive_sha256"]}
for name, args in [("node", ["node", "--version"]), ("npm", ["npm", "--version"]),
                   ("compiler", [str(root / "node_modules/.bin/tsc"), "--version"]), ("revision", ["git", "rev-parse", "HEAD"])]:
    definition[name] = subprocess.check_output(args, text=True).strip()
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
builds = []
for number in (1, 2):
    destination = scratch / str(number)
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir()
    command(["npm", "run", "release:prepare"], f"build-{number}.txt")
    files = fingerprint(stage)
    require_same(files, before)
    command(["npm", "pack", str(stage), "--ignore-scripts", "--json", "--pack-destination", str(destination)], f"pack-{number}.json")
    archives = list(destination.glob("*.tgz"))
    assert len(archives) == 1
    archive = archives[0].read_bytes()
    assert sha(archive) == reference["archive_sha256"], "archive differs from current private candidate"
    builds.append({"files": files, "archiveSha256": sha(archive), "archiveBytes": len(archive)})
require_same(builds[0], builds[1])
# Demonstrate that exact comparison rejects damaged bytes, modes and tarballs.
faults = []
for name in ("file-bytes", "executable-mode", "archive-bytes"):
    damaged = json.loads(json.dumps(builds[1]))
    if name == "file-bytes":
        damaged["files"]["dist/src/index.js"]["sha256"] = sha(b"damaged output")
    elif name == "executable-mode":
        damaged["files"]["dist/bin/replay.js"]["mode"] = 0o644
    else:
        damaged["archiveSha256"] = sha(b"damaged tarball")
    try:
        require_same(damaged, builds[0])
    except AssertionError:
        faults.append(name)
    else:
        raise AssertionError("comparison missed " + name)
identities = {}
for group in ("product_sources", "evaluation_inputs", "compiled_files"):
    expected = reference[group]
    mismatches = [path for path, digest in expected.items() if sha((root / path).read_bytes()) != digest]
    identities[group] = {"count": len(expected), "mismatches": mismatches}
    assert not mismatches, group + " changed"
result = {"ok": True, "builds": builds, "comparisonFaultsCaught": faults, "identities": identities,
          "originalStageUnchanged": fingerprint(stage) == before}
(output / "summary.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"ok": True, "builds": len(builds), "comparisonFaultsCaught": faults,
                  "archiveSha256": builds[0]["archiveSha256"], "originalStageUnchanged": result["originalStageUnchanged"]}))
