"""Diagnose installed replay completeness without editing the maintained kill gate."""
import hashlib
import json
import os
import signal
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/installed-kills"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another run")
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
archive = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
assert sha(archive) == "55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d"
paths = ["evals/ci/kills.ts", "evals/ci/kill-child.ts", "packages/sdk/test/support/workload.ts",
         "packages/sdk/test/support/craft.ts", "packages/sdk/test/support/kit.ts",
         "package-lock.json", "evals/release/installed-kills.py"]
inputs = {path: sha(root / path) for path in paths}
product = json.loads((root / "evals/release/runtime-builds/definition.json").read_text())["product"]
assert all(sha(root / path) == digest for path, digest in product.items())
scratch = root / ".sandbox/installed-kills"
scratch.mkdir(exist_ok=True)
definition = {"revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "archiveSha256": sha(archive), "inputs": inputs, "product": product,
              "originalSeed": 202610061, "proposedSeed": 202610113, "trials": 100,
              "faults": ["replay reports success with zero decisions", "success with one decision", "replay reports failure"],
              "scope": "installed acknowledged-prefix SIGKILL; proposed counter-consistency check only; not power loss or signing/send recovery"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
(scratch / "job.json").write_text(json.dumps({"pid": os.getpid(), "group": os.getpgrp(), "state": "running"}, indent=2) + "\n")

def run_logged(command, cwd, name):
    # Each run owns its group so a parent timeout cannot leave kill children running.
    process = subprocess.Popen(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, start_new_session=True)
    try:
        stdout, stderr = process.communicate(timeout=180)
    except BaseException:
        os.killpg(process.pid, signal.SIGKILL)
        stdout, stderr = process.communicate()
        (output / (name + ".txt")).write_text(stdout + stderr)
        raise
    (output / (name + ".txt")).write_text(stdout + stderr)
    return process.returncode, stdout, stderr

results = {"faults": [], "controls": []}
with tempfile.TemporaryDirectory(prefix="solanaut-installed-kills-") as directory:
    consumer = Path(directory)
    (consumer / "package.json").write_text('{"private":true,"type":"module"}\n')
    code, _, _ = run_logged(["npm", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", str(archive)], consumer, "install")
    assert code == 0
    package = consumer / "node_modules/@solanaut/sdk"
    assert package.is_dir() and not package.is_symlink()
    workload = (root / paths[2]).read_text()
    for relative in ("../../src/base58.ts", "../../src/guard.ts", "../../src/policy.ts"):
        assert workload.count(json.dumps(relative)) == 1
        workload = workload.replace(json.dumps(relative), '"@solanaut/sdk"')
    workload = workload.replace('"./craft.ts"', json.dumps((root / paths[3]).as_uri()))
    child = (root / paths[1]).read_text()
    runner = (root / paths[0]).read_text()
    for before, after in [('"../../packages/sdk/src/guard.ts"', '"@solanaut/sdk"'),
                          ('"../../packages/sdk/src/record.ts"', '"@solanaut/sdk"'),
                          ('"../../packages/sdk/test/support/workload.ts"', '"./workload.ts"')]:
        assert before in runner and before in child
        runner = runner.replace(before, after)
        child = child.replace(before, after)
    runner = runner.replace('"../../packages/sdk/test/support/kit.ts"', json.dumps((root / paths[4]).as_uri()))
    runner = runner.replace('"evals/ci/kill-child.ts"', json.dumps(str(consumer / "kill-child.ts")))
    runner = runner.replace('".sandbox/solanaut-1/kills/"', json.dumps(str(scratch / "original") + "/"))
    before = "assert.equal(recomputed.ok, true); result.replayed++;"
    after = 'assert.equal(recomputed.ok, true); assert.equal(recomputed.decisions, guard.entries().filter((entry) => entry.kind === "decision").length, "replay decision count differs"); result.replayed++;'
    assert runner.count(before) == 1
    proposed = runner.replace(before, after).replace("rng(202610061)", "rng(202610113)")
    proposed = proposed.replace(json.dumps(str(scratch / "original") + "/"), json.dumps(str(scratch / "proposed") + "/"))
    for name, text in [("original.ts", runner), ("proposed.ts", proposed), ("kill-child.ts", child), ("workload.ts", workload)]:
        (consumer / name).write_text(text)
        (output / (name + ".txt")).write_text(text)
    (output / "owed-edit.txt").write_text("In evals/ci/kills.ts replace:\n" + before + "\nwith:\n" + after + "\nKeep the maintained seed unchanged; the separate proposal proof uses fresh seed 202610113.\n")
    implementation = package / "dist/src/guard.js"
    original = implementation.read_bytes()
    needle = "export async function replay(entries, policyInput, sensor = sensorV1, trust) {"
    assert original.decode().count(needle) == 1
    try:
        implementation.write_text(original.decode().replace(needle, needle + " return {ok: true, decisions: 0, divergence: null};"))
        code, stdout, _ = run_logged(["node", "original.ts"], consumer, "original-zero-count-miss")
        evidence = json.loads(stdout.splitlines()[-1])
        assert code == 0 and evidence == {"kills": 100, "completed": 100, "replayed": 100}
        results["maintainedMiss"] = {"exit": code, "evidence": evidence, "injectedReplayDecisions": 0}
        for name, ok, decisions in [("zero-count", True, 0), ("one-count", True, 1), ("not-ok", False, 0)]:
            implementation.write_text(original.decode().replace(needle, needle + " return " + json.dumps({"ok": ok, "decisions": decisions, "divergence": None}) + ";"))
            code, stdout, stderr = run_logged(["node", "proposed.ts"], consumer, name + "-red")
            assert code == 1 and stdout.count("kill trial ") == 1 and "AssertionError" in stderr
            if ok:
                assert "replay decision count differs" in stderr
            results["faults"].append({"fault": name, "exit": code, "trialsStarted": 1})
        implementation.write_bytes(original)
        for version in ("26.7.0", "24.19.0"):
            code, stdout, _ = run_logged(["mise", "exec", "node@" + version, "--", "node", "proposed.ts"], consumer, version + "-green")
            evidence = json.loads(stdout.splitlines()[-1])
            assert code == 0 and evidence == {"kills": 100, "completed": 100, "replayed": 100}
            results["controls"].append({"node": version, "exit": code, "evidence": evidence})
    finally:
        implementation.write_bytes(original)
    assert implementation.read_bytes() == original
assert all(sha(root / path) == digest for path, digest in {**inputs, **product}.items())
assert sha(archive) == definition["archiveSha256"]
results.update({"installedBytesRestored": True, "boundInputsUnchanged": True, "consumerRemoved": True, "maintainedGateChanged": False, "releaseClearance": False})
(output / "result.json").write_text(json.dumps(results, indent=2) + "\n")
(scratch / "complete.json").write_text(json.dumps({"pid": os.getpid(), "state": "completed", "exit": 0}) + "\n")
print("maintained replay-count miss reproduced; separate proposed check catches faults and passes installed recovery")
