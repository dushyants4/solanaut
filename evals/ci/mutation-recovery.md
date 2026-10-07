# CI-2 — recoverable mutation execution

2026-10-07 · builder-authored local Linux, Node 26.7.0; base `ddc8bb0`
plus this candidate. Execution evidence, not a full mutation score.

Definition 4 retains the source/test population, score floors, worker configuration
and twelve-hour limit. Fresh seed 23093 is declared before execution. Frozen input,
lockfile, environment, command and supervisor-source bindings are checked against
actual committed completion. `--start` launches once; `--finish` never relaunches.
Baseline completion never reports a score.

Six recovery cases and fourteen real helper/driver faults pass with restoration.
The real staged baseline executes 235 cases and supports repeated inspection without
changing completion. Synthetic report fixtures test grading, not a Stryker score.
Regenerate: `node --test evals/ci/mutation-recovery.test.ts` and
`node evals/ci/mutation-recovery-faults.ts`. Raw evidence: `mutation/recovery/`.

Stub, unsupported CLI and unregistered campaign fail first. The first campaign
baseline exceeds its unchanged twenty-second fixture wait while the old orphan is
active. After retiring that diagnostic attempt, the unchanged battery passes.
Failures remain retained. `mutation/interrupted-a4dba77/` preserves original inputs
and retirement records: actual original exit status unknown, incomplete population,
no qualification. No thresholds or coefficients change.

Root integration and typecheck pass. A fresh complete supervised mutation campaign
remains required. Supervisor-KILL automatic containment, hostile-host authenticity,
escaped groups and power-loss durability remain outside this evidence.
