# SNP-3/5 — validated Keel prefix preparation

2026-10-07 · builder-authored local Linux evidence · Node 26.7.0 · base afed152
plus the recorded candidate. Internal component only; full restore and installed
SDK integration remain owed.

The unimplemented function fails all seven original cases. Full replay now precedes
event extraction, using the pinned controller and sensor through existing replay.
Signed policy history needs externally pinned policy trust. Inputs are captured
before asynchronous replay; history must reach the captured sequence/head.

Canonical format 1 has kind `solanaut-checkpoint-keel-prefix`, evaluation profile,
next sequence, preceding head and ordered events. A tick retains telemetry,
posture, source sequence/hash; a release retains a reset and source sequence/hash.
No controller state numbers are emitted. The signed checkpoint descriptor binds
this payload digest to authority, guard/cluster, policy and archive/state digests.
Preparation does not verify that descriptor or restore a guard.

Nine cases pass, including mixed history, fresh-controller posture reproduction,
malformed inputs, resealed dishonest telemetry, signed policy changes and mutation
during replay. Seventeen source faults are caught with exact restoration. The
initial sequence fault exposed a missing valid-but-wrong endpoint case, then added.
A clone-only fault is masked by the canonical copy; retained as a miss. Removing
the effective history copy is caught. Initial critical-file and campaign-inventory
refusals remain retained. Coverage faults pass with restored sources.

Serial ordinary integration passes 574 cases; integrated typecheck exits zero.
A prematurely overlapping coverage invocation is stopped, not qualified; its
children finish and inspection confirms no worker remains. Isolated instrumented
validation passes all 574 cases and existing floors; prefix statements 26/26 and
branches 33/33. Earlier interruption remains retained, not counted as a pass.

Regenerate: `node --test packages/sdk/test/checkpoint-prefix.test.ts`,
`node evals/sdk/checkpoint-prefix-faults.ts`, `node evals/ci/coverage-faults.ts`,
`npm test -- --test-concurrency=1`, `npm run test:coverage -- --serial`,
`npm run typecheck`. Raw outputs: `checkpoint-prefix/`.

The next frozen mutation definition must include this component; no full score
is claimed. Atomic publication, authenticated prefix consumption, admission-state
payloads, restore/fallback, bounded streaming/indexing and independent security
review remain required. No deployment, publication or release clearance.
