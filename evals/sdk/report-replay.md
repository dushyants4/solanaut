# SNP-5/6, LIF-7 — report recovery validation (D22)

2026-10-08 · builder-authored Linux/x86-64, Node 26.7.0 evidence · base
5b00257 plus candidate. No independent security or release clearance.

Peer review reproduces unsupported outcome/attribution and post-final reports
being accepted by shared recovery. An unsupported non-unknown outcome can mark
signing settled. The chain can be correctly resealed: structural integrity does
not establish a permitted transition. The live report contract already refuses
unsupported outcomes and reports after landed/failed/expired.

The first test fixture imports a nonexistent stream function; retain its setup
failure without semantic credit. Corrected initial twelve-case output passes two
and fails ten for accepted impossible reports or absent exceptions. Shared
validation now precedes head, sequence, clock, signing, reservation and sensor
mutation. It enforces supported outcome/source, finite nonnegative time, an
admitted reservation and unresolved matching attempt. The final sixteen cases
cover array/stream replay, restore, inspection and unchanged direct state after
refusal. Positive cases preserve repeated unknown reservations/counts, fractional
times, both source enums, late reconciliation, pruning and signed-policy changes.

An unknown-value-release fault initially misses: the oracle captures the already
corrupted state after the first unknown report. Compare against admission before
the first report instead. The original miss remains with the corrected output.
All twelve final source faults catch with exact restoration: omitted validation,
enum/time/finality/reservation checks, validation after mutation, unknown release,
inflated repeat streak, expired fees and unsettled final signing. D23 introduces
similar conditions; fault sites bind the exact report refusal to stay unique.

Native typecheck initially finds readonly fixture arrays. Explicit array copies
preserve deep cloning and assertions. Combined source and installed qualification
is in `request-index-integration.md`; the installed battery directly exercises
impossible report replay/restore independently of the index's local validator.
Compiled boundary/source/finality faults also catch. Original outputs remain.

Regenerate: `node --test packages/sdk/test/report-replay.test.ts`;
`node evals/sdk/report-replay-faults.ts`; `npm run release:prepare`;
`node --test evals/packaging/packed-sdk.test.ts`; `node evals/packaging/faults.ts`.
Raw source evidence and hashes: `report-replay/`; shared integrated evidence:
`request-index-integration/`.

No valid live-format replay break, record version, snapshot field, sensor tuning,
source-to-decision attribution restriction or timestamp-order rule is introduced.
Earlier structural/archive receipts remain scoped to their original evidence.
Full snapshot/startup, mutation score, independent review and stable release remain
open. The hosted baseline-wait finding is not corrected by this component.
