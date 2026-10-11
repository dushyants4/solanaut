# HANDOFF.md — Claude to Codex, and back

> **Draft 1** · 2026-10-05 · from Claude, the session that built and verified the Beta, to Codex · for: Codex, the
> human, and Claude on its return · not public. The rules Codex works under: `AGENTS.md`. Register:
> `kb/DOCUMENTS.md`. Codex keeps §5, §6 and §7 current; everything else changes only when the human or Claude says so.

## 1. Where Solanaut stands at the transfer

- **Legs 1 and 2 are won.** The Beta MVP is built, verified and validated on devnet.
  - The human signed off its review on 2026-10-05 (`kb/milestones/2026-10-01_2b-beta.md`), and the commit carrying the
    sign-off is tagged `milestone/beta`.
  - The Alpha's scope (milestone 2c.1) is approved: `docs/SPEC.md` §13, ADR-013 to ADR-018, `docs/RISKS.md` 1.0, and the
    thresholds in `docs/READINESS.md` 2.0.
- **The guard, `packages/sdk`, decides in this order:**
  - it decodes legacy, v0 with pinned lookup tables, and v1 messages, denying an unknown version;
  - it classifies each instruction against an allowlist;
  - it applies rules 0 to 19 in order, with receipts and intents keyed by effects;
  - a latch stops it until the operator signs an ed25519 release;
  - Keel, its bytes hashed, reads sensor v1's numbers.

  The log is the state: a hash-chained record, synced before each answer and restored by replay.
- **Around it:**
  - adapters for Solana Agent Kit (`guardedWallet`) and kit (`guardedSigner`);
  - a Squads v4 spending limit on devnet, which bounds a stolen key;
  - a read-only cockpit on localhost;
  - the demo's scenes, run end to end on devnet.
- **Measured** (`PROGRESS.md`, `evals/README.md`):
  - `npm test` passes 161 of 161, and the typecheck is clean;
  - the boundary guard passes 59 of 59;
  - `kb_lint` and `claims_lint` report no errors;
  - CI is green;
  - defects D1 to D20 are all closed;
  - the independent evaluator run: 317 cases, and six defects closed test-first.
- **Still open in `docs/SPEC.md` §12**, for milestone 3.10 (RT-3): runs of failed outcomes, and loops that alternate
  shapes.

## 2. The human's decisions, and the standing ones

| When | Decision |
|---|---|
| 2026-09-30 | Devnet only. ADR-008, a capped mainnet canary, is deferred. Milestones, not dates. |
| 2026-09-30 | The licence, the judges' access and the Colosseum submission are set aside until testing is done. The submission window closes 2026-10-12, 11:59pm PT; whether to submit, and what, is the human's (T4). |
| 2026-10-01 | Outside agent CLIs are not run unattended from Claude's session. The human runs Codex here directly. |
| 2026-10-05 | The Beta review is signed off. The Alpha's scope is approved as drafted. ADR-012's option C is accepted. Leg 3 is handed to Codex. |

## 3. What Codex owns, and what it does not

| Codex owns | Not Codex's |
|---|---|
| building ADR-012 and milestones 3.1 to 3.9, test-first, each with its receipt | T4, every time (`AGENTS.md`) |
| measuring the Leg 3 thresholds (RT-1), and the loop battery for §12's questions (RT-3), proposing what the measurements show | RT-2, the independent red team: Codex builds the code, so Claude runs it on return |
| keeping `PROGRESS.md`, `docs/`, `evals/`, `kb/` and `runs/` true to the code | the Alpha's milestone review and the `milestone/alpha` tag: Claude, then the human |
| proposing an ADR when a choice falls outside the accepted ones | accepting an ADR, or changing a threshold: the human |
| | editing `AGENTS.md`, `CLAUDE.md`, `.codex/`, `.claude/`, the boundary policy or the gates: owed edits, §6 |

## 4. The work queue, in order

**Solanaut 1.0 mission, approved in this session on 2026-10-05:**
`docs/plans/2026-10-05_solanaut-1.md` extends this queue through individual Linux/devnet deployment
and all existing R.1–R.5 gates. The original repository is the eventual public repository.
A release-only JavaScript/declaration build is authorised; native TypeScript development remains.
Allocate snapshots, exclusive recovery, compatibility and lifecycle work before qualification.
Independent packaging and gate preparation can progress while architecture proposals await
acceptance. Mainnet and every T4 action remain separately human-owned.

Take the first item whose dependencies are achieved. Item 0 comes first, every session. The order puts first what
the demo and every later milestone lean on. The ADRs give the design, and `docs/SPEC.md` §13 the requirement IDs that
the tests are named by.

**0. Probe the fence, every session, before any other work.**
- **The patch probe.** Use `apply_patch` to create a file named `.env.hook-probe`. The tool must be refused with
  `BOUNDARY GUARD`.
- **The shell probe.** Run `touch .env.hook-probe`. It must be refused the same way.
- **If either file appears**, the hook is not running. Delete the file, stop, and tell the human: nothing else is safe.
- **Then record the baseline** in the run record:
  - `npm test` (161 at the transfer);
  - `npm run typecheck`;
  - `uv run --script tools/session_close.py`. Gates 6, 8 and 9 may read red until the session's record is written and
    pushed.

**1. ADR-012, option C: when REGROUND latches.** `design/ADR-012-latch-on-reground.md` is the specification.
- **The rule.** A denial at REGROUND latches the guard only when Keel is the reason (rule 17, `loop-reground`), or when
  the denial just before it was also at REGROUND. The run of denials latches as today.
