# OVERVIEW.md — the codebase, as it is

> **Draft 57** · 2026-10-10 · owner: integrator · for: engineers new to this repository, and judges
> reading the code · describes the tree **as it is today**, through milestone 2a.10 of `docs/ROADMAP.md`. What it will
> become is `docs/SPEC.md`; why is `docs/ARCHITECTURE.md` and `design/`; in what order is `docs/ROADMAP.md`.

## 1. What is here

The wallet sending adapter captures serialised wire once, verifies its message
and wallet signature, then sends those same bytes. Malformed/changed serialisation
refuses before RPC; already verified signing remains unknown, even if the
serializer erases its object evidence. Trusted SDK mode and public methods remain.

The private owned facade queues captured signing-history facts, returns detached
immutable entries after the existing verifier/synced append, and drains before
closing. It journals trusted SDK facts and signs or sends nothing. Component
evidence: `evals/sdk/owned-signing.md`; full retained state remains unbounded.

The private facade queues trusted SDK outcome reports with its other mutations
and observations. It delegates the existing durable caller-attributed report
path and uses the latest journal time, with fixed errors and primitive inputs.
An isolated report still needs authoritative RPC evidence; this adds no socket
method or root export. Component evidence: `evals/sdk/owned-report.md`.

After syncing each append, the file store rechecks its held mutex and named
journal identity before validating size or mutating its cache. Replacement fails
the store permanently while preserving both inodes and foreign-marker evidence.
Local evidence: `evals/sdk/record-write-identity.md`; the host remains trusted.

The file writer verifies the synced physical size delta equals the exact entry
bytes before acknowledgement and cache mutation. Missing or extra physical
writes fail the store permanently, preserving evidence. Component qualification
is `evals/sdk/record-write-completion.md`; this is not authenticated content or
bounded-state recovery.

The file writer requires single-link journal and mutex inodes, refusing hardlinked
aliases before accepting ownership. It compares descriptor size and nanosecond modification/change times
against its completed startup or last synced append before adding another line.
Unexpected change fails that writer permanently; restoring bytes does not revive
it. This checks live storage consistency alongside inode ownership. It does not
make an advisory lock mandatory for other processes or make the host tamper-proof.
Record reads also verify descriptor size and nanosecond modification/change times
across the read, plus current inode identity, before parsing or torn-tail repair.
Observed changes refuse startup/maintenance rather than seed a stale cache.
The complete raw read must also match descriptor byte count before any repair.
Torn tails are cut at byte newline boundaries, preserving complete entries even
when the unfinished suffix contains a partial UTF-8 character.

Internal `owned-guard.ts` opens established signed devnet history and privately
owns its guard/store. Admission, redemption, control requests, status and close are queued;
configuration/inputs are captured and the frozen surface exposes no history.
It refuses implicit creation or policy upgrade. Signing journal,
outcome reporting, operational ceremonies, maintenance and bounded state remain owed.
This is not a stable root export or operational signer.
Private release-text preparation and signed latch release share that queue.
Preparation validates prompt shape/expiry; release captures private signature
backing and returns frozen synced success or fixed error. Reservations survive
release, and a failed write preserves latch state. These methods neither sign
nor send and use the existing trusted SDK clock convention.
Redemption captures private bytes and returns frozen synced success; refusals use
the fixed typed error, including failed writes. Receipt use survives restart.
The facade also refuses the trusted SDK's unrecorded admission sentinel with its
fixed typed error; a storage failure or identity collision is not a durable reply.
The trusted SDK retains its existing synchronous denial behaviour.

Internal owned control companions share the proposal admission FIFO. They capture
inputs, consult actual owned disk evidence, check the current head and return
detached immutable starts/replies. They preserve the trusted synchronous SDK and
add no root export or signer method. They retain full state; bounded recovery and
service wiring remain separate. Evidence: `evals/sdk/owned-control-request.md`.

The existing replay command now uses complete verified streamed history reads
and independently supplied public policy pins. It bounds public JSON inputs and
redacts errors/divergence values while preserving arguments, exit semantics,
success text and the first divergent sequence/field. It writes no guard state;
retained replay maps and actual isolated startup remain separate work.
Evidence: `evals/sdk/replay-command.md`.

The internal `guard.ts` companion `checkOwnedRequest` serializes proposal
consultation with the actual owned disk lookup and rechecks the live head before
returning a payload-matching old decision or synchronously committing verified
absence. Genuine signed guard context, private input bytes and immutable detached
replies protect its boundary. Existing synchronous methods and retained history
stay intact. It is a consultation seam, not a bounded facade or signer expansion.
Evidence: `evals/sdk/owned-request-admission.md`.

