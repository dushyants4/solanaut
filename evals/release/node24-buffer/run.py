"""Install the preserved D40 archive; keep each runtime's original evidence intact."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/node24-buffer"
manifest = json.loads((root / "evals/sdk/adapter-buffer/candidate.json").read_text())
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
archive = root / manifest["archive"]
assert digest(archive) == manifest["archive_sha256"]
snapshot = root / "evals/sdk/adapter-buffer/candidate-test.ts.txt"
assert digest(snapshot) == manifest["evaluation_inputs"]["packages/sdk/test/adapter-buffer.test.ts"]
version = subprocess.check_output(["node", "--version"], text=True).strip()
assert version == "v24.19.0"
faults = [
    ("legacy-message-copy", "new Uint8Array(new Uint8Array(tx.serializeMessage()))", "new Uint8Array(tx.serializeMessage())"),
    ("versioned-message-copy", "new Uint8Array(new Uint8Array(tx.message.serialize()))", "new Uint8Array(tx.message.serialize())"),
    ("wire-copy", "new Uint8Array(new Uint8Array(signed[0].serialize()))", "new Uint8Array(signed[0].serialize())"),
]
with tempfile.TemporaryDirectory(prefix="solanaut-d40-node24-") as directory:
    consumer = Path(directory)
    (consumer / "package.json").write_text('{"private":true,"type":"module"}\n')
    with (output / "install.txt").open("w") as log:
        installed = subprocess.run(["npm", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", str(archive)], cwd=consumer, stdout=log, stderr=subprocess.STDOUT)
    assert installed.returncode == 0
    package = consumer / "node_modules/@solanaut/sdk"
    assert package.is_dir() and not package.is_symlink()
    source = snapshot.read_text()
    for relative in ("../src/guard.ts", "../src/base58.ts", "./support/workload.ts", "./support/craft.ts"):
        path = (root / "packages/sdk/test" / relative).resolve()
        relative_path = str(path.relative_to(root))
        group = "product_sources" if relative_path in manifest["product_sources"] else "evaluation_inputs"
        assert digest(path) == manifest[group][relative_path]
        source = source.replace(json.dumps(relative), json.dumps(str(path)))
    source = source.replace('"../src/adapters/agent-kit.ts"', json.dumps(str(package / "dist/src/index.js")))
    cases = consumer / "cases.ts"
    cases.write_text(source)
    implementation = package / "dist/src/adapters/agent-kit.js"
    original = implementation.read_bytes()
    assert hashlib.sha256(original).hexdigest() == manifest["compiled_files"][".sandbox/releases/sdk/dist/src/adapters/agent-kit.js"]
    def run(name, status):
        result = subprocess.run(["node", "--test", str(cases)], capture_output=True, text=True)
        text = result.stdout + result.stderr
        (output / (name + ".txt")).write_text(text)
        assert result.returncode == status and "ℹ tests 6\n" in text
        assert all("ℹ " + label + " 0\n" in text for label in ("cancelled", "skipped", "todo"))
        if status:
            assert "AssertionError" in text and "ADP-1/ADR-009" in text
        else:
            assert "ℹ pass 6\n" in text and "ℹ fail 0\n" in text
    run("baseline", 0)
    caught = []
    try:
        for name, before, after in faults:
            source = original.decode()
            assert source.count(before) == 1
            implementation.write_text(source.replace(before, after))
            run(name, 1)
            caught.append(name)
            implementation.write_bytes(original)
    finally:
        implementation.write_bytes(original)
    run("restored", 0)
    assert implementation.read_bytes() == original
    (output / "summary.json").write_text(json.dumps({"runtime": version, "archiveSha256": digest(archive), "packageSymlink": False, "caught": caught, "restored": True, "scope": "installed patched wallet export; repository guard/builders, no complete runtime matrix"}, indent=2) + "\n")
