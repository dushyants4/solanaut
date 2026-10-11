"""Collect selected client/policy/history assertion edits for manual review."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-interfaces"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another collection")
input_bytes = (root / "evals/release/assertion-history/actual.json").read_bytes()
assert hashlib.sha256(input_bytes).hexdigest() == "f813d4f9f5c54e8bfd0dd5e626680abb3978f1789a42c08309d35c7eb09eaf4b"
report = json.loads(input_bytes)
selected = {"evals/ci/ordinary-serial.test.ts": "6162efb", "evals/ci/history.test.ts": "9a6480f",
            "packages/sdk/test/sending-client.test.ts": "43f20c0", "evals/ci/coverage-hook.test.ts": "0332c97",
            "packages/sdk/test/signed-policy.test.ts": "9996f00"}
definition = {"baseline": report["baseline"], "head": report["head"], "inventorySha256": hashlib.sha256(input_bytes).hexdigest(),
              "collectorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "selected": selected,
              "currentRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "scope": "selected historical diffs/current test identities, not complete or independent assertion review"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
rows, patches = [], []
for edge in report["edges"]:
    if edge["status"] != "M" or selected.get(edge["path"]) != edge["commit"][:7]:
        continue
    target = edge["path"]
    patch = subprocess.check_output(["git", "--no-replace-objects", "diff", "--no-ext-diff", "--no-textconv", "--unified=2", edge["parent"], edge["commit"], "--", target], timeout=30)
    before = subprocess.check_output(["git", "--no-replace-objects", "show", edge["parent"] + ":" + target], timeout=30)
    after = subprocess.check_output(["git", "--no-replace-objects", "show", edge["commit"] + ":" + target], timeout=30)
    current = (root / target).read_bytes()
    rows.append({**edge, "beforeSha256": hashlib.sha256(before).hexdigest(), "afterSha256": hashlib.sha256(after).hexdigest(),
                 "diffSha256": hashlib.sha256(patch).hexdigest(), "currentTestSha256": hashlib.sha256(current).hexdigest(),
                 "currentTestEqualsSelectedRevision": current == after})
    patches.append(edge["commit"].encode() + b"\n" + patch)
assert {(row["path"], row["commit"][:7]) for row in rows} == set(selected.items())
(output / "edges.json").write_text(json.dumps(rows, indent=2) + "\n")
(output / "edges.diff").write_bytes(b"\n".join(patches))
(output / "result.json").write_text(json.dumps({"selectedEdgesCollected": len(rows), "automatedReasonReview": False,
    "completeHistoryReview": False, "independentReview": False, "releaseClearance": False}, indent=2) + "\n")
print("selected interface/history assertions collected; complete and independent review remain pending")
