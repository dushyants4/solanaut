# SNP-4 — publication under the actual record owner

2026-10-07 · builder-authored Linux/Node 26.7.0 evidence · base 6162efb plus
candidate. Internal component; no stable root export or signer method added.

An internal capability is registered only against the actual file-store object.
Publication requires live kernel ownership, compares a fresh record read with its
cached entries, authenticates the candidate, verifies retained archive files and
compares every payload and descriptor with full replay-derived preparation. Record
changes during asynchronous validation refuse the candidate. Archive files are
rechecked after replay. Competing publications on the same store refuse.

The canonical signed envelope is written to an exclusive temporary file and synced.
An existing authenticated checkpoint is retained through a hard link and atomic
rename to `.checkpoint.previous`, followed by directory sync. The candidate then
replaces `.checkpoint` through atomic rename and directory sync. Storage failures
fail the writer. Authentication and stale-input refusals before storage mutation
preserve the existing writer and checkpoint. These are reversible file conventions
inside ADR-019, not a change to its authority or replay contract.

## Evidence and findings

The initial eight cases fail because the function is missing. The first candidate
exposes a fixture defect: a null message with request identity is refused without
recording a decision. The corrected fixture uses unsupported bytes and asserts its
retained denial. Initial output and fixture/type failures are retained.

Fourteen cases pass locally, including genuine SIGKILL at write, file sync, prior
rename, current rename and final directory sync boundaries. After each observed
death, checkpoint files authenticate and kernel ownership can be reacquired with
the original history. Seven storage failures cover disk-full, zero progress,
permission loss, file/prior/final sync and final rename. Short writes finish fully;
replacement observes one file sync and two directory syncs before returning.

Fault trials found ineffective fixtures for manual ownership and symlink sources;
both now use valid signed history or checkpoint bytes. A single missing payload
comparison is defended by the descriptor digest comparison; the compound omission
trial removes both checks. The zero-progress omission stalls a child. A test-runner
SIGTERM handler prevented timely containment with shared isolation; that attempt
was explicitly killed and restored. The final campaign uses SIGKILL at its existing
child deadline and gives that trial no test-completion credit.

Commands: `node --test packages/sdk/test/checkpoint-publication.test.ts`;
`node evals/sdk/checkpoint-publication-faults.ts`; `npm run release:prepare`;
`node --test evals/packaging/packed-sdk.test.ts`; `node evals/packaging/faults.ts`;
`node evals/ci/coverage-faults.ts`; `node evals/ci/mutation-faults.ts`;
`node evals/ci/mutation-recovery-faults.ts`; `npm test`; `npm run typecheck`;
`npm run test:coverage -- --serial`.

Final campaign and integrated results follow below. Raw evidence is retained in
`checkpoint-publication/`; no failed trial is discarded.

Final focused evidence: fourteen source cases pass; sixteen completed source
omission trials fail and one zero-progress omission is contained by actual
SIGKILL at the child deadline. Restored source passes. Ten installed cases and
thirty compiled faults pass with restoration. Twenty-six coverage faults,
thirty-four staging/report faults and fifteen recovery/driver faults pass and
restore. Definition 11 retains every earlier target/test and adds record and
publication sources plus the publication battery, with fresh seed 23731. Its
actual staged baseline contains 317 cases; it measures no mutation score. The
first recovery trial retained a stale definition assertion and failed before
qualification; that assertion now names the enlarged population. The existing
baseline wait, all floors and supervisor limits remain unchanged.

Ordinary and serial AST integration both pass 611 cases; typecheck exits zero.
Unchanged floors pass: publication 81/88 statements and 51/59 branches; record
140/145 statements and 75/81 branches. The source manifest and AST input hashes
are retained. Final fault children use a parent-owned scratch directory that is
removed after observed completion or deadline kill.

## Limits

This full-history publication component does not implement checkpoint cadence,
maintenance wiring, authenticated restore/fallback, a disk request index or bounded
memory. Process death and observed sync calls do not establish power-loss durability.
Signer expansion remains behind H9. No independent evaluation, complete mutation
score, SNP-4 completion, Alpha or stable-release claim is made.
