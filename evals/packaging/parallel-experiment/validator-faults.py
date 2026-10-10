"""Reproduce the strengthened validator fault battery; restore exact source."""
import hashlib
import json
import subprocess
from pathlib import Path

path = Path("evals/packaging/parallel-experiment.mjs")
original = path.read_bytes()
source = original.decode()
output = Path("evals/packaging/parallel-experiment/validator-faults")
faults = [
    ("timeout", "result.timedOut||", "", "timeout"),
    ("population", 'count("tests")!==19||', "", "partial population"),
    ("target", "line.includes(target)", "true", "wrong target"),
    ("signal", "result.signal!==null", "false", "termination"),
    ("control", 'else if(count("pass")!==19||count("fail")!==0)', "else if(false)", "failed control"),
    ("footer", "lines.findLastIndex(", "lines.findIndex(", "earlier forged footer"),
]
results = []
try:
    for name, before, after, target in faults:
        assert source.count(before) == 1
        damaged = source.replace(before, after)
        if name == "population":
            damaged = damaged.replace('count("pass")+count("fail")!==19', "false")
        path.write_text(damaged)
        result = subprocess.run(
            ["node", "--test", "evals/packaging/parallel-experiment.test.mjs"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60,
        )
        (output / f"{name}-strengthened.txt").write_bytes(result.stdout)
        caught = result.returncode != 0 and target in result.stdout.decode()
        results.append(dict(fault=name, status=result.returncode, caught=caught))
        assert caught, name
finally:
    path.write_bytes(original)
(output / "strengthened.json").write_text(json.dumps(dict(
    results=results, source_restored_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
), indent=2) + "\n")
result = subprocess.run(
    ["node", "--test", "evals/packaging/parallel-experiment.test.mjs"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60,
)
Path("evals/packaging/parallel-experiment/unit-strengthened.txt").write_bytes(result.stdout)
print(result.stdout.decode())
assert result.returncode == 0
