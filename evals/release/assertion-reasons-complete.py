"""Index frozen modification reasons without granting release clearance."""
import hashlib
import json
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/assertion-reasons-complete"
output.mkdir(exist_ok=True)
assert not (output / "inputs.json").exists(), "preserve previous evidence before regeneration"
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

modifications = [row for row in inventory["edges"] if row["status"] == "M"]
known = {key(row) for row in modifications}
assert len(modifications) == len(known) == 142
references = {}
areas = ["recovery", "packaging", "interfaces", "storage", "owned", "signer", "coverage", "stage", "other", "consumers"]
for area in areas:
    base = "evals/release/assertion-" + area
    definition = json.loads(read(base + "/definition.json"))
    assert definition["inventorySha256"] == inputs[inventory_path], "receipt inventory differs"
    assert definition["baseline"] == inventory["baseline"] and definition["head"] == inventory["head"], "receipt range differs"
    read(base + ".md")
    read(base + "/edges.diff")
    rows = json.loads(read(base + "/edges.json"))
    for row in rows:
        identity = key(row)
        assert identity in known, "foreign modification reason"
        assert identity not in references, "duplicate modification reason"
        fields = ["testSha256", "runnerSha256", "diffSha256"] if area == "recovery" else ["beforeSha256", "afterSha256", "diffSha256"]
        for field in fields:
            value = row[field]
            assert isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value), "invalid content binding"
        references[identity] = base + ".md"
assert set(references) == known, "missing modification reason"
rows = [{**row, "builderReasonReceipt": references[key(row)], "independentReview": False,
         "releaseClearance": False} for row in modifications]
summary = {"baseline": inventory["baseline"], "head": inventory["head"],
           "modificationEdges": len(rows), "edgesLinkedToScopedBuilderReasons": len(references),
           "edgesWithoutIndexedReason": 0, "reasonReceipts": len(areas),
           "scope": "complete reference allocation for frozen named-test modifications only",
           "confirmedMaintainedGap": "S154 head declaration check; O10 unapplied",
           "initialAdditionsReviewed": False, "completeHistoryReview": False,
           "independentReview": False, "publicHistoryClearance": False, "releaseClearance": False}
inputs["evals/release/assertion-reasons-complete.py"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
(output / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
(output / "edges.json").write_text(json.dumps(rows, indent=2) + "\n")
(output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
