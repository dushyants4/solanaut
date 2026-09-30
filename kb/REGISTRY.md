# REGISTRY.md — what Solanaut depends on, pinned

Upstream code Solanaut consumes rather than writes. Exact versions; `package-lock.json` holds the
full tree.

| Package | Pin | Source | Why | Checked |
|---|---|---|---|---|
| `@gubernaut/core` | **1.0.1** | npm | Gubernaut Keel, the controller in-process. Apache-2.0, pre-existing, disclosed under the hackathon rules §9. Its wasm digest `834015d7…` is checked when a guard is created | 2026-09-27 |
| `@solana/web3.js` | **1.99.0** | npm | transactions, keys, RPC. The 1.x line, because the agent frameworks Solanaut adapts to (ElizaOS, Solana AgentKit) build on it. `@solana/kit` (8.4.0 on 2026-09-30) is the modern line. The v1 core decodes bytes without web3.js, which stays in the adapters (ADR-009) | 2026-09-30 |
| `typescript` | **7.0.2** | npm | typecheck only; Node runs the sources directly | 2026-09-27 |
| `@types/node` | **26.6.3** | npm | Node 26 types | 2026-09-27 |

Toolchain: `TOOLCHAIN.md`. Vendored office: `plugins/VENDORED.md`.

## Install scripts

`npm install` reports three optional native modules whose install scripts npm 11 did not run
(`bufferutil`, `utf-8-validate`, both optional speed-ups for the WebSocket library under
web3.js). They are not needed: the sandbox ran against a local validator without them.

## What the agent frameworks build on

Checked on the npm registry on 2026-09-27 ([source](sources/2026-09-27_npm-agent-frameworks.md)) and again on
2026-09-30 ([source](sources/2026-09-30_npm-registry-versions.md)):
- Solana Agent Kit 2.0.10, ElizaOS's `plugin-solana` 1.2.6 and Anchor's TS client
  (`@anchor-lang/core` 1.2.0) all depend on `@solana/web3.js` 1.x.
- `@solana/kit` was at 8.3.0 on 2026-09-27 and 8.4.0 on 2026-09-30. Version 8 builds v1 transactions.

That confirms the 1.x pin above for H2. The guard decodes serialized bytes (ADR-005), so kit-built
transactions are covered too.

## Candidates, not yet dependencies

Read on npm on 2026-09-30 ([source](sources/2026-09-30_npm-registry-versions.md)). Each is pinned exactly when the
milestone that needs it adds it, and not before.

| Package | Version seen | For | Milestone |
|---|---|---|---|
| `@solana-program/system`, `token`, `token-2022`, `compute-budget` | 0.15.0, 0.17.0, 0.19.0, 0.19.0 | cross-checking the decoder in tests | 2a.2 |
| `fast-check` | 4.10.2 | property tests | 2a.2 |
| `@sqds/multisig` | 2.1.4 | the Squads spending limit on devnet | 2a.9 |
| `litesvm` | 1.5.0 | in-process integration tests | 3.9 |
| `@stryker-mutator/core` | 10.0.0 | mutation testing | 3.9 |
| `mitata` | 1.0.34 | benchmarks | 3.9 |
| `@phantom/mcp-server` | 1.2.8 | the MCP firewall's upstream | 3.5 |

Surfpool is not on npm; it installs as a binary, and version 1.5 or later runs v1 transactions.

## Findings about upstream

A defect found in a Gubernaut package is written here and in the run record for the human. Solanaut
never patches upstream code. It guards against the defect on its own side, and records that here.

| ID | Package | Finding | Checked | Solanaut's side |
|---|---|---|---|---|
| U-1 | `@gubernaut/core` 1.0.1 | The README says the controller's digest "is verified at build time by the embed script… and again on load". The shipped `dist/index.js` sets `var wasmDigest = WASM_SHA256;` (a constant), and loading checks only the decoded length (17,082 bytes). Nothing hashes the bytes on load | **first-hand**, 2026-09-27 ([source](sources/2026-09-27_npm-gubernaut-core.md)) | `docs/CLAIMS.md` S4 narrowed; H1 hashes the embedded bytes (`docs/SPEC.md` D4) |
| U-2 | `@gubernaut/core` 1.0.1 | `tick()` accepts `null`, `"0.5"`, `true` and `[0.7]` (JavaScript coerces them to numbers) while `Governor.accepts()` rejects each | reported by a research agent; **to reproduce** in H1's first eval | validate before ticking (`docs/SPEC.md` D3) |
| U-3 | `@gubernaut/core` 1.0.1 | `Governor.create(state)` accepts NaN and out-of-range state, and carries it forward | reported by a research agent; to reproduce | Solanaut never restores a state it did not write and verify |
| U-4 | `@gubernaut/core` 1.0.1 | The npm description says the package "hard-stops runaway loops"; the README says it decides and "does not intercept". The unpublished 1.0.2 fixes the wording | via the npm record and the repository's `PUBLISH_1.0.2.md` | Solanaut quotes the README, never the description |
