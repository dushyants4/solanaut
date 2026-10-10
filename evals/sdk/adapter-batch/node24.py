"""Installed prepared D41 trials on an already installed runtime; no tool install."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

root = Path.cwd()
output = root / "evals/sdk/adapter-batch/node24"
output.mkdir(exist_ok=True)
scratch = root / ".sandbox/solanaut-1/adapter-batch"
manifest = json.loads((output.parent / "candidate.json").read_text())
archive = root / manifest["archive"]
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest["archiveSha256"]
path = scratch / "consumer/node_modules/@solanaut/sdk/dist/src/adapters/agent-kit.js"
assert not (scratch / "consumer/node_modules/@solanaut/sdk").is_symlink()
original = path.read_bytes()
assert hashlib.sha256(original).hexdigest() == manifest["compiled_files"][".sandbox/releases/sdk/dist/src/adapters/agent-kit.js"]
cases = scratch / "installed-cases.ts"
assert cases.read_bytes() == (output.parent / "installed-cases.txt").read_bytes()
env = dict(os.environ)
env.pop("NODE_TEST_CONTEXT", None)
command = ["mise", "exec", "node@24.19.0", "--", "node"]
version = subprocess.run(command + ["--version"], capture_output=True, text=True, env=env, timeout=30)
assert version.returncode == 0 and version.stdout.strip() == "v24.19.0"
(output / "runtime.txt").write_text(version.stdout + version.stderr)

def trial(name):
    result = subprocess.run(command + ["--test", str(cases)], capture_output=True, text=True, env=env, timeout=30)
    text = result.stdout + result.stderr
    (output / (name + ".txt")).write_text(text)
    assert "ℹ tests 4\n" in text
    assert all("ℹ " + label + " 0\n" in text for label in ("cancelled", "skipped", "todo"))
    return result.returncode, text

status, _ = trial("control")
assert status == 0
faults = [
    ("caller-membership", "txs = [...txs];", "// omitted private membership"),
    ("wallet-membership", "wallet.signAllTransactions([...txs])", "wallet.signAllTransactions(txs)"),
    ("signed-reservation", 'guard.report(a.decision.hash, "unknown");', 'guard.report(a.decision.hash, "expired");'),
]
caught = []
try:
    for name, before, after in faults:
        source = original.decode()
        assert source.count(before) == (2 if name == "signed-reservation" else 1)
        path.write_text(source.replace(before, after, 1))
        status, text = trial(name)
        assert status == 1 and "ADP-1/ADR-009" in text
        assert "AssertionError" in text or "SolanautDenied: wallet-changed-message" in text
        caught.append(name)
        path.write_bytes(original)
finally:
    path.write_bytes(original)
status, _ = trial("restored")
assert status == 0 and path.read_bytes() == original
(output / "summary.json").write_text(json.dumps({"runtime": version.stdout.strip(), "archiveSha256": manifest["archiveSha256"], "installedImplementationSha256": hashlib.sha256(original).hexdigest(), "caught": caught, "restored": True}, indent=2) + "\n")
print("existing Node 24 installed component qualification passed")
