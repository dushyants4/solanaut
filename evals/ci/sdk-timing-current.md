# CI-2 — corrected candidate SDK timing

2026-10-10 Toronto · builder-authored local diagnostic · Node 26.7.0/Linux.
Reviewed e715238, after D40 integration. CLAIMS S126 scopes these measurements.

Before measurement, retain S124's exact workload population, policy, starting
step, expected mixed-history head, profile ordering, clocks and comparisons.
No coefficients, seeds, domains, thresholds, sampling or warm-up change.
The only updated input hash is the integrated wallet adapter, which this guard
workload does not invoke. The copied runner changes only the definition path;
its controls and validators remain unchanged. Preserve original S124 files.

The old frozen hashes correctly refuse the new source in
`historical-input-red.txt`. Bind the current source before timing rather than
relabelling that earlier run. New four-case controls and six omission/two
preflight faults pass with exact restoration. Original checks/populations are
copied unchanged; this is builder evidence, not independent qualification.

Regenerate on the bound source with
`node evals/ci/sdk-timing-current/measure.mjs <fresh-directory>`.
Use `node --test evals/ci/sdk-timing-current/measure.test.mjs` and
`node evals/ci/sdk-timing-current/faults.mjs` for controls/refusals.
Archive previous raw outputs before regeneration.

## Actual corrected candidate

`timeout 180 node evals/ci/sdk-timing-current/measure.mjs evals/ci/sdk-timing-current/measured`
exits zero. No other Solanaut evaluation runs concurrently. Every raw observation,
bound input/runner/definition hash, actual revision and host metadata is retained.
The existing Intel i5-1155G7/Linux x86-64/Node 26.7.0/Btrfs host remains outside
the approved clean Ubuntu reference installation.

| SDK profile | Decision p99 | Whole workload decisions/second | Replay decisions/second |
|---|---:|---:|---:|
| Memory store | 0.381 ms | 4,332.06 | 7,221.00 |
| Synced file store | 3.214 ms | 562.90 | 7,550.10 |

Unrounded nanoseconds govern the recorded comparisons. Each profile completes
10,000 decisions and 13,651 mixed entries, reproduces the frozen head and fully
replays. Actual persisted bytes exactly match the earlier frozen history. A
separate `node evals/ci/sdk-timing-current/verify-history.mjs` check reads that
file and passes. The retained scratch first-hash corruption asserts divergence;
the original passes again. Final source preflight and typecheck pass.

The memory p99 is greater than the earlier S124 run by more than the specified
regression tolerance; the synced-file p99 is not. Preserve `comparison.json`
and both raw populations. These single local runs do not establish the cause
or qualify the external-reference regression gate. No policy, sensor, seed or
population is tuned, and no repeat is selected to replace the slower result.
Original complete report fields remain missing, so requirePerformance is not
invoked with fabricated restart/freshness evidence. Earlier H11 and all failed
runtime/coverage/maintained gates remain recorded. No new full native/coverage
run is attributed to this evaluator-only continuation; exact product checks
remain scoped in S125.

These are scoped memory/synced-file SDK decision and complete mixed-history
replay measurements. Memory includes its record operation, not isolated
pre-log timing. No isolated signer, all-benign/token/versioned/concurrent/send
qualification, approved reference-machine baseline/regression, snapshot
restart, dashboard, runtime matrix, power-loss durability or complete
performance/stable gate follows. Existing H11 and other failed gates remain open.
