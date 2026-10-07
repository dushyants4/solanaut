# POL-1 / POL-5 — public policy signing request command

2026-10-06 · builder-authored local Linux evidence · Node 26.7.0. Revision: commit
containing this receipt. This prepares existing canonical signing text; it neither signs
nor installs a policy, and does not qualify Phantom or the operational signer.

## Failures retained

Seven tests fail against the stub (`prepare-policy/initial-red.txt`). The first installed
case hits an undefined assertion-message harness error on the missing executable
(`installed-red.txt`); the corrected assertion retains the actual missing-command failure
(`installed-red-corrected.txt`). The initial release build omits the new bin from its
explicit compilation list and fails with ENOENT (`build.txt`). Add that explicit input.

A build mistakenly overlaps source fault injection (`build-final.txt`); discard that
candidate. Rebuild after confirmed restoration (`build-restored.txt`), then test the actual
packed installation. A symlink fault initially survives because the same fixture also has
a hardlinked target (`faults.txt`). Separate those cases so each check must detect its own
fault. This is a test improvement, not a weaker source restriction.

## Local component evidence

- `node --test packages/sdk/test/prepare-policy-cli.test.ts`: seven cases, canonical
  request/text/identity, determinism, no invented signature, usage/time boundaries,
  invalid policy/cluster, source and error redaction (`focused-boundaries.txt`).
- `node evals/sdk/prepare-policy-faults.ts`: nine final caught faults, with restored source
  (`faults-final.txt`). Sources include the exact size boundary, UTF-8, links and missing files.
- `npm run release:prepare`, `npm run test:package`: eight packed installed checks pass
  (`build-restored.txt`, `installed-final.txt`); the new executable runs without a loader
  outside the monorepo and matches the installed SDK's canonical text.
- `npm run typecheck`: zero errors (`typecheck.txt`).

`npm test` passes 464 cases (`full.txt`). Full `npm run test:bite` passes all 32 campaigns,
catches 269 planted faults and restores fingerprints with no failed/skipped campaign
(`bite.txt`). Typecheck after restoration is clean (`typecheck-restored.txt`). Private
close and hosted CI follow sync. No new
dependency, admission rule, sensor coefficient, history version or readiness floor changes.

The public output names guard/cluster/operator, version, issuance, policy hash and exact text.
It contains no signature. The command cannot establish the current installed policy version,
prove the human reviewed the request, authenticate a wallet or replace policy history.
