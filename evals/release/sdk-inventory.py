"""Inventory the installed private SDK graph; refuse a missing dependency first."""
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
output = root / "evals/release/sdk-inventory"
output.mkdir(exist_ok=True)
archive = root / ".sandbox/solanaut-1/runtime-builds/26.7.0/solanaut-sdk-0.0.0.tgz"
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert sha(archive) == "55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d"
definition = {"revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(), "archiveSha256": sha(archive), "runnerSha256": sha(__file__), "node": subprocess.check_output(["node", "--version"], text=True).strip(), "npm": subprocess.check_output(["npm", "--version"], text=True).strip(), "scope": "npm CycloneDX consumer graph with exact private SDK; not package-centred R.1 clearance"}
(output / "definition.json").write_text(json.dumps(definition, indent=2) + "\n")
with tempfile.TemporaryDirectory(prefix="solanaut-sbom-") as directory:
    consumer = Path(directory)
    (consumer / "package.json").write_text('{"name":"solanaut-sbom-evaluation","version":"0.0.0","private":true,"type":"module"}\n')
    result = subprocess.run(["npm", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", str(archive)], cwd=consumer, capture_output=True, text=True, timeout=60)
    (output / "install.txt").write_text(result.stdout + result.stderr)
    assert result.returncode == 0
    core = consumer / "node_modules/@gubernaut/core"
    saved = consumer / "core-saved"
    shutil.move(core, saved)
    try:
        missing = subprocess.run(["npm", "sbom", "--sbom-format", "cyclonedx", "--omit", "dev"], cwd=consumer, capture_output=True, text=True, timeout=60)
        (output / "missing-dependency.txt").write_text(missing.stdout + missing.stderr)
        assert missing.returncode == 1 and "ESBOMPROBLEMS" in missing.stderr
    finally:
        shutil.move(saved, core)
    result = subprocess.run(["npm", "sbom", "--sbom-format", "cyclonedx", "--omit", "dev"], cwd=consumer, capture_output=True, text=True, timeout=60)
    (output / "consumer.cdx.json").write_text(result.stdout)
    (output / "stderr.txt").write_text(result.stderr)
    assert result.returncode == 0
    document = json.loads(result.stdout)
    assert document["bomFormat"] == "CycloneDX" and document["specVersion"] == "1.5"
    components = {item["name"]: item for item in document["components"]}
    assert len(document["components"]) == 2 and set(components) == {"@solanaut/sdk", "@gubernaut/core"}
    assert components["@solanaut/sdk"]["version"] == "0.0.0" and components["@gubernaut/core"]["version"] == "1.0.1"
    sdk, core = components["@solanaut/sdk"]["bom-ref"], components["@gubernaut/core"]["bom-ref"]
    edges = {item["ref"]: item["dependsOn"] for item in document["dependencies"]}
    assert len(edges) == 3 and edges[sdk] == [core] and edges[core] == []
    assert edges[document["metadata"]["component"]["bom-ref"]] == [sdk]
    sdk_hash = next(item["content"] for item in components["@solanaut/sdk"]["hashes"] if item["alg"] == "SHA-512")
    assert sdk_hash == hashlib.sha512(archive.read_bytes()).hexdigest()
    graph = subprocess.run(["npm", "ls", "--all", "--json", "--long"], cwd=consumer, capture_output=True, text=True, timeout=60)
    (output / "installed-graph.json").write_text(graph.stdout)
    assert graph.returncode == 0
assert sha(archive) == definition["archiveSha256"] and sha(__file__) == definition["runnerSha256"]
(output / "result.json").write_text(json.dumps({"generatorMissingDependencyExit": missing.returncode, "components": 2, "dependencyNodes": 3, "artifactHashMatched": True, "consumerRemoved": True, "licenseClearance": False, "releaseClearance": False, "sbomSha256": sha(output / "consumer.cdx.json")}, indent=2) + "\n")
print("current SDK consumer inventory retained; missing dependency refused before control")
