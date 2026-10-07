# SNP-3/5 — derived admission-state preparation

2026-10-07 · builder-authored local Linux/Node 26.7.0 evidence · base 23f57d5
plus retained candidate. Internal preparation only; no loader, publication,
bounded-history claim or independent security evidence.

The stub fails all five original cases. Captured history, policy seed, external
policy trust and endpoint precede asynchronous full Keel/decision replay. Admission
state then uses existing transitions. Unsigned history refuses this signed-mode
preparation. Canonical format 1, kind `solanaut-checkpoint-admission-state`, binds
profile, guard/cluster, current canonical policy/hash/signed version/entry, admission
state and previous decision. Ordered map/set entries retain replay order; bigint
amounts/heights become decimal strings. The predecessor survives release/report
boundaries for ADR-012. Decision observations are evidence, never loaded controller
state. Keel reconstruction remains separate authenticated prefix replay.

Six cases pass: unresolved send/signature/response, reservation/redemption, latch
and reset, pending/completed controls, increased then decreased policy windows,
resealed dishonest telemetry and caller mutation. Sixteen source faults are caught
with restoration. Seed-cap mutation was masked by signed-policy reapplication and
retained as a miss; a retention-window fixture catches the missing policy copy.
Initial campaign/critical-file refusals remain retained; coverage faults pass with
restoration. Serial ordinary and instrumented suites pass all 580 cases; typecheck
exits zero. State statements 44/44 and branches 22/22; all existing floors pass.
Private close/sync follows this reviewed candidate.

Final schema/profile assertions and a profile-substitution fault pass, followed by
580 ordinary cases and typecheck. Recorded AST evidence uses the same SDK source
hashes before this fixture strengthening; no coverage floor or source is changed.

Regenerate: `node --test packages/sdk/test/checkpoint-state.test.ts`,
`node evals/sdk/checkpoint-state-faults.ts`, `node evals/ci/coverage-faults.ts`,
`npm test -- --test-concurrency=1`, `npm run test:coverage -- --serial`,
`npm run typecheck`. Raw outputs/source hashes: `checkpoint-state/`.

Authority binding, exclusive atomic publication and strict restore/fallback remain
required. Full history is copied/replayed here; bounded streaming/indexing is owed.
Include these sources/tests in the next frozen mutation definition. RT-2, specialist
audit and individual Linux recovery/upgrade evidence remain separate release gates.
