# Synthetic SOL cap properties — CI-2, partial

Definition frozen 2026-10-06 before measurement. Two additional properties, each
10,000 executions with fresh printed seeds and no skips:

- Per-transaction: cap and random amount span unsigned 64-bit integers. Half the
  generated choices use cap minus one, cap or cap plus one, clamped to that range;
  the other half use the independent amount. A fresh guard admits exactly amounts
  at or below the cap. Window cap is unsigned-64 maximum, fees are separately bounded.
- Pending-window: one to eight transfers of 0–1,000,000 lamports, window cap
  0–8,000,000. Each destination is distinct so intent deduplication cannot mask the
  cap. A fresh guard retains admissions without outcomes; an independent bigint
  running sum predicts each admission/refusal and never exceeds the window cap.

Both use native transfer bytes, an in-memory unsigned SDK guard, fixed monotonically
increasing times inside one window and quiet telemetry to isolate policy rules. No
sign/send, disk durability, token caps, expired windows or Keel qualification claim.
No threshold or coefficient change. Workload changes require fresh seeds.

## Evidence

Local Linux, Node 26.7.0, 2026-10-06; revision is the commit containing this receipt
(`git log -- evals/ci/caps.md`). Builder-authored evidence, no independent qualification.
The asynchronous runner test fails against its stub (`caps/async-red.txt`), then passes.
Existing cap implementation already passes both new oracle properties (`caps/green.txt`):
10,000 executions each, no skips; six focused tests including the runner tests.
Regenerate: `node --test evals/ci/properties.test.ts packages/sdk/test/caps.property.test.ts`.
Reproduce each printed seed using `SOLANAUT_PROPERTY_SEED`.

Five faults caught: per-tx equality refused, per-tx cap disabled, window equality refused,
pending reservations ignored and asynchronous work shortened to one execution. Initial
campaign in `caps/faults.txt`; retained failing tests/shrunk cases in `caps/fault-details.txt`.
Regenerate: `node evals/ci/cap-faults.ts`. No product fix was necessary; faults restore the
existing code. No final miss. The new campaign joins bite, and normal root tests run both
properties on each approved CI runtime. No package or protected harness change.

Prior fuzz commit `59b2e1c` passes CI run 37480963029 on all approved runtimes, the
million-input job, maintained faults and office. Its post-push close passes all ten checks.

Final local validation: `npm test` 343 passes (`caps/full.txt`), `npm run typecheck`
exit zero (`caps/typecheck.txt`). `npm run test:bite` passes nineteen campaigns,
catching 125 faults and restoring source (`caps/bite.txt`, count via `rg -c '^caught '`
on that file). This is hand-planted gate evidence, not a tool mutation score.
