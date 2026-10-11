import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("inventory", Path(__file__).with_name("package-inventory.py"))
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)
manifest = {"name": "@solanaut/sdk", "version": "0.0.0", "private": True,
            "dependencies": {"@gubernaut/core": "1.0.1"}}
archive = b"synthetic archive, not a production package"
raw = {"bomFormat": "CycloneDX", "specVersion": "1.5", "metadata": {"component": {
    "name": "package", "version": "0.0.0", "bom-ref": "@solanaut/sdk@0.0.0",
    "purl": "pkg:npm/%40solanaut/sdk@0.0.0"}},
    "components": [{"name": "@gubernaut/core", "version": "1.0.1",
                    "bom-ref": "@gubernaut/core@1.0.1"}],
    "dependencies": [{"ref": "@solanaut/sdk@0.0.0", "dependsOn": ["@gubernaut/core@1.0.1"]},
                     {"ref": "@gubernaut/core@1.0.1", "dependsOn": []}]}


class InventoryTests(unittest.TestCase):
    def test_INV_1_projection_binds_manifest_without_mutating_raw(self):
        prior = copy.deepcopy(raw)
        result = inventory.project(raw, manifest, archive)
        self.assertEqual(result["metadata"]["component"]["name"], "sdk")
        self.assertEqual(result["metadata"]["component"]["group"], "@solanaut")
        self.assertEqual(raw, prior)
        inventory.validate(result, manifest, archive)

    def test_INV_1_raw_directory_name_is_not_package_identity(self):
        result = inventory.project(raw, manifest, archive)
        result["metadata"]["component"]["name"] = "package"
        del result["metadata"]["component"]["group"]
        with self.assertRaisesRegex(ValueError, "root identity"):
            inventory.validate(result, manifest, archive)

    def test_INV_2_wrong_archive_hash_refuses(self):
        result = inventory.project(raw, manifest, archive)
        result["metadata"]["component"]["hashes"] = [{"alg": "SHA-256", "content": "0" * 64}]
        with self.assertRaisesRegex(ValueError, "archive hash"):
            inventory.validate(result, manifest, archive)

    def test_INV_3_missing_edge_refuses(self):
        result = inventory.project(raw, manifest, archive)
        result["dependencies"][0]["dependsOn"] = []
        with self.assertRaisesRegex(ValueError, "dependency graph"):
            inventory.validate(result, manifest, archive)

    def test_INV_3_wrong_runtime_version_refuses(self):
        result = inventory.project(raw, manifest, archive)
        result["components"][0]["version"] = "1.0.0"
        with self.assertRaisesRegex(ValueError, "runtime component"):
            inventory.validate(result, manifest, archive)

    def test_INV_3_unexpected_component_refuses(self):
        result = inventory.project(raw, manifest, archive)
        result["components"].append(copy.deepcopy(result["components"][0]))
        with self.assertRaisesRegex(ValueError, "runtime component"):
            inventory.validate(result, manifest, archive)


if __name__ == "__main__":
    unittest.main()
