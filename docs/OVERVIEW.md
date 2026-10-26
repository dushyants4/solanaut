# OVERVIEW.md — the codebase, as it is

> **Draft 62** · 2026-10-27 · owner: integrator · for: engineers new to this repository, and judges reading the code ·
> describes the tree **as it is today**. What it will become is `docs/SPEC.md`; why is `docs/ARCHITECTURE.md` and
> `design/`; in what order is `docs/ROADMAP.md`.

A product and an office around it. The product is a transaction guard for Solana AI agents: an SDK, a separate signer
process, and the apps that show and test them. The office is the machinery that keeps the work honest: seven agent
seats, gates, standard procedures, records and a knowledge vault.

1. [What is here](#1-what-is-here)
2. [Dependencies and tools](#2-dependencies-and-tools)
3. [The guard: the logic, and the data it moves](#3-the-guard-the-logic-and-the-data-it-moves)
4. [The signer and the apps](#4-the-signer-and-the-apps)
5. [Internal components](#5-internal-components)
6. [The workflows](#6-the-workflows)
7. [Configuration and constraints](#7-configuration-and-constraints)

## 1. What is here

```
Solanaut/                        (an Obsidian vault; open this folder, and the front page is kb/INDEX.md)
├─ packages/sdk/                 @solanaut/sdk: the guard (the product); its README maps every file
│   ├─ src/index.ts              every export, grouped by purpose: read this first
│   ├─ src/message.ts            message bytes → their parts: legacy, v0 (tables from pins only) and v1
│   ├─ src/base58.ts             the address codec, so decoding needs no library
│   ├─ src/classify.ts           a decoded message → its effects: outflows, denied instructions, fees, the intent key
│   ├─ src/pda.ts                program-derived and associated token addresses, offline
│   ├─ src/policy.ts             policy v1: validated (rule 0), frozen, hashed
│   ├─ src/signed-policy.ts, profile.ts   operator authorization, and the evaluator identity it binds
│   ├─ src/guard.ts              createGuard(): rules 0 to 19 in order; receipts, reports, the latch, replay
│   ├─ src/state.ts              the guard's state, changed only by applying an entry of the record
│   ├─ src/log.ts                the record's entries, hash-chained
│   ├─ src/record.ts             where the record lives: memory, or a synced, locked file
│   ├─ src/archive.ts            a stopped record's archive, verified as a stream
│   ├─ src/latch.ts              the release text and its ed25519 check
│   ├─ src/sensor.ts             sensors v1 (the default) and v0: the proposal stream → Keel's three numbers
│   ├─ src/tables.ts             a lookup table's account → its pin for the policy
│   ├─ src/errors.ts             SolanautDenied: what the agent is told, and what only the operator sees
│   ├─ src/adapters/             guardedWallet (Solana Agent Kit), guardedSigner (kit), jsonRpc, the sending client
│   ├─ src/checkpoint*.ts, request*.ts, signing.ts, owned-guard.ts   the signer host's journal and recovery (§5)
│   ├─ bin/                      replay, pin-table, verify-archive, prepare-policy, and the release build
│   └─ test/                     the batteries (node:test)
├─ apps/                         its README maps every app
│   ├─ sandbox/src/main.ts       three scripted scenarios through the guard, offline or on a local validator
│   ├─ cockpit/                  the dashboard: the record and the Squads limit, read-only, on 127.0.0.1
│   ├─ agentkit/src/run.ts       a scripted Solana Agent Kit agent behind guardedWallet, for validation
│   ├─ onchain/src/squads.ts     the Squads v4 spending-limit drill, for devnet or a local validator
│   ├─ onchain/src/scenes.ts     DEMO.md's scenes end to end through guardedWallet, with a real SIGKILL and restore
│   ├─ signer/src/               the separate signer: executor, RPC boundary, socket, handler, service, executable
│   └─ firewall/src/filter.ts    the MCP firewall's first part: which tool calls may reach a wallet
├─ examples/offline-preview.mjs  an offline walkthrough of the SDK (docs/PREVIEW.md)
├─ .github/workflows/ci.yml      19 jobs on every push (evals/ci/green.md)
├─ docs/                         the reading guide is docs/README.md: product, guides, spec, roadmap, claims, papers
├─ design/                       ADR-001 … ADR-025
├─ kb/                           the knowledge base: INDEX, LOG, DOCUMENTS, REGISTRY, sources/, wiki/, milestones/, templates/, intake/, private/ (gitignored)
├─ evals/                        receipts: each gate shown failing, then passing; evals/README.md indexes them
├─ runs/                         one record per session
├─ plugins/  .claude-plugin/     the seven seats (architect, harness, builder, integrator, evaluator, operator, archivist)
├─ workflows/                    the procedures: session close, milestone review, knowledge, triage, and more
├─ tools/                        the gates: boundary guard, doctor, lints, scaffold, session close, CI host fixture; the Colosseum tool
├─ Docs-Dashy-Drop/              the human's drop, on the developer's disk only: not in the repository
├─ .obsidian/                    the vault's shared settings
├─ STYLE.md                      how the code is written
└─ CLAUDE.md, AGENTS.md          the law, and the router, for Claude Code and for Codex
```

## 2. Dependencies and tools

| What | Version | Why |
|---|---|---|
| Node.js | 26.7.0 (mise) | native TypeScript development; the release-only JavaScript and declaration build |
| `@gubernaut/core` (Keel) | 1.0.1 | the loop controller: three numbers in, a posture out. **The SDK's only runtime dependency** |
| `@solana/kit` | 8.4.0 | dev only: the reference the decoder is checked against |
| `@solana-program/system`, `token`, `compute-budget` | 0.15.0, 0.17.0, 0.19.0 | dev only: the reference the classifier is checked against |
| `@solana/web3.js` | 1.99.0 | dev only in the SDK; the sandbox and the agent frameworks the adapters wrap use it |
| `typescript` | 7.0.2 | typecheck and release-only compilation |
| `fast-check`, `istanbul-lib-*`, `@stryker-mutator/core` | 4.10.2, 3.2.2 and 6.0.3, 10.0.0 | property tests, the coverage floors, the mutation run |
| `puppeteer-core` | 25.12.0 | `tools/colosseum_entry.mjs` and the cockpit's screenshot only |
| Agave (Solana CLI) | 3.1.10, and 4.3.0 for v1 | `solana-test-validator` for the sandbox; 4.3.0 by absolute path for v1 transactions |
| Anchor | 1.2.0 | installed and proven; `solanaut_anchor` (milestone 3.7) will use it |
| uv, Python 3.11+ | 0.12 | runs the office tools, which use the standard library only |

Pins and install notes: `TOOLCHAIN.md` and `kb/REGISTRY.md`.

## 3. The guard: the logic, and the data it moves

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
   intent in flight (an earlier attempt could still land, or is past its expiry with its outcome never reported);
   intent attempts exhausted; over a window cap (SOL, each mint, fees), counted at admission;
   Keel's REGROUND; and under INHIBIT, an amount over the cap times Keel's clamp.
5. **Rule 19.** Anything that throws denies as `fail-closed`. `check` never throws.

**Out:** a `Decision`, also the next entry of a hash-chained record (`log.ts`). An allowed decision is a **receipt**:
it binds the message hash, the expiry height and the policy hash. Around it:
- `redeem(bytes, hash, height)`: before signing, the bytes are the admitted ones, in time, and used once;
- `report(hash, outcome)`: landed, failed, expired or unknown. Outcomes end attempts and release reservations;
  `state.ts` validates reports and redemptions before it changes anything;
- `releaseText(expires)` and `release(text, signature, at)`: the latch, freed only by the operator's ed25519
  signature over an exact text naming the guard, cluster, policy, latch seq and expiry.

**The latch** trips after `latch.afterDenials` denials in a row, and on REGROUND by ADR-012's option C: a denial at
REGROUND latches when Keel itself is the reason (rule 17), or when the denial just before it was also at REGROUND, so
exactly one REGROUND is tolerated on a proposal an earlier rule already denied. The predecessor comes from the record
and is reconstructed in replay (`evals/sdk/latch-c.md`; the funded devnet rerun is owed).

**Adapters** (`src/adapters/`). `guardedWallet(wallet, guard, { rpc })` has exactly the members of Solana Agent Kit's
`BaseWallet`, so the kit takes it at runtime (TypeScript needs a cast): it checks before the wallet signs, verifies
what the wallet signed, sends the checked bytes itself, and reports the outcome. It captures the serialized wire once,
verifies its message and the wallet's signature, then sends those same bytes; a changed or malformed serialization
refuses before any RPC call, and a signing already verified stays unknown even if the serializer erases its evidence
(`evals/sdk/adapter-wire.md`). It copies raw buffers it is handed before admission
(`evals/sdk/adapter-buffer-current.md`), and captures and copies a batch's membership before delegating
(`evals/release/integrated-fixes.md`). What it only signs, it follows up by signature before the next check, and
reports what the chain says. A failed send is reported `failed` only when the RPC refused the bytes.
`guardedSigner(signer, guard)` checks and verifies the same way for a kit partial signer. Both throw `SolanautDenied {
ref, class }` by default. The rule, reason and decision go to the operator's callback and journal; a signed
development disclosure can add the rule and reason to SDK errors. The signer's socket always projects the class
channel.

**State** (`state.ts`) changes only by applying an entry. Given a `log` path, the record is a file (`record.ts`): one
JSON entry per line, synced before the guard answers, locked to one guard. On start the guard applies every entry
again, Keel included, and continues where it stopped; `replay(entries, policy)` recomputes every decision from its
bytes. Without a `log`, the record lives in memory.

**The record on disk** (`docs/STORAGE.md`). Manual SDK ownership refuses stale markers. Explicit Linux kernel
ownership holds a `flock` through the writer's lifetime and keeps its mutex inode for safe competing restarts.
Established identities can refuse missing history with `create: false`. The writer:
- completes short writes before sync, and fails permanently on a write or sync error;
- requires single-link journal and mutex inodes, refusing hardlinked aliases (`evals/sdk/record-alias.md`);
- after each synced append, checks that the physical size grew by exactly the entry's bytes
  (`evals/sdk/record-write-completion.md`), and that it still holds the original mutex and journal inodes
  (`evals/sdk/record-write-identity.md`);
- before each append, compares the descriptor's size and nanosecond modification and change times with its last
  synced state, and fails permanently on an external change (`evals/sdk/live-record.md`).

Reads check the same metadata across the read, and the inode identity, before parsing or repairing a torn tail; the
complete raw read must match the descriptor's byte count. Torn tails are cut at byte newline boundaries, keeping
complete entries even when the unfinished suffix ends inside a UTF-8 character
(`evals/sdk/record-read-stability.md`, `evals/sdk/record-read-completion.md`). None of this makes an advisory lock
mandatory for other processes, or the host tamper-proof.

`verifyArchive` checks a stopped archive's bounded framing, chain, continuation identity and optional external head,
digest and anchor pins, with typed `ArchiveError` codes; the compiled `solanaut-verify-archive` command runs the same
read-only checks (`evals/sdk/archive.md`, `evals/sdk/archive-cli.md`, `evals/sdk/archive-anchor.md`). It verifies
structure, not authenticated snapshot state or policy replay. ADR-022 proposes the anchor's enrolment and rotation; no
program implements it yet, and history after the latest anchor is outside its pin.

**Signed policy** (`docs/POLICIES.md`). The SDK prepares and verifies operator-signed policies, and restores,
replays and inspects their history. Its evaluation profile binds the current evaluator and controller.

**Requests and signing facts** (`docs/REQUESTS.md`). An optional request identity is committed with its decision; a
duplicate returns that entry without another evaluation. Control requests and their responses share the admission
chain, keeping status and report payloads and immutable answers. Checked signing facts share it too: signed bytes and
signature, send intent and an immutable response. They are journal evidence; the trusted SDK method sends nothing.
Proposal errors other than admissions leave durable refusal history, never replacing an admitted decision's signing
history (`evals/signer/refusal.md`).

**Defects:** every one found in review is closed (`docs/SPEC.md` §10). The open questions are in §12.

## 4. The signer and the apps

**The signer** (`apps/signer/src/`, `docs/SIGNER.md`) is the separate process that holds the key, so the agent does
not. `core.ts` runs the signing lifecycle through supplied signing and RPC functions; its recovery pass isolates
attempt failures, returns completion results, and still follows signed bytes after a refusal before sending
(`evals/signer/recovery.md`). `rpc.ts` gives validated devnet reads, health, a single send and conservative
two-provider outcome evidence (`docs/RPC.md`). The host's authority records source, deployment mode and an anchored
clock that only advances. `socket.ts` and `handler.ts` serve `propose`, `report` and `status` over a protected Unix
socket.

`service.ts` composes protected signed history, ownership, the clock, recovery, the handler and the socket
(`evals/signer/service.md`). The native executable, `main.ts`, loads protected configuration and a devnet key, creates
trusted RPC clients from `SOLANAUT_RPC_A` and `SOLANAUT_RPC_B` in the operator's environment, and starts that service.
It follows signed attempts automatically, and projects its private journal to class and reference replies. `--init`
creates fresh signed history once; a normal start requires the existing record. It runs in same-user mode only:
installed and dedicated-user deployment, and full signer qualification, are unfinished. Agents reach it through the
SDK's sending client (`docs/CLIENT.md`) rather than partial signing.

**The firewall** (`apps/firewall/src/filter.ts`) is the offline MCP selection component. It copies explicit operator
tool configuration, requires an explicit devnet network, bounds parsing and returns detached, immutable call
parameters. It does not forward, build, sign or send a transaction; guarded transfer handling, the Phantom integration
and an installed server are owed (`evals/firewall/filter.md`).

**The other apps**, the sandbox, the cockpit, the Agent Kit run and the devnet scripts, are listed with their commands
in [`apps/README.md`](../apps/README.md). The on-chain drill, the scenes and the cockpit have run on devnet
(`evals/onchain/squads-devnet.md`, `evals/e2e/scenes-devnet.md`).

## 5. Internal components

These parts of the SDK serve the signer host's journal and recovery. None is a root export, a supported consumer
contract or an operator command, and none can authorize an admission by itself. Each has component evidence;
together they are not yet a supported recovery workflow, and bounded live state is owed (ADR-023).

| Component | What it does, and does not do | Evidence |
|---|---|---|
| The owned guard (`owned-guard.ts`) | Opens established signed devnet history and privately owns its guard and store. Admission, redemption, control requests, status, release-text preparation, signed release and close are queued; inputs are captured, and its frozen surface exposes no history. It refuses implicit creation and policy upgrades, and the trusted SDK's unrecorded-admission sentinel. Reservations survive a release; a failed write keeps the latch. | `evals/sdk/owned-guard.md` |
| Owned signing and reports | The facade queues captured signing-history facts and trusted outcome reports with its other mutations, returns detached immutable entries after the synced append, and drains before closing. It signs and sends nothing; an isolated report still needs authoritative RPC evidence. | `evals/sdk/owned-signing.md`, `evals/sdk/owned-report.md` |
| Owned control requests | Share the proposal admission queue, consult the owned disk evidence, check the current head, and return detached immutable starts and replies. | `evals/sdk/owned-control-request.md` |
| Owned request admission (`checkOwnedRequest` in `guard.ts`) | Serializes a proposal's consultation with the owned disk lookup, and rechecks the live head before returning a matching old decision or committing a verified absence. | `evals/sdk/owned-request-admission.md` |
| The request index (`request-index.ts`, `request-index-publication.ts`) | A read-only projection of a verified completed history prefix, whose manifest and shards a full signed replay derives. A hit, or an absence, cannot authorize a current admission. Publication writes complete immutable generations through the record's owner, with a synced atomic pointer and retained predecessors. The pointer is a cache hint, never recovery authority. | `evals/sdk/request-index.md`, `evals/sdk/owned-request-index.md` |
| Owned request lookup (`record.ts`) | Authenticates the published prefix and the complete signed current history, then folds the tail for one identity; late record, cache or pointer changes refuse. It needs an existing index. | `evals/sdk/request-index-lookup.md` |
| Record-only loading | Record storage imports only lightweight maintenance errors, which the checkpoint modules re-export; publication and recovery load when maintenance is requested, after capturing the caller's pins. Maintenance still validates the full retained history. | `evals/sdk/record-loading.md` |
| Streamed recomputation | Shares the array replay's decision checker; two complete reads bind canonical records and the largest historical policy window. Public `replay` keeps its array contract and per-record loop. Success does not authenticate storage; archive verification, ownership and live restoration are separate. | `evals/sdk/replay-stream.md` |
| Archive streaming | Yields immutable entries from bounded reads under backpressure; only natural completion establishes full structural integrity and gives a receipt, and cancelling closes the source. Public `verifyArchive` consumes the same core. | `evals/sdk/archive-stream.md` |
| Checkpoint envelope, bundle, state and prefix (`checkpoint-envelope.ts`, `-bundle.ts`, `-state.ts`, `-prefix.ts`) | Authenticate a canonical container under both descriptor signing domains, with a byte ceiling; assemble validated payload parts; prepare signed-mode admission-state bytes from full verified history; prepare Keel's event prefix only after a full replay. None loads state or restores a guard. | `evals/packaging/checkpoint-payloads.md` |
| Checkpoint bindings and archives (`checkpoint.ts`, `checkpoint-archives.ts`) | Exported: authenticate checkpoint and prefix bindings against external pins and independently computed digests, and prepare the archive catalogue. Not a restoration path. | `evals/sdk/checkpoint.md`, `evals/sdk/checkpoint-archives.md` |
| Owned checkpoint publication | Only the kernel-owned file store holds this capability; memory and copied stores cannot publish. It needs external checkpoint and policy pins, the retained archive paths and an explicit byte ceiling, and authenticates each candidate against a replay of the record and the verified archives, under live kernel ownership. A synced atomic replacement keeps the previous authenticated envelope; stale or replay-inconsistent state is refused. | `evals/sdk/checkpoint-publication.md` |
| Prefix rebuilding | Derives the expected events by full replay, requires the exact supplied bytes, and feeds a fresh Keel controller; no stored controller numbers are loaded. Signed history still needs external policy pins, and a recovery caller authenticated envelope, archive and anchor validation. | `evals/sdk/checkpoint-rebuild.md` |
| Recovery preparation, and owned recovery | Verify full signed history and any configured anchor before accepting a checkpoint or falling back; a missing or corrupt checkpoint cannot bypass either. The receipt tells a verified checkpoint from a verified full replay, names the fallback, and returns derived admission text and a fresh controller, not a running guard. Owned recovery reads through the kernel-held store, bounds checkpoint reads, repeats the ownership and history checks after replay, shares maintenance exclusion with publication, and keeps invalid checkpoint evidence when it falls back. The caller still owns the lifecycle. | `evals/sdk/checkpoint-recovery.md`, `evals/sdk/checkpoint-owned-recovery.md` |

The evaluator also keeps companions outside the product, such as the historical blob-bytes check, which verifies
inventoried history without printing it and refuses sensitive path metadata before reading
(`evals/release/history-bytes.md`).

## 6. The workflows

| Workflow | Command | What it does |
|---|---|---|
| Test | `npm test` | the SDK, app and CI batteries |
| Typecheck | `npm run typecheck` | `tsc`, no emit |
| Sandbox, offline | `npm run sandbox` | three scenarios: benign payments are allowed, a drain is denied, a retry loop is stopped at turn 3 |
| Sandbox, on-chain | `npm run validator`, then `npm run sandbox -- --cluster local` | allowed transfers land; denied ones are never sent |
| The dashboard | `npm run cockpit -- --record <r> --policy <p> [--rpc <url> --squads <f>]` | the guard's record and the Squads limit, on 127.0.0.1 |
| The on-chain drill | `node apps/onchain/src/squads.ts --url <rpc> …` | a Squads v4 limit naming the agent's key, a stolen-key drill, the revoke timed |
| The demo's scenes | `node apps/onchain/src/scenes.ts --url <rpc> …` | the scenes end to end through `guardedWallet`, with a record for the cockpit |
| Pin a lookup table | `npm run pin-table -- --url <rpc> <table>` | prints the table's pin for the policy |
| Replay a record | `npm run replay -- <record.jsonl> <policy.json>` | recomputes every decision through verified streamed reads; exit 1 at the first divergence, whose values are redacted (`evals/sdk/replay-command.md`) |
| Verify an archive | `npm run verify-archive -- <archive.jsonl> [pins]` | structural checks and pins, read-only |
| Prepare a policy for signing | `npm run prepare-policy -- <policy.json> --version 2 --issued 2026-10-27T00:00:00.000Z` | the public text the operator signs (`docs/POLICY.md`) |
| Build the package | `npm run release:prepare`, then `npm run test:package` | the compiled private candidate, installed and tested outside the repository (`docs/PACKAGING.md`) |
| Fault campaigns | `npm run test:bite`, `npm run test:package:faults` | every maintained planted fault must be caught, with the source restored (`evals/ci/bite-partitions.md`) |
| Coverage floors | `npm run test:coverage` | in-memory AST instrumentation of SDK and signer source; unimported files count as uncovered (`evals/ci/coverage.md`) |
| The other CI gates | `npm run test:fuzz`, `test:replay`, `test:kills`, `test:differential`, `test:traffic` | the decoder fuzz, the pinned replay head, kill recovery, real-transaction differential decoding, frozen traffic |
| Toolchain | `npm run doctor` | every tool against its pin, the v1 validator included |
| The write boundary | `uv run --script tools/boundary_guard.py --selftest` | 59 cases; the guard runs on every Write, Edit and Bash call |
| The knowledge base | `uv run --script tools/kb_lint.py` | links, frontmatter, orphans, registers, private folder, seat table |
| CI | push | `.github/workflows/ci.yml`: all of the above in 19 jobs (`evals/ci/green.md`) |
| Close a session | `uv run --script tools/session_close.py` | every gate, then commit and push (`workflows/session_close.md`) |

## 7. Configuration and constraints

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
- **Environment:** trusted SDK proposals carry the caller's time; the signer stamps an anchored monotonic clock. Its
  native executable reads `SOLANAUT_RPC_A` and `SOLANAUT_RPC_B` from the operator's environment.
- **Public source:** Apache-2.0 is accepted. The stable anchor and an individual installation are unfinished.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. |
| Draft 2 | 2026-09-30 | The verified review: the new documents and ADRs in the tree; the defects D10 to D12 found in this code; the proposed canary; milestones in place of dates. |
| Draft 3 | 2026-10-01 | The guard as rebuilt through milestone 2a.5: bytes decoded, instructions classified, policy v1, admission by rules 0 to 19, receipts, intents, the latch, a hash-chained record made durable and restored by replay; Keel verified by its bytes; sensor v1; the adapters; the on-chain drill, rehearsed; the cockpit; CI; the SDK's one runtime dependency. Then devnet: the drill, the scenes and the cockpit run there; D13 and D14 closed in the adapters and the intents. |
| Drafts 4 to 61 | 2026-10-01 to 2026-10-13 | One note per component, added as each was built; the git history has each. |
| Draft 62 | 2026-10-27 | Reorganized for reading: the component notes gathered into §4 and §5, the tree and workflows brought up to date (the signer, the firewall, ADR-025, CI's 19 jobs, 59 boundary cases), and two stale notes corrected: the batch-membership (D41) and raw-buffer (D40) corrections are integrated (S157, S125). |
