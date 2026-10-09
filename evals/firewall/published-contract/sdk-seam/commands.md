# Regenerate the low-level SDK signing observation

Run from Solanaut root. Query metadata and inspect exact archive bytes, without
installing or executing third-party modules. Keep fresh outputs separate from
retained evidence. The CLI archive comes from the preceding current-pair commands.

```sh
mkdir -p .sandbox/solanaut-1/phantom-contract
npm view @phantom/client@2.0.4 version dist repository dependencies engines --json
npm view @phantom/browser-sdk@2.0.4 version dist repository dependencies engines --json
npm view @phantom/embedded-provider-core@2.0.4 version dist repository dependencies engines --json
curl --fail --silent --show-error https://registry.npmjs.org/@phantom/client/-/client-2.0.4.tgz -o .sandbox/solanaut-1/phantom-contract/client-2.0.4.tgz
curl --fail --silent --show-error https://registry.npmjs.org/@phantom/browser-sdk/-/browser-sdk-2.0.4.tgz -o .sandbox/solanaut-1/phantom-contract/browser-sdk-2.0.4.tgz
curl --fail --silent --show-error https://registry.npmjs.org/@phantom/embedded-provider-core/-/embedded-provider-core-2.0.4.tgz -o .sandbox/solanaut-1/phantom-contract/embedded-provider-core-2.0.4.tgz
```

Verify registry integrity, retained hashes and numbered short excerpts:

```sh
python - <<'PY'
import base64, hashlib, json, pathlib, tarfile
root = pathlib.Path('.sandbox/solanaut-1/phantom-contract')
evidence = pathlib.Path('evals/firewall/published-contract/sdk-seam')
report = json.loads((evidence / 'observations.json').read_text())
for package in report['packages']:
    archive = package['archive_url'].rsplit('/', 1)[1]
    data = (root / archive).read_bytes()
    metadata = json.loads((evidence / (archive[:-4] + '-metadata.json')).read_text())
    dist = metadata['dist']
    assert 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode() == dist['integrity']
    assert hashlib.sha1(data).hexdigest() == dist['shasum']
    assert hashlib.sha256(data).hexdigest() == package['archive_sha256']
    print(archive, 'registry integrity and retained download hash agree')
for item in report['sources']:
    with tarfile.open(root / item['archive'], 'r:gz') as source:
        data = source.extractfile(item['path']).read()
    assert hashlib.sha256(data).hexdigest() == item['sha256']
    lines = data.decode().splitlines()
    for excerpt in item['selected_excerpts']:
        assert lines[excerpt['line'] - 1].strip() == excerpt['excerpt']
    print(item['path'], 'source hash and numbered excerpts agree')
PY
```

Inspect declared types, shared preparation/signing, callback timing, and the
embedded provider's sign-only delegation:

```sh
tar -xOzf .sandbox/solanaut-1/phantom-contract/client-2.0.4.tgz package/dist/index.d.ts
tar -xOzf .sandbox/solanaut-1/phantom-contract/client-2.0.4.tgz package/dist/index.mjs
tar -xOzf .sandbox/solanaut-1/phantom-contract/embedded-provider-core-2.0.4.tgz package/dist/index.mjs
tar -xOzf .sandbox/solanaut-1/phantom-contract/cli-3.0.0.tgz package/src/session/manager.ts
```

The current official support statement is mutable and separate from archive code.
A changed fresh hash records a changed page, not a changed pinned implementation.

```sh
curl --fail --silent --show-error https://docs.phantom.com/sdks/browser-sdk/sign-and-send-transaction.md -o .sandbox/solanaut-1/phantom-contract/browser-signing-current.md
sha256sum .sandbox/solanaut-1/phantom-contract/browser-signing-current.md
rg -n 'Embedded wallet limitations|presignTransaction|before the wallet signs|only supported approach' .sandbox/solanaut-1/phantom-contract/browser-signing-current.md
```
