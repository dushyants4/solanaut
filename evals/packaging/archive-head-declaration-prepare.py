"""Prepare a copied consumer type regression; maintained gates stay unchanged."""
import hashlib
import json
from pathlib import Path

root = Path.cwd()
output = root / "evals/packaging/archive-head-declaration"
output.mkdir(exist_ok=True)
scratch = root / ".sandbox/archive-head-declaration"
source = root / "evals/packaging/packed-sdk.test.ts"
original = source.read_text()
proposed = original
for name in ["craft", "workload"]:
    old = "../../packages/sdk/test/support/" + name + ".ts"
    assert proposed.count(old) == 1
    proposed = proposed.replace(old, str(root / "packages/sdk/test/support" / (name + ".ts")))
old_root = 'const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");'
assert proposed.count(old_root) == 1
proposed = proposed.replace(old_root, "const root = " + json.dumps(str(root)) + ";")
old = "    const code: ArchiveErrorCode = 'anchor';"
assert proposed.count(old) == 1
proposed = proposed.replace(old, old + "\n    const headCode: ArchiveErrorCode = 'head';\n    void headCode;")
destination = scratch / "proposed.test.ts"
assert not destination.exists(), "preserve earlier prepared controls"
destination.write_text(proposed)
archive = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
assert archive_hash == "55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d"
manifest = {"revision": "39622d4cfc3c82a88b5bc0ce0c9f8223c1a6c672", "archiveSha256": archive_hash,
            "maintainedTestSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "proposedTestSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
            "changes": "relocate fixture imports/root only; add retained head error-code type example alongside anchor",
            "sourceChanged": False, "maintainedGateChanged": False, "releaseClearance": False}
(output / "inputs.json").write_text(json.dumps(manifest, indent=2) + "\n")
print("copied consumer type regression prepared; maintained gate unchanged")
