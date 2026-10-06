# 2026-10-06 — codex-solanaut-1

## Asked

Resume the approved Solanaut 1.0 implementation. Continue through unblocked work, retaining
all security, validation and human-owned release gates.

## Did

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
