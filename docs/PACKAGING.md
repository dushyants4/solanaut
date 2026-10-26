# PACKAGING.md — private SDK candidate

> **Draft 21** · 2026-10-27 · owner: integrator · for: developers and release reviewers.
> This is release preparation, not a stable release. Register: `kb/DOCUMENTS.md`.

Development uses the SDK's TypeScript source directly. A release needs JavaScript and declarations that run without a
loader, so this build compiles them into a private npm candidate, then installs it outside the repository and tests it
there. To use the result in a project of your own, follow [PREVIEW](PREVIEW.md).

## Build and test it

From the repository root, using the pinned development toolchain:

```bash
npm ci
npm run release:prepare
npm cache add @gubernaut/core@1.0.1
npm run test:package
npm run test:package:faults
```

The candidate is staged in `.sandbox/releases/sdk`. The preparation command replaces only that generated folder. It
compiles the SDK and its commands into JavaScript and declarations; relative runtime imports refer to JavaScript.
Source development and workspace exports still use native TypeScript.

The generated manifest keeps the source version and `private: true`. It exports the same SDK entry point, includes only
compiled files, and declares the pinned Keel dependency. No licence or publication approval is implied. The runtime
floor is Node 22.18.0; CI also runs the package battery on Node 24 and the pinned Node 26.7.0.

To inspect a tarball locally:

```bash
npm pack ./.sandbox/releases/sdk --ignore-scripts --pack-destination .sandbox/releases
```

Install that tarball by its absolute path in a separate ESM project, and import `createGuard` from `@solanaut/sdk`; no
TypeScript loader is required.

## The installed commands

| Command | What it does |
|---|---|
| `solanaut-replay <record.jsonl> <policy.json\|-> [public-trust.json]` | Exits successfully only when the history reproduces under the policy. For signed history, pass `-` in place of the policy and an independently pinned public trust file ([POLICIES](POLICIES.md)); no key material belongs in it, and an untrusted history cannot supply its own pin. |
| `solanaut-pin-table --url <rpc-url> <table-address>` | Prints a lookup table's pin for the policy; it requires an explicit RPC URL. |
| `solanaut-verify-archive <archive.jsonl> [verification flags]` | Checks a pinned archive's structure, read-only, with an optional paired `--anchor-seq` and `--anchor-head` external pin ([STORAGE](STORAGE.md)). It does not authenticate that pin's source or qualify deployed anchoring. |
| `solanaut-prepare-policy <policy.json> --version <positive integer> --issued <UTC ISO timestamp>` | Validates a public policy and prints the canonical text an operator signs ([POLICY](POLICY.md)). It does not sign, install a policy or inspect the current version. |

Incorrect arguments return usage errors. Installed tests run `solanaut-verify-archive` and `solanaut-prepare-policy`
without a loader, through success, refusal and usage (`evals/sdk/archive-cli.md`, `evals/sdk/archive-anchor.md`,
`evals/sdk/prepare-policy.md`).

## What the package battery checks

The battery installs offline into a temporary directory outside the repository, without installation scripts or
development dependencies. The explicit cache command supplies both the pinned runtime tarball and its package
metadata; `npm ci` alone does not guarantee that metadata for an offline consumer on a clean machine. See
`evals/packaging/packed-sdk.md` and claim S14 for the measured scope. CI runs the battery on every push, and the 144
installed-package faults in four shards (`evals/ci/green.md`, S163).

The candidate includes the trusted SDK, the socket client and its typed errors ([CLIENT](CLIENT.md)), `verifyArchive`
and its typed errors, and checkpoint and prefix binding authentication ([SDK](SDK.md)). The current export and error
reference is [SDK](SDK.md); it separates trusted in-process APIs from the distinct sending client and describes the
operational contracts still incomplete.

The external consumer also exercises compiled internal components. Their module paths are not stable exports, and
none is a supported recovery workflow or an installed signer service:

| Component | Installed checks | Evidence |
|---|---|---|
| The request index | exact historical replies, forged roots, altered bytes, and omission or rechecksum attacks; also D22 and D23's impossible report and redemption replay and restore | `evals/sdk/request-index.md` |
| Record-only loading | append and reopen, and typed capability refusal while evaluation imports are blocked | `evals/sdk/record-loading.md` |
| Streamed recomputation | actual pinned archive bytes, captured policy authority and changed second reads | `evals/sdk/replay-stream.md` |
| Checkpoint prefix and state | the compiled components | `evals/packaging/checkpoint-payloads.md` |
| Checkpoint bundle and envelope | consistent payload bytes and both descriptor signing domains; altered state, framing and reader byte bounds refused | `evals/packaging/checkpoint-payloads.md` |
| Checkpoint bindings | the regenerated JavaScript and declarations, and compiled export damage | `evals/sdk/checkpoint.md` |
| Owned checkpoint publication | real retained archive files and kernel file ownership; replacement and predecessor bytes; a copied store's ownership claim rejected | `evals/sdk/checkpoint-publication.md` |
| Prefix rebuilding | next decisions compared with a fresh full-stream Keel controller; altered prefix bytes refused | `evals/sdk/checkpoint-rebuild.md` |
| Recovery preparation | a valid checkpoint, a verified fallback, correctly signed dishonest state and an anchor conflict | `evals/sdk/checkpoint-recovery.md` |
| Owned recovery | a kernel-held file store: derived unresolved state compared, a copied store capability rejected, corrupt checkpoint bytes kept during verified full replay | `evals/sdk/checkpoint-owned-recovery.md` |
| Archive streaming | immutable ordered entries, a naturally completed receipt, cancellation without a receipt, a conflicting digest refused | `evals/sdk/archive-stream.md` |

## What is outstanding

This candidate covers the trusted SDK mode and the socket-client contract. The isolated signer, the MCP firewall, the
operator lifecycle, the licence, notices, provenance, audit and publication gates are outstanding, as are installed
startup, backup, upgrade and bounded recovery. The staged release scope and the human's publication decisions are in
[release/STAGED-RELEASE.md](release/STAGED-RELEASE.md).
