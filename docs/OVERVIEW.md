# OVERVIEW.md — the codebase, as it is

> **Draft 3** · 2026-10-01 · owner: integrator · for: engineers new to this repository, and judges
> reading the code · describes the tree **as it is today**, through milestone 2a.10 of `docs/ROADMAP.md`. What it will
> become is `docs/SPEC.md`; why is `docs/ARCHITECTURE.md` and `design/`; in what order is `docs/ROADMAP.md`.

## 1. What is here

A product and an office around it. The product is a transaction guard for Solana AI agents: about 1,950 lines of
TypeScript, and about 1,850 lines of tests. The office is the machinery that keeps the work honest: seven agent
seats, gates, standard procedures, records, and a knowledge vault.

```
Solanaut/                        (an Obsidian vault; open this folder, and the front page is kb/INDEX.md)
├─ packages/sdk/                 @solanaut/sdk: the guard (the product)
│   ├─ src/message.ts            message bytes → their parts: legacy, v0 (tables from pins only) and v1
│   ├─ src/base58.ts             the address codec, so decoding needs no library
│   ├─ src/classify.ts           a decoded message → its effects: outflows, denied instructions, fees, the intent key
│   ├─ src/pda.ts                program-derived and associated token addresses, offline
│   ├─ src/policy.ts             policy v1: validated (rule 0), frozen, hashed
│   ├─ src/guard.ts              createGuard(): rules 0 to 19 in order; receipts, reports, the latch
│   ├─ src/state.ts              the guard's state, changed only by applying an entry of the record
│   ├─ src/log.ts                the record's entries, hash-chained
│   ├─ src/record.ts             where the record lives: memory, or a synced, locked file
│   ├─ src/latch.ts              the release message and its ed25519 check
│   ├─ src/sensor.ts             sensors v1 (the default) and v0: the proposal stream → Keel's three numbers
│   ├─ src/tables.ts, bin/pin-table.ts   a lookup table's account → its pin for the policy
│   ├─ src/adapters/             guardedWallet (Solana Agent Kit), guardedSigner (kit), jsonRpc; src/errors.ts: SolanautDenied
│   └─ test/                     decode, classify, policy, admission and pin-table batteries (node:test)
├─ apps/sandbox/src/main.ts      three scripted scenarios through the guard, offline or on a local validator
├─ apps/onchain/src/squads.ts    the Squads v4 spending-limit drill, for devnet or a local validator
├─ apps/cockpit/                 the dashboard: the record and the Squads limit, read-only, on 127.0.0.1
├─ apps/agentkit/src/run.ts      a scripted Solana Agent Kit agent behind guardedWallet, for validation
├─ .github/workflows/ci.yml      the four gates on every push
├─ docs/                         PRODUCT · ROADMAP · READINESS · OVERVIEW · SPEC · ARCHITECTURE · HACKATHON · CLAIMS · papers/ · submission/ · plans/
├─ design/                       ADR-001 … ADR-011
├─ kb/                           the knowledge base: INDEX, LOG, DOCUMENTS, REGISTRY, sources/, wiki/, milestones/, templates/, intake/, private/ (gitignored)
├─ evals/                        receipts: each gate shown failing, then passing
├─ runs/                         one record per session
├─ plugins/  .claude-plugin/     the seven seats (architect, harness, builder, integrator, evaluator, operator, archivist)
├─ workflows/                    the procedures: session close, milestone review, knowledge, triage, and more
├─ tools/                        the gates: boundary guard, doctor, lint, scaffold, kb lint, session close, CI host fixture; the Colosseum tool
├─ Docs-Dashy-Drop/              the human's drop: the raw inbox, read-only to agents
├─ .obsidian/                    the vault's shared settings
└─ CLAUDE.md                     the law, and the router for agents
```

## 2. Dependencies and tools

