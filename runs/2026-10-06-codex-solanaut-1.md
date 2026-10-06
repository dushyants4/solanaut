# 2026-10-06 — codex-solanaut-1

## Asked

Resume the approved Solanaut 1.0 implementation. Continue through unblocked work, retaining
all security, validation and human-owned release gates.

## Did

- Command step `22235e7` privately pushed; ten close gates and CI `37493990236` green.
  Continued into CI-2 AST coverage with fixed thresholds, complete SDK/signer inventory,
  native type stripping and explicit test instrumentation. Four gate, two calibration,
  one real-hook and three merger stub failures retained. Exact development dependencies
  installed without scripts; registry signatures pass. Initial complete measurement fails.

- Archive step `f1b6010` privately pushed; ten close gates and CI `37491296517` green.
  Added read-only operator command under SNP-2, with canonical arguments, JSON receipts/errors,
  separate usage/refusal exits and compiled installed executable. Eight command cases and
  seven final faults pass; installed consumers exercise the binary. Receipt `evals/sdk/archive-cli.md`.

- Kill step `91589b3` privately pushed; ten close gates and CI `37486837521` green.
  Continued into SNP-1 bounded archive verification inside accepted ADR-019. Added strict
  framing/chain/pins/source checks and typed installed exports. Sixteen final faults caught;
  six installed consumers/four package faults pass. Receipt `evals/sdk/archive.md`.

- Queued-admission step `3c36cb6` privately pushed; ten close gates and CI `37485168194`
  green. Continued into verified SIGKILL recovery: two stub failures, three gate tests pass;
  added actual kernel-owner death/reopen regression. One hundred trials verify signals,
  complete identical histories and replay. Seven faults caught and all children reaped.
  Dedicated pinned Linux job added. Receipt `evals/ci/kills.md`; no product change.

- Replay step `b758463` privately pushed; post-push close ten gates. Continued into
  queued SDK callers with a frozen profile: two gate stub failures, then four tests pass.
  Initial optional-rule type error corrected; missing bindings cannot count as identities.
  Initial short-budget mutation misses because fixture evidence was inconsistent; fixture
  strengthened to isolate the floor, then seven final faults caught and restored source.

- Cap step `f631671` privately pushed; ten close gates and CI `37482318589` green.
  Continued into pinned mixed replay. Two stub failures preserved; initial extended driver
  fails on old receipt selection. Definition 2 frozen with recent workload view and fresh
  offset10001; 10,000 decisions / 13,651 entries replay, digest pinned. First cap mutation
  survives; added focused regression without changing the generator/digest. Eight final
  faults caught, including correlated recording/replay change. Runtime matrix job added.

- Fuzz step `59b2e1c` privately pushed; ten close gates and CI `37480963029` green.
  Continued into SOL caps: froze domains, asynchronous runner stub fails, then six
  focused tests pass (two properties at 10,000 each). Existing cap implementation needs
  no fix; five planted faults fail the new oracles. Detailed shrunk cases retained.

- Property step `b41c8c7` privately pushed; ten close checks green. Continued directly into
  frozen million-input decoder workload. Three wrapper tests fail first, then pass; local
  million-input run passes at seed -1722707241, with 189,174 kit matches and 810,826 refusals.
  Separate pinned CI job and maintained faults prepared. Receipt `evals/ci/fuzz.md`.

- Resumed after deliberate interruption; property fault campaign finished with eight faults
  caught and restored source, no process left running. Frozen five synthetic properties each
  complete 10,000 executions. Three stub gate tests fail first; eight focused tests pass.
  New dependency fast-check 4.10.2 locked with pure-rand 8.4.2, installed ignore-scripts.
  Receipt `evals/ci/properties.md` retains advisory/signature audit results and runner failure.
- Prior bite commit `dc1d6b1` CI `37461704632` green. Corrected arithmetic breakdown to
  402 signer app/99 helpers, unchanged total 501. H9 remains unaccepted; no expansion.
  Property tests run through the existing matrix; faults added to sequential bite inventory.

- Sending client `f9c0cec` privately pushed; ten close gates and CI `37460725029` green.
  Continued into CI-1 maintained fault aggregation. Three tests fail first, then pass;
  five planted aggregator faults caught. First full run rejects a stale request selector;
  final sixteen-campaign run catches 105 faults and restores source. Receipt `evals/ci/bite.md`.
- Added pinned CI bite job without removing existing injections or weakening gates. Root
  test command now includes aggregation tests; full suite 329 passes, typecheck clean.
  No dependency added. H9 remains pending; no silent budget acceptance.
