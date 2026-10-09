# Regenerate exact MCP 1.2.9 / CLI 3.0.0 inspection

From the Solanaut root, query public metadata and download exact archives into
ignored scratch. These commands install or execute no third-party module.
Record fresh observations separately; do not overwrite retained evidence.

```sh
mkdir -p .sandbox/solanaut-1/phantom-contract
npm view @phantom/mcp-server@1.2.9 version dist repository dependencies engines --json
npm view @phantom/cli@3.0.0 version dist repository dependencies engines --json
curl --fail --silent --show-error https://registry.npmjs.org/@phantom/mcp-server/-/mcp-server-1.2.9.tgz -o .sandbox/solanaut-1/phantom-contract/mcp-server-1.2.9.tgz
curl --fail --silent --show-error https://registry.npmjs.org/@phantom/cli/-/cli-3.0.0.tgz -o .sandbox/solanaut-1/phantom-contract/cli-3.0.0.tgz
sha256sum .sandbox/solanaut-1/phantom-contract/mcp-server-1.2.9.tgz .sandbox/solanaut-1/phantom-contract/cli-3.0.0.tgz
```

Verify agreement with retained registry integrity, source hashes and numbered
short excerpts. These are consistency checks, not origin signature verification.

```sh
python - <<'PY'
import base64, hashlib, json, pathlib, tarfile
root = pathlib.Path('.sandbox/solanaut-1/phantom-contract')
evidence = pathlib.Path('evals/firewall/published-contract/current-pair')
report = json.loads((evidence / 'observations.json').read_text())
for archive, metadata in [('mcp-server-1.2.9.tgz', 'mcp-1.2.9-metadata.json'), ('cli-3.0.0.tgz', 'cli-3.0.0-metadata.json')]:
    data = (root / archive).read_bytes()
    dist = json.loads((evidence / metadata).read_text())['dist']
    assert 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode() == dist['integrity']
    assert hashlib.sha1(data).hexdigest() == dist['shasum']
    recorded = next(item for item in report['packages'] if item['archive_url'].endswith('/' + archive))
    assert hashlib.sha256(data).hexdigest() == recorded['archive_sha256']
    print(archive, 'recorded hashes and registry integrity agree')
for item in report['sources']:
    with tarfile.open(root / item['archive'], 'r:gz') as source:
        data = source.extractfile(item['path']).read()
    assert hashlib.sha256(data).hexdigest() == item['sha256']
    lines = data.decode().splitlines()
    for excerpt in item['selected_excerpts']:
        assert lines[excerpt['line'] - 1].strip() == excerpt['excerpt']
    print(item['path'], 'hash and selected numbered excerpts agree')
PY
```

Inspect complete action schemas and call/return ordering without extracting or
importing source. The older archive is downloaded by the preceding receipt's
commands, if absent.

```sh
tar -xOzf .sandbox/solanaut-1/phantom-contract/mcp-server-1.2.9.tgz package/src/index.ts
tar -xOzf .sandbox/solanaut-1/phantom-contract/cli-3.0.0.tgz package/src/actions/send-solana-transaction.ts
tar -xOzf .sandbox/solanaut-1/phantom-contract/cli-3.0.0.tgz package/src/actions/transfer-tokens.ts
tar -xOzf .sandbox/solanaut-1/phantom-contract/cli-3.0.0.tgz package/src/utils/actions.ts package/src/tools/types.ts
python - <<'PY'
import pathlib, tarfile
root = pathlib.Path('.sandbox/solanaut-1/phantom-contract')
def read(version, member):
    with tarfile.open(root / ('cli-' + version + '.tgz'), 'r:gz') as source:
        return source.extractfile(member).read().decode()
send = 'package/src/actions/send-solana-transaction.ts'
transfer = 'package/src/actions/transfer-tokens.ts'
assert read('3.0.0', send) == read('2.0.1', send)
marker = '// ─── Solana path'
assert read('3.0.0', transfer).split(marker, 1)[1] == read('2.0.1', transfer).split(marker, 1)[1]
compiled = read('3.0.0', 'package/dist/index.js')
assert 'client.signAndSendTransaction({' in compiled
assert 'rawTransaction: result.rawTransaction' in compiled
print('Send source and Solana transfer subsection agree with inspected older source; compiled route patterns present')
PY
```
