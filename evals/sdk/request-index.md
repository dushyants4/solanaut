# SNP-7 — internal immutable request-index component

2026-10-08 · builder-authored isolated Linux/x86-64, Node 26.7.0 evidence · base
a4d1c25 plus candidate. Accepted ADR-019; no independent security or release claim.

`prepareRequestIndex` captures the dense history, endpoint, policy seed and external
policy trust before asynchronous full signed replay. Local report validation also
enforces supported outcome/attribution values and permanent finality. An unsigned,
divergent or invalid-report history cannot mint the expected root. Canonical format 1 binds guard, cluster,
operator, evaluation profile, current policy version/hash and exact completed
prefix sequence/head. Sixteen fixed hexadecimal shards cover every bucket,
including empty buckets. Their byte lengths, row counts and SHA-256 digests are
independently derived from the validated history. This fixed format is a reversible
implementation choice; no timing result was used to choose its shard count.

Admission and non-admission starts share the canonical guard/client/ID namespace.
Rows retain the exact payload-bound start, redemption, signed bytes, send-started,
immutable response, latest outcome and first final-outcome evidence. Historical
reports and all other full evidence remain in the original retained record; this
projection does not replace it. Non-request SDK decisions are outside this index.

The returned small `root` has only canonical manifest text and digest. A private
capability map records its replay provenance and fixed manifest metadata, without
retaining generated shard text or the input history. It remains usable after the
prepared artefacts leave scope. Copied, parsed and manufactured root objects
refuse. Across process restart a caller must derive a new root through verified
full replay; trusting a cached manifest is not an alternative.

`lookupRequestIndex` is read-only. It captures identity and line ceiling before
file awaits, checks the exact manifest, then reads the complete selected shard
with bounded line buffering. Natural EOF, digest, count, ordering, framing,
regular-file, single-link, inode and change checks precede a hit or absence. It
returns deeply immutable evidence. Missing files, symlinks, FIFOs, directories,
oversized lines and other read failures produce `RequestIndexError`, never
absence. Returned evidence describes only the completed prefix named by the
root. It supplies no current-tail completeness or admission authority.

All ten initial cases fail for the missing component; `first-failures.txt`
preserves their output. The first implementation passes them. Initial typecheck
finds two fixture errors: an array passed to the base58 byte API and an inferred
union supplied to `seal`; their output is retained. Explicit byte conversion and
entry type fix the fixtures without changing their assertions. Root separation,
whole-digest, source-change and neighbouring-identity oracles expand the suite
to sixteen cases. A separate same-size reply from another existing request
strengthens the cross-request cache oracle. The final focused suite passes
seventeen cases and native typecheck exits zero at that revision. Peer review then
confirms a late-read race: appending after the post-read descriptor stat, before
the named-path stat, escapes the initial checks. Its deterministic first failure
is retained in `late-read-red.txt`. Named size, link count and modification/change
times now also agree with the captured file; the corrected eighteen-case suite
and twenty-one faults pass.

Further peer review identifies holes in existing shared replay: unsupported report
outcomes, unsupported report attribution, and reports after final outcomes pass
into the initial projection. `report-validation-red.txt` preserves all three
failures. Local pre-projection validation corrects this component without editing
shared replay in this worktree. The final twenty-one-case suite, native typecheck
and twenty-four source faults pass with exact restoration. Earlier passing roots
are component evidence superseded by these findings, not broad replay clearance.

Twenty semantic source faults are caught on the original campaign, with exact
source restoration: replay omission, ignored decision divergence, missing empty
bucket, missing control namespace, lost send-started/final/latest-outcome facts,
foreign operator binding, uncaptured endpoint/trust, omitted historical controls,
self-authenticated root, retained shard text in the small root, missing deep
immutability, bypassed shard digest, I/O error interpreted as absence, ignored
source change or line ceiling, inexact identity matching and changed reply target.
The final campaign adds named-path race and report outcome, attribution and
finality faults. The source-time fault now removes both descriptor and named
time checks, because the new named check independently catches descriptor-only
omission. No missed trial or timeout is credited as a catch. Per-fault outputs
preserve the baseline, assertion failures and restored passing suite. These
twenty-four-fault results describe the isolated base, before the shared replay
correction. Parent integration repeats the final campaign on corrected replay.

Further loader/lifecycle checks observe a real first failure for numeric loader
options; null explicit ceilings also need strict handling. Options now require
an object with supported fields, and a supplied ceiling must be a valid number.
The added cases exercise function/null/array inputs, hardlinks, symlinked
generation directories, deterministic post-validation directory replacement,
permission/read errors and descriptor cleanup. First output is retained in
`options-lifecycle-red.txt`.

The current isolated suite passes twenty-six cases and native typecheck; its
twenty-nine-fault campaign restores source exactly. Local report-check faults
must specifically fail a separate child-process boundary case: a test-only
native loader hook redirects only the index module's direct replay dependency
to an accepting stub. Valid public signed-history fixtures pass the seam; invalid
outcome/attribution/post-final fixtures still refuse through the local validator.
This isolates redundant defense checks when shared replay is corrected. Every
ordinary case continues using real full replay, and production replay is never
changed or bypassed. The new campaign also catches ignored options shape/null
ceiling, omitted descriptor cleanup, generation replacement and single-link checks.
All earlier failures and successful campaigns remain retained. Parent integrated
ordinary/AST/installed qualification remains owed.

The omission attack removes a historical request and recomputes the on-disk
manifest checksum/count/size; the independently derived root still refuses it.
Restoring the original manifest with the omitted shard also refuses. A separately
resealed response to an unknown request fails full replay; repeated changed
responses and disk row substitutions refuse. Another existing request's valid
reply cannot answer this identity. A same-size changed valid reply
tests the independent byte digest rather than relying on a size mismatch.

Regenerate:

- `node --test packages/sdk/test/request-index.test.ts`
- `node evals/sdk/request-index-faults.ts`
- `npm run typecheck`

Raw results and all SDK source/dependency hashes: `request-index/`. The maintained
fault command writes scratch outputs under `.sandbox/request-index-faults/` by
default; an explicit output directory preserves the original campaign here.

Construction captures full arrays and creates shard text in memory. There is no
bounded-construction, live-state, memory-growth, restart-speed or complete SNP-7
claim. No public root export, actual-owner publication, tail integration, pruning,
checkpoint-envelope change or signer implementation changes. Root history input
still needs the owned/archive/external-anchor trust boundary before operational
use. Full ordinary/AST, maintained gate registration, installed artefact checks,
runtime-matrix, compatibility, concurrency, crash and independent qualification
are parent integration work. No branch is pushed or package published here.
