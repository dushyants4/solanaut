"""Reproduce unresolved product failures and a separate copied correction."""
import difflib
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

root = Path.cwd()
work = root / ".sandbox/rpc-redaction-reproduce"
assert not work.exists(), "preserve previous reproduction before rerunning"
inputs = json.loads((root / "evals/signer/rpc-redaction/inputs-final.json").read_text())["inputs"]
for path, digest in inputs.items():
    assert hashlib.sha256((root / path).read_bytes()).hexdigest() == digest
bindings = json.loads((root / "evals/signer/rpc-redaction/candidate-results.json").read_text())
maintained_path = root / "apps/signer/test/rpc.test.ts"
assert hashlib.sha256(maintained_path.read_bytes()).hexdigest() == bindings["maintainedTestSha256"]
source = (root / "apps/signer/src/rpc.ts").read_text()
provider_old = '} catch (error) { p.healthy = false; p.reason = (error as Error).message; throw error; }'
provider_new = '} catch { p.healthy = false; p.reason = "provider unavailable"; throw new Error("RPC provider unavailable"); }'
send_old = 'catch (error) { p.healthy = false; p.reason = (error as Error).message; throw error; }'
send_new = 'catch { p.healthy = false; p.reason = "send unavailable"; throw new Error("RPC send unavailable"); }'
assert source.count(provider_old) == 1 and source.count(send_old) == 2
candidate = source.replace(provider_old, provider_new).replace(send_old, send_new)
patch = "".join(difflib.unified_diff(source.splitlines(True), candidate.splitlines(True), fromfile="a/apps/signer/src/rpc.ts", tofile="b/apps/signer/src/rpc.ts"))
assert patch == (root / "evals/signer/rpc-redaction/suggested.patch").read_text()
work.mkdir()
for kind, text in [("candidate", candidate), ("provider-omission", candidate.replace(provider_new, provider_old)), ("send-omission", candidate.replace(send_new, send_old))]:
    directory = work / kind
    directory.mkdir()
    (directory / "rpc.ts").write_text(text)
    shutil.copyfile(root / "apps/signer/src/core.ts", directory / "core.ts")
    fixture = (root / "evals/signer/rpc-redaction.test.ts").read_text().replace("../../apps/signer/src/rpc.ts", "./" + kind + "/rpc.ts")
    (work / (kind + ".test.ts")).write_text(fixture)
child_source = root / "apps/signer/test/support/rpc-deadline-child.ts"
child = work / "deadline-child.ts"
child.write_text(child_source.read_text().replace("../../src/rpc.ts", "./candidate/rpc.ts"))
maintained = maintained_path.read_text().replace("../src/rpc.ts", "./candidate/rpc.ts")
maintained = maintained.replace("../../../packages/sdk/test/support/craft.ts", str(root / "packages/sdk/test/support/craft.ts"))
maintained = maintained.replace("apps/signer/test/support/rpc-deadline-child.ts", str(child))
(work / "maintained.test.ts").write_text(maintained)
results = []
for label, node in [("26", "node"), ("24", "/home/dashy/.local/share/mise/installs/node/24.19.0/bin/node")]:
    for kind, status, passed in [("original", 1, 1), ("candidate", 0, 3), ("provider-omission", 1, 2), ("send-omission", 1, 2), ("maintained", 0, None)]:
        target = root / "evals/signer/rpc-redaction.test.ts" if kind == "original" else work / (kind + ".test.ts")
        result = subprocess.run([node, "--test", str(target)], capture_output=True, text=True, timeout=20)
        (work / (kind + "-node" + label + ".txt")).write_text(result.stdout + result.stderr)
        assert result.returncode == status, (kind, result.stdout, result.stderr)
        for token in ["cancelled 0", "skipped 0", "todo 0"]:
            assert token in result.stdout
        if passed is not None:
            assert "tests 3" in result.stdout and "pass " + str(passed) in result.stdout and "fail " + str(3 - passed) in result.stdout
        results.append({"runtime": subprocess.check_output([node, "--version"], text=True).strip(), "kind": kind, "status": result.returncode})
for path, digest in inputs.items():
    assert hashlib.sha256((root / path).read_bytes()).hexdigest() == digest
files = {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest() for path in work.rglob("*.ts")}
(work / "result.json").write_text(json.dumps({"results": results, "generatedInputs": files,
    "deadlineChildSourceSha256": hashlib.sha256(child_source.read_bytes()).hexdigest(),
    "productChanged": False, "integrated": False, "releaseClearance": False}, indent=2) + "\n")
print("original privacy failures persist; copied correction and RPC battery pass; both omission faults fail")
