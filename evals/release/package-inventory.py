"""Draft package-root inventory, separate from npm's unchanged raw report."""
import copy
import hashlib
import json
import subprocess
import tarfile
import tempfile
from pathlib import Path


def project(raw, manifest, archive):
    result = copy.deepcopy(raw)
    root = result["metadata"]["component"]
    scope, name = manifest["name"].split("/", 1)
    root["group"], root["name"] = scope, name
    root["hashes"] = [{"alg": "SHA-256", "content": hashlib.sha256(archive).hexdigest()},
                      {"alg": "SHA-512", "content": hashlib.sha512(archive).hexdigest()}]
    validate(result, manifest, archive)
    return result


def validate(report, manifest, archive):
    if manifest["name"] != "@solanaut/sdk" or manifest["version"] != "0.0.0" or manifest["dependencies"] != {"@gubernaut/core": "1.0.1"}:
        raise ValueError("unsupported artifact manifest")
    root = report["metadata"]["component"]
    identity = (report["bomFormat"], report["specVersion"], root.get("group"), root["name"], root["version"], root["bom-ref"], root["purl"])
    if identity != ("CycloneDX", "1.5", "@solanaut", "sdk", "0.0.0", "@solanaut/sdk@0.0.0", "pkg:npm/%40solanaut/sdk@0.0.0"):
        raise ValueError("root identity differs from artifact manifest")
    expected_hashes = [{"alg": "SHA-256", "content": hashlib.sha256(archive).hexdigest()},
                       {"alg": "SHA-512", "content": hashlib.sha512(archive).hexdigest()}]
    if root.get("hashes") != expected_hashes:
        raise ValueError("archive hash differs from artifact bytes")
    components = [(c["name"], c["version"], c["bom-ref"]) for c in report["components"]]
    if components != [("@gubernaut/core", "1.0.1", "@gubernaut/core@1.0.1")]:
        raise ValueError("runtime component differs from pinned manifest")
    expected_edges = [{"ref": "@solanaut/sdk@0.0.0", "dependsOn": ["@gubernaut/core@1.0.1"]},
                      {"ref": "@gubernaut/core@1.0.1", "dependsOn": []}]
    if report["dependencies"] != expected_edges:
        raise ValueError("dependency graph differs from pinned manifest")


def generate():
    root = Path.cwd()
    output = root / "evals/release/package-inventory"
    output.mkdir(exist_ok=True)
    if (output / "definition.json").exists():
        raise ValueError("preserve earlier evidence before a new generation")
    archive_path = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
    archive = archive_path.read_bytes()
    archive_hash = hashlib.sha256(archive).hexdigest()
    if archive_hash != "55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d":
        raise ValueError("unexpected current SDK artifact")
    runner = Path(__file__).read_bytes()
    definition = {"revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
                  "archiveSha256": archive_hash, "runnerSha256": hashlib.sha256(runner).hexdigest(),
                  "node": subprocess.check_output(["node", "--version"], text=True).strip(),
                  "npm": subprocess.check_output(["npm", "--version"], text=True).strip(),
                  "scope": "derived draft inventory; original npm output retained, no schema or release clearance"}
    (output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
    with tempfile.TemporaryDirectory(prefix="solanaut-package-inventory-") as directory:
        with tarfile.open(archive_path) as packed:
            packed.extractall(directory, filter="data")
        package = Path(directory) / "package"
        manifest = json.loads((package / "package.json").read_text())
        (output / "artifact-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        commands = [("lock", ["npm", "install", "--offline", "--ignore-scripts", "--package-lock-only", "--omit", "dev", "--no-audit", "--no-fund"]),
                    ("npm", ["npm", "sbom", "--package-lock-only", "--sbom-format", "cyclonedx", "--omit", "dev"])]
        for label, command in commands:
            run = subprocess.run(command, cwd=package, capture_output=True, text=True, timeout=60)
            (output / (label + ".stdout")).write_text(run.stdout)
            (output / (label + ".stderr")).write_text(run.stderr)
            if run.returncode:
                raise ValueError(f"{label} exited {run.returncode}")
        raw = json.loads(run.stdout)
        try:
            validate(raw, manifest, archive)
        except ValueError as error:
            if "root identity" not in str(error):
                raise
            (output / "raw-root-refusal.txt").write_text(str(error) + "\n")
        else:
            raise ValueError("expected original root naming finding was absent")
        derived = project(raw, manifest, archive)
        lock = (package / "package-lock.json").read_bytes()
        (output / "artifact-package-lock.json").write_bytes(lock)
        component_hash = next(item["content"] for item in derived["components"][0]["hashes"] if item["alg"] == "SHA-512")
        import base64
        expected_integrity = json.loads(lock)["packages"]["node_modules/@gubernaut/core"]["integrity"]
        if "sha512-" + base64.b64encode(bytes.fromhex(component_hash)).decode() != expected_integrity:
            raise ValueError("runtime component integrity differs from lock")
        (output / "derived-package.cdx.json").write_text(json.dumps(derived, indent=2) + "\n")
    if archive_path.read_bytes() != archive or Path(__file__).read_bytes() != runner:
        raise ValueError("bound inputs changed during generation")
    binding = {"archiveSha256": archive_hash,
               "rawSha256": hashlib.sha256((output / "npm.stdout").read_bytes()).hexdigest(),
               "derivedSha256": hashlib.sha256((output / "derived-package.cdx.json").read_bytes()).hexdigest(),
               "rawRootRefused": True, "runtimeIntegrityMatched": True, "temporaryConsumerRemoved": True,
               "fullSchemaValidation": False, "licenseClearance": False, "releaseClearance": False}
    (output / "binding.json").write_text(json.dumps(binding, indent=2) + "\n")
    print("manifest-bound derived inventory retained; original root finding preserved")


if __name__ == "__main__":
    generate()
