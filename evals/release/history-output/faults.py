"""Qualify the proposed output-parent check; leave the maintained runner alone."""
from pathlib import Path
import json
import os
import subprocess

path = Path("evals/release/history-output.candidate.mjs")
output = Path("evals/release/history-output/faults")
output.mkdir(exist_ok=True)
original = path.read_bytes()
check = 'if (realpathSync(dirname(output)) !== dirname(output)) throw new Error("output parent must not redirect");'
assert original.decode().count(check) == 1
env = {**os.environ, "SOLANAUT_HISTORY_OUTPUT_DRIVER": str(path)}
caught = []
try:
    for name, replacement in [("omitted-parent", "// omitted parent check"), ("late-parent", "// moved parent check after directory creation")]:
        text = original.decode().replace(check, replacement)
        if name == "late-parent":
            text = text.replace("mkdirSync(output);", "mkdirSync(output);\n" + check)
        path.write_text(text)
        result = subprocess.run(["node", "--test", "evals/release/history-output.test.mjs"], env=env, capture_output=True, text=True, timeout=30)
        text = result.stdout + result.stderr
        (output / (name + ".txt")).write_text(text)
        assert result.returncode == 1 and "AssertionError" in text
        assert "ℹ tests 2\n" in text
        assert all("ℹ " + label + " 0\n" in text for label in ("cancelled", "skipped", "todo"))
        caught.append(name)
finally:
    path.write_bytes(original)
result = subprocess.run(["node", "--test", "evals/release/history-output.test.mjs"], env=env, capture_output=True, text=True, timeout=30)
(output / "restored.txt").write_text(result.stdout + result.stderr)
assert result.returncode == 0 and path.read_bytes() == original
(output / "summary.json").write_text(json.dumps({"caught": caught, "restored": True}, indent=2) + "\n")
print("proposed output-parent faults caught; exact candidate restored")
