# PUB-1 — require the actual historical commit objects

2026-10-07 · builder-authored local Linux/Node 26.7.0/Git 2.55.0 gate evidence ·
base 49f753b plus this independent inventory correction. No SDK change.

The archive-stream candidate's full ordinary suite exposes a history-checker
failure: cached graph/tree queries accept the fixture's missing historical
commit. The previous local probe's refusal was insufficient evidence that those
metadata queries always require the underlying object. Its old results remain
unchanged; the new failed integration is preserved here.

For every enumerated commit, read its actual body and calculate its Git object
hash under the repository's SHA-1 or SHA-256 format. Compare its actual tree and
ordered parent headers with enumerated metadata too. Missing/unreadable bodies,
different hashes or disagreeing metadata refuse before tree/blob inventory can complete. Per-process
no-replacement, no-lazy-fetch, graft suppression and optional-lock settings remain
unchanged; no configuration or inspected repository is modified. Commit contents
are not printed or included in the returned metadata inventory.

## Evidence and findings

The existing real missing-object case fails in full integration; a deterministic
commit-read-failure regression fails before implementation. The final regression
also injects corrupt body bytes and hidden parent/substituted tree metadata.
Those metadata cases fail before the header checks are added. Sixteen focused
cases and eighteen planted faults
pass with restoration, including omitted actual reads, omitted body hashes,
omitted tree/parent checks and valid-but-truncated blob metadata. Existing deleted/divergent/tagged histories,
unusual paths, shallow/partial clones, grafts, modes/gitlinks and SHA-256 cases
remain present.

The first hash-fault target uses a decoded null rather than a literal source
escape, so its site assertion fails without credit. The corrected unique
comparison site catches omission. An initial metadata-count omission is masked
by invalid empty-row checking; a valid truncated multi-blob batch establishes the
count check independently. Every failed setup and missed trial is retained.

Commands: `node --test evals/ci/history.test.ts`;
`node evals/ci/history-faults.ts`; `npm test`; `npm run typecheck`.
Raw outputs and exact hashes: `history-commit-read/`. Full corrected ordinary
integration/typecheck and final close/private sync follow. Streaming work is
preserved separately in local stash `38b6deba5df31d096cebd99fa6e2f244517ab0b8`;
its SDK changes are not part of this repair.

Final corrected ordinary suite passes 634 cases and native typecheck exits zero.
SDK source is unchanged from 49f753b; final history source/test/fault hashes are
retained. Local knowledge/claims lints pass. Final close/private sync follows.
CLAIMS S73 records these scoped measurements; no publication gate is cleared.

## Limits

Hosted 9a6480f run 37706079593 completes on 2026-10-08 UTC with AST and maintained
fault jobs failing at the unchanged real staged-baseline wait. All runtime and
other jobs pass. Exact revision/job metadata and full log are retained under
`history-commit-read/hosted-9a6480f/`. No wait/floor is changed or hosted clearance
inferred. This remains separate from the repaired missing-commit defect.

This is inventory preparation, not the full publication review. It does not clear
secrets, confidential material, source rights, licences, third-party notices,
gitlink target repositories, audit or visibility. Existing UTF-8 Git-read and
response-size boundaries can refuse unsupported history; refusal is not review
clearance. No original-origin mirror review is repeated here. Hosted 49f753b
runtime/AST/maintained-fault jobs fail the unchanged real-baseline wait, with exact
evidence retained. H11 remains pending; no gate/floor/wait is weakened.