| What | Version | Why |
|---|---|---|
| Node.js | 26.7.0 (mise) | runs TypeScript directly (type stripping), so there is no build step |
| `@gubernaut/core` (Keel) | 1.0.1 | the loop controller: three numbers in, a posture out. **The SDK's only runtime dependency** |
| `@solana/kit` | 8.4.0 | dev only: the reference the decoder is checked against |
| `@solana-program/system`, `token`, `compute-budget` | 0.15.0, 0.17.0, 0.19.0 | dev only: the reference the classifier is checked against |
| `@solana/web3.js` | 1.99.0 | dev only in the SDK; the sandbox uses it, and so do the agent frameworks the adapters will wrap |
| `typescript` | 7.0.2 | type-checking only (`tsc --noEmit`) |
| `puppeteer-core` | 25.12.0 | `tools/colosseum_entry.mjs` only |
| Agave (Solana CLI) | 3.1.10, and 4.3.0 for v1 | `solana-test-validator` for the sandbox; 4.3.0 by absolute path for v1 transactions |
| Anchor | 1.2.0 | installed and proven; `solanaut_anchor` (milestone 3.7) will use it |
| uv, Python 3.11+ | 0.12 | runs the office tools, which use the standard library only |

Pins and install notes: `TOOLCHAIN.md` and `kb/REGISTRY.md`.

## 3. The logic, and the data it moves

**In:** `ProposalV1 { message: Uint8Array; at; blockHeight?; lastValidBlockHeight?; intent? }`: the serialized
message the signatures will cover, and the caller's clock and heights (SDK mode trusts the caller for those;
`docs/SPEC.md` §2.1).

**One check** (`guard.ts`, `check`). The first rule that fails is the decision's reason:

1. **Rules 1 to 3, decoding.** `decodeMessage` reads legacy, v0 or v1 bytes, strictly. `resolveMessage` loads v0
   accounts from the policy's pinned lookup tables, never from the chain. Anything it cannot read exactly denies as
   `malformed-proposal`, `unsupported-version` or `lookup-table-unpinned`.
2. **Effects.** `classify` puts every instruction of System, SPL Token, Token-2022, ComputeBudget and Memo in one
   class: value-moving, benign or denied. Anything unlisted is denied. It reports SOL and token outflows, signers
   outside the principal, durable nonces, opaque programs, the priority fee, base fee and tips, and the **intent
   key**: a hash of what moves, without fees, version, blockhash or memos.
3. **Keel.** Sensor v1 turns the effects and the stream into three numbers; they are checked, and Keel ticks on
   every parsed proposal, allowed or denied. Keel's wasm and module were hashed when the guard was created.
4. **Rules 4 to 18, in order:** latched; durable nonce; other signer; program not allowed; opaque program; instruction
   denied; destination not allowed; mint not allowed or unknown; over the per-transaction cap; over the fee cap;
   intent in flight; intent attempts exhausted; over a window cap (SOL, each mint, fees), counted at admission;
   Keel's REGROUND; and under INHIBIT, an amount over the cap times Keel's clamp.
5. **Rule 19.** Anything that throws denies as `fail-closed`. `check` never throws.

**Out:** a `Decision`, also the next entry of a hash-chained record (`log.ts`). An allowed decision is a **receipt**:
it binds the message hash, the expiry height and the policy hash. Around it:
- `redeem(bytes, hash, height)`: before signing, the bytes are the admitted ones, in time, and used once;
- `report(hash, outcome)`: landed, failed, expired or unknown. Outcomes end attempts and release reservations;
- `releaseText(expires)` and `release(text, signature, at)`: the latch, freed only by the operator's ed25519
  signature over an exact text naming the guard, cluster, policy, latch seq and expiry.

**Adapters** (`src/adapters/`). `guardedWallet(wallet, guard, { rpc })` is a Solana Agent Kit `BaseWallet` with
exactly its members: it checks before the wallet signs, verifies what the wallet signed, sends the checked bytes
itself, and reports the outcome. `guardedSigner(signer, guard)` does the same for a kit partial signer. Both throw
`SolanautDenied { rule, reason, decision }`.

