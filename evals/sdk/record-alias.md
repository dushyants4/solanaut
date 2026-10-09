# Journal and mutex alias refusal

Builder-authored local evidence, 2026-10-09 Toronto, Linux/Node 26.7.0,
base `8b1d29d` plus candidate. ADR-019 exclusive ownership; OWN-2/4, SIG-8.

## Finding

Manual and kernel stores can open a hardlinked journal through another pathname
because that pathname has a separate mutex. Kernel startup also accepts a
hardlinked mutex. This violates the single-owner boundary under accidental alias
configuration. The signer host remains trusted; this is not an adversarial-host
or atomic content-authentication guarantee.

## Correction and evidence

Require both descriptor and named journal/mutex inodes to have one link, alongside
existing regular-file and inode-identity checks. Preserve mutex contents on failed
startup, release acquired ownership and allow normal reopening after stopped
operator maintenance. Do not unlink mutexes to manufacture ownership.

Source cases fail first on missing refusal; the installed previous JavaScript
likewise accepts an alias. Retain every existing ownership/storage and compiled
trial. The new single-link bypass fault must fail behavioural assertions. Existing
rename/replacement tests retain the original inode so the new link check cannot
silently mask the older named-path fault.

Definition 39/seed 39743 is declared before full measurement, selecting 544 cases
and retaining every previous source/test, floor, wait and process/product limit.

```bash
node --test --test-isolation=none packages/sdk/test/ownership.test.ts packages/sdk/test/storage-failures.test.ts
node evals/sdk/ownership-faults.ts
npm run typecheck
npm run release:prepare
node --test evals/packaging/packed-sdk.test.ts
node evals/packaging/faults.ts
npm test
npm run test:coverage -- --serial
uv run --script tools/session_close.py --slug codex-solanaut-1
```

## Status

Final review adds the explicitly allocated OWN-4 to the source test labels.
Preserve the original full/AST outputs and `pre-label-candidate.json`; the
underlying cases, code, definition, seed and limits are unchanged. Re-run the
retained source campaign and full native/AST measurements under the labelled
input identity before the coherent local commit. No old failure is discarded.
The labelled source campaign and native suite pass with the same populations;
labelled serial AST repeats the unchanged wait failure. Retain both runs and
both input manifests. Final identity verification matches the labelled inputs.

Raw outputs live in `evals/sdk/record-alias/`. Wider candidate qualification is
incomplete. CLAIMS S101 records eighteen focused cases, ten retained source faults,
fourteen installed cases and all 131 retained compiled faults passing with
restoration. Native tests pass all 850 cases; final restored typecheck exits zero.
Quiet serial AST executes 850: 849 pass and one unchanged real staged-baseline
wait fails. Complete coverage fails; no floor pass is claimed. Preserve raw reports
and the original deadline. Exact bound product/input/emitted-file/archive hashes
match after restoration. Authored TypeScript/Markdown diff checks pass.
No independent security, full mutation score, bounded recovery, signer
budget, clean Ubuntu deployment or stable milestone is claimed. Earlier AST
deadline failures and human/Claude/audit/publication gates remain open. Local
commits and Git bundles only; no remote push.
