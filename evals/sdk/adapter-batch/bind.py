"""Bind the prepared D41 candidate and verify restoration to the reviewed product."""
import hashlib
import json
from pathlib import Path
import sys

output = Path("evals/sdk/adapter-batch")
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
prior = json.loads(Path("evals/sdk/adapter-buffer/candidate.json").read_text())
adapter = "packages/sdk/src/adapters/agent-kit.ts"
if "--restored" in sys.argv:
    pinned = json.loads((output / "candidate.json").read_text())
    assert all(digest(path) == value for path, value in prior["product_sources"].items())
    assert all(digest(path) == value for group in ("compiled_files", "evaluation_inputs") for path, value in pinned[group].items())
    assert digest(pinned["archive"]) == pinned["archiveSha256"]
    (output / "restoration.json").write_text(json.dumps({"reviewedBase": pinned["reviewedBase"], "productRestored": True, "candidatePreserved": True}, indent=2) + "\n")
    print("reviewed product restored; candidate identities retained")
else:
    sources = {path: digest(path) for path in prior["product_sources"]}
    assert [path for path in sources if sources[path] != prior["product_sources"][path]] == [adapter]
    assert sources[adapter] == digest(output / "agent-kit.candidate.txt")
    assert Path("packages/sdk/test/adapter-batch.test.ts").read_bytes() == (output / "batch.candidate.txt").read_bytes()
    archive = ".sandbox/solanaut-1/adapter-batch/solanaut-sdk-0.0.0.tgz"
    result = {
        "reviewedBase": "fc3caff2579450d752545cb52ebcd693c0557b13",
        "scope": "prepared D41/ADP-1 component; native H11 failure prevents product integration",
        "product_sources": sources,
        "compiled_files": {path: digest(path) for path in prior["compiled_files"]},
        "evaluation_inputs": {str(path): digest(path) for path in sorted(output.glob("*.py"))} | {str(path): digest(path) for path in sorted(output.glob("*.candidate.txt"))} | {str(output / "product.patch"): digest(output / "product.patch")},
        "archive": archive,
        "archiveSha256": digest(archive),
    }
    (output / "candidate.json").write_text(json.dumps(result, indent=2) + "\n")
    print("prepared candidate bound")
