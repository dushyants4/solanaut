"""Exercise the private emitted facade from a real offline tarball installation."""
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

archive = Path(".sandbox/solanaut-1/owned-signing/solanaut-sdk-0.0.0.tgz").resolve()
output = Path("evals/sdk/owned-signing")
consumer = Path(tempfile.mkdtemp(prefix="solanaut-owned-signing-"))
try:
    install = subprocess.run(
        ["npm", "install", "--ignore-scripts", "--offline", "--no-audit", "--no-fund", "--prefix", str(consumer), str(archive)],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120,
    )
    (output / "offline-install.txt").write_bytes(install.stdout)
    assert install.returncode == 0
    package = consumer / "node_modules/@solanaut/sdk"
    assert package.is_dir() and not package.is_symlink()
    module = package / "dist/src/owned-guard.js"
    environment = os.environ.copy()
    environment["SOLANAUT_OWNED_MODULE"] = module.as_uri()
    environment["NODE_DISABLE_COMPILE_CACHE"] = "1"
    result = subprocess.run(
        ["node", "--test", "packages/sdk/test/owned-signing.test.ts"],
        env=environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60,
    )
    (output / "installed-private.txt").write_bytes(result.stdout)
    assert result.returncode == 0 and "tests 9\n" in result.stdout.decode()
    (output / "installed-private.json").write_text(json.dumps(dict(
        scope="private installed facade; repository fixture writers and transaction builders",
        archiveSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
        installedModuleSha256=hashlib.sha256(module.read_bytes()).hexdigest(),
        externalConsumer=str(consumer), packageSymlink=False, status=result.returncode,
    ), indent=2) + "\n")
finally:
    shutil.rmtree(consumer)
