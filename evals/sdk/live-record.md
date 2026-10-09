# Live record consistency — D33

Builder-authored evidence, 2026-10-09 Toronto, Linux/Node 26.7.0, base
`7a64856` plus candidate. ADR-019 ownership/durability; STO-2/3, SIG-8, OWN-2.

## Finding and correction

In both manual and kernel ownership, a process can append, truncate or overwrite
the held journal inode without changing its identity. Before this correction the
guard acknowledges another decision from cached history and appends behind those
unverified bytes. Compare descriptor size, nanosecond modification time and change
time against completed startup or the last successful synced append. Refuse a
mismatch before writing and permanently fail that store. Refresh the expected
stamp only after sync. Capture startup metadata inside the existing cleanup scope.

No record/profile format, ownership policy, signer budget, public API or wait is
changed. This is live storage consistency, not an authenticated content read or
atomic defence against a privileged concurrent writer. Stop admissions/writers
before operator repair; a same-host Git bundle is not an off-device state backup.

## Failures and falsifiability

The initial fixture incorrectly passes `store` instead of the supported `log`
option; preserve it, correct the fixture, and observe all new cases fail for
acknowledged corrupt history. The installed previous candidate likewise fails.

The initial byte-count fault misses because timestamps independently detect the
append. Add an explicit stale/coarse timestamp injection while keeping real
external growth; that makes the size comparison independently falsifiable. The
failed-store fault also misses because the enclosing guard has already shut down.
Add a direct store append assertion to prove the store, as well as the guard,
remains failed after repair. Preserve both misses alongside the final campaign.
All previous ownership/storage and installed/compiled trials remain.

Definition 38/seed 38653 is declared before full candidate measurement, retaining
every prior source/test, floor, wait and supervisor/product limit. It selects 541
cases including the additional storage regressions. No full mutation score follows.

```bash
node --test --test-isolation=none packages/sdk/test/storage-failures.test.ts
node evals/sdk/ownership-faults.ts
npm run release:prepare
node --test evals/packaging/packed-sdk.test.ts
node evals/packaging/faults.ts
npm test
npm run typecheck
npm run test:coverage -- --serial
uv run --script tools/session_close.py --slug codex-solanaut-1
```

## Status

Raw failures and measurements are retained in `evals/sdk/live-record/`.
CLAIMS S99 records partial source/installed evidence. All nine retained source
faults catch and the restored fifteen-case combined baseline passes. All thirteen
installed cases and all 130 retained compiled faults pass with restoration.
Native tests pass all 847 cases and typecheck exits zero. Serial AST executes
847 cases: 846 pass and the unchanged real staged-baseline wait fails. Complete
coverage qualification therefore fails; no floor pass is claimed. Preserve the
quiet failure, raw reports and original deadline. H11 remains pending.

`installed-candidate.json` binds the separate private archive, product sources,
evaluation inputs and emitted files; exact post-restoration checks pass. Authored
TypeScript/Markdown diff checks pass. No independent review, bounded recovery,
process isolation, power-loss guarantee or stable-release milestone is claimed.
Local commits/backups only; H9/H11 and independent/publication gates remain open.

Pre-commit close passes eight of ten gates, failing dirty tree and unpushed HEAD
only. Keep the latter unchanged under the user's no-push direction.