The internal owned request lookup in `record.ts` authenticates the published
disk prefix and complete signed current history, then folds the tail for one
identity. Immutable request/reply evidence carries both current and index heads;
late record/cache/pointer changes refuse. This read-only maintenance capability
requires an existing index. It neither authorises admission nor bounds construction
or retained state. Evidence: `evals/sdk/request-index-lookup.md`.

`apps/firewall/src/filter.ts` is the internal offline MCP selection component.
It copies explicit operator tool configuration, requires an explicit devnet
network, bounds parsing and returns detached immutable call parameters. It does
not forward, build, sign or send a transaction. Guarded transfer/transaction
handling, actual Phantom integration and installed server deployment remain owed.
Evidence: `evals/firewall/filter.md`.

`request-index.ts` is an internal read-only projection for a verified completed
history prefix. Full signed replay derives the expected manifest and shards;
lookup verifies complete selected bytes and returns immutable request/reply
evidence or qualified prefix absence. `request-index-publication.ts` publishes
complete immutable generations through the actual record owner, with a synced
atomic pointer and retained predecessors. It does not wire live admissions or
bound live state. Shared `state.ts` now validates reports
and redemption before mutation; signed policy context travels through recovery
and inspection, preserving unsigned SDK compatibility.

The private staged SDK proposal and product-page draft describe the available
trusted mode and remaining release work. They are not publication clearance.

Record storage imports lightweight maintenance errors. Publication and recovery
modules load when actual owned maintenance is requested, after capturing caller
pins and reserving maintenance. Their validation and ownership checks remain.

Internal streamed recomputation shares the array replay's decision checker while
preserving the array path's synchronous per-record loop. Two complete reads bind
canonical records and determine the maximum historical policy window. Pinned
archive factories retain structural validation through natural completion. This
does not wire live recovery or bound request/signing maps; component evidence is
`evals/sdk/replay-stream.md`.

`checkpoint-envelope.ts` authenticates an internal canonical container with
opaque payload bytes under both descriptor signing domains. Reader parsing has
an explicit byte ceiling. This does not load or validate admission state.

`checkpoint-bundle.ts` assembles captured, validated payload components and
descriptor signing bytes. It remains internal; signatures, archive-file verification,
atomic publication and authenticated recovery are separate responsibilities.

`checkpoint-state.ts` prepares signed-mode admission-state bytes from full verified
history, retaining lifecycle facts, policy and the previous decision. It neither
loads state nor bounds memory. Complete live publication, restore, request indexing
and bounded memory remain owed.

`checkpoint-prefix.ts` prepares an internal canonical Keel event payload only after
full history replay. Events retain source identity, telemetry/posture and resets;
it neither accepts controller state numbers nor restores a guard. Authentication,
publication and full snapshot qualification remain separate work.

The new `checkpoint.ts` authenticates canonical checkpoint and prefix bindings
against external authority pins and independently computed opaque payload digests
(`evals/sdk/checkpoint.md`). Its source and packed-consumer component pass.
It is not a state-restoration path.
Atomic publication, authenticated prefix replay and full checkpoint recovery remain owed.

`checkpoint-archives.ts` prepares canonical ordered archive receipt metadata and
its payload digest (`evals/sdk/checkpoint-archives.md`). Its endpoint is externally
supplied; actual files still require archive verification. It neither restores
state nor establishes anchor authority.

`npm run test:coverage` runs explicit, in-memory AST instrumentation over SDK and signer
source, checks complete counter maps and enforces the unchanged quality floors. Unimported
files count as uncovered; development and installed consumers use their existing paths.
Its initial failure, remediation and calibration evidence are in `evals/ci/coverage.md`.

The SDK also exports bounded `verifyArchive` with typed `ArchiveError` codes, continuation
identity and optional external head/byte pins. This verifies structure, not authenticated
snapshot state or policy replay; `docs/STORAGE.md` and `evals/sdk/archive.md` give the limits.
The compiled candidate supplies `solanaut-verify-archive` for the same read-only checks;
installed usage, JSON receipt and wrong-pin refusal are tested (`evals/sdk/archive-cli.md`).
External anchor sequence/head pins are checked within the archive and exposed by the
read-only command (`evals/sdk/archive-anchor.md`). Source authenticity and the deployed
program/enforced restore path remain owed; post-anchor history remains outside that pin's
coverage. ADR-022 proposes enrolment/rotation; no dependent program implementation exists.

