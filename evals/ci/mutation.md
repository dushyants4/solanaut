# CI-2 — Stryker preparation and report gate

2026-10-06 · evaluator/operator · builder-authored local Linux evidence, Node 26.7.0.
This receipt qualifies the report/staging checks, not the required mutation score.

## Frozen definition

Definition 1 selects complete SDK source files: `base58.ts`, `classify.ts`, `guard.ts`,
`message.ts`, `pda.ts`, `policy.ts`, `state.ts` and `tables.ts`: byte/account resolution,
instruction effects, policy validation, admission and reservations. No line ranges, ignored
mutants, excluded mutators, static-mutant suppression or incremental results. The existing
mutation-score threshold in `docs/READINESS.md` remains unchanged.

`mutation-stage.ts` freezes selected decoder, classifier, policy, admission, drain, sensor,
replay/restart, ownership, storage and signed-policy/signing-history tests. The decoder
mini-fuzz uses fixed inputs; properties and million-input fuzz remain separate gates.
Signer/firewall and opaque-program mutation qualification remain owed.

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
- `node evals/ci/mutation-faults.ts`: eleven final caught faults; restored sources pass.
- `node evals/ci/mutation-run.ts --baseline`: 235 staged tests (`staged-baseline.txt`).
- `npm test`: 415 tests (`full.txt`); typecheck zero (`typecheck-final.txt`).
- `npm run test:bite`: all 26 campaigns / 200 caught faults, restored (`bite.txt`).
- `npm run test:mutation`: full qualification, not measured at this preparation commit.
  Each run gets a fresh scratch directory, input/config/lock hashes and raw reports. The
  driver bounds runtime and forwards termination to the process group; failures cannot qualify.

Exact dev pin `@stryker-mutator/core` 10.0.0; install scripts disabled. Signature audit passes:
529 signatures/207 attestations (`signatures.txt`). Advisories: 3 low/11 moderate/7 high/no
critical (`audit.json`, exit one). New moderate findings involve `typed-rest-client` and its
`qs` transitive dependency. No automatic fixes or security clearance. Command-runner package
lookup returns 404; that runner is built into core.
