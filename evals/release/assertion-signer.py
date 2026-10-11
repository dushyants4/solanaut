"""Collect bounded signer test modification edges for manual review."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-signer"
output.mkdir(exist_ok=True)
if (output / "definition.json").exists():
    raise ValueError("preserve earlier evidence before another collection")
inventory = (root / "evals/release/assertion-history/actual.json").read_bytes()
assert hashlib.sha256(inventory).hexdigest() == "f813d4f9f5c54e8bfd0dd5e626680abb3978f1789a42c08309d35c7eb09eaf4b"
report = json.loads(inventory)
selected = {"rpc.test.ts": ["f810612", "657e338"], "socket.test.ts": ["4af8e80", "a40375a", "657e338"],
            "core.test.ts": ["b7d24a5", "8b92594"], "handler.test.ts": ["a40375a"], "service.test.ts": ["f9c0cec"]}
selected = {"apps/signer/test/" + name: prefixes for name, prefixes in selected.items()}
definition = {"baseline": report["baseline"], "head": report["head"],
              "inventorySha256": hashlib.sha256(inventory).hexdigest(),
              "collectorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "selected": selected,
              "currentRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "scope": "bounded signer test modification patches, not complete or independent history review"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
rows, patches = [], []
for edge in report["edges"]:
    target = edge["path"]
    if edge["status"] != "M" or edge["commit"][:7] not in selected.get(target, []):
        continue
    patch = subprocess.check_output(["git", "--no-replace-objects", "diff", "--no-ext-diff", "--no-textconv", "--unified=2", edge["parent"], edge["commit"], "--", target], timeout=30)
    before = subprocess.check_output(["git", "--no-replace-objects", "show", edge["parent"] + ":" + target], timeout=30)
    after = subprocess.check_output(["git", "--no-replace-objects", "show", edge["commit"] + ":" + target], timeout=30)
    rows.append({**edge, "beforeSha256": hashlib.sha256(before).hexdigest(), "afterSha256": hashlib.sha256(after).hexdigest(),
                 "diffSha256": hashlib.sha256(patch).hexdigest(), "currentTestSha256": hashlib.sha256((root / target).read_bytes()).hexdigest()})
    patches.append(edge["commit"].encode() + b"\n" + patch)
assert {(row["path"], row["commit"][:7]) for row in rows} == {(path, prefix) for path, prefixes in selected.items() for prefix in prefixes}
(output / "edges.json").write_text(json.dumps(rows, indent=2) + "\n")
(output / "edges.diff").write_bytes(b"\n".join(patches))
(output / "result.json").write_text(json.dumps({"selectedEdgesCollected": len(rows), "automatedReasonReview": False,
    "completeHistoryReview": False, "independentReview": False, "releaseClearance": False}, indent=2) + "\n")
print("signer assertion patches collected; broader and independent review remain pending")
