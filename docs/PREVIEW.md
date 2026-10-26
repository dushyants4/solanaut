# Run the compiled SDK offline

> **Draft 2** · 2026-10-27 · owner: integrator · for: developers evaluating the compiled SDK in a project of their own.
> Register: `kb/DOCUMENTS.md`. This is a private build from a checkout, not a public download, a stable release or a
> supported signer installation.

In ten minutes you will build the SDK's compiled package from this repository, install it in an empty project outside
the repository, and run a guarded payment, a refused payee and a replay, with no wallet and no key. Only the build
and the install use the network, to fetch dependencies from npm.

## Before starting

- **Node.js** 22.18.0, 24 or 26.7.0 (the pinned development runtime, [TOOLCHAIN](../TOOLCHAIN.md)). CI tests the
  package on all three.
- **A Linux terminal with npm.** This walkthrough does not install or qualify the dedicated-user signer, a reference
  deployment or a service manager.
- **Nothing else.** No wallet, private key, funding, signature, Solana CLI configuration or OS user is needed. The
  example makes no RPC call and sends no transaction. Its addresses and blockhash are synthetic public bytes, which it
  cannot sign; they are not credentials.

## 1. Build the package

From the root of a checkout:

```bash
npm ci
npm run release:prepare
npm pack ./.sandbox/releases/sdk --ignore-scripts --pack-destination .sandbox/releases
```

`release:prepare` compiles the SDK and its commands to JavaScript and declarations in `.sandbox/releases/sdk`, and
replaces only that folder. `npm pack` turns it into `.sandbox/releases/solanaut-sdk-0.0.0.tgz`. The version stays
`0.0.0` and the manifest `private: true`. [PACKAGING](PACKAGING.md) describes the build.

## 2. Install it outside the repository

An empty project outside the repository makes sure the repository's own dependencies cannot hide one the package
forgot. Run this in the same shell, from the repository root:

```bash
repo="$PWD"
consumer="$(mktemp -d /tmp/solanaut-preview.XXXXXX)"
cd "$consumer"
echo '{"name":"solanaut-preview","private":true,"type":"module"}' > package.json
npm install --ignore-scripts --omit=dev --no-audit --no-fund "$repo/.sandbox/releases/solanaut-sdk-0.0.0.tgz"
cp "$repo/examples/offline-preview.mjs" .
node offline-preview.mjs
```

Installation fetches the one pinned runtime dependency, `@gubernaut/core` 1.0.1, from npm; running the example is
offline. To install offline as well, prepare the npm cache as [PACKAGING](PACKAGING.md) describes, then add `--offline`
to `npm install`; a missing cache entry is then an installation error. Everything installs into this project, with
installation scripts disabled: nothing is global, and no loader flag is needed.

## 3. Check the result

The example prints one line of JSON:

```json
{"payment":"allowed","unlistedDestination":"destination-not-allowed","reusedReceipt":false,"replay":"matched","sent":false}
```

It proposes a payment to the one allowed address, which is admitted: `allowed` is an admission, not a signature or a
send. It redeems the receipt once, and a second redemption of the same receipt is refused. It records a synthetic
`unknown` outcome, proposes a payment to an unlisted address, which is refused, and recomputes the whole in-memory
history with `replay`. It throws if any expected check fails, and closes the guard before printing.

## Where the policy and the state live

The policy is the `policy` object in the copied file. It permits only the System Program and the synthetic treasury,
denies opaque programs and lists no token mints. Its amounts, times and heights are fixture values, not recommended
limits or network readings.

No `log` is passed to `createGuard`, so the record lives in memory and is lost on exit. `replay` checks this run's
entries; it does not reopen history on disk or prove a backup can be recovered. Read [STORAGE](STORAGE.md) before
giving the guard a persistent record, and never reuse this in-memory setup for an established identity.

SDK mode trusts its caller's clock, block heights and outcome reports, and a caller that holds its own key can bypass
the SDK. The policy must stay out of the agent's control; signed policy history does not establish process isolation
(claims S2 and S15). The example's operator address has no signing key, and this walkthrough performs no latch release
or policy-signing ceremony.

## If something goes wrong

| Symptom | Action |
|---|---|
| `npm run release:prepare` fails | Run `npm ci` first, on a supported Node; the build uses the repository's pinned TypeScript. |
| npm cannot resolve `@gubernaut/core` offline | Prepare the cache as [PACKAGING](PACKAGING.md) describes, or allow a normal install. Keep the project outside the repository either way. |
| Node cannot resolve `@solanaut/sdk` | Run the copied example inside the consumer project. Running the repository's copy uses the workspace instead of the installed package. |
| Startup reports an invalid policy or mismatched controller bytes | Check the package and the unchanged example. Never disable policy validation or controller verification. |
| The example throws, or its JSON differs | Keep the error and the tarball. Inspect the named denial, receipt or replay failure; partial output is not success. |

## Next

For a real guarded wallet, read the [SDK guide](SDK.md), the [policy guide](POLICIES.md) and the
[Solana Agent Kit evidence](../evals/agentkit/sak-devnet.md), a scripted local and devnet integration whose
plugin double-signing limit is part of claim S10. A signing adapter is not the sending client: choose the contract
before connecting a wallet. This walkthrough stops before any wallet, funded devnet run or signature.

## Evidence

The [installed-package battery](../evals/packaging/packed-sdk.md) (claim S14) installs a compiled tarball outside the
repository the same way. The [first preview receipt](../evals/release/staged-preview.md) (S82) and the
[client follow-up](../evals/sdk/sending-client-input.md) (S83) keep the reviewed candidates' identities; their digests
are in [the candidate manifest](../evals/release/staged-preview/client-candidate.json). A tarball built from a later
commit differs from those, as it should.

Public distribution, the licence, notices and history review, and release qualification are still pending. The
[staged release draft](release/STAGED-RELEASE.md) keeps the stable 1.0 gates and the human's publication decisions;
nothing in this walkthrough clears them or supplies an installed, isolated service.
