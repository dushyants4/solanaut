"""Run the original mixed replay workload through an installed compiled SDK."""
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/installed-replay"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another run")
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
archive = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
assert sha(archive) == "55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d"
paths = ["evals/ci/replay.ts", "packages/sdk/test/support/workload.ts", "packages/sdk/test/support/craft.ts",
         "package-lock.json", "evals/release/installed-replay.py"]
inputs = {path: sha(root / path) for path in paths}
product = json.loads((root / "evals/release/runtime-builds/definition.json").read_text())["product"]
assert all(sha(root / path) == digest for path, digest in product.items())
definition = {"revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "archiveSha256": sha(archive), "inputs": inputs, "product": product,
              "scope": "original deterministic mixed workload and expected head; installed public SDK, repository craft oracle; not snapshots or isolated recovery"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
scratch = root / ".sandbox/installed-replay"
scratch.mkdir(exist_ok=True)
(scratch / "job.json").write_text(json.dumps({"pid": os.getpid(), "group": os.getpgrp(), "command": "uv run --script evals/release/installed-replay.py", "state": "running"}, indent=2) + "\n")
faults = [
    ("replayed-count", "export async function replay(entries, policyInput, sensor = sensorV1, trust) {", "export async function replay(entries, policyInput, sensor = sensorV1, trust) { return {ok: true, decisions: 0, divergence: null};"),
    ("skip-reports", "return { accept(e) {", 'return { accept(e) { if (e.kind === "report") return null;'),
    ("landed-substitution", "decision: decisionHash, outcome, source:", 'decision: decisionHash, outcome: "landed", source:'),
]
results = []
with tempfile.TemporaryDirectory(prefix="solanaut-installed-replay-") as directory:
    consumer = Path(directory)
    (consumer / "package.json").write_text('{"private":true,"type":"module"}\n')
    install = subprocess.run(["npm", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", str(archive)], cwd=consumer, capture_output=True, text=True, timeout=60)
    (output / "install.txt").write_text(install.stdout + install.stderr)
    assert install.returncode == 0
    package = consumer / "node_modules/@solanaut/sdk"
    assert package.is_dir() and not package.is_symlink()
    workload = (root / paths[1]).read_text()
    for relative in ("../../src/base58.ts", "../../src/guard.ts", "../../src/policy.ts"):
        assert workload.count(json.dumps(relative)) == 1
        workload = workload.replace(json.dumps(relative), '"@solanaut/sdk"')
    assert workload.count('"./craft.ts"') == 1
    workload = workload.replace('"./craft.ts"', json.dumps((root / paths[2]).as_uri()))
    runner = (root / paths[0]).read_text()
    assert runner.count('"../../packages/sdk/src/guard.ts"') == 1
    assert runner.count('"../../packages/sdk/test/support/workload.ts"') == 1
    runner = runner.replace('"../../packages/sdk/src/guard.ts"', '"@solanaut/sdk"')
    runner = runner.replace('"../../packages/sdk/test/support/workload.ts"', '"./workload.ts"')
    entry = consumer / "replay.ts"
    entry.write_text(runner)
    (consumer / "workload.ts").write_text(workload)
    (output / "relocated-runner.txt").write_text(runner)
    (output / "relocated-workload.txt").write_text(workload)
    implementation = package / "dist/src/guard.js"
    original = implementation.read_bytes()
    try:
        for name, before, after in faults:
            source = original.decode()
            assert source.count(before) == 1
            implementation.write_text(source.replace(before, after))
            run = subprocess.run(["node", str(entry)], cwd=consumer, capture_output=True, text=True, timeout=120)
            (output / (name + "-red.txt")).write_text(run.stdout + run.stderr)
            evidence = json.loads(run.stdout.splitlines()[0])
            assert run.returncode == 1 and evidence["decisions"] == 10000
            assert "replay incomplete or divergent" in run.stderr or "replay baseline digest differs" in run.stderr
            results.append({"fault": name, "exit": run.returncode, "evidence": evidence})
            implementation.write_bytes(original)
    finally:
        implementation.write_bytes(original)
    controls = []
    for version in ("26.7.0", "24.19.0"):
        run = subprocess.run(["mise", "exec", "node@" + version, "--", "node", str(entry)], cwd=consumer, capture_output=True, text=True, timeout=120)
        (output / (version + "-green.txt")).write_text(run.stdout + run.stderr)
        evidence = json.loads(run.stdout.splitlines()[0])
        assert run.returncode == 0 and evidence["ok"] and evidence["decisions"] == evidence["replayed"] == 10000
        controls.append({"node": version, "exit": run.returncode, "evidence": evidence})
    assert implementation.read_bytes() == original
assert sha(archive) == definition["archiveSha256"]
assert all(sha(root / path) == digest for path, digest in {**inputs, **product}.items())
(output / "result.json").write_text(json.dumps({"faults": results, "controls": controls, "installedBytesRestored": True,
    "boundInputsUnchanged": True, "consumerRemoved": True, "releaseClearance": False}, indent=2) + "\n")
(scratch / "complete.json").write_text(json.dumps({"pid": os.getpid(), "state": "completed", "exit": 0}) + "\n")
print("installed mixed replay passes on existing runtimes; isolated faults caught and restored")
