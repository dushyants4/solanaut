"""Read-only content companion omissions; restore exact checker bytes."""
import json
from pathlib import Path
import subprocess

path = Path("evals/release/history-bytes.mjs")
output = Path("evals/release/history-bytes/faults")
output.mkdir(exist_ok=True)
original = path.read_bytes()
driver = Path("evals/release/history-bytes-run.mjs")
driver_original = driver.read_bytes()
faults = [
    ("inventory", 'if (JSON.stringify(current) !== JSON.stringify(manifest)) throw new Error("inventory does not match current complete scope");', "// omitted inventory binding"),
    ("size", 'if (bytes.length !== blob.size) throw new Error("blob size differs from inventory");', "// omitted size check"),
    ("hash", 'if (object !== blob.id) throw new Error("blob hash differs from inventory");', "// omitted object hash"),
    ("scope", 'if (JSON.stringify(inventoryHistory(repository)) !== JSON.stringify(manifest)) throw new Error("history scope changed during content reads");', "// omitted final scope check"),
    ("sensitive-path", 'if (manifest.blobs.some(blob => blob.paths.some(sensitiveHistoryPath))) throw new Error("sensitive historical path requires human review before content reads");', "// omitted sensitive preflight"),
    ("gitlink", 'if (manifest.gitlinks.length) throw new Error("gitlink target content requires separate review");', "// omitted gitlink preflight"),
    ("object-format", 'const algorithm = blob.id.length === 40 ? "sha1" : "sha256";', 'const algorithm = "sha1";'),
    ("cli-refusal", 'writeFileSync(resolve(output, "refusal.json"), JSON.stringify(refusal, null, 2) + "\\n", { flag: "wx" });', "// omitted durable refusal evidence"),
    ("cli-clearance", 'complete: false, clearance: false, reason:', 'complete: false, clearance: true, reason:'),
]
caught = []
try:
    for name, before, after in faults:
        target = driver if name.startswith("cli-") else path
        source = (driver_original if name.startswith("cli-") else original).decode()
        assert source.count(before) == 1
        target.write_text(source.replace(before, after))
        result = subprocess.run(["node", "--test", "evals/release/history-bytes.test.mjs"], capture_output=True, text=True, timeout=30)
        text = result.stdout + result.stderr
        (output / (name + ".txt")).write_text(text)
        assert result.returncode == 1 and "AssertionError" in text
        assert "ℹ tests 13\n" in text
        assert all("ℹ " + label + " 0\n" in text for label in ("cancelled", "skipped", "todo"))
        caught.append(name)
        path.write_bytes(original)
        driver.write_bytes(driver_original)
finally:
    path.write_bytes(original)
    driver.write_bytes(driver_original)
result = subprocess.run(["node", "--test", "evals/release/history-bytes.test.mjs"], capture_output=True, text=True, timeout=30)
(output / "restored.txt").write_text(result.stdout + result.stderr)
assert result.returncode == 0 and path.read_bytes() == original and driver.read_bytes() == driver_original
(output / "summary.json").write_text(json.dumps({"caught": caught, "restored": True}, indent=2) + "\n")
print("content companion faults caught and restored")
