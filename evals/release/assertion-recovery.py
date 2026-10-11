"""Collect bounded historical test diffs and literal pins for manual review."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-recovery"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another collection")
input_path = root / "evals/release/assertion-history/actual.json"
input_bytes = input_path.read_bytes()
assert hashlib.sha256(input_bytes).hexdigest() == "f813d4f9f5c54e8bfd0dd5e626680abb3978f1789a42c08309d35c7eb09eaf4b"
report = json.loads(input_bytes)
target = "evals/ci/mutation-recovery.test.ts"
runner_path = "evals/ci/mutation-run.ts"
definition = {"baseline": report["baseline"], "head": report["head"], "inventorySha256": hashlib.sha256(input_bytes).hexdigest(),
              "collectorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "scope": "only the pinned mutation-recovery test and runner; manual reasons, not a gate or execution proof"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")

def git(*arguments):
    return subprocess.check_output(["git", "--no-replace-objects", *arguments], timeout=30)

rows, patches = [], []
for edge in report["edges"]:
    if edge["path"] != target or edge["status"] != "M":
        continue
    for pin in (edge["parent"], edge["commit"]):
        assert re.fullmatch(r"[a-f0-9]{40}", pin)
    test_bytes = git("show", edge["commit"] + ":" + target)
    runner_bytes = git("show", edge["commit"] + ":" + runner_path)
    test, runner = test_bytes.decode(), runner_bytes.decode()
    definition_pin = re.search(r"assert.equal\(manifest.definition,(\d+)\)", test)
    seed_pin = re.search(r'assert.equal\(manifest.environment.FUZZ_SEED,"(\d+)"\)', test)
    actual_definitions = sorted(set(map(int, re.findall(r"definition[:!=]+(\d+)", runner))))
    actual_seeds = sorted(set(re.findall(r'FUZZ_SEED:"(\d+)"', runner)))
    expected_definition = int(definition_pin[1]) if definition_pin else None
    expected_seed = seed_pin[1] if seed_pin else None
    patch = git("diff", "--no-ext-diff", "--no-textconv", "--unified=2", edge["parent"], edge["commit"], "--", target)
    patches.append(edge["commit"].encode() + b"\n" + patch)
    rows.append({**edge, "testSha256": hashlib.sha256(test_bytes).hexdigest(),
                 "runnerSha256": hashlib.sha256(runner_bytes).hexdigest(), "diffSha256": hashlib.sha256(patch).hexdigest(),
                 "expectedDefinition": expected_definition, "runnerDefinitions": actual_definitions,
                 "expectedSeed": expected_seed, "runnerSeeds": actual_seeds,
                 "literalPinsMatch": actual_definitions == [expected_definition] and actual_seeds == [expected_seed]})
(output / "edges.json").write_text(json.dumps(rows, indent=2) + "\n")
(output / "edges.diff").write_bytes(b"\n".join(patches))
(output / "result.json").write_text(json.dumps({"collectedEdges": len(rows),
    "literalMatches": sum(row["literalPinsMatch"] for row in rows), "automatedReasonReview": False,
    "independentReview": False, "releaseClearance": False}, indent=2) + "\n")
print("bounded test/runner evidence collected; literal matches are not execution or review clearance")