- Read official fast-check runner/configuration documentation and npm metadata in preparation
  for CI-2 properties. No package installed yet; returned pin 4.10.2 and its registry integrity.

- Same-user partial composition privately pushed as `f27337d`; ten close gates and CI
  `37459521513` green. H9 remains pending; no budget or dependent expansion authorised.
- Continued into independent consumer integration. Eight client cases fail against a stub;
  corrected native TS syntax/data typing, then captured request ID after a further mutation
  regression fails. Eleven client/eight service cases pass; ten client faults, eight service
  faults and four installed-package faults caught. Full suite 326 and five installed checks
  pass; typecheck clean. Receipt `evals/sdk/sending-client.md`; package remains private.

- Signed-policy correction `f6c8641` privately pushed; close ten of ten and CI `37458229657`
  green across all runtimes/office. Continued into same-user host composition without ending.
- Five startup tests fail first, then pass; added drain tests expose untracked host recovery.
  Both socket and host work now drain before lock release. Seven final service cases pass;
  eight final faults caught. Full suite 314 passes, typecheck clean, package checks four pass.
- Same-user factory still injects signing/RPC; key/configuration loading and executable/isolated
  modes remain owed. ADR-021 proposed and H9 asked asynchronously; dependent expansion waits,
  independent client/validation work continues. No acceptance inferred from silence/tool receipt.

- Continued without ending after a queue step, as requested. Signed-policy upgrade battery
  passes existing pending-stage restrictions; four new settled-signing cases fail first,
  then pass after executor/journal/state correction. Five new and seven existing maintained
  signing faults caught; receipt `evals/signer/policy-recovery.md`. Record-sync CI `37457518225`
  is green. Read-only lookup used a guessed fault-runner filename; found the actual tracked
  path. No external project search or read occurred.

- Recovery implementation privately pushed as `8b92594`; post-push close passes all ten
  checks with a clean tree. CI `37457271361` passes Node 22.18.0, 24, 26.7.0 and office.
  Bounded CI watch timed out while jobs were still running; subsequent direct view confirmed
  success. No validator, soak or mutated source remains running.

- Continued from clean, fetched `d64a943`; both live fence probes refused correctly.
  Baseline: 295 tests pass and typecheck clean. Read-only law batch with redirected output
  was refused by the boundary heuristic; removed the redirect, no protected write attempted.
- Added LIF-6 recovery regressions, observed four failures, then isolated each attempt's
  errors while retaining chain follow-up. Four maintained recovery faults and six existing
  core faults are caught; source restored. Receipt: `evals/signer/recovery.md`.

- Refusal implementation committed and privately pushed as `a40375a`. Post-push close passes
  all ten checks; CI `37453503555` passes Node 22.18.0, 24 and 26.7.0 plus the office job.
  Working tree clean at verification. No validator, soak or fault-mutated source remains running.

- Continued from `b7d24a5`, privately pushed; CI `37405479424` passes all approved runtimes.
- Read the project law, handoff and progress. Fetch completed; working tree contains only the
  next proposal-refusal tests. Both live boundary probes refused correctly; no probe created.
- Initial LIF-5/transport battery from the preceding date: 27 cases, four failures, 23 passes.
  Pre-admission refusal history and message-size alignment fail as intended; the already-recorded
  admission error case passes. Scratch evidence: `.sandbox/solanaut-1/refusal-red.log`.

## Changed

- Coverage step adds test-only AST instrumentation/collector, complete source/counter
  inventory and exact floor validation; a pinned CI job and maintained gate/product faults.
  Adds security-boundary tests without changing production source or signer budget.

- Archive command adds a native TypeScript bin and tests, compiled release inclusion and
  installed executable checks; documents strict arguments and actionable typed failures.

- Archive step adds SDK reader/tests, maintained fault campaign and installed exports;
  updates STORAGE, SPEC, OVERVIEW, RISKS, claims/register, progress, handoff and receipt index.

- Handler and SDK journal store pre-admission refusal payloads/answers; interrupted refusal
  starts complete without new proposal work. Errors after admission stay with signing history.
- Transport aligns its message bound with the core. Tests/maintained faults, receipt/index,
  claims/SPEC/trust docs/progress and register now describe the partial implementation.
- Reversible codec decision inside ADR-019: refusal payload is exact message/group, with
  fixed deadline/unavailable codes; no new socket method. Existing binary readers may refuse
  this history and must pass compatibility checks before rollback.

