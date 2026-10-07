# SNP-3 — canonical archive catalogue component

2026-10-07 · builder-authored local Linux, Node 26.7.0; base 805e8bb
plus this candidate. Accepted ADR-019 payload encoding only.

The catalogue binds ordered archive receipts from genesis through the externally
supplied checkpoint endpoint. Canonical bytes include file byte counts, hashes,
sequence spans and optional observed anchors. The returned digest hashes those
actual bytes. Preparation does not read files, authenticate anchor authority,
prove admission state or publish/restore a snapshot.

Fifteen focused cases and twenty final source faults pass with restoration.
Initial stub/import and malformed fixture failures are retained. The original
final-serializer-only fault survived because earlier copying had already sorted
receipt fields; that miss remains beside the final whole-module serialization
fault. Caller array methods could substitute receipts: the added regression
fails against that implementation and indexed copying resolves it.

The old packed build fails the installed API check. Rebuilt JavaScript passes
nine consumer cases and eight compiled faults. The complete compiled inventory
contains sixty-seven files; manifests bind source and restored artefacts.
Maintained inventory accepts the added campaign after its initial refusal.

Regenerate: `node --test packages/sdk/test/checkpoint-archives.test.ts`,
`node evals/sdk/checkpoint-archives-faults.ts`,
`node --test evals/ci/bite.test.ts`, `npm run release:prepare`,
`node evals/packaging/faults.ts`, `npm run typecheck`.
Raw outputs and SHA-256 manifests: `checkpoint-archives/`.

The preceding signature-bound revision's hosted run 37614673709 succeeds,
including coverage; this is not hosted evidence for the new catalogue.
A mistakenly overlapping local coverage attempt was stopped, not graded.
Both CPU 0/4 ordinary runs report 560/561 passes and fail the unchanged real
staged-baseline wait. Unrestricted sequential integration follows to diagnose
the CPU restriction without changing population, deadline or mutation workers.
Full root integration and separately executed coverage follow. The independently
frozen mutation revision remains unchanged and cannot qualify this new module.
No independent security review, complete SNP milestone or release clearance.

Unrestricted and distinct-core ordinary diagnostics also report 560/561 passes,
with the same baseline wait failure. After the D21 candidate fix, sequential AST
execution reports 563/564 passes and correctly refuses coverage qualification.
No overall coverage result is claimed. The new catalogue is added to the existing
critical-file branch floor after a failing registration test; removal is injected
in the maintained coverage campaign. No threshold is changed.

The D21 correction supersedes an existing frozen mutation target. That run is
retired with its actual interruption result and finish refusal retained in
`../ci/mutation/retired-9ac6e7c/`; no partial mutation score is claimed.
Quiet-host ordinary integration then passes all 564 cases and typecheck exits zero.
Final quiet AST measurement and private close follow; earlier failures remain visible.
The critical coverage campaign catches twenty-one faults and restores its sources.

Final quiet AST execution passes all 564 cases and every unchanged aggregate and
critical-file floor. Catalogue statements cover 48/48 and branches 57/57.
Exact source hashes/counters are retained in `coverage-final-summary.json`.
Private close and hosted qualification follow; no complete snapshot or mutation pass.
