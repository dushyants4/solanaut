# AST statement and branch coverage — CI-2

Definition frozen before measurement, 2026-10-06. Node 26.7.0/local Linux, builder-authored
evidence. Revision is the commit containing this receipt (`git log -- evals/ci/coverage.md`).
SDK and signer source inventories include every TypeScript file. Istanbul instruments the
JavaScript AST after Node's native, position-preserving type stripping, in memory only.
The explicit test hook records counters at process exit. Unimported sources start at zero.
Reports must match the instrumented statement/branch maps and contain safe nonnegative
execution counters. Missing, foreign or incompatible reports refuse qualification. Source
inventory and bytes are checked again after the test process completes successfully.

The existing statement and branch floors apply to SDK totals; corresponding checks apply
to signer totals. Existing critical SDK files, policy/request/signing/client files and all
signer files also receive the required critical branch floor. Comparisons use counts and
unrounded ratios. No coverage ignores or threshold reductions. Test instrumentation is
explicit; development and installed consumers retain their existing native/release contracts.

## Failures retained

Four gate tests fail against the stub (`coverage/red.txt`); two AST calibration tests fail
(`calibration-red.txt`), the real-hook test fails (`hook-red.txt`) and three merger tests fail
(`merge-red.txt`). Process completion has its own stub failure (`process-red.txt`).
Calibration distinguishes separate statements on one line and unexecuted branch arms.
It also verifies native type erasure and unused code. Complete evidence is checked before
merging, so omission cannot improve coverage by silently removing files or counters.

The first full run passes its tests but fails coverage (`initial-measurement.txt`,
`initial-summary.json`): SDK statements, signer statements/branches and latch/socket
critical branches are below their required floors. This failure is not a release exception.
Added malformed authentication/payload/journal, corrupted-history, RPC shape/context/deadline
and socket saturation tests without changing product rules or telemetry coefficients.

The first saturation fixture fails on a reset after a complete busy response because it
waits for EOF (`remediation-measurement.txt`). Use the actual sending client and require its
typed remote/busy refusal, without execution uncertainty; retain the same bounded clients.
The corrected run passes coverage (`second-remediation.txt`, `qualified-summary.json`).

The initial mutation campaign expects an incorrect battery count (`initial-campaign-count-error.txt`).
A release-input coercion mutation survives because canonical comparison independently denies
the benign coercible value (`initial-coercion-miss.txt`). Added an input whose coercion would
throw: the parser must refuse without invoking it. A later selector is ambiguous because
the policy-hash expression occurs at two signing stages (`initial-selector-error.txt`).
Narrowed it to the exact signed-stage statement. Baseline test completion now sets the exact
mutated battery count, with its existing minimum retained. All errors/misses remain visible.

## Regenerate

`npm run test:coverage` runs the complete root test inventory with explicit instrumentation,
prints exact per-file counts and writes raw reports/summary under
`.sandbox/solanaut-1/coverage/current/`. A failed test process or missing completion fails;
its counters cannot qualify a release. Retained final output and source hashes are in
`coverage/final-measurement.txt` and `coverage/final-summary.json`.

`node evals/ci/coverage-faults.ts` exercises gate, instrumentation, report and product faults
(`coverage/faults.txt`). All sources restore in `finally`; the clean battery is checked again.
`npm test`, `npm run typecheck`, `npm run test:bite` provide full validation, retained in
`coverage/full.txt`, `typecheck.txt`, `bite.txt`. This is not independent RT-2 or Stryker's
mutation score. Coverage counters do not prove correctness, timing or security by themselves.

## Dependency verification

Exact dev-only pins: `istanbul-lib-instrument` 6.0.3 and `istanbul-lib-coverage` 3.2.2,
BSD-3-Clause; installed with scripts disabled. `npm audit signatures` passes
(`coverage/signatures.txt`); advisories remain unchanged (`coverage/audit.json`) and neither
Istanbul package nor Babel is named. Source/API references: [Istanbul instrumenter](https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-lib-instrument),
[coverage API](https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-lib-coverage),
[pinned Node module APIs](https://nodejs.org/download/release/v26.7.0/docs/api/module.html).
Registry verification does not resolve the existing dependency advisories or replace audit.

Final measurement: 407 instrumented tests pass. SDK 1,894/1,988 statements and 1,522/1,654
branches; signer 466/487 statements and 334/354 branches. All designated critical files
pass their branch floor (`coverage/final-summary.json`, exact per-file counts/source hashes).
Nineteen final faults caught, sources restored (`coverage/faults.txt`), including failed
test process, threshold reductions, inventory/count/map omission, wrong instrumentation,
type stripping, fabricated counters, release coercion, raw canonical bytes, cross-policy
signing, noncanonical policy history, unsupported stage, slot bound and expired lifetime.

The first full bite rejects stale RPC/socket test-count expectations after the new cases
(`coverage/initial-bite-count-error.txt`). The injected product faults fail assertions; the
campaigns still reject their expanded completion counts. Update those counts to the actual
expanded batteries without changing fault sites, refusal assertions or deadlines; rerun.

Final full bite: twenty-five campaigns / 189 caught faults, none failed or skipped, all
sources restored (`coverage/bite.txt`; `rg -c '^caught '`). Ordinary `npm test` also passes
407 tests (`coverage/full.txt`), typecheck exits zero, and six installed-package checks pass
(`coverage/package-green.txt`). No production source changed. Pre-push close passes nine
gates with only uncommitted work pending; post-push close and CI are checked subsequently.
