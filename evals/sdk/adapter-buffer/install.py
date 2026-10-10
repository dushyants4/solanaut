"""Run the same boundary cases through a real offline installed SDK export."""
import json
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
output = root / "evals/sdk/adapter-buffer"
scratch = root / ".sandbox/solanaut-1/adapter-buffer"
scratch.mkdir(parents=True, exist_ok=True)
archives = list(scratch.glob("*.tgz"))
assert len(archives) == 1
with tempfile.TemporaryDirectory(prefix="solanaut-adapter-buffer-") as directory:
    consumer = Path(directory)
    (consumer / "package.json").write_text('{"private":true,"type":"module"}\n')
    with (output / "offline-install.txt").open("w") as log:
        result = subprocess.run(["npm", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", str(archives[0])], cwd=consumer, stdout=log, stderr=subprocess.STDOUT)
    assert result.returncode == 0
    package = consumer / "node_modules/@solanaut/sdk"
    assert package.is_dir() and not package.is_symlink()
    source = (root / "packages/sdk/test/adapter-buffer.test.ts").read_text()
    for path in ("../src/guard.ts", "../src/base58.ts", "./support/workload.ts", "./support/craft.ts"):
        source = source.replace(json.dumps(path), json.dumps(str((root / "packages/sdk/test" / path).resolve())))
    before = '"../src/adapters/agent-kit.ts"'
    assert source.count(before) == 1
    source = source.replace(before, json.dumps(str(package / "dist/src/index.js")))
    generated = scratch / "installed-cases.ts"
    generated.write_text(source)
    with (output / "installed-cases.txt").open("w") as log:
        result = subprocess.run(["node", "--test", str(generated)], stdout=log, stderr=subprocess.STDOUT)
    (output / "installed-result.json").write_text(json.dumps({"status": result.returncode, "packageSymlink": False,
        "scope": "actual installed public wallet export; repository guard and fixture builders"}, indent=2) + "\n")
    assert result.returncode == 0
