# Million-input decoder gate — CI-2, partial

Definition frozen 2026-10-06 before qualification: reuse the existing decoder test's
`mutate` function without tuning. Seeds are fifteen kit-built messages (five per
legacy/v0/v1), then one to four random edits: bit/byte changes, insertion, deletion,
truncation, splicing, noise or unchanged bytes. Accepted bytes must equal kit's decoded
shape; refusals must be `DecodeError`. Both outcomes must be reached.

The wrapper requires at least 1,000,000 inputs, a successful process and exactly one
completion summary whose accepted/refused totals equal the requested count. No missing,
duplicated or contradictory summary is accepted. Seed is printed before execution;
`SOLANAUT_FUZZ_SEED` accepts a canonical signed 32-bit integer for reproduction, otherwise
uses a fresh random seed. The wrapper overrides the ordinary test's FUZZ_RUNS/FUZZ_SEED.

Run only the existing fuzz case via the Node test name filter. No generator/coefficient
change or real chain data. This is synthetic decoder mutation fuzzing, not mutation score,
real-transaction differential or signing/policy/firewall qualification.

## Evidence

Measured locally 2026-10-06, Node 26.7.0. Revision: commit containing this receipt
(`git log -- evals/ci/fuzz.md`). Builder-authored evidence. Three gate tests fail against
the stub (`fuzz/red.txt`) then pass (`fuzz/green.txt`). Regenerate:
`node --test evals/ci/fuzz.test.ts`.

`npm run test:fuzz` completes 1,000,000 inputs: 189,174 accepted and matched kit,
810,826 refused with a named rule, seed -1722707241 (`fuzz/million.txt`). No crash or
differential mismatch in this defined workload. Reproduce with
`SOLANAUT_FUZZ_SEED=-1722707241 npm run test:fuzz`. This is local qualification;
the separate pinned Ubuntu 24.04/Node 26.7.0 CI job runs a fresh seed on every push.
No coefficient or workload change after observing results. No dependency added.

Seven faults caught (`fuzz/faults.txt`): reduced budget, ignored process failure,
duplicate summary, incorrect declared total, incorrect outcome sum, empty accepted
domain and an unexpected decoder exception. Regenerate: `node evals/ci/fuzz-faults.ts`.
The product mutation makes the million-input wrapper fail before completion; a crash
cannot be counted as a named refusal. Sources restored; no final miss. Faults join the
maintained bite inventory. Historical reports remain unchanged.

`npm test`: 340 passes (`fuzz/full.txt`); `npm run typecheck`: exit zero
(`fuzz/typecheck.txt`). Updated aggregation inventory accepts all eighteen maintained
campaigns; five aggregator faults caught (`fuzz/aggregation-faults.txt`, regenerate
`node evals/ci/bite-faults.ts`). Earlier campaigns are unchanged; full sequential bite
also runs on the pushed CI revision. Prior property commit `b41c8c7` passes CI run
37480188076 across every approved runtime, office and maintained campaigns.
