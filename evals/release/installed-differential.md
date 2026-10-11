# Current installed SDK — frozen real-corpus comparison

2026-10-11 Toronto · builder-authored CI-2 packaging qualification · reviewed
abed480 · current D40/Linux, existing Node 26.7.0 and 24.19.0. CLAIMS S138.
No product, corpus, original comparator or maintained gate changes.

## Frozen scope

Install the actual D40 archive offline with scripts disabled, outside the
repository. Its directory is an actual package, not a workspace symlink.
Archive SHA-256 is
`55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
Freeze original runner/comparator/validator, oracle, corpus, lock and helper
hashes, and verify the current product against S130's bound product manifest.

Relocate only imports and the corpus location. Decoder/classifier imports use
the installed public `@solanaut/sdk` export; reference clients and kit helper
use explicitly resolved repository locations. The unchanged runner still pins
the original corpus digest and applies its original completion/format/program
checks. Complete relocated sources are retained. This is not a standalone
reference-client installation or clean-machine integration study.

## Failures first and restoration

Four isolated installed faults change transaction splitting, message decoding,
account/instruction resolution or instruction identification. Each executes all
1,578 original rows and exits one. The first three record 1,578 mismatches each;
the classifier fault records 689. Rows without a supported outer instruction
are not falsely counted as classifier failures. Complete raw outputs and
per-fault evidence remain; no counterexample subset replaces the population.

Restore exact installed bytes between trials and in cleanup. Neither repository
source nor the shared compiled scratch candidate is mutated. The healthy
controls run only after restoration, and their result does not erase the failed
histories. All frozen input hashes still match; the temporary consumer is removed
and the owned job completes. These are builder faults, not independent security
evidence or a Stryker score.

## Controls

Both existing runtimes complete 1,578 transactions / 1,599 signatures:
863 legacy, 258 v0 and 457 v1. Each reports zero mismatch; supported outer
instruction comparisons total 482 System, 147 legacy Token and 1,055 ComputeBudget.
The same 66 extra-data transactions receive the original conservative refusal.
These are retained real ledger bytes, not transactions sent by this evaluation.

The original eleven comparator/loader/report controls pass without skip,
cancellation or todo; typecheck passes. The fresh full native baseline fails
solely at H11's unchanged real staged-baseline wait. Complete output is retained
in `native-baseline.txt`, with no skipped/cancelled/todo cases. No unchanged rerun
is selected to seek a pass. This scoped installed result cannot stand in for
that gate or full hosted/AST qualification.

## Regeneration and limits

```sh
uv run --script evals/release/installed-differential.py
node --test evals/ci/differential.test.ts evals/ci/differential-check.test.ts evals/ci/differential-run.test.ts
npm run typecheck
```

Preserve this output directory before a fresh helper run; an existing definition
refuses replacement. Owned scratch identity/completion is in
`.sandbox/installed-differential/`; durable hashes, results and raw logs are here.

Reusing the frozen corpus adds no new statistical population. Lookup inputs are
execution-time loaded bindings, not authentication of current table accounts.
Unknown programs, CPI execution, Token-2022 extensions, isolated signing, live
network behaviour, mainnet support, Node 22, full CI, performance, independent
audit and stable milestones remain unqualified by this receipt. Existing gates
and historical failures are unchanged. Public-history review must still cover
the retained ledger bytes; this is no publication clearance.
