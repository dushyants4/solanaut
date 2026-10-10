"""Probe the unchanged proposal with controlled children that ignore SIGTERM."""
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

root = Path.cwd()
original = Path("evals/packaging/parallel-experiment.mjs").read_bytes()
assert hashlib.sha256(original).hexdigest() == "7ca04950c47bc75634a3bb1067d86a0368f03458d3543a13a23e3efe91fdf4d7"
corrected = "--corrected" in sys.argv
fault = sys.argv[sys.argv.index("--fault") + 1] if "--fault" in sys.argv else None
assert fault in (None, "skip-kill", "late-kill", "false-completion")
assert fault is None or corrected
case = "fault-" + fault if fault else "corrected" if corrected else "initial-red"
output_relative = "evals/packaging/parallel-lifecycle/" + case
output = root / output_relative
scratch = root / ".sandbox/solanaut-1/parallel-lifecycle"
output.mkdir(parents=True, exist_ok=True)
scratch.mkdir(parents=True, exist_ok=True)
# Never collect a process identity from a previous fixture invocation.
for log in output.glob("worker-*-initial.txt"):
    log.unlink()
fixture = 'process.on("SIGTERM",()=>console.log("fixture ignored SIGTERM"));console.log("fixture child "+process.pid);setInterval(()=>{},1000);'
source = original.decode()
changes = [
    ('const root=fileURLToPath(new URL("../../",import.meta.url));', "const root=" + json.dumps(str(root)) + ";"),
    ('"evals/packaging/parallel-experiment"', json.dumps(output_relative)),
    ('".sandbox/solanaut-1/package-parallel"', '".sandbox/solanaut-1/parallel-lifecycle/candidates"'),
    ('processLimitMs:300000', 'processLimitMs:1000'),
    ('["--test","evals/packaging/packed-sdk.test.ts"]', '["-e",' + json.dumps(fixture) + ']'),
]
for before, after in changes:
    assert source.count(before) == 1
    source = source.replace(before, after)
before = 'function stop(child){if(child.pid&&child.exitCode===null&&child.signalCode===null)try{process.kill(-child.pid,"SIGTERM");}catch{/* Already exited. */}}'
after = '''const stopping=new WeakSet();
  function stop(child){
    if(!child.pid||child.exitCode!==null||child.signalCode!==null||stopping.has(child))return;
    stopping.add(child);
    try{process.kill(-child.pid,"SIGTERM");}catch{return;}
    const escalation=setTimeout(()=>{
      if(child.exitCode===null&&child.signalCode===null)try{process.kill(-child.pid,"SIGKILL");}catch{/* Already exited. */}
    },100);
    child.once("close",()=>clearTimeout(escalation));
  }'''
assert source.count(before) == 1
if corrected:
    source = source.replace(before, after)
    import difflib
    proposal = original.decode().replace(before, after)
    (output / "termination-owner.patch").write_text("".join(difflib.unified_diff(
        original.decode().splitlines(True), proposal.splitlines(True),
        fromfile="a/evals/packaging/parallel-experiment.mjs", tofile="b/evals/packaging/parallel-experiment.mjs",
    )))
if fault:
    before, after = {
        "skip-kill": ('process.kill(-child.pid,"SIGKILL")', "void child.pid"),
        "late-kill": ("},100);", "},5000);"),
        "false-completion": ("const ok=!expired&&errors.length===0&&unchanged&&complete;", "const ok=true;"),
    }[fault]
    assert source.count(before) == 1
    source = source.replace(before, after)
module = scratch / (case + ".mjs")
module.write_text(source)
parent = None
children = set()
observed = None
def collect():
    logs = list(output.glob("worker-*-initial.txt"))
    for log in logs:
        for line in log.read_text().splitlines():
            if line.startswith("fixture child "):
                children.add(int(line.split()[-1]))
    return logs

with (output / "parent.txt").open("w") as stream:
    try:
        parent = subprocess.Popen(["node", str(module)], stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        began = time.monotonic()
        while time.monotonic() - began < 3:
            collect()
            time.sleep(0.05)
        logs = collect()
        ignored = sum("fixture ignored SIGTERM" in log.read_text() for log in logs)
        observed = dict(
            prototypeSha256=hashlib.sha256(original).hexdigest(), fixtureSha256=hashlib.sha256(module.read_bytes()).hexdigest(),
            fixtureLimitMs=1000, observationElapsedMs=(time.monotonic()-began)*1000,
            fixtureChildren=sorted(children), ignoredChildren=ignored,
            parentStillRunning=parent.poll() is None,
            corrected=corrected,
            fault=fault,
            scope="artificial interruption fixture; no installed tests or product faults qualified",
        )
        (output / "observation.json").write_text(json.dumps(observed, indent=2) + "\n")
        assert len(children) == 4 and ignored == 4
        assert not observed["parentStillRunning"], "CI-2: ignored termination leaves the proposed runner waiting"
        assert parent.returncode == 1, "CI-2: interrupted campaign must refuse qualification"
    finally:
        # Only groups reported by this controlled fixture; never a process-name search.
        collect()
        if parent is not None and parent.poll() is None:
            for pid in children:
                assert pid > 1 and pid != parent.pid
                try:
                    assert os.getpgid(pid) == pid
                    os.killpg(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        if parent is not None:
            try:
                status = parent.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(parent.pid, signal.SIGKILL)
                status = parent.wait(timeout=5)
            alive = []
            for pid in children:
                try:
                    os.kill(pid, 0)
                    alive.append(pid)
                except ProcessLookupError:
                    pass
            (output / "cleanup.json").write_text(json.dumps(dict(parentStatus=status, remainingFixtureChildren=alive), indent=2) + "\n")
            assert not alive, "controlled child cleanup incomplete"
assert Path("evals/packaging/parallel-experiment.mjs").read_bytes() == original
print(json.dumps(observed))
