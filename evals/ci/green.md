# CI green on `main`

2026-10-22 to 2026-10-26 · Claude Code (Opus 5.5) · `.github/workflows/ci.yml` on github.com/dushyants4/solanaut ·
hosted GitHub Actions, `ubuntu-24.04`.

CI failed on every push to `main` from at least 2026-10-07 to `55e31b9` (run `38958954990`, 2026-10-16). There were
three causes, none in product code:

1. **A stale count.** The frozen mutation selection gained a test in `55e31b9`, and
   `evals/ci/mutation-recovery.test.ts` still expected `tests 573`. Fixed in `884cae7`. It reads 576 since the
   Token-2022 tests (`47fd514`, `evals/sdk/token-2022.md`).
2. **A folder never made.** `evals/sdk/checkpoint-publication-faults.ts` made its temporary folder inside
   `.sandbox/solanaut-1` without creating that, so it passed only where an earlier run had left one. Fixed in
   `884cae7`.
3. **A campaign longer than any job.** `evals/packaging/faults.ts` plants 144 faults, each through `npm pack`, an
   install and the installed battery: 15 min 56 s on the development machine, against 300 s per campaign in the fault
   partitions and 10 minutes in the test job. After `884cae7` this was the only failure (run `39845930464`).

The fix for the third, `cd911a6`: `faults.ts --shard k/n` runs every n-th fault from the k-th, and `--list` names
them. A `package-faults` job runs four shards on Node 26.7.0, 15 minutes each. `evals/ci/bite.ts` keeps the
campaign in its inventory but lists it in `OWN_JOB`, outside the three partitions. `c660d8b` gives it 1,800 s in a
full local `npm run test:bite`.

## Shown failing first

The partition battery (`evals/ci/bite-partitions.test.ts`) pins `OWN_JOB`, checks that the partitions and the own
job cover the inventory exactly once, checks the new job's matrix, command, deadline and lack of skips, and checks
that the four shards list all 144 faults once and refuse malformed shards. `evals/ci/bite-partitions-faults.ts`
plants seven new faults: an extra own-job campaign, an unpartitioned inventory, a shard that drops faults, a listing
that drops faults, a missing shard, a fixed shard command and a skipped job. Each is caught, as are the 12 before it,
19 of 19.

## Then passing

| Run | Commit | Jobs |
|---|---|---|
| `39853196274` | `cd911a6`, the shards | 19 of 19 pass, the first green run |
| `39871862841` | `42420ff`, the reshaped domain model | 19 of 19 pass |
| `40342320596` | `c660d8b`, one format for all the code (`6253a7b`) | 19 of 19 pass, all 144 installed-package faults caught on the formatted build |

The 19 jobs are the tests and typecheck on Node 22.18.0, 24 and 26.7.0, the maintained fault campaigns in three
partitions, the installed-package faults in four shards, the million-input fuzz, the pinned replay on three Node
versions, the kill recovery, the AST coverage floors, the differential decoding, the synthetic traffic, and the
office's own checks.

Regenerate with `npm test`, `npm run test:bite -- --partition 1` (and 2, 3), and
`npm run test:package:faults -- --shard 1/4` (to 4/4) after `npm run release:prepare`. On GitHub:
`gh run view <run> --repo dushyants4/solanaut`.
