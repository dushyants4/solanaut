# PACKAGING.md — private SDK candidate

> **Draft 1** · 2026-10-05 · owner: integrator · for: developers and release reviewers.
> This is release preparation, not a stable release. Register: `kb/DOCUMENTS.md`.

From the repository root, using the pinned development toolchain:

```bash
npm ci
npm run release:prepare
npm run test:package
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
without installation scripts or development dependencies. `npm ci` must first populate the
npm cache. See `evals/packaging/packed-sdk.md` and claim S14 for the measured scope.

This candidate covers the current trusted SDK mode. The isolated signer, MCP firewall,
operator lifecycle, licence, notices, provenance, audit and publication gates remain outstanding.
