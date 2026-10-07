# CI-2 — baseline runtime compatibility correction

2026-10-07 · builder-authored local Node 26.7.0; base `fdae9b4` plus
this candidate. The preceding hosted recovery revision has a Node 22 failure;
its final logs and independent hosted confirmation remain required.

The baseline command used `--test-isolation=none`, absent from the
[Node 22.18 documented options](https://nodejs.org/download/release/v22.18.0/docs/api/cli.html#--experimental-test-isolationmode).
Require the documented `--experimental-test-isolation=none` spelling in the actual
captured command; the new assertion fails first. The compatibility alias is also
accepted by the local pinned runtime. Definition 5 declares fresh seed 23107 before
execution and preserves population, per-mutant limits, whole-run limit and score floors.
Definition 4 staged baselines remain historical component evidence, not qualification.

Six recovery cases and fifteen helper/driver faults pass after restoration, including
reverting the option spelling. Root integration and typecheck pass. No runtime is
removed from the matrix, and no fixture deadline or qualification threshold changes.
Regenerate: `node --test evals/ci/mutation-recovery.test.ts`,
`node evals/ci/mutation-recovery-faults.ts`, `npm test`, `npm run typecheck`.
Raw evidence: `mutation/runtime/`. Full mutation score remains owed.

Original hosted run 37610469380 finishes with twelve successful jobs and the Node
22 test job failed. Its real staged baseline has a non-successful completion, correctly
refused by the grader; its child output was not included in that assertion. The fixture
now reports child output with nonzero status. The absent option is a confirmed
compatibility defect; the corrected hosted run is required to verify the diagnosis.
