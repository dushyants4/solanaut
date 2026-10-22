"""Local serialized-wire boundary faults; exact source restore on every exit."""
import json
import subprocess
import sys
from pathlib import Path

compiled = "--compiled" in sys.argv
path = Path(".sandbox/releases/sdk/dist/src/adapters/agent-kit.js" if compiled else "packages/sdk/src/adapters/agent-kit.ts")
original = path.read_bytes()
output = Path("evals/sdk/adapter-wire/compiled-faults" if compiled else "evals/sdk/adapter-wire/faults")
output.mkdir(parents=True, exist_ok=True)
faults = [
    ("message", "!equal(decoded.message, a.message)", "false"),
    ("signature", "!verifyEd25519(key, a.message, decoded.signatures[index] ?? new Uint8Array())", "false"),
    ("reservation", '[tx, ...signed].forEach(strip);\n      try {\n        guard.report(a.decision.hash, "unknown");', '[tx, ...signed].forEach(strip);\n      try {\n        guard.report(a.decision.hash, "expired");'),
    ("strip", '[tx, ...signed].forEach(strip);', 'void tx;'),
    ("second-serialization", "rpc.sendRawTransaction(wire, options)", "rpc.sendRawTransaction(new Uint8Array((signed[0] as any).serialize()), options)"),
]
caught = []
cases = "packages/sdk/test/adapter-wire.test.ts"
if compiled:
    root = Path.cwd()
    source = Path(cases).read_text()
    for relative in ("../src/guard.ts", "../src/base58.ts", "./support/workload.ts", "./support/craft.ts"):
        source = source.replace(json.dumps(relative), json.dumps(str((root / "packages/sdk/test" / relative).resolve())))
    source = source.replace('"../src/adapters/agent-kit.ts"', json.dumps(str(root / ".sandbox/releases/sdk/dist/src/index.js")))
    generated = root / ".sandbox/solanaut-1/adapter-wire/compiled-cases.ts"
    generated.write_text(source)
    cases = str(generated)
    faults = [(name, before.replace("\n      ", "\n            "), after.replace("\n      ", "\n            ").replace("(signed[0] as any)", "signed[0]")) for name, before, after in faults]
    faults = [(name, '[tx, ...signed].forEach(strip);\n            try {\n                guard.report(a.decision.hash, "unknown");', '[tx, ...signed].forEach(strip);\n            try {\n                guard.report(a.decision.hash, "expired");') if name == "reservation" else (name, before, after) for name, before, after in faults]
try:
    for name, before, after in faults:
        source = original.decode()
        assert source.count(before) == 1
        path.write_text(source.replace(before, after))
        result = subprocess.run(["node", "--test", cases], capture_output=True, text=True)
        text = result.stdout + result.stderr
        (output / (name + ".txt")).write_text(text)
        assert result.returncode == 1 and "AssertionError" in text and "ADP-1/ADR-009" in text
        assert "ℹ tests 7\n" in text and all("ℹ " + label + " 0\n" in text for label in ("cancelled", "skipped", "todo"))
        caught.append(name)
        path.write_bytes(original)
finally:
    path.write_bytes(original)
result = subprocess.run(["node", "--test", cases, "packages/sdk/test/adapters.test.ts"], capture_output=True, text=True)
(output / "restored.txt").write_text(result.stdout + result.stderr)
assert result.returncode == 0
(output / "summary.json").write_text(json.dumps({"caught": caught, "sourceRestored": path.read_bytes() == original, "restoredStatus": result.returncode}, indent=2) + "\n")
