"""Join scoped builder reason receipts to the frozen named-test inventory.

This is a data index, not an approval mechanism or release gate.
"""
import hashlib
import json
from collections import Counter
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-review-map"
output.mkdir(exist_ok=True)
if (output / "inputs.json").exists():
    raise ValueError("preserve earlier evidence before another collection")
inputs = {}

def read(relative):
    data = (root / relative).read_bytes()
    inputs[relative] = hashlib.sha256(data).hexdigest()
    return data

inventory_path = "evals/release/assertion-history/actual.json"
inventory = json.loads(read(inventory_path))
assert inputs[inventory_path] == "f813d4f9f5c54e8bfd0dd5e626680abb3978f1789a42c08309d35c7eb09eaf4b"

def key(edge):
    return edge["parent"], edge["commit"], edge["status"], edge["path"]

modifications = [edge for edge in inventory["edges"] if edge["status"] == "M"]
assert len(modifications) == 142 and len({key(edge) for edge in modifications}) == 142
known = {key(edge) for edge in modifications}
references = {}
areas = ["recovery", "packaging", "interfaces", "storage", "owned", "signer"]
for area in areas:
    base = "evals/release/assertion-" + area
    definition = json.loads(read(base + "/definition.json"))
    assert definition["inventorySha256"] == inputs[inventory_path]
    assert definition["baseline"] == inventory["baseline"] and definition["head"] == inventory["head"]
    read(base + ".md")
    rows = json.loads(read(base + "/edges.json"))
    for row in rows:
        identity = key(row)
        assert identity in known, "receipt references an edge outside the frozen modification inventory"
        assert identity not in references, "duplicate reason reference must not inflate the index"
        references[identity] = base + ".md"
assert len(references) == 63
rows = [{**edge, "builderReasonReceipt": references.get(key(edge)),
         "independentReview": False, "releaseClearance": False} for edge in modifications]
pending = [row for row in rows if row["builderReasonReceipt"] is None]
summary = {"baseline": inventory["baseline"], "head": inventory["head"],
           "modificationEdges": len(rows), "edgesLinkedToScopedBuilderReasons": len(references),
           "edgesWithoutIndexedReason": len(pending),
           "pendingByPath": dict(sorted(Counter(row["path"] for row in pending).items())),
           "scope": "indexes six scoped builder reason receipts; does not read remaining patches or grant approval",
           "initialAdditionsReviewed": False, "completeHistoryReview": False,
           "independentReview": False, "publicHistoryClearance": False, "releaseClearance": False}
inputs["evals/release/assertion-review-map.py"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
(output / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
(output / "edges.json").write_text(json.dumps(rows, indent=2) + "\n")
(output / "pending.json").write_text(json.dumps(pending, indent=2) + "\n")
(output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