The first Solanaut 1.0 change implements ADR-012 C in the existing guard: one REGROUND denial
from an earlier rule is tolerated; Keel's own denial or a consecutive REGROUND denial latches.
The predecessor comes from the record and is reconstructed in replay. Offline evidence and the
accepted historical replay breaks are in `evals/sdk/latch-c.md`; the funded devnet rerun is owed.
The SDK also has signed-policy preparation/verification and policy-aware history, restore,
replay and inspection (`docs/POLICIES.md`). Its profile binds the current evaluator and controller.
The release-only build stages a private compiled SDK (`docs/PACKAGING.md`). The isolated signer
and later Alpha paths remain specified, not built. Signer executor, RPC, host clock and
bounded Unix transport helpers have builder evidence (`docs/SIGNER.md`); they are not yet
an operational service or a qualified isolated deployment.
SDK control starts and responses now share the admission chain (`docs/REQUESTS.md`), preserving
status/report payloads and immutable answers. The method handler connects their journal,
deadline and coalescing paths; the operational service remains in progress.
Non-admission proposal errors now leave durable refusal history rather than an unrecorded
exception. They never replace signing history for an admitted decision (`evals/signer/refusal.md`).

A product and an office around it. The product is a transaction guard for Solana AI agents.
The office is the machinery that keeps the work honest: seven agent
seats, gates, standard procedures, records, and a knowledge vault.

