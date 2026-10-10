"""Execute the exact termination proposal with the unchanged full population."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
path = Path("evals/packaging/parallel-experiment.mjs")
original = path.read_bytes()
assert hashlib.sha256(original).hexdigest() == "7ca04950c47bc75634a3bb1067d86a0368f03458d3543a13a23e3efe91fdf4d7"
patch = Path("evals/packaging/parallel-lifecycle/corrected/termination-owner.patch").read_text().splitlines()
before = "\n".join(line[1:] for line in patch if line.startswith("-") and not line.startswith("---"))
after = "\n".join(line[1:] for line in patch if line.startswith("+") and not line.startswith("+++"))
source = original.decode()
assert source.count(before) == 1
source = source.replace(before, after)
for before, after in [
    ('const root=fileURLToPath(new URL("../../",import.meta.url));', "const root=" + json.dumps(str(root)) + ";"),
    ('"evals/packaging/parallel-experiment"', '"evals/packaging/parallel-lifecycle-full"'),
    ('".sandbox/solanaut-1/package-parallel"', '".sandbox/solanaut-1/parallel-lifecycle/full-candidates"'),
    ('revision:"826d05864271f3b2af05c8a8eb11243b1755c50f"', 'reviewedBase:"206744723dd00b70ad96b6701ad29a3c526f2dce"'),
]:
    assert source.count(before) == 1
    source = source.replace(before, after)
output = root / "evals/packaging/parallel-lifecycle-full"
scratch = root / ".sandbox/solanaut-1/parallel-lifecycle"
output.mkdir(parents=True, exist_ok=True)
scratch.mkdir(parents=True, exist_ok=True)
module = scratch / "full.mjs"
module.write_text(source)
observer = scratch / "observe-full.mjs"
observer.write_text('''import {spawnSync} from "node:child_process";
import {writeFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
const began=performance.now();
const result=spawnSync(process.execPath,[''' + json.dumps(str(module)) + '''],{stdio:"inherit",timeout:300000});
writeFileSync(''' + json.dumps(str(output / "termination.json")) + ''',JSON.stringify({node:process.version,elapsedMs:performance.now()-began,
timeoutMs:300000,status:result.status,signal:result.signal,errorCode:result.error?.code??null},null,2)+"\\n");
process.exitCode=result.status===0&&!result.error?0:1;
''')
definition = dict(
    originalPrototypeSha256=hashlib.sha256(original).hexdigest(),
    terminationPatchSha256=hashlib.sha256(Path("evals/packaging/parallel-lifecycle/corrected/termination-owner.patch").read_bytes()).hexdigest(),
    generatedRunnerSha256=hashlib.sha256(module.read_bytes()).hexdigest(),
    observerSha256=hashlib.sha256(observer.read_bytes()).hexdigest(),
    scope="generated corrected proposal; no maintained gate edit or qualification",
)
(output / "generation.json").write_text(json.dumps(definition, indent=2) + "\n")
result = subprocess.run(["node", str(observer)])
assert path.read_bytes() == original
raise SystemExit(result.returncode)
