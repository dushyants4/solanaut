# OVERVIEW.md — the codebase, as it is

> **Draft 2** · 2026-09-30 · owner: integrator · for: engineers new to this repository, and judges
> reading the code · describes the tree **as it is today** (phase 0, the research foundation and the verified
> review). What it will become is `docs/SPEC.md`; why is `docs/ARCHITECTURE.md` and `design/`; in what order is
> `docs/ROADMAP.md`.

## 1. What is here

A small product and a larger office around it. The product is a transaction guard for Solana AI agents,
about 470 lines of TypeScript. The office is the machinery that keeps the work honest: seven agent
seats, gates, standard procedures, records, and a knowledge vault.

```
Solanaut/                        (an Obsidian vault; open this folder, and the front page is kb/INDEX.md)
├─ packages/sdk/                 @solanaut/sdk: the guard (the product)
│   ├─ src/policy.ts             the deterministic half: allowlists and caps → a Verdict
│   ├─ src/sensor.ts             sensor v0: the proposal stream → Keel's three numbers
│   ├─ src/guard.ts              createGuard(): policy + sensor + Keel → a Decision; fails closed
│   ├─ src/describe.ts           a web3.js legacy Transaction → a Proposal
│   ├─ src/index.ts              the public surface
│   └─ test/guard.test.ts        9 evals, written failing first (node:test)
├─ apps/sandbox/src/main.ts      three scripted scenarios through the guard, offline or on a local validator
├─ docs/                         PRODUCT · ROADMAP · READINESS · OVERVIEW · SPEC · ARCHITECTURE · HACKATHON · CLAIMS · papers/ · submission/ · plans/
├─ design/                       ADR-001 … ADR-011
├─ kb/                           the knowledge base: INDEX, LOG, DOCUMENTS, REGISTRY, sources/, wiki/, milestones/, templates/, intake/, private/ (gitignored)
├─ evals/                        receipts: each gate shown failing, then passing
├─ runs/                         one record per session
├─ plugins/  .claude-plugin/     the seven seats (architect, harness, builder, integrator, evaluator, operator, archivist)
├─ workflows/                    the procedures: session close, milestone review, knowledge, triage, and more
├─ tools/                        the gates: boundary guard, doctor, lint, scaffold, kb lint, session close; the Colosseum tool
├─ Docs-Dashy-Drop/              the human's drop: the raw inbox, read-only to agents
├─ .obsidian/                    the vault's shared settings
└─ CLAUDE.md                     the law, and the router for agents
```

## 2. Dependencies and tools

| What | Version | Why |
|---|---|---|
| Node.js | 26.7.0 (mise) | runs TypeScript directly (type stripping), so there is no build step |
| `@gubernaut/core` (Keel) | 1.0.1 | the loop controller: three numbers in, a posture out |
| `@solana/web3.js` | 1.99.0 | transactions, keys, RPC; what ElizaOS, Solana Agent Kit and Anchor's TS client still build on |
| `typescript` | 7.0.2 | type-checking only (`tsc --noEmit`) |
| `@types/node` | 26.6.3 | Node's types |
| `puppeteer-core` | 25.12.0 | `tools/colosseum_entry.mjs` only |
| Agave (Solana CLI) | 3.1.10 | `solana-test-validator` for the sandbox; the release Anchor 1.2.0 selects |
| Anchor | 1.2.0 | installed and proven; `solanaut_anchor` (H3, P2) will use it |
| uv, Python 3.11+ | 0.12 | runs the office tools, which use the standard library only |
| Obsidian | 1.13.7 | optional: reads the vault |

Pins and install notes: `TOOLCHAIN.md` and `kb/REGISTRY.md`.

## 3. The logic, and the data it moves

**Data models** (`packages/sdk/src/`):

```ts
Policy   { allowedPrograms, allowedDestinations: string[]; maxLamportsPerTx, maxLamportsPerWindow, windowMs: number }
Proposal { programIds: string[]; transfers: { to, lamports }[]; at: number }   // time comes from the caller
Verdict  { ok: true } | { ok: false; rule; reason }
Decision { allow; rule?; reason; posture; telemetry; turn }
```

**One evaluation** (`guard.ts`, `evaluate`):

