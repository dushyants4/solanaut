# SNP-5/6, OWN-2 — recovery under the actual record owner

2026-10-07 · builder-authored local Linux/Node 26.7.0 component evidence · base
f05c84d plus candidate. Internal read-only preparation, not live guard startup.

Only the actual kernel-owned file store receives the capability. Capture external
pins; read history from a fresh no-follow descriptor rather than the append
descriptor at EOF; compare it with cached entries before checkpoint access. Read
the current checkpoint with no-follow/nonblocking regular-file checks and an
explicit byte ceiling, including short reads and growth checks. Invoke verified
recovery preparation with disk history. Repeat ownership, inode, size/time and
cached-history checks after asynchronous replay. Publication/recovery share one
maintenance exclusion, released on both success and failure.

A missing, corrupt, oversized or unsupported checkpoint source can trigger only
verified complete-history fallback. Invalid history, an external anchor conflict,
lost ownership or a changed record refuses. Evidence is never overwritten during
recovery. A reopened established owner verifies existing history; a closed old
store cannot acquire its capability through reused descriptor numbers.

## Evidence and findings

Hosted 49f753b run 37703450078 completes with four unchanged-baseline-wait
failures: Node 22/26 ordinary jobs, AST and maintained faults. Node 24 and the
other jobs pass. Exact metadata/full logs are retained in
`checkpoint-owned-recovery/hosted-49f753b/`. H11 remains pending; these failures
are not cleared by local component evidence.

Nine initial cases fail on the missing capability. A further failed-writer and
established-reopen case exercises the existing storage failure boundary. Initial
closed-owner omission is masked by closed file descriptors; reopening the record
adds the descriptor-reuse regression. Initial early cached-history omission is
caught by the final check; an added early-refusal regression requires rejection
before checkpoint access. These missed trials and their corrected tests remain
retained alongside passes.

Ten focused cases and the earlier fifteen source omissions pass with exact restoration.
Cases cover checkpoint/tail comparison, forged/manual/closed/failed ownership,
record and lock replacement, corrupt disk/cache history, checkpoint fallback,
competing maintenance, mid-replay changes, short/error/growing reads, captured
pins and an external anchor. This evidence is builder-authored, not independent.

The maintained campaign inventory and expanded staged test scope fail first,
then accept registration. Provisional seed 24029 precedes the additional torn-file
and invalid-read-progress cases. Definition 14/fresh seed 24103 precedes integration;
that candidate subsequently fails the symlink-to-held-inode regression. The
following stat accepts an alias installed during replay. Lstat and regular-file
checking correct the named ownership boundary; record and lock alias cases plus
an installed alias case establish refusal. Final definition 15/fresh seed 24307 precedes repeated
qualification; all previous source inputs, floors and limits are retained. No
mutation score is inferred from the baseline. Old installed artefacts fail first;
final installed/integration measurements follow.

Before the alias correction, ordinary and serial AST suites each pass 633 cases. Native typecheck exits
zero; all unchanged coverage floors pass. Record coverage is 199/205 statements
and 117/124 branches. Ten external installed cases and thirty-nine compiled
faults pass with restoration. Thirty-seven mutation report/staging faults and
the provisional fifteen recovery/driver faults pass; final frozen-seed recovery
fault repetition follows. The real expanded baseline contains 339 cases.
Original publication faults also pass after their sites are scoped precisely to
publication, retaining the zero-progress child deadline without completion credit.
These are provisional local component results, not the corrected candidate or
hosted runtime qualification. Corrected final measurements follow.

Corrected source passes sixteen fault trials with restoration. Ten installed
cases and forty compiled faults pass, including the named-path alias omission;
the earlier installed artefact fails that new case first. Thirty-seven staging/
report faults restore. Final typecheck exits zero. Corrected ordinary/AST and
fresh-seed recovery/driver qualification follow; all original failures remain.

Corrected ordinary and serial AST suites each pass 633 cases; native typecheck
exits zero and every unchanged coverage floor passes. Record coverage measures
199/205 statements and 118/125 branches, with exact hashes in the final summary.
The real baseline contains 339 cases under definition 15/fresh seed 24307.
Final fresh-seed recovery/driver repetition catches all fifteen faults and restores
the exact sources. No complete mutation score, hosted runtime or release
qualification is inferred. Final close/private sync follows. CLAIMS S72 records
these scoped measurements; pre-alias manifests remain explicitly labelled.

Commands: `node --test packages/sdk/test/checkpoint-owned-recovery.test.ts`;
`node evals/sdk/checkpoint-owned-recovery-faults.ts`;
`node evals/sdk/checkpoint-publication-faults.ts`; `npm run release:prepare`;
`node --test evals/packaging/packed-sdk.test.ts`; `node evals/packaging/faults.ts`;
`node evals/ci/mutation-faults.ts`; `node evals/ci/mutation-recovery-faults.ts`;
`npm test`; `npm run typecheck`; `npm run test:coverage -- --serial`.
Raw evidence and exact source hashes: `checkpoint-owned-recovery/`.

## Limitations

The receipt checks a boundary under a live owner; it is not an admission-blocking
startup path. An existing trusted SDK guard can append during replay, which
invalidates recovery. No snapshot admission state is deserialised, no root export
or signer RPC is added, and the full history remains in memory. Cadence, live
protected startup, bounded retention, restart/performance targets, approved
runtime qualification, backup/upgrade drills and independent security remain owed.
Missing external anchor configuration cannot establish a rollback bound. No
power-loss, Alpha or stable-release claim. H9/H10/H11 remain pending.
