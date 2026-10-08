# SNP-1 — internal archive streaming

2026-10-07 · builder-authored Linux/Node 26.7.0 component evidence · base
9a6480f plus candidate. Internal structural iterator, not a root SDK export.

Capture options at creation, verify each frame/envelope/hash/sequence/predecessor
and applicable anchor before yielding deeply immutable entries. Reads pause with
the consumer. Natural completion verifies remaining framing, source identity and
size/time boundary, external head/digest and anchor presence; only then return an
immutable receipt. Cancellation or consumer failure closes the descriptor and
does not produce that receipt. The public verifier fully consumes the shared
iterator and preserves its existing receipt/error surface.

Yielded entries are provisional. A consumer cannot enable admissions or claim
complete source integrity from a partial stream. This is a prerequisite for
streaming replay, not policy authentication, live state loading or bounded state.

## Evidence and findings

Eight initial cases fail on the missing iterator. Eight focused cases and eleven
source faults pass with exact restoration. Fixtures check known entry counts,
endpoint and independently calculated raw SHA-256/byte count, in addition to
comparison with the same-core full verifier. They cover empty/continuation history,
deep immutability, bounded backpressure, cancellation/consumer failure, corruption
after a valid yield, conflicting pins, mid-stream source mutation, captured options
and unsupported/malformed/oversized sources. Existing archive and anchor batteries
also pass after the refactor. These are builder-authored tests, not independent
security evidence.

Critical archive inventory and expanded mutation source/test scope fail first,
then accept registration. Definition 16/fresh seed 24413 is declared before
measurement: retain every earlier source/test and floor/limit, add archive source
and its structural/anchor/stream tests. Old installed artefacts fail the new
consumer case before rebuilding. Final installed, fault and integrated evidence
follow; no complete mutation score is inferred from a baseline.

The corrected full ordinary and serial AST suites pass 642 cases each; native
typecheck exits zero. The unchanged AST floors pass, with archive coverage at
100/103 statements and 110/113 branches. Existing structural archive and external
anchor campaigns catch sixteen and nine faults; the new streaming campaign catches
eleven. Ten installed consumer cases and forty-four compiled faults pass, alongside
twenty-eight coverage and forty-one mutation report/staging faults. These counts
are component gate evidence, not the separate Stryker score. Exact source hashes,
raw outputs and AST summary are retained. Fifteen fresh recovery/driver faults
pass with exact restoration, including real staged execution of all 371 selected
cases. The twenty-second harness wait and every floor/limit remain unchanged.
CLAIMS S74 records these measurements. Final close/private sync follows.

Commands: `node --test packages/sdk/test/archive-stream.test.ts`;
`node evals/sdk/archive-stream-faults.ts`; `node evals/sdk/archive-faults.ts`;
`node evals/sdk/archive-anchor-faults.ts`; `npm run release:prepare`;
`node --test evals/packaging/packed-sdk.test.ts`; `node evals/packaging/faults.ts`;
`node evals/ci/coverage-faults.ts`; `node evals/ci/mutation-faults.ts`;
`node evals/ci/mutation-recovery-faults.ts`; `npm test`; `npm run typecheck`;
`npm run test:coverage -- --serial`. Raw results and exact source hashes:
`archive-stream/`.

## Limitations

Hosted c2c2f5c run 37707464546 completes on 2026-10-08 UTC with runtime,
AST and maintained-fault jobs failing at the unchanged real-baseline wait.
Other jobs pass. Full logs and exact revision/job metadata are retained under
`archive-stream/hosted-c2c2f5c/`. H11 remains pending; no wait/floor is changed.

Bounded archive I/O is not bounded full replay or live state. The entry consumer
must fully finish and validate before making admissions. Immutable filesystem
segments and supported local Linux storage remain assumptions; the hash chain
still needs external anchors for rollback bounds. Request indexing, signed policy
and profile replay, full recovery, restart/performance/memory qualification,
independent security and operator drills remain required. No power-loss, Alpha,
stable-release or mainnet claim. H9/H10/H11 and hosted runtime failures stay open.
