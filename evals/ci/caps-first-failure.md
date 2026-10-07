# CI-2 — fault-trial counterexamples and actual completion

2026-10-07 · builder-authored local Linux evidence, Node 26.7.0 / fast-check 4.10.2.
This changes diagnostic work for planted faults; cap rules, generators, requested execution
floor, ordinary shrinking and containment deadlines stay unchanged.

## Failure and reproduction

History commit a94ecf0 CI 37571438128 passes the other jobs but fails the cap fault campaign
(`history/ci-a94ecf0-failed.txt`). The ignore-reservation fault's seed 1678743925 produces
no counterexample before containment. A separate candidate copy reproduces that exact
fault/seed with the same deadline (`caps/counterexample-default.txt`). The child returns
one while its spawn result also carries ETIMEDOUT; an exit code alone is insufficient.

The diagnostic control stops at the first counterexample without shrinking
(`caps/counterexample-first-failure.txt`). It reports the actual reservation defect after
22 generated trials. This old seed is reproduction evidence only, not fresh qualification.
Both copied sources restore. No root mutation source is changed.

## Contract and current evidence

Only planted cap trials set `SOLANAUT_PROPERTY_TRIAL=first-failure`. The default option
object remains unchanged. Unknown modes and reduced budgets refuse. Successful trials
still complete the existing floor; the frozen demonstration seed 23083 produces exactly
the same successful population with either diagnostic mode. Negative trials report an
actual failure without shrinking or retrying it. Ordinary property qualification retains
its original shrinking behaviour. The [pinned library's documented option](https://fast-check.dev/docs/api/interfaces/Parameters/)
controls diagnostics, not which successful cases execute.

The option stub fails all three initial cases (`caps/first-failure-red.txt`). The completion
stub falsely accepts a real timed-out child that prints a plausible failure and exits one
(`caps/false-timeout-red.txt`). After implementation, eight runner/options/process cases
pass (`caps/first-failure-process-final.txt`) and typecheck passes
(`caps/first-failure-typecheck.txt`). Negative fault checks now reject spawn errors and
signals in addition to requiring actual exit one and the expected assertion text.

Twelve maintained property faults pass with restoration (`caps/property-trial-process-faults.txt`),
including default diagnostics, first-counterexample mode, unknown modes and incomplete
process acceptance. All five cap faults pass (`caps/first-failure-cap-faults.txt`); restored
ordinary properties complete their original floor. All candidate inputs restore to the
retained manifest. These campaigns run only inside the isolated copy, preserving the
original live mutation sources and every staged input.
The complete integrated uncommitted candidate passes all 504 ordinary cases with the
fault-mode variable explicitly unset (`caps/first-failure-root.txt`). Typecheck passes.
This superset includes the separately pending checkpoint/coverage work; do not present
the count as a measurement of the history-only or CI-only committed tree. Close, private
sync and corrected hosted CI are still owed. This is not
performance, mutation-score, independent security or release qualification.

## Regenerate

`node --test evals/ci/property-trial.test.ts evals/ci/properties.test.ts`;
`node evals/ci/property-faults.ts`; `node evals/ci/cap-faults.ts`; `npm run typecheck`.
Fault commands must use an isolated candidate while the original full Stryker run is active.
Input manifests are retained in `caps/first-failure-process-manifest.json`; actual group
completion and restored bytes are checked, not presumed from caught-fault messages.
