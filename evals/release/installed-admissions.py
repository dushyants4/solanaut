"""Run unchanged queued-admission analysis against an actual installed SDK."""
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/installed-admissions"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another run")
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
archive = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
assert sha(archive) == "55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d"
paths = ["evals/ci/concurrency.ts", "packages/sdk/test/support/craft.ts", "packages/sdk/test/support/kit.ts",
         "package-lock.json", "evals/release/installed-admissions.py"]
inputs = {path: sha(root / path) for path in paths}
product = json.loads((root / "evals/release/runtime-builds/definition.json").read_text())["product"]
assert all(sha(root / path) == digest for path, digest in product.items())
faults = [("ignore-window-cap", "if (w.sol + t.sol > policy.sol.maxPerWindow)", "if (false && w.sol + t.sol > policy.sol.maxPerWindow)"),
          ("drop-request", "return commit(binding ? { ...body, request: binding } : body);", "return commit(body);"),
          ("wrong-amount", "sol: t.sol.toString(), tokens:", "sol: (t.sol + 1n).toString(), tokens:")]
definition = {"revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "archiveSha256": sha(archive), "inputs": inputs, "product": product,
              "seed": 20261006, "faults": [name for name, _, _ in faults],
              "scope": "original thousand callers released by one JS barrier; synchronous SDK check; not parallel threads/processes or isolated signer"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
scratch = root / ".sandbox/installed-admissions"
scratch.mkdir(exist_ok=True)
(scratch / "job.json").write_text(json.dumps({"pid": os.getpid(), "group": os.getpgrp(), "state": "running"}, indent=2) + "\n")
results = {"faults": [], "controls": []}
with tempfile.TemporaryDirectory(prefix="solanaut-installed-admissions-") as directory:
    consumer = Path(directory)
    (consumer / "package.json").write_text('{"private":true,"type":"module"}\n')
    install = subprocess.run(["npm", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", str(archive)], cwd=consumer, capture_output=True, text=True, timeout=60)
    (output / "install.txt").write_text(install.stdout + install.stderr)
    assert install.returncode == 0
    package = consumer / "node_modules/@solanaut/sdk"
    assert package.is_dir() and not package.is_symlink()
    runner = (root / paths[0]).read_text()
    for relative in ("../../packages/sdk/src/guard.ts", "../../packages/sdk/src/policy.ts", "../../packages/sdk/src/base58.ts"):
        assert runner.count(json.dumps(relative)) == 1
        runner = runner.replace(json.dumps(relative), '"@solanaut/sdk"')
    for relative, path in [("../../packages/sdk/test/support/craft.ts", paths[1]), ("../../packages/sdk/test/support/kit.ts", paths[2])]:
        assert runner.count(json.dumps(relative)) == 1
        runner = runner.replace(json.dumps(relative), json.dumps((root / path).as_uri()))
    (consumer / "concurrency.ts").write_text(runner)
    (output / "relocated-runner.txt").write_text(runner)
    driver = 'import {measureAdmissions, validateAdmissions} from "./concurrency.ts";\nconst result = await measureAdmissions(); console.log(JSON.stringify(result)); validateAdmissions(result);\n'
    (consumer / "driver.ts").write_text(driver)
    (output / "driver.txt").write_text(driver)
    implementation = package / "dist/src/guard.js"
    original = implementation.read_bytes()
    try:
        for name, before, after in faults:
            assert original.decode().count(before) == 1
            implementation.write_text(original.decode().replace(before, after))
            run = subprocess.run(["node", "driver.ts"], cwd=consumer, capture_output=True, text=True, timeout=60)
            (output / (name + "-red.txt")).write_text(run.stdout + run.stderr)
            evidence = json.loads(run.stdout.splitlines()[0])
            assert run.returncode == 1 and evidence["proposed"] == 1000
            assert "concurrent admission totals differ" in run.stderr or "concurrent evidence incomplete" in run.stderr or "concurrent reservation total differs" in run.stderr
            results["faults"].append({"fault": name, "exit": run.returncode, "evidence": evidence})
            implementation.write_bytes(original)
        for version in ("26.7.0", "24.19.0"):
            run = subprocess.run(["mise", "exec", "node@" + version, "--", "node", "driver.ts"], cwd=consumer, capture_output=True, text=True, timeout=60)
            (output / (version + "-green.txt")).write_text(run.stdout + run.stderr)
            evidence = json.loads(run.stdout.splitlines()[0])
            assert run.returncode == 0 and evidence["proposed"] == evidence["recorded"] == evidence["identities"] == evidence["destinations"] == 1000
            assert evidence["admitted"] == 7 and evidence["denied"] == 993 and evidence["reserved"] == "7000000"
            results["controls"].append({"node": version, "exit": run.returncode, "evidence": evidence})
    finally:
        implementation.write_bytes(original)
    assert implementation.read_bytes() == original
assert all(sha(root / path) == digest for path, digest in {**inputs, **product}.items())
assert sha(archive) == definition["archiveSha256"]
results.update({"installedBytesRestored": True, "boundInputsUnchanged": True, "consumerRemoved": True, "releaseClearance": False})
(output / "result.json").write_text(json.dumps(results, indent=2) + "\n")
(scratch / "complete.json").write_text(json.dumps({"pid": os.getpid(), "state": "completed", "exit": 0}) + "\n")
print("installed queued admissions pass existing runtimes; complete-population faults caught")
