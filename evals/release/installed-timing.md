# Current installed SDK — scoped timing

2026-10-11 Toronto · builder-authored CI-2 packaging diagnostic.
Reviewed 54b15d5, actual current D40/Linux, Node 26.7.0. CLAIMS S142.
No product, original timing analysis, workload or maintained gate change.

## Frozen analysis and inputs

Use the existing scoped runner's original first step, decision budget, maximum
steps, expected mixed-history head, sequential memory/file profiles and monotonic
clock analysis. No warm-up, sample exclusion, coefficient or post-result tuning.
The workload is reused, not a new statistical population. Refresh only candidate
input bindings and relocate imports to the installed public SDK, workload fixture
and explicit original craft/performance helpers.

Actual private archive installs offline/scripts disabled outside the repository,
without a workspace symlink. SHA-256:
`55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
Freeze product, original definition/runner/verifier, fixture, analysis, lock and
new helper before measuring. Updated definition and complete relocated sources
are retained. The original archived input preflight first refuses changed
adapter bytes; its older measurements are not relabelled as this candidate.

A planted installed replay stub generates all 10,000 memory-profile decisions
but returns successful zero-count replay. The unchanged validator refuses it
before healthy measurement. This negative profile is not a completed two-profile
timing run. Restore exact bytes before the healthy controls.

## Measured result

| Installed local SDK profile | Decision p99 | Whole workload decisions/s | Replay decisions/s |
|---|---:|---:|---:|
| Memory store | 0.187 ms | 7,366.74 | 10,842.51 |
| Synced file store | 2.437 ms | 668.31 | 11,237.31 |

Raw nanoseconds govern comparisons: p99 is 186,863 and 2,437,431 ns respectively.
Every profile retains all 10,000 observations and produces/replays 13,651 entries
with decision, report, redemption and release kinds, matching the original head
`cb4674cdc5851f2c1d6645df4c1d36f30eb7cf616b95010b27dbe6487c65254c`.
The partial rate targets and synced-file p99 comparison pass; the complete
performance report is not constructed from these partial observations.

Separately reopen actual persisted bytes and replay every decision using the
installed SDK. The complete file is 13,002,864 bytes, SHA-256
`bb7d00ece4abb0294ce221218c57c9186d9faa306288b64d06956166aab26991`.
Retain the original file in owned workspace scratch and an exact lossless gzip
copy in this receipt directory; decompression equality is checked. Both timing
sample arrays, metadata, completion and raw refusal/measurement outputs remain.

The original four validator controls and typecheck pass. Exact installed bytes
restore, bound inputs match, temporary consumer is removed and owned job finishes.
No other Solanaut evaluation overlaps the timing run. Local Git backup verification
may overlap and the host is not otherwise reserved; do not infer run distributions
or cross-host comparisons. Host/runtime/filesystem identifiers are in metadata.

```sh
uv run --script evals/release/installed-timing.py
node --test evals/ci/sdk-timing/measure.test.mjs
npm run typecheck
```

Existing definition refuses replacement. Preserve this directory and scratch
before another generation; no unchanged pass-seeking rerun occurs.

## Limits

Memory storage is not an isolated before-log measurement. File observations
include synced appends, not power-loss durability. Whole-workload rates include
fixtures, reports, redemptions and releases. Replay is over a captured history;
persisted verification is separate from a timed ready-to-admit restart.

This existing Linux laptop is not the Ubuntu reference installation. One run per
profile is not a runtime matrix, token/v0/v1/benign/concurrent/isolated-service/RPC
workload, authenticated snapshot recovery, bounded-memory test, 100,000-decision
restart, dashboard measurement or approved reference-baseline regression check.
No actual key file or send occurs. H11 still fails the current native gate;
independent security, soak, operational and publication gates remain. No stable
milestone or full performance qualification follows.
