# Run the private SDK preview offline

2026-10-08 · integrator draft · for developers evaluating the compiled SDK
candidate. This guide is a concrete private consumption path, not a public
download, stable release or supported signer installation.

The [installed-package evidence](../evals/packaging/packed-sdk.md), claim S14,
covers a compiled SDK tarball outside the repository. This example uses that
kind of artefact through documented exports. Its output below is an expected
result to check, not a new qualification measurement.
The [first preview receipt](../evals/release/staged-preview.md), S82, and
[client follow-up receipt](../evals/sdk/sending-client-input.md), S83, retain
the original artefact and the current corrected candidate separately.

## Before starting

- Use Node 22.18.0, Node 24 or the pinned Node 26.7.0 development runtime. These
  are the approved candidate matrix, not a claim that current release CI is green.
- Use a local Linux terminal with npm. This walkthrough does not install or
  qualify the dedicated-user signer, reference deployment or service manager.
- Obtain the reviewed private artefact at
  `/home/dashy/Projects/Solanaut/.sandbox/solanaut-1/staged-preview-client/solanaut-sdk-0.0.0.tgz`
  and its companion example at
  `/home/dashy/Projects/Solanaut/examples/offline-preview.mjs`.
  The artefact must exist before the installation commands; it is not fetched
  from a public Solanaut registry package. Candidate version and `private: true`
  remain unchanged.

No wallet, private key, funding, signature, Solana CLI configuration or OS-user
creation is needed. The example makes no RPC call and sends no transaction.
The addresses and blockhash are synthetic public bytes; the script cannot sign
them and they are not credentials.

## Verify the private candidate

Before installation, compare both file digests with the retained
[candidate manifest](../evals/release/staged-preview/client-candidate.json):

```bash
sha256sum "/home/dashy/Projects/Solanaut/.sandbox/solanaut-1/staged-preview-client/solanaut-sdk-0.0.0.tgz" "/home/dashy/Projects/Solanaut/examples/offline-preview.mjs"
```

The tarball must match the manifest's `sha256`; the example must match
`sourceHashes["examples/offline-preview.mjs"]`. A mismatch stops this walkthrough:
obtain the reviewed files rather than installing a substitute. These hashes
identify the private files from the commit containing that manifest, following
`39c24de` and the client input correction. They are not public
provenance, an audit or publication clearance.

## Install outside the repository

Create a temporary consumer so the repository's dependencies cannot hide a
missing package dependency. Run the following in the same shell:

```bash
preview_consumer_dir="$(mktemp -d /tmp/solanaut-preview.XXXXXX)"
cd "$preview_consumer_dir"
cat > package.json <<'JSON'
{"name":"solanaut-private-preview","private":true,"type":"module"}
JSON
npm install --ignore-scripts --omit=dev --no-audit --no-fund "/home/dashy/Projects/Solanaut/.sandbox/solanaut-1/staged-preview-client/solanaut-sdk-0.0.0.tgz"
cp "/home/dashy/Projects/Solanaut/examples/offline-preview.mjs" "$preview_consumer_dir/offline-preview.mjs"
node "$preview_consumer_dir/offline-preview.mjs"
```

Installation may fetch the pinned runtime dependency from npm. Execution of the
example is offline. If installation must also be offline, prepare the pinned
runtime tarball and npm metadata cache described in [PACKAGING](PACKAGING.md),
then add `--offline` to the installation command. A missing cache entry is an
installation error; do not resolve it through an ancestor workspace dependency.
All packages are installed into this consumer, with installation scripts
disabled. There is no global npm installation or undocumented loader flag.

Expected single JSON line:

```json
{"payment":"allowed","unlistedDestination":"destination-not-allowed","reusedReceipt":false,"replay":"matched","sent":false}
```

`allowed` is an admission, not a signature or send. The first receipt redemption
succeeds; a second redemption of the same receipt is refused. The script then
records a synthetic `unknown` outcome, proposes an unlisted destination and
recomputes the in-memory history through replay. It throws if an expected check
fails, and closes the guard before printing success.

## Where policy and state live

The example policy is the `policy` object in the copied JavaScript file. It
permits only the System Program and the synthetic treasury, denies opaque
programs and has no listed token mints. Its amounts, times and heights are
fixture configuration, not recommended spending presets or network readings.

No `log` is supplied to `createGuard`, so the record is ephemeral in-process
state. Exiting loses it. `replay` checks the entries from this run; it does not
reopen disk history or prove installed backup recovery. For persistent SDK
records and ownership, read [STORAGE](STORAGE.md) before changing the example.
Do not reuse this ephemeral setup for an established identity.

SDK mode trusts its caller's clock, block heights and outcome reports. A caller
with its own key can bypass the SDK. The original policy configuration must
remain outside agent control; signed policy-history tests do not establish
process isolation (claims S2 and S15). The example's synthetic operator address
has no corresponding signing material, and this guide performs no latch release
or policy-signing ceremony.

## Errors and next integration

| Symptom | Action |
|---|---|
| The tarball or example is missing | Obtain the exact reviewed candidate and companion example. Do not substitute the native TypeScript workspace package. |
| npm cannot resolve its pinned dependency offline | Prepare the documented cache or permit normal dependency installation; keep the consumer outside the repository. |
| Node cannot resolve `@solanaut/sdk` | Verify installation in the consumer and run its copied example. Running the repository's example directly uses a different module-resolution location. |
| Startup reports invalid policy or mismatched controller bytes | Inspect the candidate and unchanged fixture. Do not disable policy validation or controller verification. |
| The example throws or its JSON differs | Preserve the error and artefact identity. Inspect the named denial, receipt or replay failure; do not treat a partial output as success. |

For an actual guarded wallet, continue with the [SDK reference](SDK.md),
[policy guide](POLICIES.md) and the scoped
[Solana Agent Kit evidence](../evals/agentkit/sak-devnet.md). The latter is a
scripted local/devnet integration; its plugin double-signing limitation remains
part of claim S10. A signing adapter is distinct from the sending client; connect
a wallet only after choosing and understanding that contract. This guide stops
before any wallet, funded devnet run or signature.

The candidate's public distribution, licence/notices/history review and exact
release qualification remain pending. The [staged release draft](release/STAGED-RELEASE.md)
preserves the stable 1.0 gates and the human's publication decisions. Nothing in
this walkthrough clears them or supplies an installed isolated service.
