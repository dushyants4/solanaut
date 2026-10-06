# Mixed-history replay gate — CI-2, partial

Definition revision 2 frozen 2026-10-06 before its measurement. Reuse existing
`packages/sdk/test/support/workload.ts` without changing its generator, policy, synthetic
operator or telemetry. Its workload view selects only the ten most recent entries, so
report/redemption selection stays within retention; production history/replay keeps every
entry. Fresh deterministic input offset 10001 after the initial driver failure. Continue
its deterministic steps until exactly 10,000 decisions;
each step must append exactly one entry, bounded by 30,000 steps. Include reports,
redemptions and signed latch releases; require all these entry kinds to be reached.

Recompute the complete history with the production replay engine, requiring a successful
result and exactly the generated decision count. Pin the baseline record head in the gate
before CI qualification so record/replay changes cannot silently agree with each other.
Test that digest across the approved Node runtime matrix. This is a mixed unsigned SDK
in-memory workload with synthetic release signing, not signed-policy/socket/send recovery,
power-loss durability, the random-kill battery or snapshot/restart performance evidence.

Historical replay changes require the accepted record/evaluation compatibility programme;
never silently regenerate a pin to turn a failing CI result green.

Initial definition used the complete history for receipt selection. Beyond the original
short battery it selected an old receipt no longer retained for reporting, and aborted
before qualification (`replay/initial-driver-failure.txt`). No production code changed.
The revised view bounds test selection, not policy or retained history; this is a workload
definition change, not a passing result under the first definition.

## Evidence

Local Linux/Node 26.7.0, 2026-10-06; revision is the commit containing this receipt
(`git log -- evals/ci/replay.md`). Builder-authored, not independent security evidence.
Two gate tests fail against a stub; the positive test already passes (`replay/red.txt`).
Three gate tests pass after implementation (`replay/green.txt`). A fourth focused cap
regression is added after the mutation miss below.

Revised frozen history: 10,000 decisions, 13,651 entries; replay recomputes all 10,000
without divergence (`replay/baseline-v2.txt`). Pin:
`cb4674cdc5851f2c1d6645df4c1d36f30eb7cf616b95010b27dbe6487c65254c`.
Regenerate: `npm run test:replay`. Production sensor v1/Keel 1.0.1; all four required
entry kinds reached. The same pin runs in a separate approved Node matrix CI job.

The first product mutation (per-tx cap disabled) survives: the mixed history never
reaches that cap (`replay/initial-fault-miss.txt`). Added a focused cap-plus-one regression
to this campaign, leaving the generator and digest unchanged. Eight final faults caught
(`replay/faults-final.txt`): six gate faults, the previously missed cap fault, and disabled
destination enforcement. The latter changes recording and replay consistently but fails
the pinned digest, demonstrating protection against correlated implementations.
Regenerate: `node evals/ci/replay-faults.ts`; `node --test evals/ci/replay.test.ts`.
Sources restored; no final miss. A pinned history remains bounded coverage, not all rules.

Prior SOL cap commit `f631671` passes all CI jobs, run 37482318589; post-push close
passes ten gates. Historical independent reports untouched. No new dependency or
protected harness change. Crash/recovery/performance/snapshot qualification remains owed.

Final local commands: `npm test` 347 passes (`replay/full.txt`), `npm run typecheck`
exit zero (`replay/typecheck.txt`), `npm run test:replay` passes the pin
(`replay/qualified.txt`). `npm run test:bite` passes twenty campaigns / 133 caught
faults, source restored (`replay/bite.txt`; count via `rg -c '^caught '` on that file).
These are builder results; actual runtime-matrix CI evidence follows the pushed revision.