- **"The denial before it"** is read from the record (the previous decision's `allow` and `posture`), so restore and
  replay rebuild it. Nothing new is stored.
- **Tests first:**
  - one REGROUND on an already-denied proposal does not latch;
  - two in a row do;
  - the streams of `evals/sdk/latch-variants.md` become a test that reproduces its table for option C.
- **Records made under today's rule** may not replay at the decision where they differ. The ADR accepts this as a
  one-time break. Say so in the receipt, and name each local or devnet record that stops replaying.
- **Then re-run DEMO.md's scenes on devnet** (`apps/onchain/src/scenes.ts`): scene 5 must no longer latch.
  - Withdraw S12's note that it does, in `docs/CLAIMS.md`, with the new receipt.
  - The keys hold little devnet SOL (§5): if the run cannot be funded, record the offline result, queue the funding,
    and move on.

**2. 3.1 · The signer process.** SIG-1 to SIG-11; ADR-013. This is the foundation of the rest of Leg 3.
- **Clarification accepted:** ADR-019 governs durable request lifecycle, exclusive ownership,
  snapshots, evaluator versions and RPC trust. The human accepted it after review.
- **The same-user mode is what you build and test.** Running it as its own OS user needs a user created with `sudo`,
  which is the human's (§5).
- **SIG-11 is a budget:** state the line count before writing, and measure it after.

**3. 3.2 · The operator-signed policy.** POL-1 to POL-5; ADR-014. Depends on 3.1.
- **Watch replay across a policy change** (POL-4).
- **ADR-012 left one decision for here:** whether records name the rules that made them. A record made under an older
  rule then replays under that rule, not today's. Decide it with POL-4's `policy` entry. If it needs more than ADR-014
  says, propose an ADR (§5).

**4. 3.3 · Token-2022 and token accounts.** TOK-1 to TOK-5; ADR-016. Depends on 3.1. Read
`kb/sources/` on Token-2022's authorities and the transfer-hook guide first.

**5. 3.9 · CI hardened.** CI-1 and CI-2. Depends only on 2a.1, so it can be done between any of the others.
- **The `bite` job** re-runs every gate's fault injection on every push.
- **Then the gates in `docs/READINESS.md`**, each seen failing first:
  - coverage, with the per-file branch floors;
  - StrykerJS mutation on the decoder and the policy;
  - fast-check properties, 10,000 runs each;
  - one million fuzz inputs;
  - 1,000 real mainnet transactions decoded against kit, read-only;
  - replay determinism on Node 22.18 or later, 24 and 26;
  - 100 kills;
  - 1,000 concurrent proposals;
  - performance.
- **A new dependency** is pinned exactly and recorded in `kb/REGISTRY.md`, and `npm audit signatures` must pass.

**6. 3.7 · The log anchor.** ANC-1 to ANC-5; ADR-015. Anchor 1.2.0, under `programs/solanaut_anchor`.
- **Deploying to devnet needs devnet SOL** that the keys do not hold (§5).
- **The verified build needs `solana-verify`,** which is not installed; Docker is. Installing it is a toolchain
  change: ask for approval with the exact command, and update `TOOLCHAIN.md`.
- **Include the `security.txt`.**

**7. 3.6 · The ElizaOS plugin.** ELZ-1 to ELZ-3; ADR-017. Pin `plugin-solana`'s published version, and test against
it.

**8. 3.4 · Opaque programs bounded.** OPQ-1 to OPQ-7; ADR-018. It needs Surfpool for the mainnet fork, and Surfpool
is not installed (§5).
- **Lighthouse's instruction set** is in `kb/sources/`.
- **If OPQ-6 cannot be met,** the Alpha ships with opaque programs denied, and says so (RK6). That is a result, not a
  failure to hide.

**9. 3.5 · Phantom paths.** PHX-1 to PHX-5. Depends on 3.1 and 3.4.
- **Build and test offline** whatever does not need the human:
  - the escalation record (PHX-2);
  - the MCP firewall's tool filter and its `networkId` check (PHX-3, PHX-4).
- **The human's part:** the co-sign in Phantom on devnet, and the separate OS user (PHX-5). Queue it in §5.

**10. 3.8 · Dashboard v1.** DSH-1 to DSH-4. Depends on 3.5. Operator actions are signed in Phantom, by the human, on
devnet.

**11. 3.10, preparation.**
- **Measure every threshold** (RT-1).
- **Run the loop battery** for runs of failed outcomes and alternating loops (RT-3). A proposed rule goes in an ADR,
  for the human.
- **Draft threat model v3.**
- **Leave RT-2 and the Alpha's review to Claude** (§8).

**If the human says the submission is near,** ask which items to bring forward. Nothing unmeasured goes into it.

## 5. Questions and requests for the human

SDK schema qualification finding (2026-10-11): existing Ajv/formats cannot
compile the pinned official CycloneDX schema strictly because a required format
is unsupported. `evals/release/schema-probe.md` preserves the failure before
artifact validation. Select and approve a pinned supported validator/formats
toolchain before installation/full qualification; no ignored-format waiver.

**H16 — failed-outcome/alternating-loop decision (2026-10-11).** Accept, reject
or revise `design/ADR-024-failed-outcome-budget.md`: an operator-signed cumulative
failed-outcome window budget, independent of shape and Keel tuning, with durable
latching and release epochs. S135 preserves the current non-stop findings.
Values must precede fresh qualification. No dependent policy/profile/state/signer
implementation before acceptance and no readiness gate changes. Generic
continuation is not acceptance; independent work may continue while this waits.

**H13 — hosted CI account availability (2026-10-09).** Exact archival run
`37949577048` cannot start any job. GitHub's annotations say recent account
payments failed or the spending limit needs increasing. The human account owner
must resolve the account setting; Codex makes no purchase or billing change.
Metadata, annotations and failed log retrieval are retained in
`evals/sdk/replay-command/hosted-0a199aa/`. No test execution, code failure or
passing hosted qualification is inferred from jobs that never started. H11's
separate baseline-wait proposal and all release gates remain required.

Phantom compatibility finding (2026-10-08): exact inspected stock MCP routes
return after broadcast. Client sign-only code exists, but live support and
nonbroadcast behaviour for the intended agent wallet remain unqualified; the
presign callback runs before the signature. Browser SDK embedded-wallet limits
do not establish exact CLI user-wallet permissions. Static receipts:
`evals/firewall/published-contract-current.md`, `evals/firewall/published-sdk-seam.md`.
Continue accepted offline filtering/preparation and qualification work; this
finding grants no replacement deployment contract or release exception.

Published-framework qualification finding (2026-10-08): the isolated ElizaOS
stable graph has unresolved high/critical advisories; a normally resolved patched
form-data peer fails ERESOLVE. No product dependency was added and no waiver is
requested. `evals/elizaos/published-routes.md` retains exact metadata, route probes
and remediation incompatibilities for upstream qualification. H9/H10/H11/H12
remain pending; resuming work does not accept those decisions.

**H12 — proposed devnet SDK preview scope/version.** A concrete private tarball,
installed offline walkthrough and claim-traced page draft are now reviewable in
`docs/PREVIEW.md`, `docs/PRODUCT-PAGE.md` and `docs/release/STAGED-RELEASE.md`.
Proposed public preview version: `0.1.0-devnet.1`, not applied. Human acceptance
of that scope/version is needed before release metadata changes; licence,
visibility, registry/page publication remain human decisions at the moment.
Current private metadata stays `0.0.0`/private. This preview does not satisfy or
relax stable 1.0 gates; source/history/notices review and exact hosted qualification
remain owed. Continue independent core/release work while these decisions wait.

**H11 — expanded real mutation-baseline harness wait.** Hosted 6d81f8b run
37654130653 still fails Node 22's unchanged baseline wait with serial execution.
Retained exact logs: `evals/sdk/checkpoint-bundle/hosted-6d81f8b/`. Proposed
edit in `evals/ci/mutation-recovery.test.ts`: replace
`const end=Date.now()+20000;` with `const end=Date.now()+60000;`, and update
the diagnostic to `staged baseline incomplete after configured harness wait`.
Keep every selected test, seed policy, mutation floor, actual completion check,
supervisor limit and product/readiness target unchanged. This is a proposal,
not an applied exception. Human acceptance is required before this wait changes.

Hosted 995c5b0 run 37664288112 repeats four unchanged-wait failures in the runtime
matrix and AST; maintained faults pass. Exact evidence:
`evals/sdk/checkpoint-rebuild/hosted-995c5b0/`. The wait proposal remains pending.

Hosted 0c61fa3 run 37662281431 confirms the same unchanged-wait failure in all
three runtime jobs and the AST job. Maintained faults pass. Exact logs and revision
metadata: `evals/sdk/checkpoint-publication/hosted-0c61fa3/`. The proposal remains
pending; neither the increased population nor successful local timing is approval.

Codex appends; the human answers in place. Open at the transfer:

| # | Asked | For | Request |
|---|---|---|---|
| H1 | 2026-10-05 | items 1, 6 | **Devnet SOL.** At the transfer the agent key held 0.032, the operator 0.277 and the treasury 0.059. The scenes' re-run needs about 1 SOL, and the anchor program's deploy several more. Fund `keys/devnet-operator.json`'s public key (`solana address --keypair keys/devnet-operator.json`) with 5 devnet SOL, from the faucet the human uses. |
| H2 | 2026-10-05 | item 8 | **Surfpool,** for 3.4's mainnet fork, is not installed. Approve installing a pinned release, and its line in `TOOLCHAIN.md`. |
| H3 | 2026-10-05 | item 6 | **`solana-verify`,** for 3.7's verified build, is not installed. Approve installing a pinned release. |
| H4 | 2026-10-05 | items 2, 9 | **OS users,** for the signer (ADR-013) and Phantom's MCP server (PHX-5), are created with `sudo` by the human, when Codex has the same-user modes working. |
| H5 | 2026-10-05 | Codex | **The machine-wide Gubernaut skills.** Six skills in `~/.agents/skills` load into every Codex session, this one included. `AGENTS.md` forbids them here; only the human can scope them to Gubernaut's own repository. |
| H6 | 2026-10-05 | every item | **Resolved on resume:** `gh run list/view` now work. Commit `2030ef7` CI passed, run `37397016363`. Historical baseline run `37369485468` failed because its office job was not acquired by a hosted runner; guard tests/typecheck passed. The transfer's green-CI statement was inaccurate for that run. No credential workaround used. |
| H7 | 2026-10-05 | Solanaut 1.0 foundations | **Accepted:** the human said “Go aheaaad, Continue the plan” after the explicit acceptance request for ADR-019 and ADR-020. Their dependent implementation may proceed. No readiness threshold or T4 permission changed. |
| H8 | 2026-10-05 | qualification | **External resources:** recruit outside developers, choose/fund the specialist audit and live bounty, and provide reliable devnet RPC for its soak. No contact or purchase made by Codex; all thresholds retained. |

| H9 | 2026-10-06 | signer completion / SIG-11 | **Decision requested:** accept or reject `design/ADR-021-signer-implementation-budget.md`. The partial signer is 501 lines under the recorded conservative count (402 app + 99 signer-specific SDK helper lines), before key loading and remaining operational work. Proposal: 1,000 physical lines across the same scope, with all other gates unchanged. Until acceptance the 500-line gate is not achieved and dependent expansion waits; independent work continues. |

| H10 | 2026-10-06 | anchor program / ANC-1 | **Decision requested:** accept or reject `design/ADR-022-anchor-enrolment-and-rotation.md`. Accepted ADR-020 requires operator enrolment/rotation, but ANC-1 still specifies only `anchor(head, seq)` without its ceremony account contract. Proposal: explicit enrol/anchor/rotate instructions with a stable operator namespace and preserved history. This changes the accepted instruction surface; no dependent program implementation until acceptance. Generic externally pinned archive verification is independent and can proceed. |

| H14 | 2026-10-09 | SNP-7 compact owned retention | **Decision requested:** accept or reject `design/ADR-023-bounded-owned-working-state.md`. Existing state/checkpoint/index construction retains full history; deleting maps would lose late lifecycle and duplicate-request evidence. Proposal: separately versioned compact owned checkpoints, verified disk consultation for evicted facts, explicit operator-owned active-decision/pending-control capacity with durable pre-admission refusal, and maintenance reconstruction for window extensions. No limit values, dependency, migration or signer expansion is authorised before acceptance; all readiness targets stay unchanged. Independent component and runtime work continues. |

| H15 | 2026-10-10 | proposed public history | **Decision/review owed:** settle the private-directory path classification in the exact be7d296 restored history before complete file-blob review. `evals/release/history-bytes.md` retains metadata-only scope and refusal. This is not a secret finding; no private contents are read or cited, no entries are skipped and no refs/history/drop bytes change. The human determines the proposed public scope and conducts any confidential review; generic resume is not permission to override private/key restrictions. |

## 6. Owed edits, to files Codex may not change

Codex appends one row for each edit it needs in `AGENTS.md`, `CLAUDE.md`, `.codex/`, `.claude/`,
`plugins/harness/hooks/`, `tools/boundary_guard.py`, `tools/session_close.py`, `tools/claims_lint.py` or
`tools/kb_lint.py`. Each row gives the exact text and why. Claude or the human applies them.

| # | File | Exact edit | Why | Applied |
|---|---|---|---|---|
| | | | | |
| O1 | AGENTS.md, build convention | Replace `TypeScript run natively by Node 26, with no build step; ESM;` with `TypeScript run natively by Node 26 for development; a release-only build emits JavaScript and declarations for npm consumers; ESM;` | Explicitly approved by the human in the Solanaut 1.0 mission. | no |
| O2 | evals/packaging/faults.ts | Exact unapplied diff: `evals/packaging/parallel-experiment/owner-draft.patch`; retain all fault declarations and original initial control, import the measured isolated runner and replace sequential mutation with its complete execution. Add `node --test evals/packaging/parallel-experiment.test.mjs` to maintained qualification and verify cleanup/partial refusal before acceptance. | S111 prototype catches the entire original population inside the unchanged outer deadline; S110 actual maintained gate remains failed. Extra original control and changed entry point need fresh owner qualification. No process limit or readiness target changes. | no |
| O3 | Proposed parallel package runner | Exact unapplied diff: `evals/packaging/parallel-lifecycle/corrected/termination-owner.patch`; send SIGTERM once per owned child group, escalate to SIGKILL after the declared grace if still live, clear escalation on close. Combine with O2 and freshly qualify unchanged full populations/entry point before adoption. | S114 observes ignored SIGTERM leaving the original proposed parent waiting. Corrected fixture refuses incomplete execution; missing/late escalation and false completion are caught. Nominal S111 completion is not universal termination evidence. Maintained gate/deadline remain unchanged. | no |
| O4 | .github/workflows/ci.yml | Exact unapplied diff: `evals/sdk/adapter-wire/owner-ci.patch`; use the existing pinned uv action in runtime jobs, pack the private SDK, execute actual installed ADP-1 cases and source/emitted fault trials. Retain all current steps, runtime matrix and limits. | D39's new wire boundary has local tests/fault evidence; protected CI needs owner application and exact hosted/runtime qualification. `git apply --check` accepts the draft. No deadline, assertion, population or threshold is weakened. | no |
| O5 | .github/workflows/ci.yml | Exact unapplied combined diff: `evals/sdk/adapter-buffer/owner-ci.patch`; supersedes O4's application by retaining its installed/source/emitted trials and adding D40 private-buffer installation and copy-omission trials. | Private raw-buffer ownership has local fault evidence. Existing pinned action, runtime matrix, job limits and earlier gates stay unchanged. Read-only patch validation passes; owner application and exact hosted/matrix qualification remain owed. | no |
| O6 | evals/ci/mutation-recovery.test.ts | Exact unapplied diff: `evals/ci/baseline-latency/owner-wait.patch`; H11's proposed 20,000→60,000 ms harness wait and diagnostic text only. Apply only after human acceptance. | Unchanged source reproduces H11; original staged child naturally passes 573 cases in 22.223 seconds. Generated review copy passes all six original recovery cases. Backend, selected population, seed, score/readiness targets and completion checks stay unchanged. Current gate remains failed; matrix/hosted/maintained qualification follows owner application. | no |
| O7 | .github/workflows/ci.yml | Exact unapplied combined diff: `evals/sdk/adapter-batch/owner-ci.patch`; supersedes O5's application while retaining D39/D40 steps and adding D41 source/emitted/installed batch trials. Apply only after D41 product integration qualifies. | Local prepared component catches membership omissions. Full native still fails H11, so D41 remains unintegrated; source trials deliberately refuse the original product. Read-only patch validation passes. Matrix, limits and existing checks remain unchanged; exact hosted qualification stays owed. | no |

| O8 | .github/workflows/ci.yml | Exact unapplied independent diff: `evals/release/history-bytes/owner-ci.patch`; add pinned existing uv action and the nested PUB-1 content tests/faults to runtime jobs. Merge additively with other owed runtime-step drafts. | Thirteen component cases and nine omission trials are local proof. Read-only patch validation passes; all existing steps, matrix and limits remain. Actual history still refuses H15; this step cannot grant publication clearance. Owner application and exact hosted qualification remain owed. | no |

| O9 | evals/ci/kills.ts | Exact replacement in `evals/release/installed-kills/owed-edit.txt`: after `assert.equal(recomputed.ok, true);`, add `assert.equal(recomputed.decisions, guard.entries().filter((entry) => entry.kind === "decision").length, "replay decision count differs");` before `result.replayed++;`. Retain maintained seed, deadline and population. | S140 confirms successful zero-count replay escapes the original installed battery. Separate proposed-copy proof on a predeclared fresh seed catches inconsistent counters and passes installed recovery. Counts still assume a trusted replay backend; owner application and maintained/hosted qualification remain owed. No target is lowered. | no |
| O10 | evals/packaging/packed-sdk.test.ts | Exact unapplied diff: `evals/packaging/archive-head-declaration/owner.patch`. After the existing typed anchor example, add `const headCode: ArchiveErrorCode = 'head';` and `void headCode;` inside the same consumer fixture. Retain every earlier case/assertion/deadline. | S154 confirms removal of head from a copied actual D40 declaration escapes all maintained package cases while anchor removal fails the typed case. The proposed copied fixture catches head removal and passes the actual archive; read-only patch validation passes. Current product type is intact. Owner application and maintained/hosted qualification remain owed. | no |

## 7. Codex's log

2026-10-11 records unresolved RPC diagnostic redaction D42/S156 in
`evals/signer/rpc-redaction.md`. Malformed fake response bodies propagate synthetic
private text into read/send refusal and health; both existing runtime populations
retain failures. No real credential or deployed exposure is found. Explicit
fixture typecheck and contextual suggested-patch validation pass, but the patch
is unapplied and H11 prevents product integration. Retain all original RPC gates.
Separate copied correction/reproducer passes the privacy and complete relocated
RPC cases on both existing runtimes and catches both catch-site omissions.
Original product tests stay red; full integrated/maintained qualification remains owed.

2026-10-11 completes scoped builder reason allocation for the frozen named-test
modifications in `evals/release/assertion-reasons-complete.md`, S155. Remaining
consumer patches are read in full and exact references bound. Initial additions,
supporting/later/public history and Claude's independent judgement remain owed;
S150 remains its original checkpoint. Initial index schema/reference corrections
and copied fault refusals are preserved. O10/H11 and stable gates stay open.

2026-10-11 installed archive declaration diagnostic is in
`evals/packaging/archive-head-declaration.md`, S154. Removing the copied head
type member escapes all maintained consumer cases; anchor removal is caught.
The proposed copy retains both examples and catches head removal; O10 is owed.
Current product type is intact. Broader consumer history was inspected only at
replacement blocks and remains unqualified.

2026-10-11 smaller historical assertion reasons and current focused checks are
in `evals/release/assertion-other.md`, S153. Explicit kernel recovery replaces
dead-PID takeover under accepted ADR-019; other changes retain prior checks and
add finality/capture/alias/evidence refusals. Supervisor KILL's separate child
containment remains a limit. S150's earlier map does not yet index this receipt;
packed-consumer/broader/Claude review and stable gates remain pending.

2026-10-11 mutation-staging assertion reasons and current copied-policy control
are in `evals/release/assertion-stage.md`, S152. Expected file membership grows
without removing earlier cases; explicit absent assertions remain identified.
S150's earlier frozen map does not yet index this receipt. H11/O6 and complete
mutation/independent/stable qualification remain pending.

2026-10-11 coverage assertion modification reasons and current checker controls
are in `evals/release/assertion-coverage.md`, S151. Additions retain every prior
critical-file deficit and extend firewall checks without changing floors.
S150's earlier frozen map does not yet index this receipt. No fresh instrumented
coverage, independent approval or stable milestone advance follows.

2026-10-11 scoped assertion-reason index and remaining queue are in
`evals/release/assertion-review-map.md`, S150. Exact edges link to builder receipts;
copied duplicate/foreign/range faults refuse. Initial additions, broader history
and Claude's independent review remain open. Reference counts are not release
progress; all public/independent/stable clearance flags stay false.

2026-10-11 signer assertion modification reasons and current focused checks are
in `evals/release/assertion-signer.md`, S149. Retain deadline/refusal/recovery and
typed saturation checks, corrected trickle framing and earlier fixture failures.
The original recovery receipt's lost scratch output remains a limitation.
Same-user/fake-RPC evidence does not resolve H9, H11 or stable qualification.

2026-10-11 private owned-guard assertion reasons and current facade/signing
checks are in `evals/release/assertion-owned.md`, S148. Exact private-surface
additions preserve hidden-history/immutability checks; caller reports remain
distinct from authoritative signer evidence. Earlier stalled-fixture evidence
remains. Broader/Claude review and all release gates remain pending.

2026-10-11 selected storage/checkpoint assertion reasons and current focused
checks are in `evals/release/assertion-storage.md`, S147. Shared-policy cloning
and checkpoint-inode fault scoping preserve the intended mutation/refusal cases;
storage additions strengthen evidence checks. Broader/Claude review, H11 and
release gates remain pending; no protected test or milestone changes.

2026-10-11 selected interface/history assertion reasons and current focused
checks are in `evals/release/assertion-interfaces.md`, S146. Original refusals,
timeout and coverage checks persist or strengthen in this selection. Current
focused results do not replace H11, broader history or independent qualification;
no protected test or stable milestone changes.

2026-10-11 selected package-consumer assertion reasons are in
`evals/release/assertion-packaging.md`, S145. Preserve complete selected patches
and exact revision/diff hashes. The expanded spawn arguments retain their
original deadline; existing refusal checks are distinguished from additional
coverage. Broader/Claude review remains pending; no gate or milestone changes.

2026-10-11 builder-reviewed historical mutation-recovery test reasons are in
`evals/release/assertion-recovery.md`, S144. Literal expected pins match each
same-revision runner; full patches remain. Existing wait, completion/refusal
assertions and corrected teardown semantics are distinguished. Broader/Claude
review remains pending, O6 is unapplied and H11 still fails. No milestone advances.

2026-10-11 named-test assertion-review preparation is in
`evals/release/assertion-history.md`, S143. All-parent metadata includes edits
to tests added after Beta; synthetic omissions and false-review completion
refuse. Net baseline-existing durable assertion changes have their accepted
ADR-019 reason recorded in the continuing run. Historical edge content/reasons
and Claude's independent review remain pending; H15 is unchanged. No milestone advances.

2026-10-11 current installed SDK scoped timings complete, S142. Freeze fresh
candidate identities with unchanged workload/analysis; archived pins and planted
incomplete replay refuse before healthy memory/file measurement. Actual persisted
bytes replay separately. All samples, exact compressed history and metadata remain.
No isolated before-log/restart/dashboard/reference-baseline/full performance or
stable qualification follows; H11 and external requirements remain.

2026-10-11 original queued-admission workload passes through the installed SDK,
S141. Complete cap, identity and amount faults refuse before restored existing
runtime controls. Bound inputs remain unchanged and consumer/job finish. This
is synchronous SDK admission after a JS barrier, not isolated/parallel service
qualification. H11 and O9 remain; no stable milestone advances.

2026-10-11 installed crash recovery confirms a replay-count blind spot, S140.
Original seed still reports complete replay after an injected zero-count success.
Separate proposed-copy analysis on a predeclared fresh seed catches inconsistent
results before restored existing-runtime controls. O9 is unapplied; maintained
gate, thresholds and product stay unchanged. No stable milestone advancement.

2026-10-11 qualifies original mixed replay through the installed SDK, S139.
Unchanged workload/head and complete generated histories refuse installed faults,
including internally consistent landed substitution. Existing-runtime controls
pass after exact restoration; inputs match and consumer/job finish. No persisted,
snapshot, isolated-service, full CI or stable milestone credit; H11 remains failed.

2026-10-11 qualifies the installed current SDK against the original frozen real
corpus, S138. Import/location-only relocation preserves comparator and gate
semantics; complete installed fault populations fail before restored controls on
existing runtimes. Product/reference/corpus/archive hashes remain unchanged and
the consumer/job finish. No fresh population, Token-2022, isolated/live signing,
full runtime/hosted/AST or stable milestone credit.

2026-10-11 reconciles THREAT-MODEL Draft 6 with current loop, prepared D41,
recovery/core/package and publication/schema findings. Historical D21 gate
results remain scoped to their revision. All proposed ADRs and independent
obligations stay explicit; this is not Alpha or specialist review.

2026-10-11 strict schema qualification attempt fails during compilation, before
artifact validation, S137. Existing tools, official hashed scratch schemas and
exact raw refusal/input identities are retained. Permissive exploratory warnings
are not accepted as evidence. No install, gate weakening or milestone credit.

2026-10-11 retains npm's package-root naming finding and a separate derived SDK
inventory draft, S136. Manifest, actual archive hashes, dependency edges and
runtime lock integrity agree. Tests fail first; copied faults are caught without
mutating measured originals. No full schema/licence/provenance/R.1 clearance,
source/gate/version changes or milestone credit. Raw S133 remains intact.

2026-10-11 proposes ADR-024 for remaining RT-3 questions, H16. It specifies
global failed-report counting, source trust, durable latch/release epochs,
policy-history reconstruction and compatibility, with fresh evaluation/fault
obligations. No defaults, source/gate change, acceptance or milestone credit.
Architect-seat references `kb/PATTERNS.md` and `kb/GAPS.md` are absent here;
no other workspace is searched or consulted.

2026-10-11 original synthetic traffic reproduces its benign pass and known
RT-3 limits on the current product: alternating/distinct failed outcomes still
have no refusal within the original horizons. S135 preserves both findings,
full raw postures and unchanged source/domain/seed identities. Original controls
and typecheck pass. No tuning, new statistical sample, universal stop claim or
stable milestone credit follows; the accepted review/architecture process stands.

2026-10-11 current SDK original acknowledged kill/replay and same-event-loop
admission workloads complete with frozen source/fixture hashes unchanged, S134.
Existing validator controls/typecheck pass and all owned workers finish. Exact
receipt retains original definitions, complete logs and scope: no power-loss,
isolated signer, bounded restart, full CI or stable milestone follows.

2026-10-11 current private SDK consumer inventory preserves npm's actual
missing-dependency refusal before the healthy control. Component versions,
dependency edges and SDK tarball hash agree, S133. The original report keeps its
synthetic consumer root and absent SDK licence; it is not relabelled as a frozen
package-centred R.1 artefact. No licence, metadata, product/gate, publication or
stable milestone changes. Complete per-package release SBOMs remain owed.

2026-10-11 current frozen source completes the unchanged million-input fuzz,
seven source properties and Node 26/24 mixed replay workloads. Actual installed
D40 public decoder exports pass identical property domains on both runtimes,
after three isolated named faults fail first and restore exactly. S131/S132
receipts retain raw completions, definitions, process identities and oracle
scope. Typecheck and existing validator controls pass. No shared source or
protected gate changes; H11, full CI and every stable/external gate remain open.

2026-10-11 current D40 release builds and packs match under existing Node 26/24
despite different npm versions; each original installed package suite passes.
Four comparison substitutions refuse, frozen inputs match and the previous D41
scratch stage restores exactly. `evals/release/runtime-builds.md`, S130 retain
full scope and raw proof. No installation, product/gate/version change, Node 22,
full CI, provenance, public release or stable milestone credit follows.

2026-10-11 PUB-1 evidence output finding: maintained runner accepts a directory
symlink and redirects writes. Workspace-only regression fails; exact proposed
edit is `evals/release/history-output/owner.patch`, with separate candidate/control
and omission/late-check proof in the receipt. The evaluator does not fix the
maintained runner it reviewed; owner application and additive CI qualification
remain owed. No private contents or external paths are accessed. S128/H15 scope
refusal, H11 and stable gates remain unchanged. Product and protected gates do
not change; local-only commits and verified backups continue.

2026-10-10 PUB-1 content companion from clean backed-up be7d296: initial
stub failures, a missed size omission and strengthened diagnosis are retained.
Thirteen final component cases pass on existing Node 26/24; nine omissions
are caught with exact restoration. Actual restored history refuses sensitive
path metadata before file-blob reads, H15. Structured metadata/refusal and
source pins are retained; no entry is skipped and no contents are quoted.
The root native baseline still fails only H11; typecheck passes. O8 is an
unapplied additive CI draft. No product, gate, publication or milestone changes.

2026-10-10 D41/ADP-1 from fc3caff: reproduce wallet reversal/removal releasing
visible valid signing and caller array edits changing admission membership.
Prepare private membership before awaits and a separate wallet array; component,
source/emitted and actual installed checks pass. Original and corrected full
native fail H11's unchanged wait. Preserve exact candidate/source/test/raw evidence
without integrating product or applying O7. No push or stable milestone credit.

2026-10-10 current e715238 SDK timing: first prove the old source pin refuses
the changed wallet adapter; bind the correction without changing the workload.
Both actual profiles reproduce the original head and exact persisted bytes.
Controls, omissions, substitutions and corrupt-history refusal are retained.
Memory p99 is slower than the earlier run; no tuning/replacement or reference
regression pass follows, CLAIMS S126. Product/gates remain unchanged and formal
milestone accounting stays open; local-only commits/backups continue.

2026-10-10 D40 integration from 11234cc, committed locally as e715238:
complete local bundle/exact clean restore/full integrity check succeed. Six fresh tests-first failures,
source/emitted copy omissions and actual installed cases qualify the preserved
exact correction without overwriting original receipts. Rebuilt archive and all
original candidate hashes match. Full native/type pass; serial coverage still
fails H11. The accepted ADR-009 implementation is corrected locally; independent,
maintained/hosted and stable gates remain open, CLAIMS S125. Existing Node 24
full native also fails only H11; its typecheck and final binding pass. O5 stays unapplied.

2026-10-10 frozen SDK timing on 1633231: original mixed replay workload is measured
sequentially with memory and actual synced file stores. Both reproduce the frozen
history; separate actual persisted-byte replay passes and corrupted hash refuses.
First failures and validator/input faults are preserved, CLAIMS S124. No pre-log
isolation, isolated signer, snapshot restart, dashboard or full performance gate
is claimed. H11/package/human gates and formal milestone accounting remain open.

2026-10-10 current-task diagnosis on e7d92e1: no Solanaut worker is initially
running, clean local-only tree. Original full native again fails H11. An unchanged
staged child naturally passes the complete population after its unit wait;
original finish verifies actual completion. Exact owner wait proposal O6 and
generated-copy proof are preserved; human acceptance remains required. Latest
hosted annotations again report account billing/spending refusal before steps.
No rate-limited devnet operation, gate modification or milestone progress follows.

2026-10-10 D40 preparation is committed as 001c6c9 with raw-evidence whitespace
finding recorded at 69ada72. Complete local bundle/exact clean restore/full Git
integrity verify; clean close passes nine of ten, only unpushed HEAD fails.
Then the preserved patched archive passes all six installed Node 24 cases;
three installed copy omissions are caught and exact restoration/control pass,
S122. No source or earlier runtime evidence changes; D40/H11 remain open.

O5 application depends on D40 source/test integration and fresh complete gate
qualification; its exact draft is not an executable substitute for that work.

D40 final disposition: both full native runs and quiet AST fail the unchanged
H11 wait. Preserve all failures/counters and exact candidate source/test patch
in adapter-buffer, S121. Restore original product/test inputs; the private-copy
correction is **prepared, not integrated** until required full checks pass.
No deadline change, native pass, milestone, public preview or waiver follows.
O5 remains a read-only validated unapplied combined CI draft.

2026-10-10 S120 evidence committed as 32abc73; complete local bundle verifies,
exact restore is clean and full Git integrity succeeds. Clean close passes nine
of ten, failing only intentionally unpushed HEAD. No remote action occurs.

D40/ADP-1 reproduces raw-buffer aliasing at admission and RPC handoff. Six first
failures are preserved separately; privately copy each capture. Source/emitted
omission trials and actual installed public export pass; prior S119 evidence is
not overwritten. Public methods and SDK/key/RPC trust remain unchanged.

2026-10-10 the actual unchanged full maintained runner on 71a1ef4 attempts every
campaign and fails mutation recovery and packaging, skipping none, S120.
Preserve aggregate/raw failures and interrupted emitted request-index bytes;
release rebuild restores every bound candidate identity and typecheck passes.
H11/O2/O3 remain owed; no waiver, gate change, push or milestone credit.

2026-10-10 D39/ADP-1 demonstrates unchecked serialized wallet bytes reaching RPC.
Correct by capturing one wire and verifying its message/signature before send.
A further destructive serializer exposes premature reservation release in the
first correction; preserve that failure and keep verified signing unknown even
after erasure. Source/emitted faults, actual installed cases and native/type
checks pass. Quiet serial AST and existing floors pass for this exact candidate,
CLAIMS S119; earlier H11 failures are preserved. Public methods and signer-specific
scope remain unchanged; hosted/maintained/full release qualification stays owed.
No push or stable milestone closes.

2026-10-10 f4f3d92 evidence commit has verified complete local bundle, exact clean
restore and Git integrity check. Clean close passes nine of ten, failing only
intentionally unpushed HEAD. Existing PUB-1 inspector inventories the named
restored ref set and its complete reachable closure, CLAIMS S118. Original refs
and human drop stay unchanged. Content/rights/secret/licence/publication review
and the final public scope remain human-owned; no stable milestone closes.

2026-10-10 combined O2/O3 generated entry rejects a damaged CLI in its retained
original extra baseline, then the healthy full unchanged campaign passes,
CLAIMS S116. Actual protected entry remains unchanged; owner application and
fresh maintained inventory qualification are owed. Repeated same-host private
build/pack matches current bytes, modes and archive, CLAIMS S117; altered
comparison manifests are refused. No release freeze, milestone or push follows.

2026-10-10 full corrected parallel proposal completes in a generated copy with
unchanged original fault/installed populations and outer timeout, CLAIMS S115.
Healthy initial/restored worker controls pass; original stage bytes/modes and
every bound current candidate identity match. Exact original prototype/gates
are unchanged. O2/O3 owner application and fresh maintained entry qualification
remain owed; no stable milestone closes or push occurs.

2026-10-10 proposed parallel-runner interruption probe finds ignored SIGTERM
leaves children and parent waiting. Strict CI-2 acceptance fails first. Generated
corrected copy stops its owned groups and refuses incomplete execution; three
planted faults are caught, with complete controlled cleanup. Exact termination
draft is owed as O3, combined with O2 before fresh full qualification. No actual
gate/product change or stable-release credit. S114 records scope and limitations.

2026-10-10 exact f1e253f current Node 24 native/type/installed checks and new
compiled lifecycle faults pass. Current Node 26 direct package campaign passes;
its standalone invocation does not qualify the maintained enclosing deadline.
Quiet Node 24 AST again fails only the unchanged H11 wait. Preserve every runtime
output separately and restore earlier helper output locations byte-for-byte.
All current bound identities match; CLAIMS S113. No installation, push or stable
release claim; H9/H11/H14 and external gates remain pending.

2026-10-10 private owned signing-history operation under accepted ADR-019 queues
captured events and delegates the existing verifier/synced append. Absent-method
and frozen-surface failures are retained; source/emitted faults and actual offline
installed private facade pass. Full native passes. No key loading, signer execution,
broadcast, root export or socket method. Complete lifecycle, conservative signer
budget, bounded retention and stable-release qualification remain owed.

S112 records exact native/component successes and the quiet AST failure at
the unchanged H11 wait. No coverage-floor or complete maintained-runner credit.
All product/evaluation/emitted/archive identities remain bound and unchanged
after fault restoration. Private queued journalling is ready for review only.

2026-10-10 isolated package prototype completes under the unchanged outer
deadline with all original faults and installed cases, cache disabled, and
healthy initial/restored worker controls, CLAIMS S111. Validator fault testing
first misses control/footer defects; both misses are preserved, new tests fail
against the mutants, and strengthened tests catch every validator fault.
Exact runner/candidate identities restore. The maintained gate remains failed;
unapplied owner draft is owed in §6. No push or stable-release claim.

2026-10-10 package execution prototype: maintained failures are locally committed
as 826d058, with verified bundle/exact clean clone/full fsck. Clean close passes
nine of ten, failing only deliberately unpushed HEAD. Test isolated parallel
copies with the entire existing fault/installed populations and original outer
limit, cache disabled. Qualification is pending; the maintained gate stays
unchanged and failed. Any protected edit goes to its authorised owner.

2026-10-10 calendar continuation: preserve the previous day's run and add the
current-day continuation required by the unchanged close checker. Maintained
fault results remain failed as in CLAIMS S110; no calendar override, approval
inference or gate change. Local archival commit/backup follows, no push.

2026-10-09 maintained runner: runtime/retention records are locally committed as
`227b0bb`, with verified bundle/exact clean clone/full fsck. Clean close passes
nine of ten, failing only deliberately unpushed HEAD. Run unchanged maintained
fault partitions against that exact candidate, preserving process limits,
source identity and all failures in `evals/ci/bite-current.md`. Individual script
passes do not qualify the runner. No remote push or gate relaxation.
Actual uncached partition two fails only the package campaign, with none skipped.
The source fingerprint matches; an interrupted emitted module differs and is
rebuilt before reuse. Same-limit diagnostic reproduces ETIMEDOUT/SIGTERM, CLAIMS
S110. The separate scratch-cache invocation also times out; no remedy or cache
status is inferred. Restore all bound emitted identities before reuse. Other
maintained partitions complete: all 65 campaigns execute with none skipped.
Partition three passes; partition one fails mutation recovery's unmodified
baseline at the existing H11 wait, before its faults run. Final source and bound
identities match and typecheck passes. Complete maintained qualification fails.

2026-10-09 bounded-retention design: inspect current state, checkpoint and index
construction. Propose ADR-023/H14 before changing compact format or resource
admission; retain late replies, unresolved reservations, complete negative lookup
and policy-window reconstruction. No dependent implementation or threshold
change. Architect-seat references `kb/PATTERNS.md` and `kb/GAPS.md` are absent
in this repository; do not search another project's workspace for them.

2026-10-09 Node 24 follow-up: queued trusted reports are locally committed as
`4addaa4`, with verified bundle, exact clean clone and full fsck. Clean close
passes nine of ten, failing only deliberately unpushed HEAD. Qualify the exact
candidate in the already installed Node 24.19.0 environment; retain definition
45, prior inputs, floors, waits and limits. No installation, remote push or
H9/H11 acceptance. Evidence is `evals/release/node24-owned-report.md`.
All 879 native and nineteen installed cases pass; typecheck passes. Quiet serial
AST executes 879: 878 pass and the unchanged staged wait fails, with no floor
pass. All 144 retained compiled faults catch/restored and bound identities
match. Frozen mixed-history replay matches its existing digest under both local
runtimes, CLAIMS S109. No complete matrix or stable qualification.

2026-10-09 private trusted report: crash receipt is locally committed as
`ae6ba56`, with verified bundle/exact clean clone/full fsck; clean close fails
only unpushed HEAD. Add queued trusted SDK outcome reporting under ADR-019,
without root/socket exports or authoritative RPC claims. Preserve seven absent-
method failures and the FIFO fixture stall/targeted test termination; release
the artificial gate in `finally`. All prior cases/faults remain. Definition
45/seed 45691 retains earlier inputs/limits. All 879 native, 23 focused and
nineteen installed cases pass; 39 source and 144 compiled faults catch/restored,
with final typecheck and bound identities matching. Quiet serial AST executes
879: 878 pass and the unchanged staged wait fails; no floor pass. Broader qualification continues
without H9/H11 acceptance, signer expansion or remote push.

2026-10-09 crash qualification: post-sync identity is locally committed as
`49f6d63`, with verified bundle/exact clean clone/full fsck. Clean close passes
nine of ten, with only unpushed HEAD failing. Run the existing real 100-kill
workload without changing seed/definition/limits after other workers stop.
Current `.sandbox/` filesystem reports Btrfs; keep this scope separate from
historical ext4 results. All 100 kills/recoveries/replays pass; preserved exemplar,
trial digests and frozen inputs match, CLAIMS S107. No power-loss, exhaustive
signer-boundary or independent claim. Local archival commit/backup follow;
no push or human decision is inferred.

2026-10-09 post-sync identity: physical length correction is locally committed
as `3fe0f0d`, with verified source-history bundle and exact clean clone/full fsck.
Clean close passes nine of ten, with only unpushed HEAD failing. Actual journal
and mutex replacement during append first acknowledge in both modes. Recheck
both identities after sync before cache mutation, preserving foreign markers.
Definition 44/seed 44317 retains earlier inputs/limits; source and installed
failures remain. Native/type/source/compiled pass with exact restored identities;
quiet serial AST fails the unchanged staged wait. Local commit/backup and the
existing crash battery follow without H9/H11 acceptance, signer expansion or push.

2026-10-09 physical append completion: `72dde39` runtime evidence is locally
committed, with verified bundle/exact clean clone/full fsck. Clean close passes
nine of ten, failing only unpushed HEAD as required by the user. Reproduce
missing/extra physical append acknowledgement; check post-sync size delta before
cache mutation. Preserve the moved sync-fault site diagnostic and nonempty-
journal test miss, then add positive controls without changing the checker.
Definition 43/seed 43907 retains prior inputs/limits; native/type/source/compiled
pass with exact restored identities. Quiet serial AST fails the unchanged staged
wait; no complete coverage/floor pass or stable gate follows. Local commit/backup
follow under ADR-019 without H9/H11 acceptance, signer expansion or push.

2026-10-09 exact `701372e` Node 24 follow-up: already installed runtime passes
native/type/installed and all retained compiled faults with restored identities,
CLAIMS S104. Quiet serial AST fails the unchanged staged-baseline wait; archive
raw reports/output without claiming complete coverage. Product pins, workload
limits and signer surface remain unchanged. Implementation's local bundle and
exact clean clone/full fsck verify. Post-commit close saw newly started runtime
evidence and correctly failed dirty/unpushed; no clean close is inferred. Updated
release evidence map keeps bounded state and independent/human gates explicit.

2026-10-09 read completion: startup consistency is locally committed as
`67948e6` with verified source-history bundle and exact clean clone/full fsck;
post-commit close fails only unpushed HEAD. Reproduce short read results
truncating acknowledged entries. Check raw byte count before repair and use byte
newline offsets, preserving genuine torn UTF-8 recovery. Source/installed first
failures and the decoded-count fault's initial diagnostic mismatch are retained;
strengthen the positive assertion, keeping the strict checker unchanged.
Definition 41's full fixture/wait failures remain archived. Scope checkpoint
faults/counters to their actual inode while retaining every fault/assertion;
definition 42/seed 42719 retains earlier inputs/limits. Corrected native/quiet
serial AST each pass all 862 cases, unchanged floors and typecheck pass, all
source/compiled faults catch and bound restored identities match, CLAIMS S103.
No H9/H11 acceptance, signer expansion, stable milestone or remote push follows.

2026-10-09 startup consistency: alias correction is locally committed as
`84cac38`, with verified bundle, exact clean clone/full fsck and close failing
only unpushed HEAD. Reproduce startup acceptance of stale read bytes when the
journal changes during descriptor reading. Add descriptor metadata and current
inode verification before parse/torn-tail repair under ADR-019. Source and
installed previous-candidate failures remain retained. Definition 40/seed 40529
adds startup cases while retaining every previous input/limit. Qualification
passes native/type/source/compiled with exact bound restored identities, CLAIMS
S102. Quiet serial AST fails the unchanged real-baseline wait; complete coverage
remains open, without accepting H9/H11 or changing the signer surface.

2026-10-09 ownership alias follow-up: Node 24 evidence is locally archived as
`8b1d29d` with its verified Git bundle. Reproduce hardlinked journal/mutex startup
acceptance; separate journal pathnames obtain separate locks. Add single-link
descriptor/named-inode checks under ADR-019, preserving cleanup and mutex evidence.
Source/installed first failures are retained in `evals/sdk/record-alias.md`.
Definition 39/seed 39743 retains earlier inputs/limits and adds the alias cases.
Source/compiled/native/typecheck pass with exact bound restored identities,
CLAIMS S101. Quiet serial AST fails the unchanged staged-baseline wait; complete
coverage remains open, without H9/H11 acceptance or signer expansion.

2026-10-09 Node 24 compiled follow-up: all retained compiled trials catch and
the restored installed baseline passes, CLAIMS S100. Exact bound product/input/
emitted-file/archive hashes match afterwards. Corrected archive `12e3895` has a
verified complete-history bundle and exact clean clone/full fsck; post-commit
close fails only unpushed HEAD. Continue local core work; all outstanding human,
Claude, audit and stable gates remain.

2026-10-09 archival correction: Node 24 evidence commits as `f5380fb` before
the pre-commit output is inspected; close rejects S100's mise-prefixed grammar.
Preserve this workflow failure. Add underlying npm/node commands within the
explicit existing Node 24 context and re-run close before corrective local commit.
No protected linter, tested implementation, input definition or result changes.

2026-10-09 Node runtime follow-up: D33 is locally committed as `fba638a`; its
complete-history bundle and exact clean clone/full fsck pass. Close fails only
unpushed HEAD under the latest direction. Inventory identifies Node 24.19.0 already
installed, so qualify unchanged native/installed populations with that runtime
and the restored private candidate. Preserve Node 26's serial AST wait failure;
Node 24 native/AST/typecheck/installed checks pass with exact bound identities,
CLAIMS S100. No H9/H11 acceptance, complete runtime matrix or stable gate is inferred.

2026-10-09 live record consistency: operator release is locally committed as
`7a64856`; its bundle verifies and an explicit `main` checkout restores exact
clean HEAD with full fsck passing. The initial clone lacked a default HEAD;
preserve that setup failure. Post-commit close fails only pushed HEAD, required
by the no-push direction. Reproduce D33 in both ownership modes; add live size/time
comparison and permanent failed-store regressions under ADR-019. First fixture
uses the wrong option, then corrected cases fail on acknowledged damaged history.
Initial size fault misses under redundant timestamp checks; stale timestamp
injection makes byte-count checking independently falsifiable. Failed-store fault
also misses behind the guard's shutdown; add a direct store assertion. Definition
38/seed 38653 retains prior inputs/limits, selecting the additional storage cases.
Native/typecheck/source/compiled checks pass with bound restored identities,
CLAIMS S99. Quiet serial AST fails the unchanged real-baseline wait, so complete
coverage qualification remains open. No human proposal is accepted by continuation.

2026-10-09 continued private lifecycle: from clean local `46922d5`, fresh probes
refuse and context/fetch are verified. Queue operator release-text preparation
and captured-signature release under ADR-019/existing latch rules. Preserve
first source/installed API failures, rule-field fixture correction and the
overbroad FIFO trial failure; the strict checker stays unchanged. Definition
37/seed 37417 retains prior populations/limits. Receipt `evals/sdk/owned-release.md`;
local qualification passes with exact restored identities, CLAIMS S98. No H9/H11 acceptance, signer expansion, remote
push, operational ceremony or stable milestone follows.

2026-10-09 private redemption continuation: fresh live probes refuse correctly;
read-only fetch changes no local work. Under ADR-019, extend the private facade
with queued captured-byte redemption, frozen durable success and fixed refusal
errors. Source/installed first failures and nested-template/build setup findings
are retained. Definition 36/seed 36191 preserves earlier inputs and limits;
receipt `evals/sdk/owned-redemption.md`, qualification continues. No H9/H11
acceptance, public export, signer expansion, push or milestone credit follows.

Redemption's source/installed/type/serial AST qualification and ordinary repeat
pass locally, CLAIMS S97; preserve the initial ordinary wait failure at equal
weight. Bound product/evaluation/emitted-file/archive digests match. Timing
instability, private signing/report/release lifecycle, bounded state, H9/H11 and
all independent/human release gates remain open. Local archival close follows.

Redemption is locally committed as `4d9d1fe`; its bundle verifies and restores
the exact clean revision with full object-integrity verification. Maintained
recovery trials complete, but final restored driver baseline fails the unchanged
wait: preserve it, verify exact source/archive restoration and claim no complete
driver pass. The next accepted facade work is signing journal, outcome reporting
and operator release, followed by bounded retained state; no H9/H11 acceptance
or stable milestone is inferred. Archival evidence remains local only.

2026-10-09 D32 local archive: correction is committed as `944579d`; its local
Git bundle verifies and restores the exact clean revision with passing full
object-integrity verification. Post-commit close passes nine of ten checks,
failing only pushed HEAD under the no-push instruction. All workers are finished;
AST/driver wait, H9/H11, bounded recovery and independent release gates remain
open. No stable milestone or remote synchronisation is claimed.

2026-10-09 D32 follow-up: private facade admission can return the trusted SDK's
unrecorded sentinel after append failure or identity collision. Real owned
storage/collision tests fail first, as does the installed previous candidate.
Reject negative-sequence facade replies with fixed typed error; preserve SDK
denials, durable retries and failed-writer state. Definition 35/seed 35447 precedes
measurement and adds the storage case without removing any earlier input/limit.
Receipt `evals/sdk/owned-admission-error.md`; qualification continues locally.

D32 source/installed/native/type evidence is complete locally; serial AST still
fails the unchanged baseline wait. Keep all outputs and raw coverage reports.
CLAIMS S96 carries the scoped results. Detect/recover the overwritten private
tarball by exact reproduction from `36a1ae7`'s local Git backup; new candidate
archive uses a separate component path. No complete coverage or milestone closes.

2026-10-09 local facade archive: `36a1ae7` is committed locally; its Git bundle
verifies and restores the exact clean revision with passing full object-integrity
verification. Post-commit close passes nine of ten checks, failing only pushed
HEAD under the human's instruction. The AST/driver timeout finding remains open;
no stable milestone closes. No push occurs.

2026-10-09 private admission/control facade: implementation and local qualification
continue under ADR-019, receipt `evals/sdk/owned-guard.md`. No history or mutable
guard/store escapes; exact established signed policy/index, captured configuration,
shared FIFO and orderly close. Preserve absent API/module, bigint-fixture/type
errors, redundant-check missed fault and concurrent unchanged-wait failures.
Definition 34/seed 34183 includes malformed and valid foreign-cluster boundaries
after the focused critical branch deficit; all limits and earlier inputs remain.
H9 acceptance is still pending; no signer expansion, bounded state or milestone
completion is assumed. Local commits only.

Quiet facade ordinary suite/typecheck pass; quiet serial AST and isolated driver
baseline still fail H11's unchanged wait. Receipt/CLAIMS S95 retain both outcomes,
all source/package fault proofs, raw failed AST reports and bound private inputs.
The exact H11 proposal is requested asynchronously; delivery is not acceptance.
Local implementation may be archived with its broader qualification explicitly
open; the guard, floors, waits and remote-sync gate are unchanged.

2026-10-09 local backup: owned controls are committed as `b1d8ed1`; the local
Git bundle verifies and restores that exact clean revision with passing full
object-integrity verification. Post-commit close passes nine of ten gates;
only pushed HEAD fails under the human's explicit no-push instruction. This is
source-history backup evidence, not operator-state or off-device recovery.

2026-10-09 owned-control component: `evals/sdk/owned-control-request.md`, CLAIMS
S94. Shared FIFO, verified current disk evidence, captured canonical inputs and
immutable replies pass local source/installed/full/AST qualification. D31 mutable
public-method dispatch fails first and is corrected with private captures.
Initial inventory/setup and unchanged-wait failures remain retained. Definition
31/seed 31907 keeps all cases, trials, floors and waits; the six actual gap
scenarios share one helper process with explicit completion inventory. Local
commits only; no bounded-state, signer isolation, hosted or stable milestone closes.

2026-10-09 local-only direction: the human prohibits remote pushes and requests
continued implementation with local Git commits. This supersedes the standing
sync grant. Keep the unchanged remote/close checks honest: committed-but-unpushed
work is expected, not a full close pass. Existing independent/publication gates
remain required. Shared owned control FIFO is the next accepted core component.

2026-10-09: existing replay command qualified as a read-only local component;
receipt `evals/sdk/replay-command.md`. Actual streamed reads, bounded public JSON,
independent pins and redaction preserve positional/exit compatibility. First
fixture errors, the candidate's trust-field collision and the prior POL-4 raw
detail assertion are retained. Exact redacted sequence/field output replaces only
that obsolete value assertion; missing trust still refuses. Full regression,
isolated driver, close and private sync results belong to the same receipt and
current run. No bounded-state, backup recovery or stable-release milestone closes.
Implementation `9996f00` is privately pushed; unchanged post-push close passes.
Exact hosted `37954540242` starts no job steps because of H13; its failed account
annotations and metadata are retained with the receipt. No hosted qualification
or release progress credit follows from that refusal.

2026-10-09 resume: owned proposal component `8a343d4` is privately pushed.
Exact hosted `37949141048` remains in progress. Post-push close fails only the
missing current-day run after the service interruption; the new manual record
preserves the previous day and leaves the workflow unchanged. Root takes over
the prepared read-only replay-command tests after the isolated builder's service
usage limit; no execution or implementation is claimed from that draft.

The next SNP-7 component integrates internal owned proposal consultation under
accepted ADR-019. Genuine signed guard context, captured private bytes and FIFO
precede actual disk lookup; the live head/closure check precedes synchronous
commit. D27 nested reply aliasing and D28 shared backing regressions fail first
and are corrected before integration. All arrays/maps remain; an exposed sync
guard cannot be pruned. Receipt: `evals/sdk/owned-request-admission.md`.
Fresh definition 27/seed 27241 retains every prior mutation source/test, wait,
limit and floor and adds the companion population. No signer expansion or
H9/H10/H11/H12 acceptance follows.

Root qualification passes 787 ordinary/serial AST cases and native typecheck at
all unchanged floors. Twenty-one admission, twenty-six lookup, twenty-seven
publication, ninety-one compiled and fifteen fresh isolated recovery/driver
faults catch/restored. Definition 27's exact selected count is 500; its stale 482
expectation first fails and is corrected without changing a workload or wait.
Evidence/source hashes/private tarball identity are in the companion receipt.
Next independent work strengthens the existing read-only replay command;
its isolated builder prepares fixtures during these measurements.

Owned lookup implementation `7118ae2` is privately pushed; the unchanged close
workflow passes all ten gates afterwards. Its source/test/workload paths stay
unchanged during the separate Phantom research. Exact hosted run `37871842802`
is checked separately; incomplete or failed hosted results are not replaced by
the passing local component evidence.

Exact implementation hosted `37871842802` completes failed: all runtime/AST
suites pass 768 of 769 with one unchanged baseline-wait failure, and partition
one fails that same real-baseline case. Other partitions, new lookup tests and
all 26 lookup faults pass/restored; type/installed checks pass. Full metadata/log:
`evals/sdk/request-index-lookup/hosted-7118ae2/`. H11 remains pending.

Published Phantom route research retains exact archives' public metadata,
integrity agreement, source hashes, short excerpts and separate current official
support observations. No package/session/wallet was executed or accessed. The
knowledge source, brief, wiki and registry distinguish stock MCP post-send
results from the low-level sign-only candidate and its unqualified live contract.
CLAIMS M14 scopes those external facts. No milestone, dependency, policy, signer
budget, harness wait, public version or publication decision changes.

Internal owned current-head lookup progresses under accepted ADR-019. It
authenticates the actual published disk prefix, validates complete current signed
history and folds the tail for an immutable request/reply answer carrying both
endpoint pairs. D26's direct-helper mutable-history regression fails first, then
captured history fixes it. Initial manual/closed-owner/order fault misses remain;
valid-cache, healthy descriptor reuse and early-refusal cases now catch them.
Source/installed evidence and limitations: `evals/sdk/request-index-lookup.md`.
No admission wiring, eviction, bounded-state or completed milestone claim.
Definition 26/seed 26179 is declared before expanded measurement, preserving all
earlier selected tests and every wait/floor/limit. H9/H10/H11/H12 stay pending.
Exact preceding 0332c97 hosted 37851655446 fails the unchanged wait; full log and
job metadata are retained with the filter receipt.

Final local ordinary/serial AST populations pass 769 cases; native typecheck and
all unchanged floors pass. Source hashes match restored files and the private
compiled artefact manifest. Lookup/publication/compiled/staging/recovery campaigns
restore after their respective 26/27/82/51/15 catches; CLAIMS S91 scopes them.
No full hosted, bounded recovery, independent security or stable-release claim.

Offline PHX-3/4 selection progresses under the explicit item 9 grant while H9/H11
decisions remain pending. Component tests reproduce accessor/proxy substitution
and inherited network/descriptor weaknesses before fixes. Captured immutable
values, explicit devnet and redacted bounded parsing pass maintained faults.
Firewall coverage/campaign inventories fail first, then include the new path
without lowering or removing existing gates. `evals/firewall/filter.md` retains
evidence and preceding 588a1ef hosted failure. No forwarding, policy-loading,
transfer-field/rent, actual Phantom or deployment qualification claim.
Final ordinary and serial AST suites pass 751 cases; native typecheck exits zero.
Thirteen filter and three new coverage faults restore; all thirty existing
coverage faults restore. Exact final product hashes/counts are retained.

Hosted c2df043 run 37846194595 completes failed; full log/job metadata are retained
with `evals/ci/mutation-stop.md`. Node 22/26 and partition one fail the unchanged
baseline wait; Node 24, AST and partitions two/three pass. Missing committed
completion evidence previously appeared pending; the new regression fails first,
then refuses before a fresh PID signal. No H11 acceptance or wait change, product
change or formal milestone credit.
Follow-up ordinary suite passes 742 cases, native typecheck exits zero; eight stop,
23 existing supervisor and fifteen isolated recovery/driver faults restore.

Hosted 5a33e69 run 37841558758 finishes failed. Full log/metadata are retained.
Recovery/loading campaign corrections narrow intended mutation targets and update
the completed publication case count without removing trials. CI-2 shutdown
fixtures reproduce premature scratch deletion; confirmed bound supervisor
completion now precedes removal and preserves original failures. H11's original
baseline wait remains unchanged. Receipt: `evals/ci/mutation-stop.md`.

Current original private-mirror history inventory at 5a33e69 is retained in
`evals/ci/history-owned-publication.md`. It covers advertised refs and complete
parent closure, with actual commit reads; no contents/rights/secret/publication
clearance is inferred. Freeze and regenerate for the final proposed public revision.

Owned-publication implementation is privately pushed as 5a33e69; hosted
37841558758 is queued/running when recorded. No passing CI claim. Generic log
ignores excluded some retained experiment/install outputs; an archival follow-up
explicitly tracks them without source, workload or threshold changes.

2026-10-08 continuation: actual-owned immutable index publication and D25's late
checkpoint-cache race now have source/fault evidence in
`evals/sdk/owned-request-index.md`. Installed checks exposed a Node type leak;
the structural metadata correction preserves runtime checks and the failing
consumer configuration. Fresh mutation definition 25/seed 25813 follows that
type-only correction. Published ElizaOS route experiments are separately retained
and explicitly unqualified. Hosted 43f20c0 fails the unchanged staged-baseline
wait; full logs remain, other fault partitions pass. Live index/tail integration,
bounded state/startup and all Alpha/security/human/release gates remain open.

| 2026-10-08 | D24 client containers and private preview follow-up | commit containing `evals/sdk/sending-client-input.md` and `evals/release/staged-preview/client-candidate.json` | native/installed first failures; 718 ordinary/AST cases, typecheck, seventeen source and seventy-four compiled faults; updated checkpoint trial and fresh driver qualification | CLAIMS S83. Original 39c24de artefact/full failed hosted run retained; no public metadata change. Preview guide adds digest verification; formal progress remains 41%, all broader gates pending. |

Private candidate `39c24de` is pushed; its local close passes every gate. Hosted
37777805134 completes failed: runtime matrix and fault partition one hit the
unchanged real-baseline wait, and partition two finds the checkpoint-state
apply-state fault's outdated literal after D23's context argument. Update that
literal to omit the same operation; no trial is removed. AST and installed/type
steps pass, without clearing CI. Full logs/revision metadata are retained in
`evals/release/staged-preview/hosted-39c24de/`. Client contract peer review then
finds D24's missing/non-record argument TypeError, fixed test-first under CLT-1/3;
its refreshed source/installed qualification follows. H11 remains a proposal.

| 2026-10-08 | D22/D23 recovery validation, SNP-7 internal index and private staged preview | commit containing `evals/sdk/request-index-integration.md` and `evals/release/staged-preview.md` | first failures/misses, source and compiled faults, 718 ordinary/AST cases, typecheck, unchanged floors and isolated driver qualification | CLAIMS S79–S82. Actual private tarball/example/page scope prepared; no public release. Formal progress remains S78's 41%; full bounded recovery, H9/H10/H11/H12 and human/Claude/audit gates stay open. |

Hosted 5b00257 run 37736599067 completes failed at the unchanged staged-baseline
wait in ordinary runtimes, AST and fault partition one. Successful installed/type
steps do not clear that run. Exact full log/revision metadata are retained in
`evals/sdk/request-index-integration/hosted-5b00257/`. Corrected candidate private
sync/hosted result follows the local close workflow; no wait extension is applied.

| 2026-10-08 | CI-1 fixed complete fault partitions and release accounting | commit containing `evals/ci/bite-partitions.md` | first failures/misses, source/workflow faults, internal peer review and corrected ordinary/AST/type checks | All 54 campaigns remain required; limits unchanged. CLAIMS S77/S78 record gate scope and 41% formal milestone completion, including Beta. Hosted timing/Alpha/release gates remain open. |

a4d1c25 record loading privately pushed; local close passes every gate. Hosted
37711212005 is pending. Current release evidence map links component receipts to
all mission phase exits and names remaining owners/dependencies; PROGRESS's stale
pre-publication/pre-recovery wording is reconciled without deleting receipts.
Disk request lookup now has an internal completed-prefix component receipt.
Next accepted integration is owned publication/tail tracking, bounded state and
owned streaming restoration. H9/H10/H11 and human/Claude/audit gates stay open.

| 2026-10-07 | OWN-2/SNP-4/5 record loading | commit containing `evals/sdk/record-loading.md` | first failures; source/installed/staging/isolated driver faults; 655 ordinary/AST cases and typecheck | Captured pins, constructor identity and full maintenance validation preserved; CLAIMS S76. No hosted timing fix or complete release claim. |

Record loading candidate: source and installed bootstrap refuse eager evaluation
imports; actual owned maintenance captures pins before loading and retains full
validation. Definition 20/fresh seed 24829 adds source/tests without changing
floors, selected prior workloads or baseline wait. Integrated evidence follows.
b352454 hosted 37709169363 completes with all runtime jobs passing, AST failing
at the unchanged baseline wait and maintained faults cancelled. Exact results
are retained in `evals/sdk/replay-stream/hosted-b352454/`; H11 remains pending.

b352454 streamed recomputation privately pushed; all local close gates pass,
hosted 37709169363 starts. Consumed owned stashes removed after sync. Diagnostic
CPU profiling of unchanged selected definition-19 inputs investigates repeated
checkpoint preparation; no gate, deadline or product source is changed. A disk
request index remains separate work; no storage/runtime adoption is claimed.

Streamed recomputation final source/compiled/staging/driver faults restore;
revised ordinary/serial AST pass 652 cases, native typecheck zero and unchanged
floors pass, CLAIMS S75. Original misses and exact source/AST inputs remain with
`evals/sdk/replay-stream.md`. Close/private sync follows. Prior c2c2f5c hosted
37707464546 completes with runtime/AST/maintained wait failures, other jobs pass;
full logs/revision metadata retained with archive receipt. H11 remains pending.

Streamed producer-copy omission initially survives a posture-only fixture. Added
durable request/response hash mutation; missed output retained. Final workload
declared as definition 19/fresh seed 24713 after provisional 17/18, preserving
all earlier inputs, floors and limits. Final integrated/driver evidence follows.

Archive c2c2f5c privately pushed; all local close gates pass and hosted 37707464546
starts. Prior history repair 9a6480f hosted 37706079593 completes with AST and
maintained-fault failures at the unchanged staged-baseline wait; all runtime jobs
and other jobs pass. Exact evidence retained with the history repair receipt.
Internal SNP-7 recomputation follows: two complete canonical-record reads,
captured policy/trust, maximum historical window and shared decision checker.
The initial asynchronous array loop is replaced with its existing synchronous
behaviour; fixture/setup/type failures remain retained. Installed/integrated
checks follow, definition 17/fresh seed 24517, no changed wait/floor.

Archive streaming final local ordinary/AST/type, installed and fresh recovery/
driver checks pass with exact restoration, CLAIMS S74. Initial failures and
source/AST hashes are retained at `evals/sdk/archive-stream.md`. Close/private sync
follows; full streamed state replay and bounded memory remain unfinished.

History repair 9a6480f is privately pushed and all local close gates pass. Archive
candidate restored with final history checks preserved; ordinary/serial AST pass
642 cases, native typecheck zero and unchanged coverage floors pass. Fresh
definition-16 recovery/driver faults follow. Hosted 37706079593 runtime jobs pass
but AST is red; completed logs remain unavailable while the overall run continues.
No cause, hosted clearance or complete mutation score is inferred.

PUB-1 final focused/fault and corrected ordinary/type checks pass; exact inputs and
all original failures are retained, CLAIMS S73. Final close/private sync precedes
restoring the archive-stream candidate. No SDK source change in this independent
repair. Hosted wait failures and H9/H10/H11 remain open.

PUB-1 later integration accepts a cached missing commit. Independent repair reads
each actual commit body and verifies its Git object hash and tree/parent headers;
missing/corrupt bodies, differing metadata and valid truncated blob batches refuse.
Initial failures, sixteen focused cases and eighteen faults are retained at
`evals/ci/history-commit-read.md`. Corrected ordinary/
type/close follows. Archive streaming work is preserved in the recorded local
stash and resumes after this separate coherent repair; no SDK change in this step.

49f753b hosted 37703450078 completes with four failures, each at the unchanged
real-baseline wait (Node 22/26, AST, maintained faults). Node 24 and other jobs pass.
Exact logs/revision metadata retained with owned recovery receipt. H11 stays pending.

49f753b owned recovery is privately pushed with all local close gates passing;
hosted 37703450078 is in progress. Internal archive streaming continues inside
ADR-019/SNP-1: captured pins, immutable provisional entries, backpressure,
natural-completion receipt and cancellation cleanup. Source evidence is retained
at `evals/sdk/archive-stream.md`; installed/integrated checks follow. Full policy
replay and bounded live state remain owed; H9/H10/H11 stay pending.

Owned recovery final source/installed/staging/recovery faults restore; corrected
ordinary/AST/type and unchanged floors pass. Exact hashes, original failures and
fresh definition-15 baseline evidence are retained with the receipt, CLAIMS S72.
Final close/private sync follows; then streaming archive reads can progress
independently of pending H9/H10/H11. Live isolated startup remains unwired.

Owned recovery's final named-path review finds a symlink-to-held-inode gap, now
corrected test-first with lstat/regular-file checking. Corrected ordinary/serial
AST suites, typecheck and unchanged floors pass; source/installed faults restore.
Fresh-seed recovery/driver verification and final close/private sync follow.
Evidence is `evals/sdk/checkpoint-owned-recovery.md`, CLAIMS S72. No live startup,
bounded-retention, hosted runtime or stable-release gate is cleared.

f05c84d hosted 37700643535 completes with three runtime test-job failures at the
unchanged real-baseline wait; the other jobs, including AST and maintained faults,
pass. Exact logs and revision metadata retained with the recovery receipt. H11
stays pending. Owned recovery final frozen local integration continues.

f05c84d recovery preparation is privately pushed with all local close gates passing;
hosted 37700643535 remains in progress. Internal owned recovery follows ADR-019:
actual kernel store, fresh disk history, bounded current-checkpoint reads, verified
fallback and final ownership/history recheck. Focused and installed fault evidence
is retained at `evals/sdk/checkpoint-owned-recovery.md`; integrated checks follow.
No live startup or bounded-retention completion. H9/H10/H11 remain pending.

Recovery preparation passes local ordinary/AST/type and unchanged floors, with
source/installed/gate evidence retained at `evals/sdk/checkpoint-recovery.md`,
CLAIMS S71. Final close/private sync follows. Full signed replay and optional
anchor remain mandatory on fallback. Actual owner/startup integration and bounded
retention remain owed; H9/H10/H11 and release gates remain open.

995c5b0 hosted 37664288112 completes with four unchanged real-baseline-wait
failures (runtime/AST); other jobs, including maintained faults, pass. Full logs
and revision metadata retained with prefix receipt. H11 remains pending. Recovery
preparation now has focused/source fault evidence; installed/integration follow.
It is not yet wired to actual ownership or live startup, and is not bounded.

0c61fa3 hosted 37662281431 completes with four failures, all the unchanged real
baseline wait (runtime matrix and AST); other jobs, including maintained faults,
pass. Full logs/revision metadata retained with publication receipt. H11 remains
pending. Prefix rebuild local ordinary/AST/type/fault evidence is ready for sync;
no hosted qualification or complete recovery claim.

Validated prefix rebuild ordinary/AST integration and unchanged floors pass;
source/installed/recovery evidence is retained at `evals/sdk/checkpoint-rebuild.md`,
CLAIMS S70. Typecheck passes. Final close/private sync follows. Publication hosted
failures remain open; no complete authenticated recovery or release clearance.

0c61fa3 publication is privately pushed with all local close gates passing.
Hosted 37662281431 reports runtime/AST failures and remains in progress; exact
completed logs are owed. Prefix rebuilding has focused and source-fault evidence,
with full ordinary/AST integration following. It replays ticks/resets into fresh
Keel, but does not complete authenticated guard restore or bounded retention.

Owned publication passes ordinary/AST integration and unchanged coverage floors;
source/installed/storage/crash evidence is retained at
`evals/sdk/checkpoint-publication.md`, CLAIMS S69. Native typecheck passes.
Final close/private sync follows. The component does not complete cadence,
authenticated recovery or bounded retention; no release clearance inferred.

6162efb hosted run 37656562219 fails Node 22's unchanged real baseline wait;
other jobs pass and exact evidence is retained with the envelope receipt. H11
is still pending. Owned checkpoint publication now has local storage/crash
evidence; final fault/integration qualification follows. Cadence, restore,
bounded retention and signer expansion remain owed.

6d81f8b hosted completion fails two jobs: Node 22 real baseline wait and the
ordinary omission-fault campaign. Exact failures retained. The omission fixture
now supplies explicit parallel CLI defaults so the root serial option must override
them; local fault/restoration passes. H11 remains a proposed wait change, not applied.
Envelope ordinary/AST integration passes 597 cases; final portability close follows.

6d81f8b is privately pushed with all local close gates passing. Hosted Node 22
fails, with exact logs pending overall completion; no hosted clearance inferred.
Opaque envelope authentication has initial/fault/source/installed evidence.
Existing CI AST option now explicitly requests serial execution; full population,
waits and floors retained. Final integration/private sync follows.

Confirmed cause of ordinary parallelism: Node ignores the scheduling flag placed
after test paths. Two-file probes and an actual scheduling regression reproduce
it; root command/CI now put the option before paths. Planted omission is caught.
Corrected ordinary suite passes 589 cases and typecheck; no deadline/workload/floor
changed. AST and corrected hosted confirmation follow before qualification.

2692542 hosted qualification fails: Node 22 actual staged baseline is incomplete
at the existing wait; twelve other jobs pass. Exact failure/metadata retained.
Bundle serial ordinary suite also refuses the same local wait. Timing reliability
remains open; unchanged rerun follows, with failures preserved at equal scope.

2692542 is privately pushed with all local close gates passing; hosted qualification
is underway. Internal checkpoint bundle assembly has source/installed evidence:
consistent captured payloads and existing signing domains, distinct authority pins.
Array-shape regression and initial gate refusals retained. Final close/sync follows;
atomic publication and authenticated recovery remain the next dependencies.

afe482a hosted run 37649065148 passes every job; full logs and exact revision
metadata retained with compiled-payload receipt. Earlier timing failure remains
preserved and its cause unproven. All local close gates passed after private sync.

POL-2 rejects invalid signature size before decoding and captures signature text
once; source/installed faults pass with restoration. Mutation definition 8 adds
prefix/state/signed-policy targets before measurement with a fresh seed, retaining
all existing limits and floors. Expanded baseline exposed a shared checkpoint test
policy, now locally owned; first failure retained. Final integration/sync follows.

b9c06eb is privately pushed; all local close gates pass. Hosted run 37629630875
passes twelve jobs but fails the coverage job's existing staged-baseline wait.
Exact failure/metadata is retained. Installed prefix/state artefacts pass ten cases
and eighteen compiled faults; no root API export added. The wait assertion now
retains actual child progress before cleanup; cause/hosted qualification remain owed.

Corrected afed152 hosted run 37626020433 passes every job, including Node 22/24/26
and the fault aggregate. Full logs/revision metadata are retained. Prefix 23f57d5 is
privately pushed with all close gates passing; its hosted run is underway. Admission
state preparation now has focused/fault evidence; strict restore/publication remain owed.

40fa2fc hosted run 37620710240 completes with twelve successful jobs and one
Node 22 failure: the existing staged-baseline wait. Complete failure is retained.
Definition 6 expands mutation scope without removing prior inputs, after first
failures; fourteen focused cases, nineteen staging/report and fifteen recovery/driver
faults pass. Actual baseline contains 272 cases. CI ordinary suites use serial
file execution with unchanged deadlines/batteries; corrected hosted result is owed.
Scope review additionally catches dilution by an added strong mutation group.
Definition 7/fresh seed 23311 preserves original/added floors separately. Masked
global-only faults are retained; twenty-two final staging/report faults pass.

Final quiet AST execution passes all 564 cases and unchanged floors; catalogue
48/48 statements and 57/57 branches. Ordinary/type and maintained source/packed
fault checks pass. D21 is corrected locally; fresh mutation and independent review
remain owed. Evidence/records are ready for private close.

The independently found D21 fix supersedes the frozen guard target. The supervisor
is interrupted, committing actual status 143 and error "supervisor interrupted";
finish refuses qualification. Inputs/output/result retained at
`evals/ci/mutation/retired-9ac6e7c/`. Quiet ordinary integration passes all 564 cases
and typecheck passes. Final AST/private sync and fresh corrected-target mutation follow.

Catalogue private sync is held: ordinary integration repeatedly fails the existing
staged-baseline wait under full mutation load; no deadline is relaxed.
Prefix review additionally reproduces acceptance of fabricated Keel fields on a
malformed proposal in replay and restore. Regression/correction remains owed before
prefix derivation; raw finding is retained beside the catalogue receipt.

D21 candidate refusal passes three focused cases/five source faults and nine
installed cases/nine compiled faults after observed failures
(`evals/sdk/malformed-replay.md`). Typecheck passes; root qualification remains held
by the unchanged staged-baseline wait under active full mutation load.

Archive catalogue component passes fifteen cases/twenty source faults and nine
installed cases/eight compiled faults, with restoration (`evals/sdk/checkpoint-archives.md`).
Masked serializer fault and array-method regression retained. Metadata preparation
only; state/prefix, publication/restore and independent qualification remain owed.
Prior signature-bound revision 805e8bb hosted run 37614673709 succeeds in every job.

SNP-3 signature bound ordinary suite passes all 546 cases with CPU 0/4 affinity;
typecheck zero. Both local instrumented runs fail the unchanged baseline wait.
Receipt preserves these failures; corrected hosted coverage remains required.
Prior runtime revision 9ac6e7c hosted run 37611898486 passes every job.

Checkpoint signature decoder bound passes nineteen focused cases/twenty-three faults
and nine installed cases/six compiled faults after observed failures
(`evals/sdk/checkpoint-signature.md`). Concurrent integration timing failures retained;
sequential final checks and private close follow. Frozen mutation candidate remains intact.

Recovery runtime correction uses the documented cross-matrix isolation option;
six cases/fifteen faults pass locally (`evals/ci/mutation-runtime.md`). Definition 5
declares a fresh seed with unchanged scope/floors. Hosted Node 22 failure is retained;
corrected hosted evidence and complete mutation score remain owed.

Recovery f8d22f9 privately pushed; all ten close gates pass. DEP-1 now has a scoped
published qs patch, clean lockfile installation and three installed cases/four faults
(`evals/ci/dependency.md`). Resolver failures are retained. Remaining high findings,
fresh full mutation qualification and independent/human gates remain owed.

Mutation execution recovery passes six cases/fourteen faults and the real staged
baseline (`evals/ci/mutation-recovery.md`). Original orphan retired with unknown actual
status and incomplete population; no score claimed. Environment commit ddc8bb0 passes
all hosted jobs; preceding b6d9194 run was cancelled, not passed. Final close/sync follow.


Supervisor b6d9194 is privately pushed and passes all ten close gates; CI 37581602264
is running. Explicit environment/interruption extension passes twenty-three focused cases
and twenty-three faults after a masked child-binding miss. Full final integration and
private close follow (`evals/ci/run-environment.md`); no mutation qualification yet.

Supervisor isolated aggregate exits zero across thirty-seven campaigns/350 caught-fault
lines. All 805 frozen inputs/65 compiled files restore exactly, and root TypeScript and
package inputs match. Pre-sync close passes nine gates, refusing the uncommitted tree;
private commit/push and hosted checks follow. Full mutation integration remains owed.

Actual evaluation supervisor component passes eighteen local cases/nineteen real faults,
all 531 ordinary cases and typecheck (`evals/ci/run-supervisor.md`). Foreign-worker and
uncommitted-publication failures are retained. Isolated aggregate setup initially uses
the wrong working directory and is stopped; its output remains retained. Correctly frozen
aggregate, exact restoration and private close follow. Full mutation integration remains owed.

Final completion foundation recheck passes 513 root cases and typecheck. The corrected
isolated fixture passes sixteen faults with all input/release hashes restored. Pre-sync
close passes nine gates, with the uncommitted step still refused; private sync follows.

Completion foundation isolated aggregate exits zero: thirty-six campaigns/331 caught-fault
lines, all 773 inputs and 65 compiled files restored exactly. The later scratch-parent
fixture setup has its own cold-directory and focused fault evidence; no production code
changes. Final source recheck and private sync follow. Actual detached production is next.

Operational-map revision 068e90c passes every hosted job in run 37575900703. Completion
foundation integration passes 513 source cases; the full isolated aggregate continues.
Clean-directory fingerprint-fixture failure and its corrected rehearsal are retained.

Checkpoint afa0b21 passes all hosted jobs in run 37575269194. Operational maps 068e90c
are privately pushed; hosted run 37575900703 starts. CI-2 completion-evidence work begins
independently: bound result checks and operator-tool restoration fixtures pass focused
faults after a masked field check is exposed. Actual detached supervisor/wiring remains owed.

Checkpoint/serial step afa0b21 is privately pushed; hosted run 37575269194 starts. Its
pre-sync close passes nine gates and refuses the remaining uncommitted preparation.
Linux lifecycle, dependency remediation and durable mutation execution maps are the next
separate documentation step. No service, audit, publication or stable-release gate is closed.

Final checkpoint/serial candidate passes the full isolated aggregate: thirty-five campaigns,
315 caught-fault lines and actual exit zero. All 715 copied inputs and all 65 compiled files
restore with exact inventory. Eighteen checkpoint cases/twenty-two real faults, 504 ordinary
and instrumented cases, unchanged floors, nine installed checks/five compiled faults and
typecheck pass. No state-restoration or completed signer claim; H9/H10 remain pending.

CI correction 11cd688 passes all thirteen jobs in hosted run 37573902777. The failed
history run remains recorded. Current checkpoint/serial coverage candidate passes 504
instrumented cases and every unchanged floor; final isolated aggregate is still running.

CI-only correction 11cd688 is privately pushed; CI 37573902777 starts. Pre-push close
passes nine gates, with the pending checkpoint/operational steps still uncommitted.
Eight focused cases/twelve property/five cap faults and integrated root 504 pass;
ordinary property definition/deadlines unchanged. Corrected hosted evidence is awaited.

History CI 37571438128 fails the planted-cap campaign; other jobs pass. Exact-seed
reproduction confirms shrinking stalls until containment. Fault-only first-counterexample
diagnostics and actual child-error/signal checks now pass eight focused cases, twelve
property/five cap faults and restoration (`evals/ci/caps-first-failure.md`, S51). Ordinary
shrinking, complete successful floors, rules/generators and deadlines stay unchanged.
Full root/close/corrected CI follows. No failure is erased or retried into apparent success.

History-only component a94ecf0 is privately pushed; CI 37571438128 starts. Full candidate
tests/coverage pass, but the first isolated aggregate fails its restored property battery
despite all faults caught and bytes restored. Raw failure is retained; repeat without
overlapping root/coverage work. Detached mutation observer 574792 now retains the original
deadline across tool interruptions; the original completion status remains unavailable.

2026-10-07 resumed interruption: original mutation driver/session disappeared while group
1007247 remains running. Actual exit status is unavailable; scratch observer 520713 retains
the original deadline. No inferred score qualification. Strict serial coverage execution
passes its stub/fault/inventory programme; all 499 instrumented cases and existing floors
pass (`evals/ci/coverage-options.md`, S50). Full maintained faults run in a separate candidate
with local workspace links; root inputs are not mutated. Current-day continuation record
added after close rejects the older date alone. Final ordinary tests/aggregate/close pending.

Checkpoint candidate ordinary integration passes: 496 serial root cases, typecheck,
nine outside-workspace installed JavaScript/declaration checks and five compiled faults.
Restored candidate passes. Full coverage/aggregate close and private sync remain pending;
no state-restoration or complete signing-service claim. Frozen mutation job still runs.
Repeated history mirror inventory has the exact original digest; fifteen cases/thirteen
faults and corrected typecheck pass, with no commit-graph bug found.

Checkpoint caller-mutation follow-up: independently altered trust and observed digests
are caught by separate planted faults. Seventeen cases/twenty-one faults and corrected
typecheck pass. No signer wiring is added; full host/helper count is still owed at completion.

OPR-1–8 allocate the approved Linux installation/lifecycle obligations, with owner,
dependency, positive/refusal/drill evidence and unchanged targets in
`docs/plans/2026-10-06_linux-qualification.md`. Human accounts/signatures and pending H9/H10
remain dependencies; no installed-service or reference-platform support is claimed.

SNP-3 candidate export follow-up: source entry test fails first, then seventeen cases and
nineteen real faults pass, including export removal. Packed JavaScript/declaration checks
and an export-damage fixture are prepared; installed validation waits for the frozen
mutation run to finish. No installed service or state restore claim is added.

PUB-1 read-only follow-up catches graft ancestry hiding parents and lazy fetching of
missing partial-clone blobs. Per-process protections correct both; fourteen cases/thirteen
real faults pass with source restoration. Original twelve-case/eleven-fault evidence is
retained. This does not scan content or clear publication; full close remains pending.

SNP-3 binding authentication component: sixteen cases/eighteen real faults and corrected
typecheck pass, with a masked key-pin fault and test-fixture type error retained. Campaign
and critical coverage registration fail first, then pass. No installed export, checkpoint
publication, payload semantic validation or state restore yet; full root/coverage/aggregate
close remains pending while the frozen mutation run continues. H9/H10 remain pending.

PUB-1 inventory preparation records the original private-origin mirror at 0978aaa: five
refs, 83 commits, 1,607 historical blobs and 848 paths; no publication clearance. Twelve
cases/eleven real faults and typecheck pass. Missing ref-closure and an equivalent planted
edit are retained; local harness tree refs refuse. New campaign registration is proven red
before correction. Root/aggregate close and private sync remain pending. The full mutation
run stays active with its frozen SDK sources/dependencies unchanged.

Qualification preparation a4dba77 is privately pushed and passes ten close gates. CI
37553883381 starts. Fresh definition-3 mutation run uses session 47592, driver 1007197 /
worker group 1007247, stage `run-Z74iGI`; log and full paths are in the continuing run.
Instrumented dry run passes; no completed score yet. SNP-3–8 now allocate accepted ADR-019
snapshot/replay/retention/maintenance tests and their dependency map. No snapshot implementation
or performance gate is achieved by this allocation, and H9/H10 remain pending.

Mutation preparation freezes decoder/policy scope and proves staged-source isolation
(`evals/ci/mutation.md`). Actual Stryker score remains owed; ADR-021/H9 still awaits acceptance.
Coverage commit `657e338` CI `37498544709` passes all jobs.

Performance-report preparation (`evals/ci/performance.md`) and the fresh public-ledger
differential gate (`evals/ci/differential.md`) pass focused and maintained fault checks.
Full bite catches 228 faults across 28 campaigns; private sync and hosted CI follow.
The interrupted Stryker run has no completed report; frozen inputs and output are retained.
No measured timing target, signer budget acceptance or stable-release gate follows from this.

Differential/performance step `13bb075`: private push, ten close gates and hosted CI
`37517288645` all pass. New traffic definition and local gate/runner/fault evidence are
in `evals/ci/traffic.md`; full root close/sync remains pending. Changing-intent failed
streams continue admitting within the frozen horizon; no sensor change or RT-3 closure.

Anchor-pin component and traffic continuation: 457 root tests and unchanged coverage floors
pass sequentially; typecheck zero. New installed/API/CLI pin checks and faults are retained
in `evals/sdk/archive-anchor.md`. First root run catches missing campaign inventory entries;
both are included. Mutation definition 2 keeps its full scope/population/floor with a fresh
seed and one test process per worker; 235 staged cases and twelve faults pass. Both incomplete
mutation runs remain without a score. H9/H10 remain unanswered; no dependent expansion.
All 31 maintained campaigns catch 260 faults, none failed or skipped and sources restored;
typecheck remains clean. Final diff and close precede private sync; hosted CI follows it.

POL-1/5 command: canonical public signing requests, bounded/redacted source reads and the
installed executable pass seven command cases, nine faults and eight packed checks. Root
suite passes 464 tests; typecheck zero. Initial installed/build errors and masked symlink
fault are retained (`evals/sdk/prepare-policy.md`). Full maintained campaigns/sync follow;
human signing, policy installation and H9/H10 decisions remain owed.
All 32 maintained campaigns pass, 269 faults caught and no failed/skipped campaign;
sources restore and typecheck stays clean. Prior qualification 00c42e8 hosted CI
37549238301 succeeds across all thirteen jobs. Policy-command private sync is next.
Policy command e508246 is privately pushed and passes ten close gates; CI 37550310149 starts.
Fresh Stryker definition 2 runs from that revision (process details in the continuing run);
no completed score yet. Independent threat-model reconciliation follows accepted scope.
Threat model Draft 4 reconciles accepted recovery/operator contracts and current component
evidence, correcting stale window/anchor/loop wording. It is builder-authored preparation;
Claude's independent review, RT-2 and the specialist audit remain owed. No new ADR accepted.
Policy-command CI 37550310149 completes successfully across all thirteen jobs. The
definition-2 mutation attempt is stopped without a report; no worker survives. Definition 3
extends whole-run containment only, preserving scope, population, per-mutant deadlines and
score floor, with a fresh seed. Preparation passes fourteen faults and 235 staged cases;
the completed mutation score remains owed. Socket inspection confirms completed requests
are not refused by a past transport deadline; no source defect or change is claimed.

One row per completed queue step, newest last.

Archive foundation: SNP-1 structural framing/chain/pins implemented in the SDK, with
builder-authored faults and installed-consumer evidence (`evals/sdk/archive.md`, commit
containing that receipt). Signed snapshots and streamed state replay remain owed. Prior
verified-kill step `91589b3`: close ten gates, CI `37486837521` all green.

The live probes and baseline are complete. ADR-012 C is built and tested offline in
`evals/sdk/latch-c.md`; the complete queue item still owes the funded devnet rerun. Commit provenance:
`git log -- evals/sdk/latch-c.md`. The continuing run is `runs/2026-10-05-codex-solanaut-1.md`.

| Date | Item | Commit | Evidence | Note |
|---|---|---|---|---|
| | | | | |
| 2026-10-05 | 0: probes and baseline | commit containing this row; `git log -- runs/2026-10-05-codex-solanaut-1.md` | continuing run record | Correct live refusals; baseline tests/typecheck green; initial close gate finds uncommitted mission work. |
| 2026-10-05 | ADR-012 C, offline portion | `2030ef7` | `evals/sdk/latch-c.md`; CI `37397016363` passed | Funded devnet rerun still owed. |
| 2026-10-05 | release packaging foundation | commit containing `evals/packaging/packed-sdk.md` | packed consumer receipt | Private SDK candidate only; full product packaging and readiness remain open. |
| 2026-10-05 | package CI fault checks | commit containing `evals/packaging/ci-faults.md` | maintained fault receipt | Same damaged candidates checked on every push; full 3.9 programme still owed. |
| 2026-10-05 | maintained latch CI faults | commit containing `evals/ci/latch-faults.md` | latch fault receipt; prior matrix run `37397843820` passed | CI-1 partial; remaining injections and CI-2 gates are open. |
| 2026-10-05 | signed policy/version foundation | commit containing `evals/sdk/signed-policy.md` | POL/VER receipt | Existing SDK mode retained; isolated enforcement still owed. ADR-019/020 accepted. |
| 2026-10-05 | exclusive ownership/storage foundation | commit containing `evals/sdk/ownership.md` | OWN/STO receipt | Stale SDK takeover removed; Linux kernel mode tested across processes. Full SIG-8 and isolated enforcement remain owed. |
| 2026-10-05 | request admission identity foundation | commit containing `evals/sdk/request-identity.md` | LIF-1 receipt | Atomic identity/reservation and retry lookup built; signed-byte/send lifecycle next. Ownership CI `37400891997` passed. |
| 2026-10-05 | signing evidence journal foundation | commit containing `evals/sdk/signing-history.md` | LIF-2 receipt | SDK records checked lifecycle facts; executor/RPC next. Request CI `37401222564` passed. |
| 2026-10-05 | conservative executor foundation | commit containing `evals/signer/core.md` | LIF-3 receipt | Fake-RPC lifecycle boundaries tested; actual RPC/transport/isolation next. Signing CI `37401878957` passed. |
| 2026-10-05 | trusted devnet RPC boundary | commit containing `evals/signer/rpc.md` | RPC receipt | Fake-provider validation/failover tested; operational wiring, live outage and lookup reads still owed. |
| 2026-10-05 | signer attribution/clock foundation | commit containing `evals/signer/authority.md` | SIG-4/10 receipt | Recorded host flags and anchored clock; service wiring and actual OS-user isolation remain owed. |
| 2026-10-05 | owned RPC deadline correction | commit containing `evals/signer/rpc-deadline.md` | corrective receipt | Node 22 cancellation preserved; standalone regression fails first, then passes without changing targets. |
| 2026-10-05 | bounded Unix transport foundation | commit containing `evals/signer/socket.md` | socket receipt | Operational wiring still owed; corrected RPC CI `37403526901` passes all three runtimes. |
| 2026-10-05 | durable control request foundation | commit containing `evals/sdk/control-request.md` | LIF-4 receipt | SDK journal built; handler and pre-admission errors next. Socket CI `37404207616` passed. |
| 2026-10-05 | completed socket slot correction | commit containing `evals/signer/socket-slots.md` | socket correction receipt | Half-open regression and shutdown failure preserved. Control CI `37404614332` passed. |
| 2026-10-05 | method handler foundation | commit containing `evals/signer/handler.md` | handler/core receipt | Deadline/coalescing wiring tested; service and pre-admission refusals owed. Socket correction CI `37404939530` passed. |
| 2026-10-06 | proposal-refusal foundation | `a40375a` | LIF-5 receipt; CI `37453503555` passed | Pre-admission errors now durable; operational signer remains owed. Post-push close passed. |
| 2026-10-06 | recovery pass isolation | `8b92594` | LIF-6 receipt; CI `37457271361` passed | Failed attempts no longer abort later reconciliation; operational service and policy-change qualification remain owed. Post-push close passed. |

| 2026-10-06 | signed-policy recovery/settled signing | `f6c8641` | POL-4/LIF-7 receipt; CI `37458229657` passed | Pending-stage policy changes preserve reservations; final reports prevent signing/send intent. Post-push close passed; operational service remains owed. |
| 2026-10-06 | same-user host composition, partial | `f27337d` | SIG/POL receipt; CI `37459521513` passed | Startup/drain cases pass; count 501 does not pass SIG-11. ADR-021/H9 pending; post-push close passes. Independent client/validation work continues. |
| 2026-10-06 | distinct socket sending client | `f9c0cec` | CLT-1–4/installed consumer receipt; CI `37460725029` passed | Consumer integration progresses while H9 is pending. Post-push close passed. No signing method broadcasts; explicit propose sends. |
| 2026-10-06 | maintained bite job, partial CI-1 | commit containing `evals/ci/bite.md` | inventory/restoration receipt | First full run rejects stale request selector; repaired without weakening. Historical faults and CI-2 remain owed. |
| 2026-10-06 | synthetic property gate, partial CI-2 | `b41c8c7` | floor/oracle/fault receipt; CI `37480188076` green | Frozen properties added while H9 remains pending. Signer count breakdown corrected to 402 app/99 helpers; total 501 unchanged. Post-push close passes. |
| 2026-10-06 | million-input decoder fuzz, partial CI-2 | `59b2e1c` | completion/fault receipt; CI `37480963029` green | Existing generator qualified at the required floor; separate pinned CI job passes. Post-push close passes. Other CI-2/release work remains owed, H9 pending. |
| 2026-10-06 | SOL cap properties, partial CI-2 | `f631671` | arithmetic/floor/fault receipt; CI `37482318589` green | Per-tx and pending-window synthetic profiles added; no product fix needed. Post-push close passes. Broader cap/security work remains owed. |
| 2026-10-06 | mixed replay, partial CI-2 | `b758463` | digest/matrix/fault receipt; CI `37483948590` green | Driver failure and cap mutation miss retained; focused regression added, production unchanged. Post-push close passes. Disk/kill/snapshot/signing qualification remains owed. |
| 2026-10-06 | queued SDK admissions, partial CI-2 | `3c36cb6` | barrier/evidence/fault receipt; CI `37485168194` green | Post-push close passes; quiet in-memory SDK bound checked. Broader writer/socket/signing concurrency still owed. |
| 2026-10-06 | verified persisted-prefix process kills, partial CI-2 | commit containing `evals/ci/kills.md` | signal/recovery/fault receipt | SDK kernel-owned history qualification; other write/sign/send/power-loss boundaries remain owed. |
| 2026-10-06 | bounded archive verification, SNP-1 foundation | commit containing `evals/sdk/archive.md` | structure/source/pin/fault and installed-consumer receipt | Initial mutation miss and FIFO hang corrected; authenticated snapshots and state replay remain owed. |
| 2026-10-06 | read-only archive command, SNP-2 | commit containing `evals/sdk/archive-cli.md` | command/fault/installed-binary receipt | Prior archive step `f1b6010`: ten close gates and CI `37491296517` green. Numeric fixture miss corrected; state recovery remains owed. |
| 2026-10-06 | AST statement/branch coverage, partial CI-2 | commit containing `evals/ci/coverage.md` | calibrated inventory/counters, initial deficit, remediation and faults | Command step `22235e7`: ten close gates and CI `37493990236` green. Coverage floors unchanged; remaining quality/security gates and H9 still pending. |

| 2026-10-06 | Stryker preparation, partial CI-2 | commit containing `evals/ci/mutation.md` | report/staging receipt; prior coverage CI `37498544709` green | Frozen full-file scope, staged-source proof and maintained faults; actual tool score remains owed. |
| 2026-10-06 | mutation definition 3 and threat-model reconciliation | commit containing the run-limit evidence | 235 staged/464 root cases, fourteen faults; 32 campaigns/271 faults; typecheck clean | Full mutation score and independent threat-model review remain owed. Scope, per-mutant deadlines and release thresholds unchanged. |
| 2026-10-06 | signed-snapshot acceptance allocation | commit containing `docs/plans/2026-10-06_snapshot-qualification.md` | existing accepted ADR-019 and SNP-3–8 mapping; documentation lint | No implementation or measured performance result; authentication/publication precede derived restore, streaming/index and maintenance qualification. |

| 2026-10-06 | SDK candidate reference, partial 5.3 | commit containing `docs/SDK.md` | source interface/behaviour review; document/claims lint | Current exports, trust boundaries and errors documented; stable contracts and usability qualification remain owed. |

| 2026-10-06 | CI-2 differential and performance-report preparation | commit containing `evals/ci/differential.md` | pinned offline corpus, report tests, fault campaigns, root tests/typecheck | Differential reference checks pass; performance targets unmeasured. Interrupted mutation and coverage load failure retained; complete qualification remains owed. |
| 2026-10-07 | SNP-3/5 checkpoint history foundation | commit containing `evals/sdk/checkpoint-archives.md` and `evals/sdk/malformed-replay.md` | first failures, source/packed fault proof, quiet ordinary/type/AST checks | Catalogue metadata and D21 refusal pass locally. Earlier timing failures and actual superseded-run interruption retained; full snapshots, fresh mutation and independent review remain owed. |

| 2026-10-07 | CI mutation authentication populations and runtime execution | commit containing `evals/ci/mutation-authentication.md` | initial scope/definition/dilution failures; fifteen focused cases; twenty-two staging/report and fifteen recovery faults; serial ordinary 565 cases and typecheck | Original and added populations retain separate floors. Previous Node 22 hosted failure and overlapping local timing failures remain retained; corrected hosted qualification and full frozen-target score remain owed. |

| 2026-10-07 | SNP-3/5 validated internal Keel prefix | commit containing `evals/sdk/checkpoint-prefix.md` | seven initial failures; nine focused cases/seventeen source faults; critical/inventory refusals; 574 ordinary and instrumented cases/typecheck | Event payload derives from full replay; signed policy trust enforced. Misses and stopped overlap retained. Publication, authenticated consumption, state restore and fresh mutation remain owed. |

| 2026-10-07 | SNP-3/5 signed admission-state component | commit containing `evals/sdk/checkpoint-state.md` | five stub failures; six cases/sixteen faults; campaign/critical refusals; 580 ordinary/instrumented cases and typecheck | Lifecycle, policy and previous decision retained. Seed-cap miss retained, effective window-copy fault caught. Prefix 23f57d5 hosted CI succeeds; publication, restore, streaming and fresh mutation remain owed. |

| 2026-10-07 | PKG-1 compiled checkpoint payload qualification | commit containing `evals/packaging/checkpoint-payloads.md` | missing-module failure; ten installed cases/eighteen compiled faults; fifteen recovery/driver faults; 580 ordinary cases/typecheck | Internal compiled artefacts pass. Hosted b9c06eb baseline failure retained; child-progress diagnostics preserve workload/wait. Full snapshot and corrected hosted qualification remain owed. |

## 8. Handing back to Claude

When the human asks for Claude, or when every item left needs the human or Claude, Codex checks each of these:

- [ ] Everything is committed and pushed, `tools/session_close.py` is green, and CI is green on the last commit.
- [ ] Every session has its run record in `runs/`. §7 is complete, §5 says what is waiting on the human, and §6 lists
      every owed edit.
- [ ] `PROGRESS.md` is true. Each milestone is marked achieved only with its evidence.
- [ ] A list in the last run record of every decision made inside an ADR, and of every proposed ADR.
- [ ] A list of every test whose assertion was changed or removed since `milestone/beta`, with the reason
      (`git diff milestone/beta..HEAD -- '*.test.ts' '*.test.mjs'`).
- [ ] Every number added to `docs/CLAIMS.md` names its command, its receipt and its date.

Claude, on its return:
1. Reads this file, the run records since `milestone/beta`, and the diff.
2. Applies §6, re-running each changed gate's self-test.
3. Reviews the work for what tests cannot see: weakened assertions, tuned constants, claims beyond their evidence.
4. Runs RT-2, the independent red team, with the black-box harness in `evals/independent/`, on code it did not write.
5. With the human, writes the Alpha's milestone review, and finalises.

## 9. What will bite: lessons from the Beta

- **`node --test` takes globs on Node 26.** `node --test tests/` fails; `npm test` already globs. A battery runs on its
  own as `node --test packages/sdk/test/<name>.test.ts`.
- **`/tmp` is cleared on reboot.** Two evaluator folders were lost that way. Scratch goes in `.sandbox/`.
- **The record is the state.** Any change to a rule can change what replay recomputes. Run `npm run replay` on the
  committed records after every rule change, and name every divergence in the receipt.
- **Fresh seeds after any change of definition.** Seeds that found a problem cannot also confirm its fix. Claim S7
  was stated too broadly once, and was scoped the same day.
- **The benign battery has two counting methods**, kept apart (`evals/sdk/fee-escalation.md`). Never compare figures
  across them.
- **Wallets and frameworks misbehave.** Solana Agent Kit signs plugin payments twice, and re-sends until it sees a
  status: on devnet it reported landed payments as failed. A wallet may sign a batch in place and return it short
  (D15). Test against the published package, never the documentation.
- **In SDK mode, the caller supplies time, heights and outcomes** (RK3). The signer (3.1) is what removes that trust.
  Do not weaken a check because a caller "would not" lie.
- **Devnet.** The public RPC rate-limits, the faucet refuses, and a slow status read once inflated a revoke's timing
  fourfold. Record slots beside wall-clock times.
- **The toolchain.** Anchor 1.2.0 selects Agave 3.1.10; never switch the active release. v1 needs Agave 4.2.2's
  validator, by its absolute path.
- **Keel's pin.** `@gubernaut/core` is 1.0.1, its bytes digest-checked. A bump is the human's decision (RK8,
  `kb/REGISTRY.md`).
- **The boundary guard's heuristic.** `git push`, `rm`, `cp` and a redirect all count as writes anywhere in a command.
  A command that also names a protected path is refused. Split the command, or use `apply_patch`.
- **Independence.** Each builder's battery passed, and the independent evaluators still found six defects in the gaps
  between them. Write each test from the requirement, not from the code.
