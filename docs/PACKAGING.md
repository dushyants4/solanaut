# PACKAGING.md — private SDK candidate

> **Draft 10** · 2026-10-07 · owner: integrator · for: developers and release reviewers.
> This is release preparation, not a stable release. Register: `kb/DOCUMENTS.md`.

Compiled internal prefix/state components have installed-tarball evidence
(`evals/packaging/checkpoint-payloads.md`). These files remain internal; this is
not a supported recovery workflow.

Bundle assembly is also internal. Its installed check exercises consistent payload
bytes and both descriptor signing domains; it does not publish or restore a checkpoint.

The current export and error reference is [SDK](SDK.md); it separates trusted in-process
APIs from the distinct sending client and describes incomplete operational contracts.
The candidate now includes `createSendingClient` and its typed errors (`docs/CLIENT.md`).
It also includes `verifyArchive` and typed structural-verification errors (`docs/STORAGE.md`).
The compiled `solanaut-verify-archive` executable checks pinned archives without a loader;
installed tests exercise success, wrong-pin refusal and usage (`evals/sdk/archive-cli.md`).
It also accepts a paired `--anchor-seq`/`--anchor-head` external pin, and the SDK declarations
include `expectedAnchor` and its bound receipt (`evals/sdk/archive-anchor.md`). This does not
authenticate the source of that pin or qualify deployed anchoring or restored guard state.
Installed consumer checks exercise its JavaScript and declarations without loader flags;
this does not qualify an installed signer service.
The compiled `solanaut-prepare-policy` command validates a public policy and returns the
existing canonical text for operator signing ([POLICY](POLICY.md)). It does not sign,
install a policy or inspect the current version; its installed component is tested separately.

The candidate adds checkpoint/prefix binding authentication ([SDK](SDK.md)). Its regenerated
JavaScript/declaration component and compiled export-damage checks pass
(`evals/sdk/checkpoint.md`). This does not supply an installed checkpoint restoration service.

From the repository root, using the pinned development toolchain:

```bash
npm ci
npm run release:prepare
npm cache add @gubernaut/core@1.0.1
npm run test:package
npm run test:package:faults
```

The candidate is staged in `.sandbox/releases/sdk`. The preparation command replaces only
that generated folder. It compiles the SDK and its replay/table-pin commands into JavaScript
and declarations; relative runtime imports refer to JavaScript. Source development and
workspace exports still use native TypeScript.

The generated manifest keeps the source version and `private: true`. It exports the same SDK
entry point, includes only compiled files, and declares the existing pinned Keel dependency.
No licence or publication approval is implied. Runtime floor: Node 22.18.0; the approved CI
matrix also exercises Node 24 and the pinned Node 26 development runtime.

To inspect a tarball locally:

```bash
npm pack ./.sandbox/releases/sdk --ignore-scripts --pack-destination .sandbox/releases
```

Install that tarball by its absolute path in a separate ESM project. Import `createGuard` from
`@solanaut/sdk`; no TypeScript loader is required. The installed commands are
`solanaut-replay <record.jsonl> <policy.json>` and
`solanaut-pin-table --url <rpc-url> <table-address>`. The table command requires an explicit
RPC URL. Replay exits successfully only when the supplied history reproduces under the policy.
Both commands return usage errors when required arguments are absent.

The package battery installs offline into a temporary directory outside the repository,
without installation scripts or development dependencies. The explicit cache command supplies
both pinned runtime tarball and package metadata; `npm ci` alone does not guarantee metadata
for an offline consumer on a clean machine. See `evals/packaging/packed-sdk.md` and claim S14
for the measured scope.

This candidate covers the current trusted SDK mode and the socket-client contract. The isolated signer, MCP firewall,
operator lifecycle, licence, notices, provenance, audit and publication gates remain outstanding.
