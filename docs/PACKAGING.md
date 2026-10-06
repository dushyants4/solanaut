# PACKAGING.md — private SDK candidate

> **Draft 2** · 2026-10-06 · owner: integrator · for: developers and release reviewers.
> This is release preparation, not a stable release. Register: `kb/DOCUMENTS.md`.

The candidate now includes `createSendingClient` and its typed errors (`docs/CLIENT.md`).
Installed consumer checks exercise its JavaScript and declarations without loader flags;
this does not qualify an installed signer service.

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
