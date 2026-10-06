# 2026-10-06 — codex-solanaut-1

## Asked

Resume the approved Solanaut 1.0 implementation. Continue through unblocked work, retaining
all security, validation and human-owned release gates.

## Did

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

- Handler and SDK journal store pre-admission refusal payloads/answers; interrupted refusal
  starts complete without new proposal work. Errors after admission stay with signing history.
- Transport aligns its message bound with the core. Tests/maintained faults, receipt/index,
  claims/SPEC/trust docs/progress and register now describe the partial implementation.
- Reversible codec decision inside ADR-019: refusal payload is exact message/group, with
  fixed deadline/unavailable codes; no new socket method. Existing binary readers may refuse
  this history and must pass compatibility checks before rollback.

## Found

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