1. **Spent.** Sum what this guard has *allowed* within `windowMs` of the proposal.
2. **Policy.** `checkPolicy` runs its rules in a fixed order: `malformed-proposal`,
   `program-not-allowed`, `destination-not-allowed`, `over-per-tx-cap`, `over-window-cap`.
3. **Sensor.** `sensorV0` turns the proposal and the history into intensity (value, and rate against
   one per second), valence (the failure streak) and repetition (an identical fingerprint = 1, the same
   shape = 0.5).
4. **Keel.** `tick` gives a posture. Every proposal reaches Keel, denied or not.
5. **Verdict.**
   - A policy denial wins.
   - Otherwise REGROUND denies as `loop-reground`.
   - Otherwise the proposal is allowed, and its amount counts toward the window.
   - Anything that throws denies as `fail-closed`.
6. **`report(outcome)`** feeds the failure streak after a send.

`createGuard` refuses a Keel whose declared digest is not the pinned one. That check compares two
constants for now (`docs/SPEC.md` §10, D4).

**What the verified review of 2026-09-30 found in this code** (`docs/SPEC.md` §10):
- **D10.** Only System Program `Transfer` is decoded. With the System Program allowlisted, every other System
  instruction, including `CreateAccount` and the nonce instructions, passes with 0 lamports counted.
- **D11.** Reservations, sensor state and Keel's state live in memory, so a restart resets the caps.
- **D12.** Decoding goes through `@solana/web3.js`; the v1 core decodes bytes without it (ADR-009).
- The code handles legacy transactions only. v1 transactions have been live on mainnet since 2026-09-15, and v0
  transactions use lookup tables; both are specified in `docs/SPEC.md` §4.

## 4. The workflows

| Workflow | Command | What it does |
|---|---|---|
| Test | `npm test` | the 9 guard evals |
| Typecheck | `npm run typecheck` | `tsc`, no emit |
| Sandbox, offline | `npm run sandbox` | three scenarios: benign payments are allowed, a drain is denied, a retry loop is stopped at turn 3 |
| Sandbox, on-chain | `npm run validator`, then `npm run sandbox -- --cluster local` | allowed transfers land; denied ones are never sent |
| Toolchain | `npm run doctor` | every tool against its pin |
| The write boundary | `uv run --script tools/boundary_guard.py --selftest` | 34 cases; the guard runs on every Write, Edit and Bash call |
| The knowledge base | `uv run --script tools/kb_lint.py` | links, frontmatter, orphans, registers, private folder, seat table |
| Close a session | `uv run --script tools/session_close.py` | every gate, then commit and push (`workflows/session_close.md`) |
| Close a milestone | `/milestone` | `workflows/milestone_review.md` |

## 5. Configuration and constraints

- **Devnet only** (ADR-003). No key that holds real funds lives in this tree. Devnet keys are in
  `keys/`, which is gitignored and write-denied to agents. A capped, human-run mainnet canary with a Phantom
  wallet is **proposed** (ADR-008) and waits for the human's decision.
- **Isolation** from the Gubernaut workspace (ADR-002):
  - `.claude/settings.json` denies reads of it;
  - `tools/boundary_guard.py` denies writes to it, to machine-wide agent config, to the drop and to
    anything key-shaped;
  - the guard fails closed.
- **The Solana CLI's global config is never used.** Every command passes `--url` and `--keypair`.
  npm scripts set their own PATH.
- **Claims:** every public sentence traces to `docs/CLAIMS.md`.
- **Tiers:** T3 files (the guard, the doctor, the claims, the evals, the public surface) change only
  with the gate shown failing first. T4 (public, mainnet, submission) is the human's.
- **Environment:** there are no runtime environment variables. The guard keeps no clock; proposals
  carry their time.
- **What is not here yet:** CI, a licence, `programs/`, `apps/cockpit`. The order they arrive in is the
  milestone sequence in `docs/ROADMAP.md`; the contest's own dates are in `docs/HACKATHON.md`.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. |
| Draft 2 | 2026-09-30 | The verified review: the new documents and ADRs in the tree; the defects D10 to D12 found in this code; the proposed canary; milestones in place of dates. |
