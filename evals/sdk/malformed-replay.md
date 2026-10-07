# SNP-5/D21 — impossible controller events in malformed history

2026-10-07 · builder-authored local Linux, Node 26.7.0; base 805e8bb
plus the pending snapshot-foundation candidate.

Live proposal-shape validation returns before Keel runs. A resealed malformed
decision carrying DEFAULT posture and zero telemetry nevertheless passes both
full replay and guard restoration. The raw diagnostic and failing regression are
retained. This is a local history-semantic finding, not a remote signing exploit.

The candidate checks that malformed inputs retain null posture, telemetry and
temperature before applying recorded state or controller events. Three focused
cases exercise genuine malformed history, each altered controller field and a
genuine parsed decision. Five source reversions fail, including removing the
input scope and thereby rejecting valid parsed history; source is restored.

Regenerate: `node --test packages/sdk/test/malformed-replay.test.ts`,
`node evals/sdk/malformed-replay-faults.ts`, `npm run release:prepare`,
`node evals/packaging/faults.ts`, `npm run typecheck`.
Raw output and source/artefact manifests: `malformed-replay/`.
The previous compiled guard fails the installed replay regression. Rebuilding
passes all nine installed cases and nine compiled artefact faults with restoration.
Typecheck exits zero. Quiet-host ordinary integration passes all 564 cases.
Earlier staged-baseline timeouts under full mutation load remain retained; no deadline
or threshold changes. Complete snapshot prefix/recovery and independent evidence
remain owed. The frozen mutation revision cannot qualify this newer guard check.
Its supervised interruption is retained at `../ci/mutation/retired-9ac6e7c/`;
actual status 143 and interruption error refuse qualification. Fresh mutation
qualification of the corrected target remains required.

Quiet AST execution passes all 564 cases and unchanged coverage floors after
fault restoration. Private close follows. Earlier timeouts remain retained and
builder evidence is still distinct from independent review.
