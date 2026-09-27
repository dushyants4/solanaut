# REGISTRY.md — what Solanaut depends on, pinned

Upstream code Solanaut consumes rather than writes. Exact versions; `package-lock.json` holds the
full tree.

| Package | Pin | Source | Why | Checked |
|---|---|---|---|---|
| `@gubernaut/core` | **1.0.1** | npm | Gubernaut Keel, the controller in-process. Apache-2.0, pre-existing, disclosed under the hackathon rules §9. Its wasm digest `834015d7…` is checked when a guard is created | 2026-09-27 |
| `@solana/web3.js` | **1.99.0** | npm | transactions, keys, RPC. The 1.x line, because the agent frameworks Solanaut adapts to (ElizaOS, Solana AgentKit) build on it; `@solana/kit` (8.3.0) is the modern one, revisited in H2 | 2026-09-27 |
| `typescript` | **7.0.2** | npm | typecheck only; Node runs the sources directly | 2026-09-27 |
| `@types/node` | **26.6.3** | npm | Node 26 types | 2026-09-27 |

Toolchain: `TOOLCHAIN.md`. Vendored office: `plugins/VENDORED.md`.

## Install scripts

`npm install` reports three optional native modules whose install scripts npm 11 did not run
(`bufferutil`, `utf-8-validate`, both optional speed-ups for the WebSocket library under
web3.js). They are not needed: the sandbox ran against a local validator without them.

## Findings about upstream

None yet. A defect found in a Gubernaut package is written here and in the run record for the
human; Solanaut never patches upstream code.
