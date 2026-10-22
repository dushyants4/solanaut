"""ADR-025 omission checks; builder evidence, exact source restored on every exit."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
out = root / ".sandbox/evidence/2026-10-13-development/disclosure-faults"
out.mkdir(exist_ok=False)
errors = root / "packages/sdk/src/errors.ts"
guard = root / "packages/sdk/src/guard.ts"
original = {p: p.read_bytes() for p in [errors, guard]}
faults = [
    ("leaked-rule", errors, 'this.class = classification;', 'this.class = classification; Object.assign(this, {rule});'),
    ("leaked-limit", errors, 'super(`${classification} (decision ${ref})`);', 'super(`${classification} (decision ${ref}): ${reason}`);'),
    ("skipped-callback", guard, 'if (!decision.allow) notifyRefusal(guard, decision.rule!, decision.reason, decision);', '// omitted operator callback'),
    ("full-default", errors, 'channels.get(guard)?.disclosure === "full"', 'channels.get(guard)?.disclosure !== "full"'),
    ("unsigned-full", guard, 'if (policy.disclosure === "full" && !authorization)', 'if (false && policy.disclosure === "full" && !authorization)'),
    ("missing-marker", guard, '...(policy.disclosure === "full" ? { disclosure: "full" as const } : {}),', '// omitted disclosure marker'),
]
results = []
try:
    for name, path, before, after in faults:
        source = original[path].decode()
        assert source.count(before) == 1, name
        path.write_text(source.replace(before, after))
        child = subprocess.run(["node", "--test", "packages/sdk/test/disclosure.test.ts"], capture_output=True, text=True, timeout=30)
        raw = child.stdout + child.stderr
        (out / (name + ".txt")).write_text(raw)
        assert child.returncode == 1 and "AssertionError" in raw, (name, raw)
        assert all(token in raw for token in ["tests 43", "cancelled 0", "skipped 0", "todo 0"]), name
        results.append({"fault": name, "caught": True, "sha256": hashlib.sha256(raw.encode()).hexdigest()})
        path.write_bytes(original[path])
finally:
    for path, data in original.items():
        path.write_bytes(data)
assert all(p.read_bytes() == data for p, data in original.items())
child = subprocess.run(["node", "--test", "packages/sdk/test/disclosure.test.ts"], capture_output=True, text=True, timeout=30)
raw = child.stdout + child.stderr
(out / "restored.txt").write_text(raw)
assert child.returncode == 0 and "pass 43" in raw
(out / "result.json").write_text(json.dumps({"faults": results, "restored": True,
    "sourceSha256": {str(p.relative_to(root)): hashlib.sha256(data).hexdigest() for p, data in original.items()}}, indent=2) + "\n")
print("six disclosure faults caught; exact source restored; 43 cases pass")
