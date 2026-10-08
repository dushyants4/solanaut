# CI-2 — confirmed shutdown before mutation scratch removal

2026-10-08; Linux/Node 26.7.0; evaluator/operator-authored local fixtures, not
independent security evidence. Base implementation `5a33e69` plus this receipt's
follow-up. Raw output: `mutation-stop/`. Full preceding hosted failure is retained
in `../sdk/owned-request-index/hosted-5a33e69/`.

Hosted run 37841558758 completes failed. Its runtime/AST/recovery-driver jobs
exceed the existing real-baseline wait; several teardown paths then raise
ENOTEMPTY because they remove scratch while the interrupted supervisor still
writes there. This secondary error masks the primary failure. Separate maintained
campaigns also expose an ambiguous recovery fault target and an outdated loading
campaign case count; those trials remain and now target the exact intended
operation and complete sixteen-case publication suite.

The test harness now interrupts a pending known supervisor and awaits its bound
durable completion before deleting scratch. Already completed tickets do not
trigger another signal. Malformed PID boundaries, corrupt completion evidence,
unsupported completion shape and explicitly unconfirmed process-group shutdown
refuse cleanup. If shutdown cannot be confirmed within the separately declared
ten-second teardown containment, scratch remains; the original test failure stays
primary. Successful test bodies still fail when their cleanup fails.

This helper is for trusted harness tickets, not a general process-control API or
proof against every PID-reuse race. The original twenty-second baseline wait,
selected 464-case population, mutation definition 25/seed 25813, run limits,
grace periods, property budgets, score floors and product latency targets are
unchanged. H11's proposed baseline-wait change remains unapplied.

Two actual-supervisor cases fail against immediate signal/return teardown, then
pass after implementation. A delayed child shutdown produces a late file before
its supervisor commits. Completed-ticket tests assert no fresh signal, reject
resealed unsupported/unconfirmed completion and malformed commit markers. Seven
final semantic faults pass and restore the helper. The initial missing-signal
fault was missed because the child's own timeout eventually stopped it; retain
that output, and assert explicit interruption with no timeout. No deadline or
coefficient was adjusted to pass. Each rerun uses new actual child processes and
fresh run identities.

The missing-campaign inventory fails before registration; the maintained list
now includes this campaign without removing earlier entries. Partition coverage
and restoration checks remain required. These checks establish no full mutation
score, passing hosted run, Alpha, stable release, live signer lifecycle or
power-loss durability.

```sh
node --test evals/ci/mutation-stop.test.ts
node evals/ci/mutation-stop-faults.ts
node --test evals/ci/bite.test.ts evals/ci/bite-partitions.test.ts
node evals/sdk/checkpoint-owned-recovery-faults.ts
node evals/sdk/record-loading-faults.ts
node evals/ci/mutation-recovery-faults.ts
npm test
npm run typecheck
npm run test:coverage -- --serial
```

Final full-suite and isolated driver results are retained after quiet execution;
source SDK behaviour and root exports are unchanged by this harness correction.
Fresh ordinary suite passes 742 cases; native typecheck exits zero; all fifteen
isolated recovery/driver faults pass with restoration. Serial AST follow-up uses
the same SDK/signer floors. No successful hosted result is inferred from these.
Final serial AST population passes all 742 cases and unchanged floors. Exact
product-source hashes/counts are retained in `mutation-stop/coverage-summary.json`.

## Missing committed evidence follow-up

Hosted c2df043 run 37846194595 completes failed. Full output and job metadata
are retained in `mutation-stop/hosted-c2df043/`. Node 22, Node 26 and fault
partition one fail the unchanged staged-baseline wait. Node 24, AST coverage
and fault partitions two and three pass. The original failure is visible rather
than masked by ENOTEMPTY; complete passing CI remains owed.

`readSupervisedResult` previously treated ENOENT throughout its reader as pending.
Removing an already committed result or its marker therefore permitted shutdown
to signal a potentially reused supervisor PID. The maintained completed-ticket
case removes and restores each file, requires a missing-evidence error from the
reader and shutdown, and asserts no signal. Its first run fails with "Missing
expected exception". A zero-length existing private marker remains pending;
missing required evidence now refuses. No completion format or wait changes.

The two stop cases and existing supervisor suite pass together. The stop campaign
retains its original seven trials and adds restoration of the former ENOENT
fallback as an eighth semantic fault. All eight are caught and both sources
restore. The existing supervisor campaign also passes and restores. Full ordinary,
typecheck and recovery-driver follow-up are retained separately.

These are local builder/operator checks, not independent evidence or a general
process-ID identity guarantee. No product code, profile or SDK export changes.

Fresh full ordinary suite passes 742 cases; native typecheck exits zero. All
fifteen isolated recovery/driver faults pass with source restoration before the
ordinary run. The product-source inventory and coverage floors are unchanged;
preceding c2df043 hosted AST evidence remains separate. No fresh full mutation
score or passing hosted result is inferred. Raw follow-up commands/output:
`missing-evidence-first-red.txt`, `missing-evidence-pass.txt`,
`missing-evidence-faults.txt`, `missing-evidence-supervisor-faults.txt`,
`missing-evidence-driver-faults.txt`, `missing-evidence-ordinary.txt` and
`missing-evidence-typecheck.txt` under `mutation-stop/`.
