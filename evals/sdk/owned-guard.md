# Private owned admission/control facade — local component

2026-10-09 Toronto · Linux/Node 26.7.0 · base `4325a03` plus candidate.
Builder-authored evidence; no independent-security or stable-release claim.
Accepted ADR-019, SPEC SNP-7, OWN-2, LIF-1/4 and partial OPR-2/POL-4.

## Contract and scope

Open only established kernel-owned devnet history with exact current signed
policy configuration and authenticated request-index evidence. Configuration is
captured before awaiting. Refuse implicit creation/upgrade and release failed
startup ownership. Keep the guard, store and full history private. The frozen
internal surface serializes admission/control operations, status and orderly
close; replies and policy are detached. Shared message backing is copied.
Status is an observation of private memory, not an independent chain check.

This is an internal SDK prerequisite, not a stable root export or signer-process
implementation. Redemption, signing evidence, outcome reporting, operator release,
maintenance, executable service, bounded retained state and startup targets remain
owed. Full history is still retained. No changed signer budget or socket method.

## Failures retained

The original tests fail first on the missing factory. The initial implemented
candidate has a test-fixture error: it expects a bigint result to refuse, but the
existing canonical codec intentionally encodes bigint as decimal text. Replace
that fixture with NaN, which the unchanged codec rejects. Initial dynamic test
invocation also leaves its return type unknown; annotate the actual internal type.
No product validation or assertion strength is removed.

The first version-only fault misses: exact signed text independently rejects the
new version. Retain the miss; the corrected semantic trial removes both version
and signed-text matching and is caught. Closure likewise has layered acceptance/
execution checks; its trial removes both. Registry omission fails before adding
the maintained campaign. The installed test fails on the previous actual package
without the new internal module. The new critical-file deficit assertion fails
before adding its designation; all existing coverage floors remain unchanged.

Definition 32's ordinary run hits the unchanged staged-baseline wait while the
compiled package campaign competes for resources. Retain that failed output.
After that baseline test fails, add the critical-file designation and declare
definition 33/seed 33811 before further measurement. Preserve every earlier test,
source, campaign and limit. H11 remains pending; no timeout acceptance is assumed.

The isolated recovery/driver campaign's initial baseline also expires during
compiled faults, before any mutation; preserve that failure without fault credit.
The focused AST diagnostic falls below the unchanged critical branch floor.
Expand the existing cases with malformed options/message bytes and a correctly
signed foreign-cluster configuration, rather than removing the designation or
lowering a floor. Freeze definition 34/seed 34183 before final measurement, with
the same selected count and all earlier cases/sources. An initial documentation
patch fails context verification and makes no change; reapply the exact valid
contexts. No protected harness or gate limit is edited.

## Regenerate

```bash
node --test --test-isolation=none packages/sdk/test/owned-guard.test.ts
node evals/sdk/owned-guard-faults.ts
npm run release:prepare
npm run test:package
npm run test:package:faults
node --test evals/ci/bite.test.ts evals/ci/bite-partitions.test.ts evals/ci/mutation-stage.test.ts evals/ci/coverage.test.ts
node evals/ci/bite-faults.ts
node evals/ci/bite-partitions-faults.ts
node evals/ci/coverage-faults.ts
npm test
npm run typecheck
npm run test:coverage -- --serial
node evals/ci/mutation-recovery-faults.ts
node evals/ci/mutation-faults.ts
uv run --script tools/session_close.py --slug codex-solanaut-1
```

## Measured outcomes and outstanding gate

Nine focused cases and all seventeen semantic source faults pass; exact source
is restored. Twelve installed cases pass outside the workspace with no loader
or workspace symlink. All 118 compiled faults catch, preserving the complete
earlier 108 and adding ten facade trials; restored package passes. Registry,
partition and coverage campaigns catch five, twelve and thirty-one faults and
restore. Native typecheck exits zero. Definition 34's quiet ordinary suite
passes all 834 cases, including the exact selected 528-case real baseline.

The quiet serial AST suite executes 834 cases: 833 pass and its existing real
baseline wait expires. The unchanged coverage command refuses qualification at
test completion, before producing a passing summary. Retain `coverage-final.txt`
and all raw reports in `coverage-failed-definition34/`. No complete coverage
floor pass, mutation score or completed SNP-7 follows. H11's exact wait proposal
is requested asynchronously; delivery is not acceptance. Preserve all concurrent
failures, the focused branch deficit and the quiet AST failure together with the
ordinary pass. The implementation remains a locally verified partial component.

`installed-candidate.json` binds product/evaluation sources and the unpublished
private tarball. The package remains `0.0.0`/private. The final isolated driver
baseline also expires at its unchanged wait before any trial: no driver catch or
qualification credit. All fifty-two report/staging faults catch/restored. Every
bound product/evaluation/archive digest matches after restoration. Local
close/commit verification follows in the continuing run. Source-history
Git backups are distinct from operator-state recovery; local-only work cannot
pass pushed HEAD. No hosted or stable-release qualification follows.

Pre-commit close flags a dummy malformed-status field named `secret`, with literal
value `PRIVATE_SENTINEL`, as credential-shaped. No actual credential/key is present.
Rename only that rejected extra field to `extra`, retaining its value, redaction
assertion and strict status validation. This is a fixture-name correction, not a
workload/limit change; all selected cases and definition 34 remain. Preserve the
prior evaluation identity as `installed-candidate-before-fixture-name.json`;
product and compiled archive bytes are unchanged. Repeat focused/type/native
checks and bind the corrected evaluation identity before local commit.

The corrected fixture passes nine focused cases, native typecheck and all 834
ordinary cases. Only its evaluation-input digest changes; every product and
private archive digest matches the earlier candidate. The earlier serial AST
failure remains the outstanding qualification result; no passing AST run is
invented for this fixture-name correction.

Corrected pre-commit close passes eight of ten checks, failing only pushed HEAD
and the staged tree; secret scanning and all other local close checks pass.
Archive the partial implementation locally with its wider qualification open.

Local implementation commit: `36a1ae793e08855e817496837fcf5d7ea34abd37`.
Its local Git bundle verifies and restores that exact clean revision with passing
full object-integrity verification. Post-commit close passes nine of ten checks;
only pushed HEAD fails under the explicit local-only direction. This backs up
source history on the same machine, not operator state or off-device storage.
