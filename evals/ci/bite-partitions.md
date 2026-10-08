# CI-1 — fixed complete fault partitions

2026-10-08 · builder-authored Linux/Node 26.7.0 gate evidence · base a4d1c25
plus candidate. Peer review is internal builder review, not Claude RT-2.

Run every maintained campaign across three fixed jobs, each with its own checkout.
Within a job, mutations remain sequential and every source fingerprint must
restore. The default local command still runs the complete inventory. Partition
arguments are strict; all jobs are mandatory and fail-fast cancellation is off.
The existing job/campaign deadlines, staged-baseline wait, score floors and
READINESS thresholds remain unchanged.

## Evidence and findings

Missing partition function/workflow and new campaign inventory fail first. The
first loose workflow assertion misses contradictory fail-fast keys; exact single
false value fixes it. A valid true replacement supplies the final fault evidence.
Peer review finds an unanchored timeout test accepting 150 as 15; a first fault
site is ambiguous and supplies no credit, then the actual timeout fault misses.
The anchored line catches it. Conditional job omission and ignored failure now
refuse too. Every initial failure/miss remains in `bite-partitions/`.

The expanded workflow restoration fingerprint initially breaks the older
operator-tool fixture because it lacks a workflow directory. Preserve workflow
monitoring and supply that directory; retain the failed complete ordinary run.
The new fixture proves changed workflow bytes affect restoration and a missing
directory refuses. Existing skip-first aggregation fault follows the renamed
selected iterator; its missing-site failure and all five final original faults
are retained. No original fault or assertion is removed.

Five partition cases plus three existing aggregation cases pass. Twelve final
partition faults and all five prior aggregation faults catch with restoration.
All 54 maintained campaigns divide exactly once into 18/18/18. Corrected ordinary
and serial AST suites pass 660 cases; native typecheck exits zero and unchanged
coverage floors pass. Exact source hashes match the record-loading candidate.
No entire partition execution or hosted pass is inferred from focused tests.

Preceding hosted a4d1c25 run 37711212005 completes with unchanged baseline-wait
failures on Node 22.18.0, Node 26.7.0 and AST. Node 24 and maintained campaigns
pass. Full exact log/metadata are retained in
`../sdk/record-loading/hosted-a4d1c25/`. Record-loading optimisation does not
establish a hosted timing fix; H11 remains pending.

## Reproduce

`node --test evals/ci/bite-partitions.test.ts evals/ci/bite.test.ts`

`node evals/ci/bite-partitions-faults.ts`; `node evals/ci/bite-faults.ts`.

`npm test`; `npm run typecheck`; `npm run test:coverage -- --serial`.

`npm run release:prepare`, then `npm run test:bite` runs all campaigns locally.
The fixed partition commands are `npm run test:bite -- --partition 1`, followed
by partitions 2 and 3. Use separate checkouts for parallel mutation runs; running
partitions concurrently in one tree is unsupported. Hosted results are checked
only after private sync. No complete mutation score, performance, Alpha or
stable-release clearance is claimed.
