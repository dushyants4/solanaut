# CI-2 — performance report checks, preparation

2026-10-06 · builder-authored local report-check evidence · Node 26.7.0.
No timing workload or performance target is measured by this receipt. The complete runner
and reference-machine baseline remain owed. Root tests/typecheck and maintained faults are
checked with the differential step; hosted CI is checked after private sync.

The report contract retains every existing READINESS performance target: core and synced
decision p99, decision/replay rates, snapshot-backed restart with Keel rebuilt through replay,
dashboard freshness, and regression against an externally supplied compatible baseline.
Checks require process success, positive integral nanoseconds, complete observation populations
and unrounded comparisons. Definition 1 requires a decision sample population before accepting
a timing report. The external baseline binds machine, Node, workload, definition and revision;
the current measurement cannot supply its own replacement baseline silently.

Nearest-rank p99 sorts a copy and preserves raw observations. Every measured dashboard delay
must meet the freshness bound; missing observations fail. Snapshot/replay/ready flags describe
required runner evidence, not proof derived from these flags alone. Actual qualification also
needs authenticated snapshot verification, the raw history and a reproducible runner receipt.

Eight report cases initially fail against a stub (`performance/initial-red.txt`). The first
fault campaign misses a weakened synced regression comparison because its fixture is far above
the threshold (`initial-faults.txt`). A boundary fixture just above the permitted change catches
it. The latest campaign also checks missing observations: sixteen faults caught, restored
source passes (`faults-complete.txt`). Regenerate report checks with
`node --test evals/ci/performance.test.ts` and `node evals/ci/performance-faults.ts`.

This is a report-gate component, not performance qualification, independent evidence or a
release exception. Run timing workloads separately from Stryker qualification.
