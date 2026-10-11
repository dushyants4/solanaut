"""Run unchanged decoder domains through an actual installed compiled SDK."""
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/installed-properties"
output.mkdir(exist_ok=True)
archive = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert sha(archive) == "55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d"
paths = ["packages/sdk/test/properties.test.ts", "packages/sdk/test/support/kit.ts", "evals/ci/properties.ts", "evals/release/installed-properties.py"]
inputs = {path: sha(root / path) for path in paths}
definition = {"revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(), "archiveSha256": sha(archive), "inputs": inputs, "seed": 101131, "scope": "installed public decoder/codec only; repository kit/fast-check/domain oracle, no full runtime matrix"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
faults = [
    ("address", "base58.js", "export function encodeBase58(bytes) {", 'export function encodeBase58(bytes) { return "1";', "^CI-2 address property:"),
    ("decoder", "message.js", "export function decodeMessage(bytes) {", 'export function decodeMessage(bytes) { throw new DecodeError("malformed-proposal", "planted decoder fault");', "^CI-2 decoder property: legacy"),
    ("resolve", "message.js", "export function resolveMessage(m, pins) {", "export function resolveMessage(m, pins) { return {instructions: []};", "^CI-2 decoder property: 0"),
]
env = {**os.environ, "SOLANAUT_PROPERTY_SEED": str(definition["seed"])}
env.pop("SOLANAUT_PROPERTY_TRIAL", None)
with tempfile.TemporaryDirectory(prefix="solanaut-installed-properties-") as directory:
    consumer = Path(directory)
    (consumer / "package.json").write_text('{"private":true,"type":"module"}\n')
    with (output / "install.txt").open("w") as log:
        result = subprocess.run(["npm", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", str(archive)], cwd=consumer, stdout=log, stderr=subprocess.STDOUT, timeout=60)
    assert result.returncode == 0
    package = consumer / "node_modules/@solanaut/sdk"
    assert package.is_dir() and not package.is_symlink()
    source = (root / paths[0]).read_text()
    for relative in ("../src/base58.ts", "../src/message.ts"):
        source = source.replace(json.dumps(relative), '"@solanaut/sdk"')
    for relative, target in [("../../../evals/ci/properties.ts", root / "evals/ci/properties.ts"), ("./support/kit.ts", root / "packages/sdk/test/support/kit.ts")]:
        source = source.replace(json.dumps(relative), json.dumps(str(target)))
    for name in ("fast-check", "@solana/kit"):
        resolved = subprocess.check_output(["node", "--input-type=module", "-e", "console.log(import.meta.resolve(" + json.dumps(name) + "))"], text=True).strip()
        source = source.replace(json.dumps(name), json.dumps(resolved))
    cases = consumer / "cases.ts"
    cases.write_text(source)
    (output / "relocated-cases.txt").write_text(source)
    implementations = {name: package / "dist/src" / name for name in ("base58.js", "message.js")}
    original = {name: path.read_bytes() for name, path in implementations.items()}
    caught = []
    try:
        for name, file, before, after, pattern in faults:
            text = original[file].decode()
            assert text.count(before) == 1
            implementations[file].write_text(text.replace(before, after))
            result = subprocess.run(["node", "--test", "--test-name-pattern=" + pattern, str(cases)], cwd=consumer, env={**env, "SOLANAUT_PROPERTY_TRIAL": "first-failure"}, capture_output=True, text=True, timeout=60)
            text = result.stdout + result.stderr
            (output / (name + "-red.txt")).write_text(text)
            assert result.returncode == 1 and "property failed:" in text and "ℹ tests 1\n" in text
            assert all("ℹ " + label + " 0\n" in text for label in ("cancelled", "skipped", "todo"))
            caught.append(name)
            implementations[file].write_bytes(original[file])
    finally:
        for name, path in implementations.items(): path.write_bytes(original[name])
    runtimes = []
    for version in ("26.7.0", "24.19.0"):
        result = subprocess.run(["mise", "exec", "node@" + version, "--", "node", "--test", str(cases)], cwd=root, env=env, capture_output=True, text=True, timeout=120)
        text = result.stdout + result.stderr
        (output / (version + "-green.txt")).write_text(text)
        assert result.returncode == 0 and "ℹ tests 5\n" in text and "ℹ pass 5\n" in text
        assert text.count("; runs=10000; skips=0") == 5
        assert all("ℹ " + label + " 0\n" in text for label in ("fail", "cancelled", "skipped", "todo"))
        runtimes.append(version)
    assert all(path.read_bytes() == original[name] for name, path in implementations.items())
assert all(sha(root / path) == digest for path, digest in inputs.items())
(output / "result.json").write_text(json.dumps({"runtimes": runtimes, "faultsCaught": caught, "restored": True, "inputsUnchanged": True, "clearance": False}, indent=2) + "\n")
print("installed decoder domains passed on existing runtimes; three isolated faults caught and restored")
