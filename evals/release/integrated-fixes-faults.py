"""Fault-check integrated batch/privacy corrections, restoring exact source bytes."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
out = root / ".sandbox/evidence/2026-10-13-development/integration-faults"
out.mkdir(exist_ok=False)
batch = root / "packages/sdk/src/adapters/agent-kit.ts"
rpc = root / "apps/signer/src/rpc.ts"
original = {path: path.read_bytes() for path in [batch, rpc]}
faults = [
    ("caller-membership", batch, "txs = [...txs];", "// omitted capture", "packages/sdk/test/adapter-batch.test.ts", 4),
    ("wallet-membership", batch, "wallet.signAllTransactions([...txs])", "wallet.signAllTransactions(txs)", "packages/sdk/test/adapter-batch.test.ts", 4),
    ("signed-reservation", batch, 'guard.report(a.decision.hash, "unknown");', 'guard.report(a.decision.hash, "expired");', "packages/sdk/test/adapter-batch.test.ts", 4),
    ("provider-private-text", rpc, '} catch { p.healthy = false; p.reason = "provider unavailable"; throw new Error("RPC provider unavailable"); }', '} catch (error) { p.healthy = false; p.reason = (error as Error).message; throw error; }', "apps/signer/test/rpc-redaction.test.ts", 3),
    ("send-private-text", rpc, 'catch { p.healthy = false; p.reason = "send unavailable"; throw new Error("RPC send unavailable"); }', 'catch (error) { p.healthy = false; p.reason = (error as Error).message; throw error; }', "apps/signer/test/rpc-redaction.test.ts", 3),
]
results = []
try:
    for name, path, before, after, test, count in faults:
        text = original[path].decode()
        assert text.count(before) == (2 if name == "signed-reservation" else 1)
        path.write_text(text.replace(before, after, 1))
        child = subprocess.run(["node", "--test", test], capture_output=True, text=True, timeout=30)
        raw = child.stdout + child.stderr
        (out / (name + ".txt")).write_text(raw)
        assert child.returncode == 1, (name, raw)
        assert "AssertionError" in raw or (name == "caller-membership" and "SolanautDenied: wallet-changed-message" in raw), (name, raw)
        assert "tests " + str(count) in raw
        assert all(token in raw for token in ["cancelled 0", "skipped 0", "todo 0"])
        results.append({"fault": name, "caught": True, "rawSha256": hashlib.sha256(raw.encode()).hexdigest()})
        path.write_bytes(original[path])
finally:
    for path, data in original.items():
        path.write_bytes(data)
assert all(path.read_bytes() == data for path, data in original.items())
child = subprocess.run(["node", "--test", "packages/sdk/test/adapter-batch.test.ts", "apps/signer/test/rpc-redaction.test.ts"], capture_output=True, text=True, timeout=30)
(out / "restored.txt").write_text(child.stdout + child.stderr)
assert child.returncode == 0 and "tests 7" in child.stdout and "pass 7" in child.stdout
(out / "result.json").write_text(json.dumps({"faults": results, "restored": True,
    "sourceSha256": {str(path.relative_to(root)): hashlib.sha256(data).hexdigest() for path, data in original.items()}}, indent=2) + "\n")
print("five faults caught; exact source restored and all seven regression cases pass")
