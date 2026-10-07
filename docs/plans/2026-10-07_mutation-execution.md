# Complete mutation qualification — execution and recovery work

2026-10-07 · operational acceptance preparation for CI-2, not a completed mutation gate.
The existing full-file population, selected tests, pinned engine and global READINESS
floor remain binding. The interrupted local run supplies no actual completion status;
neither a progress percentage nor a report file can manufacture successful execution.

## Delivery order and evidence

| Owner / step | Dependency | Acceptance evidence |
|---|---|---|
| Operator / durable supervision | existing frozen staging and completion gate | A separate supervisor owns the actual child wait result, deadline and process group. Persist input identity before launch and completion atomically after actual exit. Outer-driver loss must leave an inspectable real result or a refusal, never presumed success. |
| Evaluator / interruption battery | supervisor candidate | Kill the outer driver before launch, during baseline/mutation and after child exit; interrupt completion writes; inject launch failure and deadline expiration. Wrong stage/hash, incomplete record, missing result, nonzero exit and signal refuse. Observe actual child/group termination, not only signal delivery. |
| Operator / CI execution choice | supervisor proof; primary tool/configuration checks | Either an approved runner completes the entire workload, or bounded partitions cover it exhaustively. Human owns runner registration, infrastructure and billing. Do not add an unapproved machine service. |
| Evaluator / partition proof, if used | exact complete population manifest and frozen inputs | Whole-file partitions initially; no line ranges, ignored mutants or changed mutators. Every expected mutant occurs exactly once across reports, including duplicate-shaped mutations as a multiset. Missing/cancelled/foreign/duplicated partitions or source/test/config/lock mismatch refuse. |
| Evaluator / final qualification | every actual execution completed and every artifact matched | Apply the unchanged global score floor to the complete population. Keep all original mutant identities and partition mappings; individual artifacts are not qualification. Preserve invalid/status categories and failures. |
| Archivist / close | exact tested revision and CI result | Receipt names revision, source/test/config/lock hashes, platform/runtime, seeds, actual child statuses, complete population, outcome counts and limits. Private close/sync precedes any long qualification campaign. |

GitHub documents a shorter hosted job limit than the current local whole-run allowance
([Actions limits](https://docs.github.com/en/actions/reference/limits)). Extending a workflow
timeout cannot bypass that limit. A runner or partition design must be demonstrated before
calling hosted mutation qualification implemented.

Stryker documents whole-file selection through `mutate`, JSON reporting and `dryRunOnly`
([configuration](https://stryker-mutator.io/docs/stryker-js/configuration/)). Its installed
pinned schema agrees. Before using a dry run to define the expected mutant population,
prove that its actual artifacts contain the complete identities/locations/replacements;
do not assume the JSON reporter emits them. The old `exportMutantsOnly` option found in
older research is absent from the installed schema and current configuration documentation;
do not depend on it. If exhaustive population evidence cannot be produced, partitions
remain unqualified and the complete-run path is still required.

Actual diagnostic probe from afa0b21 completes successfully with `dryRunOnly`, unchanged
source/test selection and fresh diagnostic seed 23089, but emits no
`reports/mutation.json`. Preserve the driver, configuration, manifest, actual status and
output in `evals/ci/mutation/population-probe/`. Source hashes remain unchanged. The
instrumentation count does not supply mutant identities or establish completeness; no
partition or mutation score is qualified. Reproduce from the root with
`node evals/ci/mutation/population-probe/driver.ts`; the reusable driver adjusts its import for this retained location and records actual HEAD.
`original-driver.txt` preserves the exact original driver; `manifest.json` identifies the
original diagnostic input, not a claim about later executions.

Freeze an execution definition before measurement. Definition changes use fresh seeds.
Never reduce the population or tune policy/sensor coefficients from survivor results.
Performance/soak measurements require their separate declared environment; overlapping
mutation workers and ordinary validation do not constitute performance evidence.

Current runner/workflow/thresholds are unchanged by this map. The running original stage
remains intact. This work does not expand signer code, accept ADR-021/022, publish a package
or satisfy the independent security programme.
