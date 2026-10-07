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

## 6. Owed edits, to files Codex may not change

Codex appends one row for each edit it needs in `AGENTS.md`, `CLAUDE.md`, `.codex/`, `.claude/`,
`plugins/harness/hooks/`, `tools/boundary_guard.py`, `tools/session_close.py`, `tools/claims_lint.py` or
`tools/kb_lint.py`. Each row gives the exact text and why. Claude or the human applies them.

| # | File | Exact edit | Why | Applied |
|---|---|---|---|---|
| | | | | |
| O1 | AGENTS.md, build convention | Replace `TypeScript run natively by Node 26, with no build step; ESM;` with `TypeScript run natively by Node 26 for development; a release-only build emits JavaScript and declarations for npm consumers; ESM;` | Explicitly approved by the human in the Solanaut 1.0 mission. | no |

## 7. Codex's log

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
