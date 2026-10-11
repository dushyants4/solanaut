# Scoped assertion-reason handoff map

2026-10-11 Toronto · builder-authored data index, not independent evaluation.
CLAIMS S150. S143's frozen named-test inventory remains unchanged.

Join six scoped reason receipts to the exact historical parent/commit/path
identities. Bind the inventory, receipt definitions, edge lists, prose and index
source in `inputs.json`. Link 63 of the inventory's 142 modification edges;
79 lack indexed reasons and remain explicitly pending in `pending.json`.
`summary.json` groups pending work by test path. These are edit edges, not
assertion counts, findings, unique tests or completed release requirements.

This is a reference index: the collector cannot judge the reasons or turn a
builder's review into independent approval. Each source receipt defines its
limitations. All independent/public-history/release flags remain false. Initial
test additions, supporting fixtures/helpers, content outside the named-test
scope and later history are not cleared. The separate durable net-change reason
in S143's run remains useful but is not counted as a linked per-edge receipt.

```sh
uv run --script evals/release/assertion-review-map.py
uv run --script evals/release/assertion-review-map-controls.py
```

Preserve the output directory and owned scratch controls before regeneration.
The original equivalent inline control run is retained in `controls.json`;
the script makes that same copied-input procedure reproducible. Its positive
control reproduces the counts and false clearance flags. Three isolated input
faults refuse: duplicate edge, foreign edge and mismatched frozen range.
Raw stdout/stderr and exit codes remain. No product or protected gate is changed.
This data-reader check is not a new release gate or security/mutation campaign.

The next review can use the pending list to inspect exact full patches and write
reasons, preserving each failed fixture and receipt limitation. Claude still
owns independent review. H9/H10/H11/H14/H15/H16 and the external qualification
programme remain; the map changes neither formal progress nor stable status.