```
Solanaut/                        (an Obsidian vault; open this folder, and the front page is kb/INDEX.md)
├─ packages/sdk/                 @solanaut/sdk: the guard (the product)
│   ├─ src/message.ts            message bytes → their parts: legacy, v0 (tables from pins only) and v1
│   ├─ src/base58.ts             the address codec, so decoding needs no library
│   ├─ src/classify.ts           a decoded message → its effects: outflows, denied instructions, fees, the intent key
│   ├─ src/pda.ts                program-derived and associated token addresses, offline
│   ├─ src/policy.ts             policy v1: validated (rule 0), frozen, hashed
│   ├─ src/signed-policy.ts, profile.ts   operator authorization and supported evaluator identity
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
├─ apps/onchain/src/scenes.ts    DEMO.md's scenes end to end through guardedWallet, with a real SIGKILL and restore
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
| Node.js | 26.7.0 (mise) | native TypeScript development; release-only JavaScript/declaration build |
| `@gubernaut/core` (Keel) | 1.0.1 | the loop controller: three numbers in, a posture out. **The SDK's only runtime dependency** |
| `@solana/kit` | 8.4.0 | dev only: the reference the decoder is checked against |
| `@solana-program/system`, `token`, `compute-budget` | 0.15.0, 0.17.0, 0.19.0 | dev only: the reference the classifier is checked against |
| `@solana/web3.js` | 1.99.0 | dev only in the SDK; the sandbox uses it, and so do the agent frameworks the adapters will wrap |
| `typescript` | 7.0.2 | typecheck and release-only compilation |
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
   intent in flight (an earlier attempt could still land, or is past its expiry with its outcome never reported);
   intent attempts exhausted; over a window cap (SOL, each mint, fees), counted at admission;
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
itself, and reports the outcome. What it only signs, it follows up by signature before the next check, and reports what
the chain says. A failed send is reported `failed` only when the RPC refused the bytes. `guardedSigner(signer, guard)`
checks and verifies the same way for a kit partial signer. Both throw
`SolanautDenied { rule, reason, decision }`.

**State** (`state.ts`) changes only by applying an entry. Given a `log` path, the record is a file (`record.ts`):
one JSON entry per line, synced before the guard answers, locked to one guard. On start the guard applies every entry
again, Keel included, and continues where it stopped; `replay(entries, policy)` recomputes every decision from its
bytes. Without a `log`, the record lives in memory.

Manual SDK ownership refuses stale markers. Explicit Linux kernel ownership holds a `flock`
through the writer's lifetime and keeps its mutex inode for safe competing restarts.
Established identities can refuse missing history with `create: false`; `docs/STORAGE.md`
describes the filesystem boundary. Short writes complete before sync; a failure closes the writer.
An optional request identity is committed with its decision; duplicate lookup returns that entry
without another evaluation. `docs/REQUESTS.md` describes this foundation and its lifecycle limits.
Checked signing facts share that chain: signed bytes/signature, send intent and immutable response.
They are journal evidence; the trusted SDK method does not perform a network send.
`apps/signer/src/core.ts` executes that lifecycle through supplied signing/RPC functions.
Its offline tests use fake RPCs; the operational Unix service and provider implementation are next.
`apps/signer/src/rpc.ts` supplies validated devnet reads, health, a single send and conservative
two-provider outcome evidence. Its operational wiring and live drills are next (`docs/RPC.md`).
Signer-host authority records source, deployment mode and anchored clock metadata. Its clock
helper advances monotonically; operational wiring and OS-isolation evidence remain owed.

**Defects:** every one found in review, D1 to D12, is closed (`docs/SPEC.md` §10). The open questions are in §12.

## 4. The workflows

| Workflow | Command | What it does |
|---|---|---|
| Test | `npm test` | the SDK and cockpit batteries; current run evidence is in `evals/` |
| The dashboard | `npm run cockpit -- --record <r> --policy <p> [--rpc <url> --squads <f>]` | the guard's record and the Squads limit, on 127.0.0.1 |
| The on-chain drill | `node apps/onchain/src/squads.ts --url <rpc> …` | a Squads v4 limit naming the agent's key, a stolen-key drill, the revoke timed |
| The demo's scenes | `node apps/onchain/src/scenes.ts --url <rpc> …` | the scenes end to end through `guardedWallet`, with a record for the cockpit |
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
- **What is not here yet:** a licence, and `programs/`. The on-chain drill, the scenes and the cockpit have run on
  devnet (`evals/onchain/squads-devnet.md`, `evals/e2e/scenes-devnet.md`).

## Changes

The signer recovery pass now isolates attempt failures and returns completion results while
still following signed bytes after pre-send refusal (`evals/signer/recovery.md`). This is
executor evidence; operational supervision remains owed.
The same-user host factory now composes protected signed history, ownership, clock,
recovery, handler and socket (`evals/signer/service.md`). Signing/RPC remain host-supplied;
installed/isolated operation and the existing implementation budget gate remain unachieved.
Consumers can use the distinct SDK socket sending client (`docs/CLIENT.md`) instead of
partial signing. Its compiled candidate exports and declarations have installed evidence;
the product service is still not qualified for installation.
CI now requires fixed maintained fault partitions in separate checkouts, each
sequential with exact inventory and source/workflow-restoration checks
(`evals/ci/bite-partitions.md`). The default local command runs every campaign.
Historical receipts remain retained; corrected CI-2 qualification remains owed.

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. |
| Draft 2 | 2026-09-30 | The verified review: the new documents and ADRs in the tree; the defects D10 to D12 found in this code; the proposed canary; milestones in place of dates. |
| Draft 3 | 2026-10-01 | The guard as rebuilt through milestone 2a.5: bytes decoded, instructions classified, policy v1, admission by rules 0 to 19, receipts, intents, the latch, a hash-chained record made durable and restored by replay; Keel verified by its bytes; sensor v1; the adapters; the on-chain drill, rehearsed; the cockpit; CI; the SDK's one runtime dependency. Then devnet: the drill, the scenes and the cockpit run there; D13 and D14 closed in the adapters and the intents. |

Internal owned checkpoint publication now authenticates and compares each candidate
with replay of the actual record and verified retained archive files. Live kernel
ownership and unchanged record boundaries are required through publication. Synced
atomic replacement retains the previous authenticated envelope; storage failure
fails the writer (`evals/sdk/checkpoint-publication.md`). Cadence, authenticated
restore/fallback and bounded retention remain separate unfinished paths.

The internal prefix rebuilder derives expected events through full history replay,
requires exact supplied bytes and feeds a fresh Keel controller ticks and resets.
Its next decisions are compared with full-stream controller replay in component
tests (`evals/sdk/checkpoint-rebuild.md`). Full authenticated guard restore and
bounded replay remain unfinished; no stored controller numbers are loaded.

Internal recovery preparation now verifies full signed history and optional external
anchor evidence before accepting a checkpoint or fallback. Verified checkpoint
prefix/tail events rebuild fresh Keel; current admission facts derive from full
replay. A missing/corrupt checkpoint cannot bypass history or anchor validation
(`evals/sdk/checkpoint-recovery.md`). Actual owner/startup integration and bounded
retention remain unfinished.

Internal owned recovery now obtains history and the current checkpoint through
the actual kernel-held record store. It bounds checkpoint reads, verifies recovery
and repeats ownership/history checks after replay. Publication and recovery share
maintenance exclusion (`evals/sdk/checkpoint-owned-recovery.md`). This returns a
read-only preparation receipt; live guard startup and bounded retention remain
unfinished.

The internal archive iterator now supplies immutable entries from bounded reads
with consumer backpressure. Natural completion verifies final source/pin checks;
early cancellation supplies no receipt. The public archive verifier fully consumes
this same core (`evals/sdk/archive-stream.md`). It remains structural verification,
not authenticated policy replay or bounded live state.