**State** (`state.ts`) changes only by applying an entry. Given a `log` path, the record is a file (`record.ts`):
one JSON entry per line, synced before the guard answers, locked to one guard. On start the guard applies every entry
again, Keel included, and continues where it stopped; `replay(entries, policy)` recomputes every decision from its
bytes. Without a `log`, the record lives in memory.

**Defects:** every one found in review, D1 to D12, is closed (`docs/SPEC.md` §10). The open questions are in §12.

## 4. The workflows

| Workflow | Command | What it does |
|---|---|---|
| Test | `npm test` | the SDK's batteries and the cockpit's: 145 tests |
| The dashboard | `npm run cockpit -- --record <r> --policy <p> [--rpc <url> --squads <f>]` | the guard's record and the Squads limit, on 127.0.0.1 |
| The on-chain drill | `node apps/onchain/src/squads.ts --url <rpc> …` | a Squads v4 limit naming the agent's key, a stolen-key drill, the revoke timed |
| Typecheck | `npm run typecheck` | `tsc`, no emit |
| Fuzz the decoder harder | `FUZZ_SEED=<n> FUZZ_RUNS=<count> node --test --test-name-pattern=fuzz packages/sdk/test/decode.test.ts` | mutated messages must decode as kit decodes them, or deny with a named rule |
| Pin a lookup table | `npm run pin-table -- --url <rpc> <table>` | prints the table's pin for the policy |
| Replay a record | `npm run replay -- <record.jsonl> <policy.json>` | recomputes every decision; exit 1 at the first divergence |
| Sandbox, offline | `npm run sandbox` | three scenarios: benign payments are allowed, a drain is denied, a retry loop is stopped at turn 3 |
| Sandbox, on-chain | `npm run validator`, then `npm run sandbox -- --cluster local` | allowed transfers land; denied ones are never sent |
| Toolchain | `npm run doctor` | every tool against its pin, the v1 validator included |
| The write boundary | `uv run --script tools/boundary_guard.py --selftest` | 34 cases; the guard runs on every Write, Edit and Bash call |
| The knowledge base | `uv run --script tools/kb_lint.py` | links, frontmatter, orphans, registers, private folder, seat table |
| CI | push | `.github/workflows/ci.yml`: tests, typecheck, kb lint and the boundary self-test |
| Close a session | `uv run --script tools/session_close.py` | every gate, then commit and push (`workflows/session_close.md`) |

## 5. Configuration and constraints

- **Devnet only** (ADR-003). No key that holds real funds lives in this tree. Devnet keys are in `keys/`, which is
  gitignored and write-denied to agents. A capped, human-run mainnet canary with a Phantom wallet is proposed
  (ADR-008) and was deferred by the human on 2026-09-30.
- **Isolation** from the Gubernaut workspace (ADR-002): `.claude/settings.json` denies reads of it;
  `tools/boundary_guard.py` denies writes to it, to machine-wide agent config, to the drop and to anything
  key-shaped, and fails closed.
- **The Solana CLI's global config is never used.** Every command passes `--url` and `--keypair`. npm scripts set
  their own PATH.
- **Claims:** every public sentence traces to `docs/CLAIMS.md`.
- **Tiers:** T3 files (the guard, the doctor, the claims, the evals, the public surface) change only with the gate
  shown failing first. T4 (public, mainnet, submission) is the human's.
- **Environment:** there are no runtime environment variables. The guard keeps no clock; proposals carry their time.
- **What is not here yet:** the devnet run of the on-chain drill (it waits for devnet SOL), a licence, and `programs/`.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. |
| Draft 2 | 2026-09-30 | The verified review: the new documents and ADRs in the tree; the defects D10 to D12 found in this code; the proposed canary; milestones in place of dates. |
| Draft 3 | 2026-10-01 | The guard as rebuilt through milestone 2a.5: bytes decoded, instructions classified, policy v1, admission by rules 0 to 19, receipts, intents, the latch, a hash-chained record made durable and restored by replay; Keel verified by its bytes; sensor v1; the adapters; the on-chain drill, rehearsed; the cockpit; CI; the SDK's one runtime dependency. |
