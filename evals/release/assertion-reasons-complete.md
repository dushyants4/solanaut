# Frozen assertion modification reason index

2026-10-11 Toronto · builder-authored allocation, CLAIMS S155.
The frozen S143 range remains Beta e925f1d through 753769d. All its 142
named-test modification edges now link exactly once to ten scoped reason
receipts. S150's earlier 63-linked/79-pending checkpoint remains unchanged.
The final consumer receipt binds and explains its remaining thirty-three
complete patches. This is reference allocation, not a count of assertions,
tests, defects, independent approvals or achieved release requirements.

```sh
uv run --script evals/release/assertion-consumers.py
uv run --script evals/release/assertion-reasons-complete.py
uv run --script evals/release/assertion-reasons-controls.py
```

Preserve existing receipt outputs and owned scratch before regeneration. The
index checks exact inventory/range identities, duplicate/foreign/missing edges
and content-binding shape, and hashes every receipt, patch stream and metadata
input. It does not mechanically establish that prose reasons are correct or
that a valid-looking digest matches historical content: the earlier collectors
and manual complete-patch review provide that separate scoped evidence.

The positive copied index passes. Five independent copied-input faults each
refuse with their named assertion: duplicate edge, foreign edge, wrong range,
missing edge and invalid binding. All original inputs remain unchanged.
Both successful output and complete refusal diagnostics are retained in
`assertion-reasons-complete/controls.json`. No product mutation occurs here.

The first collection failed on a missing beforeSha256 field because the recovery
receipt instead binds its test/runner hashes. Record that observed KeyError;
the collector now explicitly validates that receipt's existing schema rather
than fabricating absent bindings. The initial successful index/controls precede
correction of consumer receipt path references. Preserve them in
`assertion-reasons-initial/`, including their original consumer receipt as
`consumer-receipt.md`; their recorded input digest for assertion-consumers.md
refers to that saved draft. The corrected-reference collection and controls
are the final result. No initial outcome or S150 checkpoint is overwritten.

S154's complete installed populations remain the consumer execution evidence;
this index does not rerun them, pool them with other populations, or turn the
miss into a pass. The historical typed head example was displaced by anchor.
O10's proposed copy catches that omission, but the maintained gate is unchanged.
No further displaced assertion was found within the final consumer selection;
that conclusion is builder-authored and bounded to the complete patches read.

Initial named-test additions, supporting helper histories, later commits and
full public-history contents remain outside this allocation. Complete-history,
initial-addition, independent, public-history and release flags stay false.
Native H11 still fails; O6, O9 and O10 owner application remains pending.
No new native/hosted/mutation result or stable milestone credit follows.
