"""Private facade source/emitted faults; complete lifecycle cases per trial."""
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

compiled = "--compiled" in sys.argv
path = Path(".sandbox/releases/sdk/dist/src/owned-guard.js" if compiled else "packages/sdk/src/owned-guard.ts")
original = path.read_bytes()
source = original.decode()
directory = Path("evals/sdk/owned-signing/compiled-faults" if compiled else "evals/sdk/owned-signing/source-faults")
directory.mkdir(parents=True, exist_ok=True)
environment = os.environ.copy()
if compiled:
    environment["SOLANAUT_OWNED_MODULE"] = path.resolve().as_uri()
    environment["NODE_DISABLE_COMPILE_CACHE"] = "1"
faults = [
    ("capture", "const fact = structuredClone(event);" if compiled else "const fact=structuredClone(event);", "const fact=event;"),
    ("commit", "guard.recordSigning(fact)", "undefined"),
    ("immutable-reply", "detached(guard.recordSigning(fact))", "structuredClone(guard.recordSigning(fact))"),
    ("wrong-stage", "guard.recordSigning(fact)", 'guard.recordSigning({...fact,stage:"response",status:"uncertain",signature:undefined})'),
    ("storage", "return async () => detached(guard.recordSigning(fact));" if compiled else "return async()=>detached(guard.recordSigning(fact));", "return async()=>{try{return detached(guard.recordSigning(fact));}catch{return {};}};"),
    ("fifo", "recordSigning(event) {\n            return captured(() => {" if compiled else "recordSigning(event:SigningEvent){return captured(()=>{", "recordSigning(event){return (capture=>capture()())(()=>{"),
]
def battery(name):
    result = subprocess.run(["node", "--test", "packages/sdk/test/owned-signing.test.ts"], env=environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60)
    (directory / f"{name}.txt").write_bytes(result.stdout)
    return result

assert battery("baseline").returncode == 0
results = []
targets = {
    "capture": "captures mutable events",
    "commit": "persists immutable stages",
    "immutable-reply": "persists immutable stages",
    "wrong-stage": "persists immutable stages",
    "storage": "never acknowledges storage failure",
    "fifo": "captures mutable events",
}
try:
    for name, before, after in faults:
        assert source.count(before) == 1, name
        path.write_text(source.replace(before, after))
        result = battery(name)
        output = result.stdout.decode()
        caught = result.returncode == 1 and "tests 9\n" in output and "cancelled 0\n" in output and "skipped 0\n" in output and ("AssertionError" in output or "OwnedGuardError" in output)
        caught = caught and any("✖" in line and targets[name] in line for line in output.splitlines())
        assert "SyntaxError" not in output and "ReferenceError" not in output and "ERR_MODULE_NOT_FOUND" not in output
        results.append(dict(fault=name, status=result.returncode, caught=caught))
        assert caught, name
finally:
    path.write_bytes(original)
assert battery("restored").returncode == 0
assert path.read_bytes() == original
(directory / "summary.json").write_text(json.dumps(dict(compiled=compiled, results=results, restoredSha256=hashlib.sha256(original).hexdigest()), indent=2) + "\n")
print(json.dumps(results))
