"""Disclosure regressions in the running transport; source restored on every exit."""
import hashlib
import json
import os
import signal
import subprocess
from pathlib import Path
root = Path.cwd()
out = root / ".sandbox/evidence/2026-10-13-development/signer-transport-faults"
out.mkdir(parents=True, exist_ok=False)
socket = root / "apps/signer/src/socket.ts"
service = root / "apps/signer/src/service.ts"
client = root / "packages/sdk/src/adapters/sending-client.ts"
original = {p: p.read_bytes() for p in [socket, service, client]}
faults = [
    ("diagnostic-instead-of-class", socket, 'class:\n            code === "busy" || code === "timeout"\n              ? "retry-later"\n              : code === "protocol" || code === "method"\n                ? "invalid"\n                : "refused"', 'class:\n            code', 'apps/signer/test/transport-disclosure.test.ts', 2),
    ("missing-transport-reference", socket, 'error: {\n          ref: -1,\n          class:\n            code', 'error: { class: code', 'apps/signer/test/transport-disclosure.test.ts', 2),
    ("invalid-proposal-as-retry", service, '!d && request.method === "propose" && value.code === "unavailable"', 'false', 'apps/signer/test/disclosure-followup.test.ts', 10),
    ("accept-private-error-fields", client, 'Object.keys(error).sort().join(",") !== "class,ref"', 'false', 'packages/sdk/test/sending-client.test.ts', 11),
]
def run(tests, name):
    child = subprocess.Popen(["node", "--test", *tests], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
    try: stdout, stderr = child.communicate(timeout=30)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL); stdout, stderr = child.communicate(timeout=5)
        (out / (name + "-timeout.txt")).write_text(stdout + stderr)
        raise AssertionError("incomplete fault battery: " + name)
    return child.returncode, stdout + stderr
results = []
try:
    for name, path, before, after, test, count in faults:
        source = original[path].decode(); assert source.count(before) == 1, name
        path.write_text(source.replace(before, after))
        code, raw = run([test], name); (out / (name + ".txt")).write_text(raw)
        assert code == 1 and "AssertionError" in raw and "tests " + str(count) in raw, (name, raw)
        assert all(token in raw for token in ["cancelled 0", "skipped 0", "todo 0"]), name
        results.append({"fault": name, "caught": True, "sha256": hashlib.sha256(raw.encode()).hexdigest()})
        path.write_bytes(original[path])
finally:
    for path, data in original.items(): path.write_bytes(data)
assert all(p.read_bytes() == data for p, data in original.items())
code, raw = run(["apps/signer/test/transport-disclosure.test.ts", "apps/signer/test/disclosure-followup.test.ts", "packages/sdk/test/sending-client.test.ts"], "restored")
(out / "restored.txt").write_text(raw); assert code == 0 and "pass 23" in raw
(out / "result.json").write_text(json.dumps({"faults": results, "restored": True,
    "sourceSha256": {str(p.relative_to(root)): hashlib.sha256(data).hexdigest() for p, data in original.items()}}, indent=2) + "\n")
print("four transport/decode faults caught; exact source restored; 23 cases pass")
