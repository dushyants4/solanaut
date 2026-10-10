# Current private signing journal qualification

Builder-authored local evidence, 2026-10-10 Toronto, existing Linux x86-64 host.
Exact product revision `f1e253ffb791b7e3ca3710427f9a26ee90ec8504`; native
Node 26.7.0 evidence is in `../sdk/owned-signing.md`, CLAIMS S112. This receipt
extends that exact component's verification, without inheriting older passes.

The actual unchanged standalone package campaign catches all 144 retained
compiled faults and passes its restored installed control. The complete output
is retained in `owned-signing-current/package-faults.txt`. Product, evaluation,
emitted and archive hashes match `../sdk/owned-signing/candidate.json` afterwards;
the verification result is `post-package-identities.json`.

```bash
node evals/packaging/faults.ts
```

This is direct campaign evidence, not a pass under the maintained runner's
enclosing process deadline. CLAIMS S110 still records that failed runner; the
isolated execution proposal in S111 remains unapplied. No wait, process limit,
fault population, installed assertion or readiness threshold is changed.

Already installed Node 24.19.0 passes all 888 native cases, typecheck, nineteen
existing installed cases and nine lifecycle cases against the actual offline
tarball installation. All six new compiled faults are caught with complete
named-case checks and exact restoration; initial/restored controls pass. Raw
output and the runtime identity are retained in this receipt's directory.
Quiet serial AST executes all 888 cases, passes 887 and fails only the unchanged
H11 real staged-baseline wait. No cancellation or skip; no floor credit. The
earlier Node 26 AST failure remains separate. Final bound product/evaluation/
emitted/archive identities match, and restored Node 26 typecheck passes.
Node 26.7.0 remains the development
pin. No runtime installation, global change, clean Ubuntu deployment, isolated
signer, complete runtime matrix or stable release is claimed.

```bash
mise exec node@24.19.0 -- npm test
mise exec node@24.19.0 -- npm run typecheck
mise exec node@24.19.0 -- node --test evals/packaging/packed-sdk.test.ts
mise exec node@24.19.0 -- python evals/sdk/owned-signing/install.py
mise exec node@24.19.0 -- python evals/sdk/owned-signing/faults.py --compiled
mise exec node@24.19.0 -- npm run test:coverage -- --serial
```

The two component helpers write their original receipt locations. This follow-up
initially overwrites those logs; preserve the new runtime logs in this directory,
then restore the exact earlier tracked logs from f1e253f. No result is discarded
or relabelled. For regeneration, snapshot the original helper outputs first,
archive the new outputs separately, then restore the originals. Original S112
evidence and its source identities remain intact.
