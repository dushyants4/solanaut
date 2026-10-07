# CI-2 — authenticated-history mutation population and runtime execution

2026-10-07 · builder-authored local Linux, Node 26.7.0; base 40fa2fc
plus this preparation candidate. Full mutation qualification remains owed.

The initial scope extension retains every earlier whole-file target and selected test, adding
checkpoint authentication, archive catalogue preparation and D21's history
regression. Source and test population assertions fail first. The previous driver
also fails the new definition/seed expectation. The initial definition uses fresh
seed 23209; no full engine score is measured under it.

The initial fourteen focused cases pass, including an actual supervised 272-case
staged baseline and repeated inspection without relaunch. Initial nineteen
staging/report and fifteen recovery/driver faults fail with restoration. Omitting
either new source or any new selected test cannot silently shrink the population.
This establishes staging and completion checks, not an engine score.

Review finds score dilution: an added perfect population can conceal an original
population below the floor. The regression fails first under the global-only
grader. Definition 7 declares fresh seed 23311 and retains separate original/added
group floors plus the global floor. Every present group requires valid mutants.
No existing threshold or resource limit is lowered.

Global-only score/empty-population faults become masked by those group guards.
Both misses remain retained. The final whole-floor/population trials weaken both
layers; a surviving-position invalid-status fixture avoids collateral floor
refusal. Final staging/report proof catches twenty-two faults with restoration;
updated focused and recovery/driver qualification follows.

Final isolated focused execution passes fifteen cases; final campaigns catch
twenty-two staging/report and fifteen recovery/driver faults with restoration.
Mistakenly overlapping focused/root executions fail their unchanged baseline
waits and remain retained. Final isolated serial ordinary integration passes all
565 cases; typecheck exits zero. Corrected hosted runtime qualification remains owed.

Hosted 40fa2fc run 37620710240 completes with twelve successful jobs and one
failure: the Node 22 ordinary suite's real staged-baseline wait. Complete raw
failure is retained beside the passes. Logs were unavailable until the run ended;
those diagnostic refusals remain too. All other runtime, aggregate and coverage
jobs pass, but the runtime matrix is not green.

CI ordinary suites now execute one test file at a time. Node documents this
control as the maximum parallel test-file count
([Node 22 CLI](https://nodejs.org/download/release/v22.18.0/docs/api/cli.html#--test-concurrency)).
No file, assertion, explicit proposal-concurrency battery, deadline or readiness
threshold is removed. Local default execution passes all 564 cases; controlled
serial and corrected hosted qualification follow. Do not infer Node 22 success
from another runtime or from local passing output.

Regenerate: `node --test evals/ci/mutation*.test.ts`,
`node evals/ci/mutation-faults.ts`,
`node evals/ci/mutation-recovery-faults.ts`, `npm test`,
`npm test -- --test-concurrency=1`, `npm run typecheck`.
Raw outputs and exact hashes: `mutation/authentication-scope/`.

Corrected afed152 hosted run 37626020433 succeeds in all thirteen jobs, including
Node 22/24/26 suites and the maintained fault aggregate. Exact revision/full logs
are retained under `mutation/authentication-scope/hosted-afed152/`. Inspect with
`gh run view 37626020433 --json status,conclusion,jobs,headSha`. This confirms the
correction, not a full mutation score or release clearance.

The superseded 9ac6e7c guard run has actual interruption evidence in
`mutation/retired-9ac6e7c/`. Freeze the corrected target before another long
campaign; this receipt claims no full score, complete snapshots, independent
review, dedicated deployment or release clearance.
