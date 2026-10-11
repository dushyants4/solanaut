# Selected interface and history assertion reasons

2026-10-11 Toronto · builder-authored review, not independent evidence.
CLAIMS S146. Five selected historical edges from S143; tests remain unchanged.

Inspect all selected full patches. Bind the frozen inventory, both historical
test revisions, their diffs and current test bytes. Each selected test currently
equals its selected historical revision. This is a bounded review, not complete
assertion-history or public-history clearance.

| Commit / test | Changed check | Reason |
|---|---|---|
| 6162efb / ordinary serial | Add a competing earlier concurrency option | The actual root command must override it. Existing interval/event serial checks and five-second timeout remain; a suffix after filenames cannot supply false serialization. `evals/ci/ordinary-serial.md`. |
| 9a6480f / history | Target malformed metadata at batch-check; add truncated and commit-body cases | Keep tree/size/count/duplicate refusals while targeting the intended Git operation after commit reads are added. Add missing/corrupt commit and contradictory parent/tree metadata refusals. Synthetic fixtures only. `evals/ci/history-commit-read.md`. |
| 43f20c0 / sending client | Replace message matching with a typed error predicate | Require input code, correct error class and no possible execution. Preserve invalid configuration/request cases and zero host calls; add malformed containers and fields across all request kinds. `evals/sdk/sending-client-input.md`. |
| 0332c97 / coverage hook | Exercise and require firewall coverage | Retain SDK counters, branch maps, persisted report and tooling exclusion. Require the newly covered firewall source too; original five-second timeout remains. `evals/firewall/filter.md`. |
| 9996f00 / signed policy | Require exact redacted replay diagnostics | Keep failure status for missing external trust. Require sequence/field labels and redacted values with empty stderr instead of exposing the original diagnostic text. `evals/sdk/replay-command.md`. |

Original checks are retained or strengthened within this selection. This builder
judgement does not establish that every historical fixture or gate is sound.
The earlier receipts retain their original first failures and planted faults;
this review does not relabel them as fresh candidate evidence.

```sh
uv run --script evals/release/assertion-interfaces.py
node --test packages/sdk/test/sending-client.test.ts packages/sdk/test/signed-policy.test.ts evals/ci/ordinary-serial.test.ts evals/ci/history.test.ts evals/ci/coverage-hook.test.ts
npm run typecheck
```

Preserve the collection directory before regeneration. `definition.json`,
`edges.json` and `edges.diff` bind the selection and bytes. `focused-current.txt`
records all 51 current focused tests passing, without failure, skip, cancellation
or todo, on Node 26.7.0. Typecheck exits successfully. These are builder-authored
local checks using synthetic fixtures, not full native/hosted qualification,
independent review, actual key handling or chain execution.

The collector is a data reader, not a release gate. Complete-history, independent
and release-clearance flags remain false. No product, protected test, public
contract, deadline, threshold or accepted ADR changes. H11, H15, broader review
and stable release requirements remain open.
