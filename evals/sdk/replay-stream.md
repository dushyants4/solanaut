# SNP-7 — internal streamed recomputation

2026-10-07 · builder-authored local Linux/Node 26.7.0 component evidence · base
c2c2f5c plus candidate. No new root SDK export or live recovery capability.

Capture policy and trust before reading. Fully consume the source to derive the
first signed policy, maximum historical window and canonical-record fingerprint.
Reopen it and recompute every decision through the existing checker. Successful
completion requires the same count and fingerprint. Source errors refuse with a
typed internal error; early divergence closes the current iterator. Copies of
streamed entries protect replay state from producer mutation. The public array
path keeps its synchronous per-record loop.

## Evidence and findings

Initial missing-function cases fail before implementation. The first asynchronous
array refactor creates a compatibility risk. Its first regression attempts to
mutate an immutable fixture and produces an asynchronous error; that failure is
not credited as proof. A mutable copy and an actual planted asynchronous-loop
fault establish the boundary. The first source-capture fixture also leaves rejected
activity after its availability assertion; the corrected initial cases are retained.

Focused source cases compare with full array replay, include a separately asserted
over-window denial after signed window expansion, trust/sensor substitution,
changed complete reads, cancellation, malformed sources and actual pinned archive
segments. A same-count resealed malformed decision with a changed explanation
still recomputes, so fingerprint agreement is checked separately from count.
The first signed-sensor fault site is ambiguous and earns no credit; its unique
streamed-path replacement catches. A generic seal type initially fails typecheck;
the actual decision type fixes the fixture. All failures remain alongside passes.

Maintained inventory and expanded selected-test scope fail before registration.
Definition 17/fresh seed 24517 retains all prior sources/tests/floors/limits and
adds the streamed-recomputation tests. Old installed artefacts fail first; compiled
consumer and fault checks follow rebuilding. Final integration and driver evidence
follow. No complete mutation score is inferred from a baseline.

Definition 17 ordinary integration passes before the producer case is added.
Definition 18 declares that added case before measurement, but its posture-only
producer mutation misses omission of the copy. A durable status request/response
fixture now mutates the yielded request's hash, exposing retained object aliasing.
The strengthened workload is declared as definition 19/fresh seed 24713 before
integrated measurement; all earlier inputs/floors/limits remain. The missed trial
is retained and does not earn fault credit.

Commands: `node --test packages/sdk/test/replay-stream.test.ts`;
`node evals/sdk/replay-stream-faults.ts`; `npm run release:prepare`;
`node --test evals/packaging/packed-sdk.test.ts`; `node evals/packaging/faults.ts`;
`node evals/ci/mutation-faults.ts`; `node evals/ci/mutation-recovery-faults.ts`;
`npm test`; `npm run typecheck`; `npm run test:coverage -- --serial`.
Raw results and exact input hashes: `replay-stream/`.

Final focused cases pass ten checks; nine source faults restore exactly. Ten
installed consumer cases and forty-eight compiled faults pass. Forty-two
staging/report and fifteen fresh recovery/driver faults restore, exercising the
381-case selected baseline under definition 19/seed 24713. Revised ordinary and
serial AST suites pass 652 cases; native typecheck exits zero and unchanged floors
pass, guard 424/442 statements and 379/407 branches. The earlier 651-case ordinary
run remains labelled as the pre-producer definition, not final qualification.
Exact source hashes and final AST summary are retained. CLAIMS S75 records these
scoped measurements. Close/private sync follows.

## Limits

This removes full-array input retention for recomputation, not retained active,
historical request, response or signing state. Source factories must themselves
authenticate raw archive framing/pins and complete their source checks. Canonical
record fingerprints alone do not prove immutable raw file bytes or ownership.
No guard startup, restored-state publication, admission capability, disk index,
bounded memory/restart/performance result, independent security, Alpha or release
clearance. H9/H10/H11 remain pending; every wait/floor remains unchanged.
