# Private queued signing journal

Builder-authored local evidence, 2026-10-10 Toronto, Linux x86-64/Node 26.7.0.
Reviewed base `f6d5e298924e752ba05cb97eb02914634b95f42f`; product identities
are bound separately. Accepted ADR-019, LIF-2/7 and SNP-5/7. This is a private
trusted SDK journal operation, not an isolated signer, key loader or send path.

`recordSigning(event)` captures the event before queuing, delegates the existing
durable verifier/append, and returns a detached immutable entry. Admissions,
controls, reports, redemption, observations and close share its queue. Existing
stage/lifetime/signature/finality checks apply; storage errors return the fixed
facade error and cannot acknowledge a stage. No root export or socket method.
No signer-specific helper or conservative line-budget scope is changed. Full
historical state retention remains unchanged; ADR-023 is still proposed.

## Failures first and faults

All nine new cases fail on the absent journal method; the updated frozen-surface
case also fails before implementation. Preserve `owned-signing/first-red.txt`
and `surface-red.txt`. Correct an unreachable test assertion before implementation:
`Reflect.set` on frozen data returns false rather than throwing. The lifecycle
case has not passed at that point. After implementation all thirty-two combined
owned-facade/lifecycle cases and typecheck pass.

Six source faults and the same six emitted faults are caught: missing capture,
missing commit, mutable reply, wrong recorded stage, swallowed storage error and
queue bypass. Each trial runs all nine lifecycle cases, requires the named failing
case, forbids cancellation/skips and syntax/reference/setup errors, then restores
exact bytes. Baseline and restored controls pass. Initial trial tooling rejects
a legitimate capture failure because it recognises only AssertionError; retain
the diagnostic, accept the existing fixed OwnedGuardError as well, and rerun all
trials with named-case checks. This is a runner correction, not a missed product
fault or relaxed product assertion. All faults and restored hashes are archived.

```bash
node --test packages/sdk/test/owned-signing.test.ts packages/sdk/test/owned-guard.test.ts
python evals/sdk/owned-signing/faults.py
npm run release:prepare
python evals/sdk/owned-signing/faults.py --compiled
npm run typecheck
```

## Private installed artefact

Pack the reviewed emitted SDK; retain pack output and archive identity. The
existing nineteen installed cases pass. Offline-install the actual tarball in
a fresh external consumer with scripts disabled and prove its package directory
is not a symlink. All nine new cases pass against that installed private facade.
The fixture writer and transaction builder still come from repository support;
this is not a public deep-import compatibility promise or clean Ubuntu install.
Ephemeral test Ed25519 material exists only in memory and moves no funds.

```bash
npm pack ./.sandbox/releases/sdk --pack-destination .sandbox/solanaut-1/owned-signing --json
node --test evals/packaging/packed-sdk.test.ts
python evals/sdk/owned-signing/install.py
```

All 888 native cases pass, without cancellation or skips. Regenerate `npm test`.
Bind the product, evaluation and emitted inputs plus the actual archive with
`python evals/sdk/owned-signing/candidate.py`; private method remains absent from
root exports. Prior Node 24 and replay receipts describe their original revision,
not this changed component. All thirty-nine existing maintained facade faults
are caught and exact source restoration is verified; raw trial logs are retained.
Regenerate `node evals/sdk/owned-guard-faults.ts`. Quiet AST executes all 888
cases, passes 887 and fails only the unchanged H11 staged-baseline wait. No
cancellation or skip; no coverage-floor credit. Raw output is retained, and no
threshold or gate is changed. Regenerate `npm run test:coverage -- --serial`.
This failure has the same evidential weight as native/component successes.
No stable-release, complete
lifecycle, bounded memory, process isolation, independent security or performance
claim follows from these component tests.

The first coverage command uses an unsupported CLI argument and fails before
measurement. Preserve `coverage-usage-refusal.txt`; use the existing documented
`npm run test:coverage -- --serial` option, changing no gate or threshold.

Candidate comparison shows only the private facade product source changed;
existing signer sources/helper, root exports and record format are identical.
Only its emitted JavaScript/declaration differ. The manifest binds 51 product
sources, 90 evaluation inputs and 86 emitted files. Archive and installation
identities match. `candidate-diff.json` lists exact differences against S108.
