"""Running socket/follow-up omissions; builder evidence, restore exact source."""
import hashlib
import json
import os
import signal
import subprocess
from pathlib import Path

root = Path.cwd()
out = root / ".sandbox/evidence/2026-10-13-development/signer-followup-faults-bounded"
out.mkdir(parents=True, exist_ok=False)
service = root / "apps/signer/src/service.ts"
client = root / "packages/sdk/src/adapters/sending-client.ts"
original = {p: p.read_bytes() for p in [service, client]}
faults = [
    ("private-denial", service, 'if (value.status === "denied")', 'if (false && value.status === "denied")'),
    ("private-status", service, 'if (request.method === "status") return { mode: "same-user", "keyIsolation": false, recoveryIncomplete: value.recoveryIncomplete === true, degraded: value.degraded === true };', 'if (request.method === "status") return result;'),
    ("no-followup", service, '  follow();\n  let stopped:', '  // omitted scheduling\n  let stopped:'),
    ("no-timer-cancellation", service, 'clearTimeout(timer);', 'void timer;'),
    ("no-backoff", service, 'delay = recoveryIncomplete ? Math.min(delay * 2, 30_000) : 1000;', 'delay = 1000;'),
    ("overlapping-recovery", service, 'if (recovery) return recovery;', 'void recovery;'),
    ("private-client-fields", client, 'Object.keys(r).every((key) => ["status", "ref", "class"].includes(key))', 'true'),
]
results = []
def run(test, name):
    child = subprocess.Popen(["node", "--test", *test], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
    try:
        stdout, stderr = child.communicate(timeout=30)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        stdout, stderr = child.communicate(timeout=5)
        (out / (name + "-timeout.txt")).write_text(stdout + stderr)
        raise AssertionError("incomplete fault battery: " + name)
    return child.returncode, stdout + stderr
try:
    for name, path, before, after in faults:
        source = original[path].decode()
        assert source.count(before) == 1, name
        path.write_text(source.replace(before, after))
        test = "packages/sdk/test/sending-client.test.ts" if path == client else "apps/signer/test/disclosure-followup.test.ts"
        code, raw = run([test], name)
        (out / (name + ".txt")).write_text(raw)
        assert code == 1 and "AssertionError" in raw, (name, raw)
        assert "tests " + ("11" if path == client else "9") in raw, name
        assert all(token in raw for token in ["cancelled 0", "skipped 0", "todo 0"]), name
        results.append({"fault": name, "caught": True, "sha256": hashlib.sha256(raw.encode()).hexdigest()})
        path.write_bytes(original[path])
finally:
    for path, data in original.items():
        path.write_bytes(data)
assert all(p.read_bytes() == data for p, data in original.items())
code, raw = run(["apps/signer/test/disclosure-followup.test.ts", "apps/signer/test/service.test.ts", "packages/sdk/test/sending-client.test.ts"], "restored")
(out / "restored.txt").write_text(raw)
assert code == 0 and "pass 28" in raw
(out / "result.json").write_text(json.dumps({"faults": results, "restored": True,
    "sourceSha256": {str(p.relative_to(root)): hashlib.sha256(data).hexdigest() for p, data in original.items()}}, indent=2) + "\n")
print("seven follow-up/privacy faults caught; exact source restored; 28 combined cases pass")
