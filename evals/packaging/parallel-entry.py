"""Qualify an unapplied owner entry draft in generated copies only."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

root = Path.cwd()
negative = "--baseline-fault" in sys.argv
output = root / "evals/packaging/parallel-entry" / ("baseline-fault" if negative else "full")
scratch = root / ".sandbox/solanaut-1/parallel-entry" / ("baseline-fault" if negative else "full")
output.mkdir(parents=True, exist_ok=True)
scratch.mkdir(parents=True, exist_ok=True)
entry_path = root / "evals/packaging/faults.ts"
prototype_path = root / "evals/packaging/parallel-experiment.mjs"
entry_original = entry_path.read_bytes()
prototype_original = prototype_path.read_bytes()
assert hashlib.sha256(entry_original).hexdigest() == "dac72a30ff1630a8c8856acae372c9dd86d210213760513d7ceef412ad22696a"
assert hashlib.sha256(prototype_original).hexdigest() == "7ca04950c47bc75634a3bb1067d86a0368f03458d3543a13a23e3efe91fdf4d7"


def apply_draft(source, patch):
    # Apply exact hunk text; offsets never bypass a mismatched context.
    lines = patch.read_text().splitlines(keepends=True)
    hunks = []
    for line in lines:
        if line.startswith("@@"):
            hunks.append([])
        elif hunks and line[:1] in (" ", "+", "-"):
            hunks[-1].append(line)
    assert hunks
    for hunk in hunks:
        before = "".join(line[1:] for line in hunk if line[0] in " -")
        after = "".join(line[1:] for line in hunk if line[0] in " +")
        assert source.count(before) == 1, "draft context must match exactly once"
        source = source.replace(before, after)
    return source


entry_patch = root / "evals/packaging/parallel-experiment/owner-draft.patch"
termination_patch = root / "evals/packaging/parallel-lifecycle/corrected/termination-owner.patch"
entry = apply_draft(entry_original.decode(), entry_patch)
runner = apply_draft(prototype_original.decode(), termination_patch)
runner_path = scratch / "runner.mjs"
entry_copy = scratch / "entry.ts"
for before, after in [
    ('const root=fileURLToPath(new URL("../../",import.meta.url));', "const root=" + json.dumps(str(root)) + ";"),
    ('"evals/packaging/parallel-experiment"', json.dumps(str(output.relative_to(root)))),
    ('".sandbox/solanaut-1/package-parallel"', json.dumps(str((scratch / "candidates").relative_to(root)))),
    ('revision:"826d05864271f3b2af05c8a8eb11243b1755c50f"', 'reviewedBase:"e16c9df4a54ba0adf6b8d07c0dd1d86ab9b4c890"'),
]:
    assert runner.count(before) == 1
    runner = runner.replace(before, after)
entry = entry.replace('from "./parallel-experiment.mjs"', 'from ' + json.dumps(str(runner_path)))
before = 'const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");'
assert entry.count(before) == 1
entry = entry.replace(before, "const root = " + json.dumps(str(root)) + ";")
before = "const baseline = battery();"
assert entry.count(before) == 1
entry = entry.replace(before, before + "\nwriteFileSync(" + json.dumps(str(output / "baseline.txt")) + ', baseline.stdout + baseline.stderr);')
if negative:
    candidate = scratch / "damaged-sdk"
    if candidate.exists():
        shutil.rmtree(candidate)
    shutil.copytree(root / ".sandbox/releases/sdk", candidate)
    replay = candidate / "dist/bin/replay.js"
    text = replay.read_text()
    assert text.startswith("#!")
    replay.write_text(text.split("\n", 1)[1])
    before = 'const stage = join(root, ".sandbox/releases/sdk");'
    assert entry.count(before) == 1
    entry = entry.replace(before, "const stage = " + json.dumps(str(candidate)) + ";")
runner_path.write_text(runner)
entry_copy.write_text(entry)
observer = scratch / "observe.mjs"
observer.write_text('''import {spawnSync} from "node:child_process";
import {writeFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
const began=performance.now();
const result=spawnSync(process.execPath,[''' + json.dumps(str(entry_copy)) + '''],{stdio:"inherit",timeout:300000});
writeFileSync(''' + json.dumps(str(output / "termination.json")) + ''',JSON.stringify({node:process.version,elapsedMs:performance.now()-began,
timeoutMs:300000,status:result.status,signal:result.signal,errorCode:result.error?.code??null},null,2)+"\\n");
process.exitCode=result.status===0&&!result.error?0:1;
''')
definition = {"scope": "generated O2/O3 entry; baseline log instrumentation only; actual gate unchanged", "negativeBaseline": negative}
for name, data in [("originalEntry", entry_original), ("originalPrototype", prototype_original),
                   ("entryDraft", entry_patch.read_bytes()), ("terminationDraft", termination_patch.read_bytes()),
                   ("generatedEntry", entry_copy.read_bytes()), ("generatedRunner", runner_path.read_bytes()),
                   ("observer", observer.read_bytes())]:
    definition[name + "Sha256"] = hashlib.sha256(data).hexdigest()
(output / "generation.json").write_text(json.dumps(definition, indent=2) + "\n")
try:
    result = subprocess.run(["node", str(observer)])
finally:
    assert entry_path.read_bytes() == entry_original
    assert prototype_path.read_bytes() == prototype_original
    if negative:
        shutil.rmtree(candidate)
raise SystemExit(result.returncode)
