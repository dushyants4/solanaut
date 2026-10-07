# POL-2 — bounded policy signature decoding

Hosted 2692542 run 37651009713 completes with twelve successful jobs and one
Node 22 ordinary-suite failure. The staged baseline is still active at the
unchanged wait deadline; diagnostics retain its progress through the sensor
battery. Exact revision metadata and failure log are retained at
`policy-signature/hosted-2692542/`. This revision is not fully hosted-qualified.

2026-10-07 · builder-authored local Linux/Node 26.7.0 evidence · base afe482a
plus candidate. No new public exports or architecture change.

The source suite initially passes twenty cases and fails both new regressions:
invalid encoded lengths reach decoding, and a signature getter is read again.
Verification now captures signature text once and checks its encoded size before
decoding. Canonical-byte and Ed25519 verification remain required. This bounds
signature decoding only, not the complete policy or remote request.

The signed-policy suite passes twenty-two cases. Three source faults are caught
and restored: omitted size bound, decoding a reread, and canonical comparison
against a reread. The prior installed artefact fails the new decoding assertion.
Release regeneration passes ten installed cases; nineteen compiled faults are
caught with exact restoration, including omission of the policy signature bound.

CI-2 definition 8 declares fresh seed 23417 before measurement. It retains all
previous files/tests, workloads, floors, deadlines and actual completion checks,
adding prefix/state/signed-policy whole-file targets and prefix/state test files.
The selected baseline now contains 289 cases across twenty-three test files and
thirteen source targets. Twenty-seven staging/report faults and fifteen recovery/
driver faults are caught and restored. This is preparation, not a mutation score.

The expanded baseline first fails because checkpoint-state setup shallow-copies
the shared workload's nested SOL policy. Its intentional caller mutation changes
that shared object under process-wide test execution. Setup now deep-copies its
fixture and asserts the shared cap remains unchanged; sequential baseline passes.
Both initial scope/definition refusals and the fixture failure remain in raw logs.
The new campaign also first fails the maintained-inventory test before registration.

Regenerate:

- `node --test packages/sdk/test/signed-policy.test.ts evals/ci/bite.test.ts`
- `node evals/sdk/policy-signature-faults.ts`
- `node --test evals/ci/mutation-recovery.test.ts`
- `node evals/ci/mutation-faults.ts`
- `node evals/ci/mutation-recovery-faults.ts`
- `npm run release:prepare`
- `node --test evals/packaging/packed-sdk.test.ts`
- `node evals/packaging/faults.ts`
- `npm test -- --test-concurrency=1`
- `npm run typecheck`
- `npm run test:coverage -- --serial`

Raw evidence: `policy-signature/`. Serial ordinary and AST integration both pass
all 582 cases, typecheck exits zero, and unchanged AST floors pass. Close and
private sync follow. Hosted qualification of this revision and full corrected
mutation remain owed.
No independent security evidence, installed service or stable-release claim.
