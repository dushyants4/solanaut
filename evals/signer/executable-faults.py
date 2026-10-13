"""Key/configuration omissions; exact restoration and complete ordinary populations."""
import hashlib
import json
import os
import signal
import subprocess
from pathlib import Path
root = Path.cwd()
out = root / ".sandbox/evidence/2026-10-13-development/signer-executable-faults"
out.mkdir(parents=True, exist_ok=False)
key = root / "apps/signer/src/key.ts"
reader = root / "apps/signer/src/protected-file.ts"
main = root / "apps/signer/src/main.ts"
original = {p: p.read_bytes() for p in [key, reader, main]}
faults = [
    ("wrong-public-half", key, '!timingSafeEqual(publicBytes, bytes.subarray(32))', 'false', 'key-loading', 9),
    ("read-before-permission-refusal", reader, '(before.mode & 0o777) !== mode', 'false', 'protected-file', 6),
    ("follow-symlink", reader, 'constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK', 'constants.O_RDONLY | constants.O_NONBLOCK', 'protected-file', 6),
    ("blocking-descriptor", reader, 'constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK', 'constants.O_RDONLY | constants.O_NOFOLLOW', 'protected-file', 6),
    ("unbounded-buffer", reader, 'Buffer.alloc(ceiling + 1)', 'Buffer.alloc(ceiling + 5000)', 'protected-file', 6),
    ("unsafe-parent-after-read", reader, '(parentAfter.mode & 0o777) !== 0o700', 'false', 'protected-file', 6),
    ("wrong-principal", main, 'policy.principal.length !== 1 || policy.principal[0] !== key.address', 'false', 'executable-startup', 3),
    ("reset-existing-identity", main, 'constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW', 'constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW', 'executable-startup', 3),
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
        code, raw = run(["apps/signer/test/" + test + ".test.ts"], name)
        (out / (name + ".txt")).write_text(raw)
        assert code == 1 and "AssertionError" in raw and "tests " + str(count) in raw, (name, raw)
        assert all(token in raw for token in ["cancelled 0", "skipped 0", "todo 0"]), name
        results.append({"fault": name, "caught": True, "sha256": hashlib.sha256(raw.encode()).hexdigest()})
        path.write_bytes(original[path])
finally:
    for path, data in original.items(): path.write_bytes(data)
assert all(p.read_bytes() == data for p, data in original.items())
code, raw = run(["apps/signer/test/" + name + ".test.ts" for name in ["key-loading", "executable-inputs", "executable-startup", "protected-file"]], "restored")
(out / "restored.txt").write_text(raw)
assert code == 0 and "pass 20" in raw
(out / "result.json").write_text(json.dumps({"faults": results, "restored": True,
    "sourceSha256": {str(p.relative_to(root)): hashlib.sha256(data).hexdigest() for p, data in original.items()}}, indent=2) + "\n")
print("eight executable faults caught; exact source restored; twenty ordinary cases pass")