## Found

- First full coverage-step bite rejects RPC/socket campaigns because expanded batteries no
  longer match their old completion counts. Product faults already fail as required. Updated
  exact expected counts upward to seventeen/sixteen, preserving all mutations and deadlines;
  failed aggregate retained and full run repeated after restoration.

- Coverage mutation harness first expects the wrong completed-test count; retained its
  rejection. Coercion fault then survives because canonical comparison masks a benign object;
  added a throwing coercion input. The signing-policy selector occurs at two stages; narrowed
  to the exact signed-stage statement. Final campaign catches all nineteen faults.

- Initial AST coverage misses the accepted SDK/signer statement floors, signer aggregate
  branches, latch and socket critical branches. Raw initial summary/output retained in
  `evals/ci/coverage/`; thresholds unchanged. Added malformed signature/payload/journal,
  corrupted restore, RPC configuration/response/context/deadline and socket resource cases.
- A combined read-only diagnostic plus stdout redirection triggered the boundary heuristic.
  Removed the write operation and ran the read-only diagnostic as permitted by the law;
  no key file or protected content read, and no protected write attempted.
- The initial socket-saturation fixture waits for EOF and treats a reset after a complete
  busy frame as failure. Replaced that fixture read with the actual sending client, requiring
  its typed remote/busy result and no execution uncertainty. Client count and server rules
  unchanged. Failed measurement retained; this is a fixture correction, not an ignored gate.

- CLI numeric fault initially survived because continuation validation masked its fixtures.
  Added a valid line-limit numeric domain to isolate spelling; seven final faults now fail.
  Installed checks fail first on absent executable, then pass after release-build wiring.

- Archive reader initially rejected fractional monotonic timestamps; corrected without
  weakening safe-integer sequences. Null options and mock typing failed; corrected. A test
  reseal retained its old hash; fixed fixture. Initial source-size mutation survived because
  timestamps masked it; isolated size-only mutation now fails. All outputs retained.
- One multi-file documentation patch had a mismatched STORAGE anchor and applied nothing;
  retried with the exact line. No protected edit or threshold exception.
- FIFO source regression reproduces blocking open; nonblocking descriptor acquisition now
  reaches regular-file refusal. Its timeout child is reaped and the mutation is maintained.
- The final fault aggregator started while the root test process was finishing. That root
  output is retained separately; rerun root tests only after mutation restoration to remove
  any uncertainty from process overlap.

- Kill step final: 355 tests pass, typecheck clean; twenty-two bite campaigns catch
  147 faults and restore source. One hundred-trial command finishes and all children are
  reaped. Pre-push close follows; no stable-release or complete isolated recovery claim.

- Kill evidence is bounded to acknowledged persisted prefixes. It does not establish
  unacknowledged-write, signing/send, power-loss or isolated-user recovery. No active child
  remains after each command completes; trial data is synthetic and stays in scratch.

- Queued-admission final: 351 tests pass, typecheck clean; twenty-one bite campaigns catch
  140 faults and restore source. Replay CI `37483948590` passes every job. Reconciled stale
  evals index footer that still described the maintained fault job as entirely owed.

- Queued SDK profile's type error and initial gate mutation miss are preserved in its receipt.
  Evidence is from synchronous admissions reached by asynchronous callers; no multi-process
  or isolated-signer concurrency claim. No product fix or threshold change was required.

- Replay final validation: 347 tests pass, typecheck clean; twenty bite campaigns catch
  133 faults and restore source. Pin passes again. No active validator, soak or service.
  Historical/CI-2 remaining gates and all human-owned release gates remain required.

- Replay initial driver failure and initial mutation miss remain in `evals/ci/replay/`.
  Old workload extended beyond its bounded battery selected unretained reporting state.
  Revised selection view leaves actual retained history intact. Pin does not cover per-tx
  cap by itself; focused regression now catches that fault. No product or threshold fix.
  A transient duplicate CI job-name field from a patch was removed before validation.

- SOL property final validation: 343 tests pass, typecheck clean; nineteen bite campaigns
  catch 125 faults and restore source. No cap defect found in these frozen profiles.
  Read-only coverage-tool investigation: c8 12.0.0 registry metadata/docs read; no install
  or coverage claim. Statement accounting must be resolved before choosing the next tool.

- Fuzz pre-push close rejects the environment-prefixed command in S34 (claims parser
  requires npm/node/uv first). Corrected the claim's command spelling and documented the
  seed separately; protected lint unchanged. Raw captured output retains whitespace.

