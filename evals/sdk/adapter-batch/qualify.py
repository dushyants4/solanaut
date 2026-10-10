"""Local ADP-1 batch membership trials; restore exact implementation bytes."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path.cwd()
output = root / "evals/sdk/adapter-batch"
scratch = root / ".sandbox/solanaut-1/adapter-batch"
scratch.mkdir(parents=True, exist_ok=True)
mode = sys.argv[1] if len(sys.argv) == 2 else "source"
assert mode in ("source", "compiled", "installed")
source = output / "batch.candidate.txt"
text = source.read_text()
support = root / "packages/sdk/test"
for relative in ("../src/guard.ts", "../src/base58.ts", "./support/workload.ts", "./support/craft.ts"):
    text = text.replace(json.dumps(relative), json.dumps(str((support / relative).resolve())))
target = root / "packages/sdk/src/adapters/agent-kit.ts" if mode == "source" else root / ".sandbox/releases/sdk/dist/src/index.js" if mode == "compiled" else scratch / "consumer/node_modules/@solanaut/sdk/dist/src/index.js"
text = text.replace('"../src/adapters/agent-kit.ts"', json.dumps(str(target)))
cases = scratch / (mode + "-cases.ts")
cases.write_text(text)
(output / (mode + "-cases.txt")).write_text(text)

env = dict(os.environ)
env.pop("NODE_TEST_CONTEXT", None)
def trial(name):
    result = subprocess.run(["node", "--test", str(cases)], capture_output=True, text=True, env=env, timeout=30)
    text = result.stdout + result.stderr
    (output / (mode + "-" + name + ".txt")).write_text(text)
    assert "ℹ tests 4\n" in text
    assert all("ℹ " + label + " 0\n" in text for label in ("cancelled", "skipped", "todo"))
    return result.returncode, text

if mode == "installed":
    path = scratch / "consumer/node_modules/@solanaut/sdk"
    assert path.is_dir() and not path.is_symlink()
    status, _ = trial("control")
    assert status == 0
else:
    path = root / ("packages/sdk/src/adapters/agent-kit.ts" if mode == "source" else ".sandbox/releases/sdk/dist/src/adapters/agent-kit.js")
    original = path.read_bytes()
    if mode == "source":
        assert original == (output / "agent-kit.candidate.txt").read_bytes(), "apply the preserved candidate before its source trials"
    faults = [
        ("caller-membership", "txs = [...txs];", "// omitted private membership"),
        ("wallet-membership", "wallet.signAllTransactions([...txs])", "wallet.signAllTransactions(txs)"),
        ("signed-reservation", 'guard.report(a.decision.hash, "unknown");', 'guard.report(a.decision.hash, "expired");'),
    ]
    caught = []
    try:
        for name, before, after in faults:
            text = original.decode()
            assert text.count(before) == (2 if name == "signed-reservation" else 1)
            path.write_text(text.replace(before, after, 1))
            status, result = trial(name)
            assert status == 1 and "ADP-1/ADR-009" in result
            assert "AssertionError" in result or "SolanautDenied: wallet-changed-message" in result
            caught.append(name)
            path.write_bytes(original)
    finally:
        path.write_bytes(original)
    status, _ = trial("restored")
    assert status == 0 and path.read_bytes() == original
    (output / (mode + "-summary.json")).write_text(json.dumps({"caught": caught, "restored": True, "implementationSha256": hashlib.sha256(original).hexdigest()}, indent=2) + "\n")
print(mode + " qualification passed")
