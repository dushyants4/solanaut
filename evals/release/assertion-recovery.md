# Mutation-recovery assertion history — scoped reasons

2026-10-11 Toronto · builder-authored handoff review, not independent evaluation.
Pinned range and parent edges from S143. CLAIMS S144. Protected tests unchanged.

## Evidence and collection

`assertion-recovery.py` binds the exact earlier inventory and collects only the
historical `evals/ci/mutation-recovery.test.ts` and `evals/ci/mutation-run.ts`.
Preserve full parent-to-commit patches and per-revision test/runner/diff hashes.
These are ordinary bounded code reads, separate from the metadata-only inventory;
no other file blobs or proposed public-history contents are reviewed here.

All 32 modification edges have expected definition/seed literals matching their
same-revision runner literals. This static cross-check does not establish executed
population counts, real baseline success, score completion or runtime compatibility.
The collector emits data and mismatch flags; it is not a release gate and does
not claim automated reason clearance. Unknown literals produce nonmatches.

The first full display was truncated. Review every changed line through a compact
display which folds only exact expected definition/seed/population numbers, then
inspect those values separately. Full raw patches remain for Claude; folded
numeric values are never used to grant independent approval.

## Reasons reviewed

| Edges | Assertion change | Reason / limitation |
|---|---|---|
| 29 edges consisting only of definition, seed or expected-population pins | Keep exact equality and complete-population assertions while updating their expected values | Bind the test to the changed mutation definition and declared seed. Population updates strictly increase from 235 to 573 across 27 edits. Literal definition/seed consistency is verified against each runner; historical actual population execution remains a separate receipt question. |
| 9ac6e7c | Add exact experimental isolation-option spelling and successful completed status assertions; update definition/seed pins | Correct the documented runtime option contract and require successful child completion. Existing completion wait and subsequent immutable-result/refusal assertions remain. Reason: `evals/ci/mutation-runtime.md`. |
| afe482a | Split the wait assertion onto its own line and add ticket/output diagnostic text | Preserve the same condition and twenty-second wait while exposing the failed child output. This is diagnostic evidence, not an expanded wait or product fix. |
| c2df043 | Replace immediate SIGTERM/scratch removal with awaited confirmed shutdown; preserve primary failure if cleanup cannot be confirmed | Prevent scratch removal racing a still-writing supervisor. A successful body still fails on unsuccessful cleanup; an already failed body retains its primary failure and scratch. Reason: `evals/ci/mutation-stop.md`. |

No changed line in this scoped test history lowers the original baseline wait
or turns a required failed completion into success. This is a manual comparison
of this file's historical diffs, not a statement about other gates, source helpers,
hidden lifecycle behaviour or all test assertions. H11's original wait remains
failed; proposed O6 is still unapplied. The broader historical review remains owed.

## Regeneration and limits

```sh
uv run --script evals/release/assertion-recovery.py
```

Preserve the existing output directory before another collection. Definition,
complete patches, literal pins and source hashes are retained. The synthetic
inventory/fault/runtime controls in S143 establish its preceding edge collection;
this review adds static observations and explicit human-readable reasons, with
no new execution campaign or mutation score.

No protected file, product, accepted ADR, threshold, seed or coefficient changes.
This completes only the builder's reasons for this scoped file, not Claude's
independent review, full public-history clearance, native/hosted gates, Alpha
qualification or any stable milestone.
