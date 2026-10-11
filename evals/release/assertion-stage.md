# Mutation-staging assertion modification reasons

2026-10-11 Toronto · builder-authored scoped review/checks. CLAIMS S152.
No protected test, staging helper or product changes.

Read all eighteen complete modification patches for `mutation-stage.test.ts`
from S143. Preserve before/after/helper/diff hashes and current identity.
Literal expected lists match each same-revision helper where asserted. The first
two revisions lack the explicit test-list assertion; that absence is recorded,
not treated as a match. Existing asserted membership loses no earlier file.

| Changes | Reason |
|---|---|
| 00c42e8 | Require the frozen test-isolation mode and append-only progress/report configuration after interrupted resource-pressure runs. Retain the mutation score floor, selected paths, unchanged copied-policy execution check and mutator/incremental exclusions. `evals/ci/mutation.md`. |
| a4dba77 | Assert whole-run resource containment and worker/per-mutant timeout configuration. This is containment, not a reduced score floor or permission to widen H11's baseline wait. Historical interrupted/unfinished reports remain. `evals/ci/mutation.md`, `evals/ci/mutation-recovery.md`. |
| Remaining membership edits | Extend exact source/test lists as checkpoint, archive, replay, request-index and private-owned work arrives. Retain earlier membership and copied-input execution/refusal checks. `edges.json` records every added name and same-revision match; complete diffs preserve exact ordering. |

The sixteen membership edits retain the expected source population, growing
from eight names to 23. The new explicit test-list assertion starts at 21 names
and grows to 41, retaining its earlier names. These are literal file counts,
not executed test populations or proof that all new security paths are included.
Do not infer a completed campaign, mutation score, complete signer/firewall
qualification or independent correctness from matching lists.

```sh
uv run --script evals/release/assertion-stage.py
node --test evals/ci/mutation-stage.test.ts
```

Preserve the collection directory before regeneration. Current Node 26.7.0
executes its one staging control successfully, with no failure, skip, cancellation
or todo. That control passes a copied policy baseline, deliberately changes only
the copied policy and requires its tests to fail, while verifying original source
is unchanged. It does not run the full selected baseline or Stryker campaign.
Original first failures/interrupted campaigns remain in their receipts.

No TS source/test changes follow S149's successful typecheck; no unchanged full
qualification rerun. S150's frozen reference map does not yet index this receipt.
Collector independent/complete-history/release flags remain false. H11, O6,
broader/independent/public-history review and stable qualification remain open.
