# SNP-3 — captured checkpoint signing bundle

Initial serial ordinary integration fails its unchanged staged-baseline wait.
The child output reaches the sensor battery but has not completed; preserve
`checkpoint-bundle/root-incomplete-baseline.txt`. This is a gate failure, not a
pass inferred from partial output. Sequential unchanged rerun follows; timing
reliability remains an open finding.

2026-10-07 · builder-authored local Linux/Node 26.7.0 evidence · base 2692542
plus candidate. Internal helper; no root exports or signer RPC additions.

Preparation captures external policy/checkpoint pins and endpoint before history
accessors or asynchronous replay. One captured history supplies admission-state and
Keel-prefix bytes; captured receipt metadata supplies the archive catalogue. The
descriptor takes its policy version/hash from validated state, binds every payload
digest, and supplies the existing distinct snapshot/prefix signing domains.

All six stub cases fail first. Positive signing round trips verify both signatures
against independently computed payload digests. Cases cover stale endpoints,
incomplete catalogues, wrong/missing policy trust, foreign guard/cluster,
principal/anchor authority overlap, dishonest resealed history, unsigned state,
caller mutation and malformed input. Twenty source faults are caught and restored.
A later hostile array with named trust fields first fails its shape refusal;
an explicit array guard and caught omission trial close it.

The old installed candidate fails because the bundle module is absent. Installed
proof inspects internal JavaScript/declarations from a tarball outside the workspace,
checks payload agreement and verifies both signed domains. Catalogue inputs in
these bundle tests are metadata fixtures, not verified archive-file evidence.

Critical coverage, maintained campaign inventory and mutation scope first refuse
before registration. Definition 9 declares fresh seed 23519 before measurement,
retaining prior sources/tests, floors, workload and resource limits while adding
the complete bundle source and test file. The selected baseline contains 295 cases.
Twenty-nine staging/report, fifteen recovery/driver and twenty-four coverage faults
are caught with restoration; ten installed cases/twenty-three compiled faults pass.
Corrected ordinary and AST integration each pass 589 cases; typecheck exits zero.
All unchanged coverage floors pass. The scheduling defect and earlier failures are retained in
`../ci/ordinary-serial.md`.
No complete mutation score, archive-file verification, authenticated consumption,
atomic publication, bounded memory or independent security evidence is claimed.

Regenerate sequentially:

- `node --test packages/sdk/test/checkpoint-bundle.test.ts`
- `node evals/sdk/checkpoint-bundle-faults.ts`
- `node evals/ci/coverage-faults.ts`
- `node evals/ci/mutation-faults.ts`
- `node evals/ci/mutation-recovery-faults.ts`
- `npm run release:prepare`
- `node --test evals/packaging/packed-sdk.test.ts`
- `node evals/packaging/faults.ts`
- `npm test -- --test-concurrency=1`
- `npm run typecheck`
- `npm run test:coverage -- --serial`

Raw failures, passes and input hashes are retained in `checkpoint-bundle/`.
Private close/sync and exact-revision hosted checks follow local qualification.

The separately committed baseline manifest/result predates the scheduling fix
and records its own inputs. Current ordinary/AST recovery cases launch fresh
stages and validate the corrected root package input; no old binding is reused.
