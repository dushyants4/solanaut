# CI-2 — scoped SDK timing

2026-10-10 Toronto. Builder-authored measurement preparation on local Linux,
Node 26.7.0, reviewed revision 1633231. Frozen preparation precedes the run.

Before measurement, freeze the existing CI replay workload: first step 10001,
10,000 decisions, at most 30,000 steps, existing WORKLOAD_POLICY and original
mixed-history head. Execute once with memory storage, then once with an actual
synced file store, sequentially in a fresh private directory. No warm-up,
coefficient changes, alternate sensor, excluded samples or post-result tuning.

Use monotonic nanoseconds around each guard.check call, including its original
record operation. Memory timings are not an isolated before-log measurement.
File timings include the existing synced append, not power-loss qualification.
Whole workload elapsed time includes step preparation, reports, redemptions,
releases and fixture history copies. Report its conservative decision rate
separately from replay of the complete captured history. Replay includes creating
Keel and checking hashes/controller fields; both profiles must exactly match the
original frozen head and contain all mixed operation kinds.

Preserve every raw timing observation, host/runtime/filesystem metadata and input
hash before/after checks. This is not a full performance gate: no externally
approved reference machine/baseline, isolated signer, authenticated snapshot
restart, dashboard freshness, regression result or independent evidence follows.
Do not fabricate the missing fields for requirePerformance.

## Measured result

Run `node evals/ci/sdk-timing/measure.mjs <fresh-directory>` on the pinned inputs
in `sdk-timing/definition.json`. The actual command uses
`timeout 180 node evals/ci/sdk-timing/measure.mjs evals/ci/sdk-timing/measured`
and exits zero. No other Solanaut evaluation runs concurrently. Each profile
records every observation without filtering and reproduces the existing head.

| Local SDK profile | Decision p99 | Whole workload decisions/second | Replay decisions/second |
|---|---:|---:|---:|
| Memory store | 0.169 ms | 7,521.53 | 11,271.68 |
| Synced file store | 3.278 ms | 708.11 | 10,795.31 |

Unrounded nanoseconds govern comparisons. Each profile has 10,000 decisions
and 13,651 total entries, including 1,365 redemptions, 1,365 reports and 921
releases. Of the decisions, 5,837 allow; refusal populations are retained in
`history-summary.json`. This is not an all-benign, token, v0/v1, concurrent,
isolated-process, RPC/send, authenticated-policy or 100,000-entry workload.
One run per profile gives no distribution across runs or runtime matrix claim.

Machine: Intel i5-1155G7, Linux x86-64, kernel 7.2.5-3-omarchy, eight logical
CPUs, Node 26.7.0; Btrfs with SSD and zstd compression. This existing host is
not the approved Ubuntu reference installation. Exact metadata and filesystem
options are retained. `metadata.json` binds runner/definition hashes and actual
revision. Source/input identities pass before and after each profile.

The file profile's actual persisted bytes are separately read and replayed by
`node evals/ci/sdk-timing/verify-history.mjs`: all decisions reproduce without
divergence. Its complete raw history and digest are retained. A scratch copy
with the first entry hash corrupted fails with an assertion identifying the
hash divergence; the unchanged original passes again. This check is outside
the reported timing and does not prove power-loss durability.

## Refusal evidence and limits

`node --test evals/ci/sdk-timing/measure.test.mjs` initially fails all four cases
against the unimplemented runner and now passes. `node evals/ci/sdk-timing/faults.mjs`
catches six validator omissions with complete four-case trials, one assertion
failure each and no skipped/cancelled/todo cases. Runtime and input substitutions
are also refused before measurement. Exact source/definition restores and final
controls pass; raw earlier and final fault output are both preserved. Typecheck
passes. The fresh unchanged full native suite passes all 895 cases in this run;
earlier H11 failures remain recorded rather than treated as resolved. The new
nested evaluator cases are run separately and are not added to that root count.
Builder-authored checks are not independent review.

The existing complete performance report gate is untouched and cannot pass
using this partial evidence. Memory storage is not pre-log isolation, and
the file profile's target comparisons do not qualify other workloads. Approved
reference-baseline regression, snapshot-backed restart, dashboard observations,
isolated signer timing and hosted/runtime qualification remain owed. The full
native result is retained separately; existing H11 and package findings are
not erased by these measurements. No stable milestone closes.