- Fuzz step: three wrapper stub failures preserved; seven gate/product faults caught,
  all sources restored. Full suite 340 passes and typecheck clean; updated aggregation
  inventory/five faults pass. Prior property commit CI `37480188076` green on all jobs.
  Document patch-anchor failure made no partial edits; no gate or generator weakened.

- Initial property mutation runner used unsupported Node `--test-bail`; no qualifying
  result, source restored. Removed flag without weakening assertions. Patch-anchor failures
  applied no partial edits. Signer budget breakdown arithmetic corrected, total unchanged.
- Property step pre-push close passes nine gates; the uncommitted-tree gate fails. Full
  suite 337 passes, typecheck clean; seventeen bite campaigns catch 113 faults and restore.
  Advisory audit exits one with existing high findings; authenticity audit exits zero.

- New full aggregation finds an old identity fault site missing since shared control history.
  Changed only its selector to the same digest comparison; failure output retained. Runner
  reports failed campaign rather than manufacturing a catch, and proceeds only after source
  restoration. Historical manual campaigns and all CI-2 targets remain unqualified.

- Client initially used non-erasable constructor properties; native Node and typecheck refuse.
  Socket data typing needed explicit byte conversion. Both corrected, raw native failure kept.
- Response-ID validation initially reread mutable caller input. Captured identity before
  connecting; original assertion retained. Stale candidate lacked new exports/declarations;
  outside consumer checks fail first then pass after release-only compilation.
- Client results distinguish immutable admission responses from pre-admission refusals;
  uncertainty is conservative and never a reason for automatic retry/new payment identity.
  Constructor/typed-result/API choices are reversible inside ADR-019. No partial-signing
  method is changed. Packet bounds follow the existing transport contract.

- Size initially 506 lines including the historically counted SDK helpers. Simplified redundant
  event type checks, duplicate allowed check and equivalent guard-open cleanup; final count 501,
  split 401 app and 100 SDK helper lines. SIG-11 remains unachieved. No compression or threshold
  exception is claimed; ADR-021 proposes a human decision before remaining signer expansion.
- Initial authorization mutation survives because SDK independently verifies it. Stronger
  unsigned-bootstrap mutation exposes missing cleanup on unexpected startup; permission fault
  exposes the same fixture issue. Added shared unexpected-service cleanup without altering
  refusal assertions. Bounded child runs stop; no service left running. Selector ambiguity
  fixed by including recover context. All initial outputs retained in the service receipt.
- A transient, unnecessary comment in HANDOFF §8 was removed immediately before commit;
  only permitted §5/§7 edits remain in the diff. Referenced generic architect-seat knowledge
  files are absent locally; no other workspace searched. Architecture proposal is based on
  this repository's accepted ADRs and measured inventory.

- A final report did not prevent new signing/send intent in the journal; signed unsent
  executor recovery could consequently send a final reported attempt. Closed test-first
  in both executor and replay validation. Unknown reports remain non-final.

- Recovery aborted at an expired admission, provider outage, expired signed bytes or failed
  response persistence. Corrected without loosening signing, lifetime or reservation rules.
- The initial mixed-attempt fixture reused an in-flight intent, so its supposed sent payment
  was denied. Corrected the amount and added explicit sent/admission assertions; unchanged
  original outcome assertion now passes. First post-fix scratch output was overwritten;
  initial red and final green are retained. Two document patch attempts had invalid anchors;
  neither changed any file, then corrected patches applied.
- Baseline close: nine of ten gates, uncommitted changes pending. Final close follows push.
- Reversible choice inside ADR-019: recovery returns per-decision completion, no error details;
  completion describes the operations in this pass, not chain settlement or storage readiness.

- The final record-sync shell batch was refused by the boundary heuristic because it combined
  the close-tool path with staging. No protected write occurred; split the documented close
  invocation from ordinary staging as the project law instructs. Gates remain unchanged.

- Proposal failures before admission leave no durable request answer. An interrupted refusal
  also needs conservative recovery without calling the proposal executor again.
- Transport currently accepts a message larger than the core's bound. Such input must be
  rejected as a protocol frame before dispatch.
- Both findings corrected: 28 focused cases pass; nine handler, nine socket and eight control
  faults caught. No miss in these final runs. Strengthened incomplete-frame fixture before
  mutation because the new message bound would mask removal of the framing bound. A fixture
  proposal signature failed typecheck, corrected to the real argument type. No gate widened.

## Open

- Operational signer lifecycle, protected key/configuration, signed-policy enforcement,
  disk request index/snapshots and full security/reliability qualification remain owed.
