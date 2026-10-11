"""Compare unchanged real-corpus domains through an installed compiled SDK."""
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/installed-differential"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another run")
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
archive = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
assert sha(archive) == "55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d"
corpus = "evals/ci/differential/mainnet-453972158.jsonl"
paths = ["evals/ci/differential-run.ts", "evals/ci/differential-check.ts", "evals/ci/differential.ts",
         "packages/sdk/test/support/kit.ts", corpus, "package-lock.json", "evals/release/installed-differential.py"]
inputs = {path: sha(root / path) for path in paths}
product = json.loads((root / "evals/release/runtime-builds/definition.json").read_text())["product"]
assert all(sha(root / path) == digest for path, digest in product.items())
definition = {"revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "archiveSha256": sha(archive), "inputs": inputs, "product": product,
              "scope": "frozen original corpus/comparator; installed SDK with repository reference clients; no new statistical sample"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
scratch = root / ".sandbox/installed-differential"
scratch.mkdir(exist_ok=True)
(scratch / "job.json").write_text(json.dumps({"pid": os.getpid(), "group": os.getpgrp(), "command": "uv run --script evals/release/installed-differential.py", "state": "running"}, indent=2) + "\n")
faults = [
    ("wire", "message.js", "export function decodeTransaction(wire) {", "export function decodeTransaction(wire) { return {message: new Uint8Array([0]), signatures: []};"),
    ("message", "message.js", "export function decodeMessage(bytes) {", 'export function decodeMessage(bytes) { throw new DecodeError("malformed-proposal", "planted installed fault");'),
    ("resolution", "message.js", "export function resolveMessage(m, pins) {", "export function resolveMessage(m, pins) { return {instructions: [], accounts: []};"),
    ("instruction", "classify.js", "export function classifyInstruction(program, data) {", 'export function classifyInstruction(program, data) { return {name: "PlantedMismatch"};'),
]
results = []
with tempfile.TemporaryDirectory(prefix="solanaut-installed-differential-") as directory:
    consumer = Path(directory)
    (consumer / "package.json").write_text('{"private":true,"type":"module"}\n')
    install = subprocess.run(["npm", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", str(archive)], cwd=consumer, capture_output=True, text=True, timeout=60)
    (output / "install.txt").write_text(install.stdout + install.stderr)
    assert install.returncode == 0
    package = consumer / "node_modules/@solanaut/sdk"
    assert package.is_dir() and not package.is_symlink()
    checker = (root / paths[1]).read_text()
    for relative in ("../../packages/sdk/src/message.ts", "../../packages/sdk/src/classify.ts"):
        assert checker.count(json.dumps(relative)) == 1
        checker = checker.replace(json.dumps(relative), '"@solanaut/sdk"')
    relative = "../../packages/sdk/test/support/kit.ts"
    assert checker.count(json.dumps(relative)) == 1
    checker = checker.replace(json.dumps(relative), json.dumps((root / paths[3]).as_uri()))
    for name in ("@solana/kit", "@solana-program/system", "@solana-program/token", "@solana-program/compute-budget"):
        resolved = subprocess.check_output(["node", "--input-type=module", "-e", "console.log(import.meta.resolve(" + json.dumps(name) + "))"], text=True).strip()
        assert checker.count(json.dumps(name)) == 1
        checker = checker.replace(json.dumps(name), json.dumps(resolved))
    runner = (root / paths[0]).read_text()
    runner = runner.replace('"./differential.ts"', json.dumps((root / paths[2]).as_uri()))
    runner = runner.replace('"./differential/mainnet-453972158.jsonl"', json.dumps((root / corpus).as_uri()))
    (consumer / "differential-check.ts").write_text(checker)
    entry = consumer / "differential-run.ts"
    entry.write_text(runner)
    (output / "relocated-comparator.txt").write_text(checker)
    (output / "relocated-runner.txt").write_text(runner)
    implementations = {name: package / "dist/src" / name for name in ("message.js", "classify.js")}
    originals = {name: path.read_bytes() for name, path in implementations.items()}
    try:
        for name, file, before, after in faults:
            source = originals[file].decode()
            assert source.count(before) == 1
            implementations[file].write_text(source.replace(before, after))
            run = subprocess.run(["node", str(entry)], cwd=consumer, capture_output=True, text=True, timeout=60)
            (output / (name + "-red.txt")).write_text(run.stdout + run.stderr)
            evidence = json.loads(run.stdout.splitlines()[0])
            assert run.returncode == 1 and evidence["completed"] == evidence["transactions"] == 1578 and evidence["mismatches"] > 0
            results.append({"fault": name, "exit": run.returncode, "evidence": evidence})
            implementations[file].write_bytes(originals[file])
    finally:
        for name, path in implementations.items():
            path.write_bytes(originals[name])
    controls = []
    for version in ("26.7.0", "24.19.0"):
        run = subprocess.run(["mise", "exec", "node@" + version, "--", "node", str(entry)], cwd=consumer, capture_output=True, text=True, timeout=60)
        (output / (version + "-green.txt")).write_text(run.stdout + run.stderr)
        evidence = json.loads(run.stdout.splitlines()[0])
        assert run.returncode == 0 and evidence["completed"] == evidence["transactions"] == 1578 and evidence["mismatches"] == 0
        controls.append({"node": version, "exit": run.returncode, "evidence": evidence})
    assert all(path.read_bytes() == originals[name] for name, path in implementations.items())
assert sha(archive) == definition["archiveSha256"]
assert all(sha(root / path) == digest for path, digest in {**inputs, **product}.items())
(output / "result.json").write_text(json.dumps({"faults": results, "controls": controls, "installedBytesRestored": True,
    "boundInputsUnchanged": True, "consumerRemoved": True, "releaseClearance": False}, indent=2) + "\n")
(scratch / "complete.json").write_text(json.dumps({"pid": os.getpid(), "state": "completed", "exit": 0}) + "\n")
print("installed real-corpus comparisons pass on existing runtimes; isolated faults caught and restored")
