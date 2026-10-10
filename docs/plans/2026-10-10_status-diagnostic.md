# Solanaut 1.0 — status and acceleration diagnosis

2026-10-10, reviewed starting HEAD e7d92e1, local-only work.
Formal progress remains CLAIMS S78: 16 of 39 milestones, rounded to 41%.
This is milestone accounting, not effort, elapsed time or release readiness.
Components inside unfinished milestones receive no fractional credit.

At inspection the tree is clean and no Solanaut test, validator or soak worker
is active. The current continuation diagnoses H11, observes actual completion,
tests a review copy and archives an exact owner edit. No background job is
waiting to finish the product. Runtime servers visible in the process inventory
are not evidence of a Solanaut blocker and are not stopped.

The unchanged full native suite fails only H11. Its real staged child naturally
passes all 573 cases in 22.223 seconds, after the original twenty-second wait.
The generated sixty-second review copy passes all six original recovery cases;
the actual gate stays unchanged. Evidence and scope: CLAIMS S123 and
[baseline latency](../../evals/ci/baseline-latency.md).

| Completed or prepared | Remaining qualification |
|---|---|
| Human-approved Beta: decoding, classification, policy/admission, journal/replay, Keel, adapters, devnet Squads and cockpit | Alpha and stable release remain unapproved |
| Accepted latch correction; signed-policy, lifecycle, exclusive ownership, authenticated history/index, storage hardening and queued bookkeeping components | Complete isolated signer, authoritative RPC, durable send reconciliation and bounded retention/restart |
| Private release-only build, installed consumer checks, replay tooling, scoped fault/property/recovery batteries and verified local Git restore | Complete CI matrix, mutation/fuzz/differential/performance, concurrency and soak requirements |
| D39 serialised-wire correction integrated; D40 correction with focused/source/emitted/installed Node 26 and Node 24 proof prepared | D40 remains an unapplied patch because full native/AST fail H11 |
| Framework/MCP compatibility research, filter components and operator preparation | Qualified Eliza graph, Token-2022/ATA, Phantom paths, opaque fallback qualification, anchor, alerts/dashboard |
| Installation/preview/documentation and publication-review preparation | Clean Ubuntu operational drills, outside developers, usability/accessibility, Claude RT-2, specialist audit, bounty and publication |

| Bottleneck | Concrete next action |
|---|---|
| H11 harness wait prevents full qualification | Human decides H11; owner applies exact O6 diff; rerun original full gates on the new revision |
| Actual sequential package campaign fails, with earlier timeout diagnostics | Owner reviews/applies O2/O3; qualify complete original populations, entry point and cleanup |
| Signer budget and compact-state contract | Resolve H9/ADR-021 and H14/ADR-023 before dependent work; do not hide helper lines or delete lifecycle evidence |
| Anchor instruction/authority contract | Resolve H10/ADR-022 before dependent program implementation |
| Hosted account refuses execution | Account owner resolves H13 billing/spending setting; latest read-only annotations confirm jobs never ran |
| Live isolation and devnet qualification | Human creates required users, funds devnet keys, provides reliable RPC and performs Phantom signatures |
| External release gates | Arrange outside developers, Claude review, specialist audit and bounty; licence, visibility and publication stay human-controlled |

The no-push instruction also means ordinary remote push-triggered CI cannot
test the newest local commits. Historical hosted results cover earlier remote
revisions, not current HEAD. Keep local qualification moving; exact hosted
qualification and final publication need the human's authorised handoff later.

There is no defensible calendar ETA while design decisions, live resources and
audit commitments are unset. Even after a qualifying candidate exists, the
specified soak requires 72 hours; a passing offline component is
not a substitute. Audit remediation can require another qualification cycle.
Progress can increase in larger jumps when complete milestones exit, so the
unchanged percentage does not mean that no engineering work happened.

To accelerate: resolve the owner/architecture queue first, arrange external
resources while implementation continues, and run quiet timing/fault jobs
without overlap. Retain the original evaluation populations and failures.
Use the already tested isolated package proposal rather than repeating the
known failing sequential campaign unchanged. Once decisions move, integrate
the preserved D40 patch and qualify the exact candidate. A staged SDK preview
needs H12 acceptance and separate publication decisions; it cannot be called
stable 1.0. No push or publication occurs in this continuation.
