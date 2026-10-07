# CI-2 — Stryker preparation and report gate

2026-10-06 · evaluator/operator · builder-authored local Linux evidence, Node 26.7.0.
This receipt qualifies the report/staging checks, not the required mutation score.

The first full qualification was interrupted with the session. No worker survives and no
completed report exists. Initial-run output and its frozen manifest are retained as
`mutation/interrupted-9775c83.txt` and `mutation/interrupted-manifest.json`; no score can be
inferred from them. A fresh full run remains owed.

## Frozen definition

Definition 3 retains definition 1's complete SDK source files: `base58.ts`, `classify.ts`, `guard.ts`,
`message.ts`, `pda.ts`, `policy.ts`, `state.ts` and `tables.ts`: byte/account resolution,
instruction effects, policy validation, admission and reservations. No line ranges, ignored
mutants, excluded mutators, static-mutant suppression or incremental results. The existing
mutation-score threshold in `docs/READINESS.md` remains unchanged.

`mutation-stage.ts` freezes selected decoder, classifier, policy, admission, drain, sensor,
replay/restart, ownership, storage and signed-policy/signing-history tests. The decoder
mini-fuzz uses fixed inputs; properties and million-input fuzz remain separate gates.
Signer/firewall and opaque-program mutation qualification remain owed.

The second definition-1 run at `13bb075` was deliberately stopped under resource pressure
before any completed report or score. Its output and manifest are retained as
`mutation/resource-pressure-13bb075.txt` and `mutation/resource-pressure-manifest.json`.
No worker survives. Many child test processes competed with operator validation; the
original FIFO startup deadline failed again. Definition 2 executes the same eighteen files
and 235 cases with `--test-isolation=none`, retaining four workers, full source scope,
default mutators and the unchanged score floor. A fresh mini-fuzz seed, 23067, replaces
23063, and append-only progress reporting exposes run progress. No mutation score was
observed before this operational change.

The new execution assertion fails against the old configuration (`definition-2-red.txt`).
All 235 staged cases pass together (`definition-2-baseline.txt`), and twelve maintained
report/staging faults are caught, including removal of the execution mode
(`definition-2-faults.txt`). Definition 2's actual score remains owed.

The definition-2 full attempt at `e508246` completes its instrumented dry run but its
observed progress cannot fit the self-chosen whole-run containment window. It is stopped
without a completed report; output/manifest remain in `runtime-limit-e508246.txt` and
`runtime-limit-manifest.json`. No worker survives and no score qualifies. Partial survivor
and timeout counts are not a completed mutation result, and no production source is tuned.

Definition 3 allows the full generator twelve hours rather than two. This changes resource
containment, not a release latency target or the per-mutant test deadlines: four workers,
10,000 ms plus the same 1.5 test-time factor, complete eight-file scope, default mutators,
eighteen test files and score floor all remain unchanged. Seed 23071 is fresh after the run
definition change; the mini-fuzz population remains 5,000. The manifest records the whole-run
limit. Its configuration test fails first (`run-limit-red.txt`); fourteen final report/staging
faults pass, including the whole-run constant and unchanged per-mutant timeout
(`run-limit-faults.txt`). This permits completion; it does not waive successful completion,
source equality, report inventory/status checks or the existing score threshold.

The built-in command runner executes native TypeScript tests without test-level coverage
optimisation. Concurrency/deadlines are fixed before measurement. Staging copies only SDK
source/bins, selected tests/support and package metadata. Dependencies are linked from the
locked installation; other repository records are not copied. Changing staged policy fails
staged tests while the original stays byte-identical. Stryker never mutates working sources.

The report gate requires successful completion, schema, exact file inventory/source contents,
unique mutant IDs, valid locations/metadata and completed statuses. Killed/Timeout count as
detected; Survived/NoCoverage as undetected; CompileError/RuntimeError stay explicit as invalid.
Ignored/Pending/unknown statuses, empty/all-invalid populations and below-floor scores fail.
Comparison uses unrounded counts. Reports alone cannot prove no individual mutant was omitted:
the pinned generator, frozen configuration, successful process and raw report are also required.

Sources: [official configuration](https://stryker-mutator.io/docs/stryker-js/configuration/)
and locked `mutation-testing-metrics/dist/src/calculateMetrics.js`.

## Failures retained

Six cases fail against the stub (`mutation/initial-red.txt`); malformed roots already refuse.
The initial isolation fixture inherits `NODE_TEST_CONTEXT`, causing child tests to skip
(`focused.txt`, `initial-faults.txt`). Clear it for the distinct child runner. The changed
staged policy then fails real tests. A scope-removal fault initially survives a self-referential
inventory assertion (`faults-second.txt`); added an independent literal inventory check.
An inferred environment-object type rejects deleting the test variable (`typecheck.txt`);
the explicit Node environment type fixes it (`typecheck-final.txt`). No threshold reduced.

## Regenerate

- `node --test evals/ci/mutation.test.ts evals/ci/mutation-stage.test.ts`: eight cases.
- `node evals/ci/mutation-faults.ts`: fourteen final caught faults; restored sources pass
  (`run-limit-faults.txt`). The original eleven-fault preparation remains retained.
- `node evals/ci/mutation-run.ts --baseline`: 235 staged tests (`run-limit-baseline.txt`).
- `npm test`: 464 tests (`run-limit-full.txt`); typecheck zero (`run-limit-typecheck.txt`).
- `npm run test:bite`: all 32 campaigns / 271 caught faults, no failed/skipped campaign
  and restored sources (`run-limit-bite.txt`); restored typecheck zero
  (`run-limit-restored-typecheck.txt`). Original 26/200 preparation remains in `bite.txt`.
- `npm run test:mutation`: full qualification, not measured at this preparation commit.
  Each run gets a fresh scratch directory, input/config/lock hashes and raw reports. The
  driver bounds runtime and forwards termination to the process group; failures cannot qualify.

Exact dev pin `@stryker-mutator/core` 10.0.0; install scripts disabled. Signature audit passes:
529 signatures/207 attestations (`signatures.txt`). Advisories: 3 low/11 moderate/7 high/no
critical (`audit.json`, exit one). New moderate findings involve `typed-rest-client` and its
`qs` transitive dependency. No automatic fixes or security clearance. Command-runner package
lookup returns 404; that runner is built into core.
