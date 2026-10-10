# D40/ADP-1 — current integration qualification

2026-10-10 Toronto · builder-authored local evidence · Node 26.7.0/Linux x86-64.
Reviewed base 11234cc plus the exact preserved S121 source/test correction.
This receipt supplements the original failures; it does not replace them.
Full native/type checks support local integration. Complete release coverage
remains failed at the existing H11 wait; no coverage-floor credit follows.

Fresh tests-first reproduction fails all six raw ArrayBuffer/SharedArrayBuffer
admission/send cases against the original adapter. The accepted ADR-009
correction privately copies each captured message branch and serialised wire.
No public method, policy/sensor, signer surface, RPC trust or key handling changes.
The exact candidate source and test match the previously reviewed patch hashes.

The corrected combined adapter suite passes all 31 cases. Three source and
three emitted copy omissions each fail the complete six-case population with
assertions and no skipped/cancelled/todo credit; exact restores and controls
pass. Actual offline installation, scripts disabled and no package symlink,
passes all six through its installed public wallet export. Guard/builders are
repository fixtures. The existing installed package suite separately passes
all 19 cases. Full native passes all 901 cases; typecheck passes.

The complete serial AST run passes 900 of 901 cases and fails H11's original
staged-baseline wait. Exit status is nonzero; the original coverage gate refuses
before emitting a floor summary. Full raw output and every counter file are
retained under `coverage-raw`, with a hash manifest. No floor pass or coverage
qualification is inferred. Post-run binding/type checks pass unchanged.

With the already installed Node 24.19.0 selected, the fresh full suite passes
900 of 901 cases and fails only the same H11 baseline wait. Preserve
`node24-native.txt`; it is not a matrix pass. Regenerate with
`mise exec node@24.19.0 -- npm test`. Its typecheck passes with
`mise exec node@24.19.0 -- npm run typecheck`; no runtime installation/global
change occurs. Final bound source/evaluation/emitted/archive identities still
match the preserved candidate. No evaluation workers remain active.

The rebuilt private archive is byte-identical to the preserved S121 archive:
`55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
All original product/evaluation/emitted hashes match that prepared candidate.
Earlier S121/S122 and S124 receipts, outputs and archives remain unchanged.
The new wrapper only relocates original helper output/scratch paths and verifies
their pinned hashes; original populations/assertions are retained. Generated
helpers and new raw trial outputs are preserved separately.

```bash
node --test packages/sdk/test/adapter-buffer.test.ts packages/sdk/test/adapter-wire.test.ts packages/sdk/test/adapters.test.ts
uv run --script evals/sdk/adapter-buffer-current/qualify.py --source
npm run release:prepare
npm pack ./.sandbox/releases/sdk --ignore-scripts --json --pack-destination .sandbox/solanaut-1/adapter-buffer-current
uv run --script evals/sdk/adapter-buffer-current/qualify.py --installed
uv run --script evals/sdk/adapter-buffer-current/qualify.py --compiled
node --test evals/packaging/packed-sdk.test.ts
uv run --script evals/sdk/adapter-buffer-current/qualify.py --bind
npm test
npm run typecheck
node evals/ci/coverage-run.ts --serial
```

Archive earlier outputs before regeneration. Deterministic aliases are not a
concurrent worker, real wallet, independent security or isolated-signing proof.
The versioned object fixture uses legacy message bytes. Original H11, actual
maintained packaging and hosted billing failures remain open. O5 remains an
unapplied owner CI draft; no source/readiness gate is changed. No complete
runtime/maintained/hosted qualification, stable milestone or release follows.
