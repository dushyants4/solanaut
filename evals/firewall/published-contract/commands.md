# Regenerate the published-contract observations

Run from the Solanaut root with npm, curl, tar, Python and sha256sum. These commands
query public package metadata and inspect archive bytes; they install or execute
no third-party package. Save fresh observations separately from the retained ones.

```sh
mkdir -p .sandbox/solanaut-1/phantom-contract
npm view @phantom/mcp-server@1.2.8 version dist repository dependencies engines --json
npm view @phantom/cli@2.0.1 version dist repository dependencies engines --json
npm view @phantom/mcp-server version dist repository dependencies --json
curl --fail --silent --show-error https://registry.npmjs.org/@phantom/mcp-server/-/mcp-server-1.2.8.tgz -o .sandbox/solanaut-1/phantom-contract/mcp-server-1.2.8.tgz
curl --fail --silent --show-error https://registry.npmjs.org/@phantom/cli/-/cli-2.0.1.tgz -o .sandbox/solanaut-1/phantom-contract/cli-2.0.1.tgz
sha256sum .sandbox/solanaut-1/phantom-contract/mcp-server-1.2.8.tgz .sandbox/solanaut-1/phantom-contract/cli-2.0.1.tgz
```

Compare SHA-512 integrity and SHA-1 against the retained exact-version registry
metadata. This deliberately does not claim registry signature verification.

```sh
python - <<'PY'
import base64, hashlib, json, pathlib
root = pathlib.Path('.sandbox/solanaut-1/phantom-contract')
evidence = pathlib.Path('evals/firewall/published-contract')
for archive, metadata in [('mcp-server-1.2.8.tgz', 'mcp-1.2.8-metadata.json'), ('cli-2.0.1.tgz', 'cli-2.0.1-metadata.json')]:
    data = (root / archive).read_bytes()
    dist = json.loads((evidence / metadata).read_text())['dist']
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()
    assert integrity == dist['integrity']
    assert hashlib.sha1(data).hexdigest() == dist['shasum']
    print(archive, hashlib.sha256(data).hexdigest(), 'registry integrity matches')
PY
```

Read these exact archive members without extracting or importing modules. Compare
their SHA-256 and numbered schema/route lines with `observations.json`.

```sh
tar -xOzf .sandbox/solanaut-1/phantom-contract/mcp-server-1.2.8.tgz package/src/index.ts
tar -xOzf .sandbox/solanaut-1/phantom-contract/cli-2.0.1.tgz package/src/actions/send-solana-transaction.ts
tar -xOzf .sandbox/solanaut-1/phantom-contract/cli-2.0.1.tgz package/src/actions/transfer-tokens.ts
python - <<'PY'
import hashlib, pathlib, tarfile
root = pathlib.Path('.sandbox/solanaut-1/phantom-contract')
for archive, member in [('mcp-server-1.2.8.tgz', 'package/src/index.ts'), ('cli-2.0.1.tgz', 'package/src/actions/send-solana-transaction.ts'), ('cli-2.0.1.tgz', 'package/src/actions/transfer-tokens.ts')]:
    with tarfile.open(root / archive, 'r:gz') as source:
        data = source.extractfile(member).read()
    print(member, hashlib.sha256(data).hexdigest())
    for number, line in enumerate(data.decode().splitlines(), 1):
        if any(text in line for text in ['SendSolanaTransactionSchema', 'TransferTokensSchema', 'signAndSendTransaction({', 'rawTransaction: result.rawTransaction,', 'signature: result.hash ?? null,']):
            print(number, line.strip())
PY
```

Current documentation is separate and mutable. A different fresh hash means the
page changed; it does not change the retained package observation.

```sh
curl --fail --silent --show-error https://docs.phantom.com/phantom-mcp-server/tools.md -o .sandbox/solanaut-1/phantom-contract/tools-current.md
sha256sum .sandbox/solanaut-1/phantom-contract/tools-current.md
rg -n 'rpcUrl|walletId|derivationIndex|confirmed|amountUnit|createAssociatedTokenAccount' .sandbox/solanaut-1/phantom-contract/tools-current.md
```
