# Node 24 qualification of queued trusted reports

Builder-authored local evidence, 2026-10-09 Toronto, existing Linux x86-64 host.
Exact implementation `4addaa4694e017a6a0b1269668a1d4b006e53dc7`; already installed
Node 24.19.0. Node 26.7.0 remains the development pin. No installation, global
configuration change, clean Ubuntu deployment or complete runtime matrix claim.

Use the unchanged private candidate and bound identities in
`evals/sdk/owned-report/installed-candidate.json`. Definition 45/seed 45691
preserves earlier populations, floors, waits and limits. All 879 native cases
and nineteen installed consumer cases pass; typecheck exits zero. Quiet serial
AST executes 879: 878 pass and the unchanged real staged-baseline wait fails.
Complete coverage fails with no floor pass; raw reports and output are archived.
All 144 retained compiled faults catch; the restored nineteen-case installed
baseline passes. Final restored typecheck exits zero. All 51 product, 87
evaluation and 86 emitted file hashes, plus the private archive digest, match.

The unchanged mixed-history replay workload reproduces all 10,000 decisions
over 13,651 entries under Node 24.19.0 and Node 26.7.0, with the existing pinned
head `cb4674cdc5851f2c1d6645df4c1d36f30eb7cf616b95010b27dbe6487c65254c`.
This is the existing unsigned, in-memory SDK workload with synthetic operator
signatures. It does not qualify signed-policy/socket/send recovery, compact
snapshots, runtime-matrix completeness or restart performance. Node 22 is not
installed locally; no installation is attempted. Failures remain beside passes.

```bash
mise exec node@24.19.0 -- npm test
mise exec node@24.19.0 -- npm run typecheck
mise exec node@24.19.0 -- npm run test:coverage -- --serial
mise exec node@24.19.0 -- node --test evals/packaging/packed-sdk.test.ts
mise exec node@24.19.0 -- node evals/packaging/faults.ts
mise exec node@24.19.0 -- npm run test:replay
npm run test:replay
```

The exact implementation is locally committed, with a verified Git bundle,
clean exact restore and full integrity check. Clean close passes all checks
except the deliberately unpushed HEAD. No remote push is performed.
