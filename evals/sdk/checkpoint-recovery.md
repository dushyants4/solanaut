# SNP-5/6 — checkpoint and tail recovery preparation

2026-10-07 · builder-authored Linux/Node 26.7.0 component evidence · base
995c5b0 plus candidate. Internal preparation; no root export, signer method,
record-owner wiring or live guard startup added.

Capture external pins and history, require supported configuration and full signed
history replay, and enforce an optional externally pinned anchor against that
history. A checkpoint must authenticate under the pinned authority, match derived
prefix/state/archive bytes and have verified retained archive files. Rebuild its
prefix into fresh Keel and apply verified tail ticks/resets. The current admission
state is derived from full replay, including signed policy changes; stored state
numbers are never loaded.

A missing or invalid checkpoint falls back to independently validated full history.
Missing checkpoint archives do not prevent that fallback when the caller supplies
complete signed history. Invalid full history, empty history, foreign configuration
or conflicting/missing external anchor evidence refuses preparation. Neither a
checkpoint nor fallback bypasses the anchor. A runtime controller divergence after
validation also refuses. The immutable receipt distinguishes checkpoint/full replay
and missing/invalid checkpoint reasons. The returned controller remains mutable
for continued runtime evaluation.

## Evidence and findings

The initial fixture accidentally supplied signing-text fields to the exact envelope
codec; corrected selection establishes the missing-function failures. The first
candidate passes the focused battery, then a sparse principal list demonstrates
an accepted invalid configuration. Dense/key-index checks correct that defect;
the regression and original failure remain retained.

Fault trials expose two ineffective fixtures. A named sparse principal array lacking
the actual principal is already refused by membership checking; the corrected
fixture retains actual membership while probing its invalid array fields. The
initial prefix has no effective reset history, so skipping a tail reset is missed.
The fixture now establishes a nontrivial prefix before the release and compares
subsequent controller decisions. Its dishonest-state alteration uses parsed state,
with an explicit inequality assertion, after the expanded fixture changes denial
counts. Every missed trial and corrected run is retained.

Eight focused cases and twenty source faults pass with restoration. The mixed
history includes admissions, redeem, signed/send-started/uncertain response,
denials, latch/release, status request/response, policy change and parsed tail.
Unresolved reservation and signing facts and final latch state agree with full
replay. Injected fresh-controller tail divergence refuses.

Commands: `node --test packages/sdk/test/checkpoint-recovery.test.ts`;
`node evals/sdk/checkpoint-recovery-faults.ts`; `npm run release:prepare`;
`node --test evals/packaging/packed-sdk.test.ts`; `node evals/packaging/faults.ts`;
`node evals/ci/coverage-faults.ts`; `node evals/ci/mutation-faults.ts`;
`node evals/ci/mutation-recovery-faults.ts`; `npm test`; `npm run typecheck`;
`npm run test:coverage -- --serial`. Raw evidence: `checkpoint-recovery/`.

Final installed/gate/integration measurements follow. Definition 13 retains all
earlier mutation inputs/floors and adds recovery source/test, with fresh seed 23947.
The harness wait and supervisor limits are unchanged. Complete mutation score,
owned operational restore, bounded-memory/restart qualification and independent
security evidence remain owed. This component cannot qualify SNP-5/6 alone.

Final local evidence: ten installed cases and thirty-six compiled faults pass
with restoration. Twenty-seven coverage, thirty-six staging/report and fifteen
recovery/driver faults pass and restore. Actual expanded baseline contains 329
cases and measures no mutation score. Ordinary/serial AST integration passes 623
cases; native typecheck exits zero. Unchanged floors pass: recovery 59/61
statements and 76/79 branches. Exact source and AST hashes are retained.
