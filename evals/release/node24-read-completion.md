# Node 24 qualification of complete record reads

Builder-authored local evidence, 2026-10-09 Toronto, existing Linux x86-64 host.
Exact implementation `701372e8de28160ec8965a3600de184d20f0c00a`; already installed
Node 24.19.0. Node 26.7.0 remains the development pin. No tool installation,
global configuration change, clean Ubuntu deployment or complete runtime matrix.

Use the unchanged private candidate and bound identities in
`evals/sdk/record-read-completion/installed-candidate.json`. Definition 42/seed
42719 preserves prior populations, floors, waits and limits. Qualification is
partial: all 862 native cases and sixteen installed cases pass; typecheck exits
zero. Quiet serial AST executes 862 cases: 861 pass, one unchanged real staged
baseline wait fails. Complete coverage fails and no floor pass is claimed.
Raw reports remain archived. All 134 retained compiled faults catch and the
restored sixteen-case consumer baseline passes. All bound product, evaluation,
emitted-file and archive hashes match after restoration. Initial failed Node 26 runs
remain with the component receipt. No independent security or stable gate follows.

```bash
mise exec node@24.19.0 -- npm test
mise exec node@24.19.0 -- npm run typecheck
mise exec node@24.19.0 -- npm run test:coverage -- --serial
mise exec node@24.19.0 -- node --test evals/packaging/packed-sdk.test.ts
mise exec node@24.19.0 -- node evals/packaging/faults.ts
```

No remote push. The implementation's local Git bundle verifies; an exact clean
clone checks out that revision and full integrity verification exits zero.
Post-commit close reports unpushed HEAD and the newly started runtime evidence
as uncommitted; do not describe it as a clean-tree close.
