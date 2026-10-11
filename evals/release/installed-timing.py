"""Measure the installed SDK with the unchanged scoped timing analysis."""
import gzip
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/installed-timing"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another run")
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
archive = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
assert sha(archive) == "55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d"
paths = ["evals/ci/sdk-timing/measure.mjs", "evals/ci/sdk-timing/definition.json", "evals/ci/sdk-timing/verify-history.mjs",
         "evals/ci/performance.ts", "packages/sdk/test/support/workload.ts", "packages/sdk/test/support/craft.ts",
         "package-lock.json", "evals/release/installed-timing.py"]
inputs = {path: sha(root / path) for path in paths}
product = json.loads((root / "evals/release/runtime-builds/definition.json").read_text())["product"]
assert all(sha(root / path) == digest for path, digest in product.items())
original_definition = json.loads((root / paths[1]).read_text())
definition = {**original_definition, "revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "inputs": {**product, **inputs}, "archiveSha256": sha(archive),
              "scope": "unchanged scoped analysis/workload; fresh installed D40 input binding, not a complete performance gate"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
scratch = root / ".sandbox/installed-timing"
scratch.mkdir(exist_ok=True)
(scratch / "job.json").write_text(json.dumps({"pid": os.getpid(), "group": os.getpgrp(), "state": "running"}, indent=2) + "\n")

def run_logged(command, cwd, name):
    run = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=180)
    (output / (name + ".txt")).write_text(run.stdout + run.stderr)
    return run

with tempfile.TemporaryDirectory(prefix="solanaut-installed-timing-") as directory:
    consumer = Path(directory)
    (consumer / "package.json").write_text('{"private":true,"type":"module"}\n')
    install = run_logged(["npm", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", str(archive)], consumer, "install")
    assert install.returncode == 0
    package = consumer / "node_modules/@solanaut/sdk"
    assert package.is_dir() and not package.is_symlink()
    workload = (root / paths[4]).read_text()
    for relative in ("../../src/base58.ts", "../../src/guard.ts", "../../src/policy.ts"):
        workload = workload.replace(json.dumps(relative), '"@solanaut/sdk"')
    workload = workload.replace('"./craft.ts"', json.dumps((root / paths[5]).as_uri()))
    runner = (root / paths[0]).read_text()
    substitutions = [("'../../../packages/sdk/src/guard.ts'", "'@solanaut/sdk'"),
                     ("'../../../packages/sdk/test/support/workload.ts'", "'./workload.ts'"),
                     ("'../performance.ts'", json.dumps((root / paths[3]).as_uri())),
                     ("resolve(dirname(fileURLToPath(import.meta.url)), '../../..')", json.dumps(str(root))),
                     ("resolve(root, 'evals/ci/sdk-timing/definition.json')", json.dumps(str(output / "definition.json")))]
    for before, after in substitutions:
        assert runner.count(before) == 1
        runner = runner.replace(before, after)
    (consumer / "measure.mjs").write_text(runner)
    (consumer / "workload.ts").write_text(workload)
    (output / "relocated-runner.txt").write_text(runner)
    (output / "relocated-workload.txt").write_text(workload)
    # Original archived pins must refuse the different current product.
    old = run_logged(["node", str(root / paths[0]), "--check-inputs"], root, "archived-pins-refusal")
    assert old.returncode == 1 and "frozen input differs" in old.stderr
    implementation = package / "dist/src/guard.js"
    original = implementation.read_bytes()
    needle = "export async function replay(entries, policyInput, sensor = sensorV1, trust) {"
    assert original.decode().count(needle) == 1
    try:
        implementation.write_text(original.decode().replace(needle, needle + ' console.error(JSON.stringify({plantedGeneratedDecisions: entries.filter(e => e.kind === "decision").length})); return {ok:true,decisions:0,divergence:null};'))
        red = run_logged(["node", "measure.mjs", str(scratch / "fault")], consumer, "zero-replay-red")
        assert red.returncode == 1 and '"plantedGeneratedDecisions":10000' in red.stderr and "replay incomplete or divergent" in red.stderr
    finally:
        implementation.write_bytes(original)
    green = run_logged(["node", "measure.mjs", str(scratch / "measured")], consumer, "measurement")
    assert green.returncode == 0
    verifier = (root / paths[2]).read_text().replace("'../../../packages/sdk/src/guard.ts'", "'@solanaut/sdk'").replace("'../../../packages/sdk/test/support/workload.ts'", "'./workload.ts'")
    verifier = verifier.replace("new URL('./definition.json', import.meta.url)", json.dumps(str(output / "definition.json")))
    (consumer / "verify.mjs").write_text(verifier)
    (output / "relocated-verifier.txt").write_text(verifier)
    verified = run_logged(["node", "verify.mjs", str(scratch / "measured/history.jsonl")], consumer, "persisted-verification")
    assert verified.returncode == 0
    assert implementation.read_bytes() == original
for name in ("memory.json", "synced-file.json", "metadata.json", "completion.json"):
    (output / name).write_bytes((scratch / "measured" / name).read_bytes())
history = (scratch / "measured/history.jsonl").read_bytes()
(output / "history.jsonl.gz").write_bytes(gzip.compress(history, mtime=0))
assert gzip.decompress((output / "history.jsonl.gz").read_bytes()) == history
assert all(sha(root / path) == digest for path, digest in {**inputs, **product}.items())
assert sha(archive) == definition["archiveSha256"]
(output / "result.json").write_text(json.dumps({"installedBytesRestored": True, "boundInputsUnchanged": True,
    "consumerRemoved": True, "historySha256": hashlib.sha256(history).hexdigest(), "historyBytes": len(history),
    "compressedHistorySha256": sha(output / "history.jsonl.gz"), "releaseClearance": False}, indent=2) + "\n")
(scratch / "complete.json").write_text(json.dumps({"pid": os.getpid(), "state": "completed", "exit": 0}) + "\n")
print("installed scoped timings complete; persisted history verified; full performance gate remains unqualified")
