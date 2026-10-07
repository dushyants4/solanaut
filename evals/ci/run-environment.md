# CI-2 — explicit environment and interruption evidence

2026-10-07 · builder-authored local Linux, Node 26.7.0; base `b6d9194` plus
the recorded candidate. Evaluation component only, not full mutation qualification.

Explicit command environments admit only PATH, LANG, LC_ALL, FUZZ_RUNS, FUZZ_SEED
and NO_COLOR, with string values and no NUL. They participate in the command digest.
Both the supervisor and child receive that captured environment instead of the caller's.
Loader overrides and undeclared variables refuse. The compatibility mode without an
explicit environment continues to inherit; qualification must select the explicit mode.

The valid explicit mode fails first under the original command shape
(`run-environment-red.txt`). The first child-environment fault is missed because the
correct worker environment masks it (`run-environment-faults.txt`). A directly launched
worker with a deliberately different environment isolates that binding; the repeated
campaign catches every fault (`run-environment-faults-final.txt`,
`run-environment-faults-restored.txt`). The malformed-input fixture's typecheck failure
is retained before its deliberate invalid input casts through unknown.

The focused battery has twenty-three cases; the maintained campaign catches twenty-three
real faults and restores source. Actual supervisor TERM prevents eligibility even when
the child handles termination and exits zero. Actual supervisor KILL leaves no eligible
completion. The fixture separately contains its surviving child; this does not claim
automatic supervisor-death recovery. Process-group escape and hostile host/storage remain
outside this helper's assurance. No key or credential input is copied into the explicit
evaluation profile. No staged baseline, full score or hosted mutation execution is claimed.

Regenerate: `node --test evals/ci/run-supervisor.test.ts`,
`node evals/ci/run-supervisor-faults.ts`, `npm run typecheck` and
`env -u SOLANAUT_PROPERTY_TRIAL nice -n 19 npm test -- --test-concurrency=1`.
The first overlapping root recheck is retained as diagnostic only; final integration
must run after the fault driver restores its source. Full maintained hosted aggregation
follows private sync. These tests are not independent security evidence.

Final root integration passes all 536 cases after fault restoration (`root-final.txt`),
with typecheck zero (`typecheck-final.txt`). The overlapping diagnostic failed launcher
release and surviving-descendant containment; both are retained, not counted as a pass.
`source-manifest.json` binds the final tool/test/campaign and unchanged lockfile bytes.
No further product source or dependency changes. Private close and hosted validation follow.
