# Property gate — CI-2, partial

Workload frozen 2026-10-06 before measurement. Builder-authored evidence, not
independent qualification. No policy coefficient is changed by this workload.

Five properties each require at least 10,000 completed executions, without skips:

- Canonical 32-byte base58 addresses equal the published kit codec and round-trip.
- Legacy, v0 and v1 (separate properties): kit-built messages from arbitrary signed
  32-bit seeds decode identically to kit; every instruction resolves identically,
  with the generator's pinned tables. Existing `support/kit.ts` generation is reused.
- Arbitrary byte arrays of length 0–512 either decode identically to kit or fail with
  a named `DecodeError`. No unexpected exception is accepted as a refusal.

Seeds are independently generated for each property unless an explicit signed
32-bit `SOLANAUT_PROPERTY_SEED` is supplied for reproduction. Print seeds before
execution and preserve shrunk counterexamples on failure. No time-based skipping.
Generator changes require fresh seeds and a revised definition before measurement.
This synthetic workload is neither real-transaction qualification nor million-input
mutation fuzzing. Policy/signing/firewall properties and remaining CI-2 gates are owed.

## Evidence

`npm test`: 337 passes (`properties/full.txt`); `npm run typecheck`: exit zero
(`properties/typecheck.txt`). These are local results; pushed CI evidence is recorded in
HANDOFF and the continuing run record after it becomes available.
`npm run test:bite` passes all seventeen campaigns, catching 113 planted faults and
restoring source (`properties/bite.txt`; count with `rg -c '^caught ' properties/bite.txt`
from this receipt's directory). This includes the new eight-fault property campaign.

Revision: commit containing this receipt (`git log -- evals/ci/properties.md`).
Node 26.7.0, local Linux. Three gate tests fail against the stub (`properties/red.txt`).
Eight focused tests then pass (`properties/green.txt`): five workload properties each
complete 10,000 executions without skips; three tests exercise gate behaviour.
Regenerate: `node --test evals/ci/properties.test.ts packages/sdk/test/properties.test.ts`.
Use each printed seed via `SOLANAUT_PROPERTY_SEED` to reproduce its individual workload.

Eight planted faults are caught (`properties/faults.txt`): lowered budget, incomplete
count, skipped work, ignored failure, noncanonical seed, wrong address alphabet, wrong
account writability and unexpected exception. Regenerate: `node evals/ci/property-faults.ts`.
The first runner used unsupported `--test-bail`; it failed before any qualifying result
and restored source (`properties/initial-fault-error.txt`). Removed that flag; no assertion
changed. Two document patch-anchor errors also applied no edits. No final mutation miss.
The new campaign is in the maintained bite inventory. Normal npm tests run the properties
on each approved CI runtime; no run-count environment override exists.

Exact development dependency `fast-check` 4.10.2, locked transitive `pure-rand` 8.4.2,
both MIT. Installation used `--ignore-scripts` (`properties/install.txt`).
`npm audit signatures` verifies 348 registry signatures and 89 attestations, exit zero
(`properties/signatures.txt`). This is authenticity evidence, not security clearance.
`npm audit --json` reports 19 existing advisories (3 low, 9 moderate, 7 high, no critical),
exit one (`properties/audit.json`). Neither new dependency is named. No automatic fix,
downgrade or threshold exception was applied. Existing framework/on-chain dependencies
need remediation before their release qualification; SDK runtime still has only Keel.

Primary references checked for the workload: [runners](https://fast-check.dev/docs/core-blocks/runners/),
[parameters](https://fast-check.dev/docs/api/interfaces/Parameters/) and
[run details](https://fast-check.dev/docs/api/interfaces/RunDetailsCommon/).