- Same human dependencies as `docs/HANDOFF.md` §5; no Alpha or stable-release claim.
- Existing protected-file owed edit O1 remains in HANDOFF §6; no protected file changed.

## Provenance

While Stryker runs only in its staged copy, drafted `docs/SDK.md` as the current candidate
export/error reference and linked it from PACKAGING (Draft 5). Checked behaviours against
the source interfaces and existing receipts; no new product code or tests. Ordinary full
tests/typecheck remain the preparation revision's evidence; no competing performance run.
An initial combined documentation patch had a mismatched PACKAGING anchor and applied nothing.
A stray blank line in HANDOFF's read-only section was immediately restored; final change is
only its permitted log section. SDK candidate documentation passes knowledge/claims lint;
prior preparation commit `9775c83` CI `37500413572` passes every job.

Preparation committed/pushed as `9775c83`; post-push close ten gates. CI `37500413572`
queued at last read. First background launch (PID 752653) exited with no output; no measured
result. Managed qualification session 66528 runs driver PID 753395 / Stryker PID 753410,
log `.sandbox/solanaut-1/mutation/qualification-managed-9775c83.txt`, staged run `run-nfEogh`.
Initial instrumented test run succeeds. Stop remaining children before ending the session.
Input definition and scope were committed before measurement; no score claimed yet.

Mutation preparation: core 10.0.0 installed exactly with scripts disabled; signature audit
529 signatures/207 attestations, advisories now 3 low/11 moderate/7 high/no critical. New
moderate findings through typed-rest-client/qs remain open. Eight report/staging cases,
eleven final faults and 235 staged tests pass. Initial scope-removal miss, inherited nested
test context error and environment type error retained in `evals/ci/mutation/`; fixed without
lowering thresholds. Full suite 415 passes; typecheck zero. Full bite passes all campaigns,
with all sources restored. Coherent private preparation commit precedes the long Stryker run;
actual mutation-score qualification remains owed at this preparation revision.
The first combined receipt/spec patch had an unmatched anchor and applied nothing.
Prior coverage commit `657e338`: CI `37498544709` succeeds across all jobs.

Coverage step final commands: `npm run test:coverage` passes 407 instrumented tests and all
fixed floors; `npm test` 407 passes, typecheck zero, six installed-package checks pass.
`npm run test:bite`: 25 campaigns / 189 caught faults, all sources restored. Receipt
`evals/ci/coverage.md`, exact counters/source hashes in its final summary. No production
source changed; signer budget/ADR-021 status unchanged. Pre-push close nine gates.
The Stryker command-runner package lookup returns 404; it is a core configuration option,
as the official configuration documents. No Stryker package installed in this step.

Archive command: `npm test` 379 passes; typecheck zero; eight focused cases/seven faults,
six installed checks/four package faults. Full bite: 24 campaigns/170 caught faults,
all sources restored. Receipt `evals/sdk/archive-cli.md`; pre-push close nine gates.
Two documentation patches had unmatched anchors and applied nothing; corrected single
anchors afterwards. Staged secret-pattern review and final private close follow.

Archive step: final sequential `npm test` 371 passes, typecheck zero, six installed-package
checks/four package faults pass. Full `npm run test:bite` passes 23 campaigns/163 faults,
all sources restored. Receipt `evals/sdk/archive.md`; pre-push close nine gates, only
uncommitted-tree gate pending. Raw stdout whitespace retained without alteration.

Starting HEAD `b7d24a5`; Node 26.7.0, Keel 1.0.1 and sensor v1. Commands:
`node --test apps/signer/test/handler.test.ts apps/signer/test/socket.test.ts`,
`npm test`, `npm run typecheck`, `uv run --script tools/session_close.py --slug codex-solanaut-1`.
Builder-authored evidence; no key-file read, real chain send, OS-user creation or publication.
Final commands/retained outputs: `evals/signer/refusal.md`. Full suite 295 passes, typecheck
clean and four installed package checks pass. Partial signer/helper total 453 lines against
the unchanged 500-line final budget; host service and full qualification remain owed.
Recovery step final validation: 299 tests pass, typecheck clean, four installed-package
checks pass. Outputs in `evals/signer/recovery/`. Current partial helper count 459 lines;
final operational service remains owed. Staged pattern scan hits only Solana token test
names in retained output, no credentials. Documentation patch-anchor failures applied no
partial edits. Full diff read; pre-push close has only the expected uncommitted-tree failure.
