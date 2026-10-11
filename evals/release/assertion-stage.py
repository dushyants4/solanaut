"""Collect mutation-staging assertion history and literal file observations."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-stage"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another collection")
inventory = (root / "evals/release/assertion-history/actual.json").read_bytes()
assert hashlib.sha256(inventory).hexdigest() == "f813d4f9f5c54e8bfd0dd5e626680abb3978f1789a42c08309d35c7eb09eaf4b"
report = json.loads(inventory)
target, helper = "evals/ci/mutation-stage.test.ts", "evals/ci/mutation-stage.ts"
selected = [edge for edge in report["edges"] if edge["status"] == "M" and edge["path"] == target]
assert len(selected) == 18
definition = {"baseline": report["baseline"], "head": report["head"],
              "inventorySha256": hashlib.sha256(inventory).hexdigest(),
              "collectorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "selected": selected, "currentRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "currentTestSha256": hashlib.sha256((root / target).read_bytes()).hexdigest(),
              "scope": "mutation-stage modification diffs/literal observations, not completed mutation or independent review"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")

def literal(text, name, test):
    expression = (r"assert\.deepEqual\(" + name + r",(\[[^\]]*\])\.map") if test else (r"export const " + name + r"\s*=\s*(\[[^\]]*\])\.map")
    match = re.search(expression, text)
    return json.loads(match[1]) if match else None

rows, patches = [], []
for edge in selected:
    patch = subprocess.check_output(["git", "--no-replace-objects", "diff", "--no-ext-diff", "--no-textconv", "--unified=2", edge["parent"], edge["commit"], "--", target], timeout=30)
    before = subprocess.check_output(["git", "--no-replace-objects", "show", edge["parent"] + ":" + target], timeout=30)
    after = subprocess.check_output(["git", "--no-replace-objects", "show", edge["commit"] + ":" + target], timeout=30)
    stage = subprocess.check_output(["git", "--no-replace-objects", "show", edge["commit"] + ":" + helper], timeout=30)
    observations = {}
    for name in ["MUTATION_PATHS", "MUTATION_TESTS"]:
        old, new, actual = literal(before.decode(), name, True), literal(after.decode(), name, True), literal(stage.decode(), name, False)
        if new is None:
            observations[name] = {"expectedAssertionAbsent": True}
            continue
        assert actual is not None
        normal = [value.removesuffix(".ts") for value in actual] if name == "MUTATION_PATHS" else actual
        assert new == normal, "same-revision expected file list differs from helper"
        removed = [value for value in (old or []) if value not in new]
        assert not removed, "expected file list lost an earlier case"
        observations[name] = {"added": [value for value in new if value not in (old or [])], "removed": removed,
                              "expectedCount": len(new), "literalMatchesHelper": True}
    rows.append({**edge, "beforeSha256": hashlib.sha256(before).hexdigest(), "afterSha256": hashlib.sha256(after).hexdigest(),
                 "helperSha256": hashlib.sha256(stage).hexdigest(), "diffSha256": hashlib.sha256(patch).hexdigest(), "observations": observations})
    patches.append(edge["commit"].encode() + b"\n" + patch)
(output / "edges.json").write_text(json.dumps(rows, indent=2) + "\n")
(output / "edges.diff").write_bytes(b"\n".join(patches))
(output / "result.json").write_text(json.dumps({"selectedEdgesCollected": len(rows), "automatedReasonReview": False,
    "completeHistoryReview": False, "independentReview": False, "releaseClearance": False}, indent=2) + "\n")
print("staging assertion diffs/literal observations collected; completed mutation and independent review remain pending")
