# SNP-3 — authenticated opaque checkpoint container

Hosted 6162efb run 37656562219 completes with Node 22 failing the unchanged
actual staged-baseline wait; other jobs pass. Exact revision/job metadata and
full logs are retained in `checkpoint-envelope/hosted-6162efb/`. Local passes
do not qualify this hosted failure. H11 remains pending, with no wait change.

2026-10-07 · builder-authored Linux/Node 26.7.0 evidence · base 6d81f8b plus
candidate. Internal codec; no public root API or signer method added.

Canonical format 1, kind `solanaut-signed-checkpoint`, stores the descriptor,
both signatures and opaque archive/state/prefix text. Verification computes the
actual three payload digests, checks both signing domains and external authority
pins, then returns immutable data. A caller-supplied positive safe-integer UTF-8
byte ceiling is checked before JSON parsing. Canonical framing rejects duplicate
keys, unsupported fields and whitespace alternatives.

All eight stub cases fail first. Eight cases and sixteen source faults then pass
with restoration. Cases cover altered payloads, wrong pins, missing/swapped
signatures, malformed/framing inputs, exact byte boundary with non-ASCII text,
refusal before parsing, captured external pins and malformed encoder accessors.
Parser call counting prevents redacted generic errors from masking late parsing.
The first fault run refuses an incorrectly escaped injection site; corrected
site and complete rerun are retained. Fixture typecheck refusal is also retained.

The old installed artefact fails on the missing compiled module. Regeneration
passes ten installed cases; twenty-seven compiled faults are caught and restored,
including missing envelope code, omitted byte ceiling, state binding and framing.
Real derived bundle bytes round trip and altered unresolved-send state refuses.
The codec's own fixtures deliberately use opaque text: authentication does not
establish semantic correctness, archive-file existence, replay or readiness.
Encoder allocation is outside the reader's pre-parse bound.

Campaign inventory, critical coverage and expanded mutation scope first refuse.
Definition 10 declares fresh seed 23623 before measurement and retains every
previous input, workload, floor and deadline. The selected baseline contains
303 cases; thirty-one staging/report, fifteen recovery/driver and twenty-five
coverage faults pass with restoration. Full corrected mutation remains unmeasured.

A focused check accidentally overlaps coverage fault injection and fails its
missing-failed-process guard. The preserved result is not qualification; the
same focused checks pass after restoration. Ordinary integration passes all 597
cases and typecheck exits zero. AST validation follows before private sync.
The serial AST suite also passes all 597 cases and unchanged coverage floors.
Its SDK source hashes are retained. The scheduling fixture is subsequently
strengthened to force a parallel default; focused/fault and ordinary checks
verify that change separately.
The strengthened fixture's fault/restoration and subsequent full ordinary suite
pass; the latter retains all 597 cases, with typecheck exiting zero. H11's proposed
wait remains unapplied, and hosted Node 22 qualification remains open.

Regenerate sequentially:

- `node --test packages/sdk/test/checkpoint-envelope.test.ts`
- `node evals/sdk/checkpoint-envelope-faults.ts`
- `node evals/ci/coverage-faults.ts`
- `node evals/ci/mutation-faults.ts`
- `node evals/ci/mutation-recovery-faults.ts`
- `npm run release:prepare`
- `node --test evals/packaging/packed-sdk.test.ts`
- `node evals/packaging/faults.ts`
- `npm test`
- `npm run typecheck`
- `npm run test:coverage -- --serial`

Raw evidence and source/compiled hashes: `checkpoint-envelope/`.
Publication, protected key deployment, authenticated semantic restoration,
bounded retention, independent red team/audit and stable release remain owed.
