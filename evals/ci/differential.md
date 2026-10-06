# CI-2 — pinned real-transaction differential corpus

2026-10-06 · builder-authored local Linux evidence · Node 26.7.0.
Local comparison/fault evidence is complete; hosted CI is checked after private sync.

## Definition and source

Definition 1 uses complete signed wire transactions from finalized public mainnet blocks.
No transaction is sent. The maintained gate runs offline against pinned JSONL bytes, so a
provider outage cannot silently shrink its population. Read-only collection uses `getSlot`
followed by `getBlock`, base64, full transactions, no rewards and maximum supported version 1.
Source: [Solana getBlock](https://solana.com/docs/rpc/http/getblock).

The exploratory block at slot 453965982 is retained as a regression corpus. After freezing
the comparison analysis and correcting its fault fixtures, a fresh block is selected by
finalized tip minus 100: slot 453972158. Every transaction is retained. No selection by outcome,
program, admission or agreement. Metadata and exact digest pins are in `corpus.json` and
`fresh-corpus.json`; the gate embeds the independent expected digest, not a value from a
caller-supplied measurement report. Byte edits, duplicate rows and incomplete framing fail.

Kit 8.4.0 independently decodes signed wire boundaries/signatures and message fields. Its
decompiler compares resolved addresses, roles and instruction data. Lookup inputs reconstruct
the execution-time loaded addresses in RPC metadata; this does not authenticate a current full
table account or qualify the operator's pinning workflow.

The pinned System, legacy Token and ComputeBudget clients compare instruction identification
and decoded data encodings. Observed moving/compute paths additionally compare amounts,
decimals, source/destination/authority addresses, compute units and priority-fee arithmetic.
Authority/nonce and unsupported layouts remain named denials. These are outer instructions;
unknown programs, CPI behaviour, Token-2022 extension semantics and mainnet signing are not
qualified by this corpus. The Alpha's wider Token-2022 programme remains owed.

## Failures retained

Six report cases fail against a stub (`initial-red.txt`); three comparison cases fail against
their stubs (`check-red.txt`). The first manual client round-trip probe rejects nine trailing-data
instructions: reference codecs accept their prefix, while the existing guard denies them.
Its failing output is retained in `exploratory-client-roundtrip.json`. The correct comparison
requires both matching decoded prefix fields and a named guard refusal for the extra data;
there is no product relaxation. The fresh corpus is measured only after this analysis freezes.

A missing-version fault survives because the fixture also fails aggregate counts
(`initial-faults.txt`). Correct the fixture by redistributing its missing version's count to
another format, preserving the total; the format gate then has to do its own work. A corpus
byte fault now changes a valid JSON string, rather than depending on a JSON parse error.
The final campaign catches twelve faults and restores sources (`faults-final.txt`).
One unchecked indexed fixture field fails typecheck; corrected without changing the gate.

## Results and regeneration

Fresh corpus: 1,578 transactions / 1,599 signatures, 863 legacy / 258 v0 / 457 v1.
Reference instruction comparisons: 482 System / 147 legacy Token / 1,055 ComputeBudget.
All transactions complete; zero mismatches. Sixty-six transactions contain extra data that
requires named conservative refusal. This is not a benign-traffic false-stop measurement.
Receipt output: `fresh-measurement.txt`. Eleven focused cases pass; twelve faults caught.

Root integration: `npm test` passes 434 cases, typecheck is clean, and `npm run test:bite`
catches 228 faults across 28 maintained campaigns with sources restored. Retained output is
in `full.txt`, `typecheck-final.txt` and `bite.txt`. The initial resumed suite overlaps bite's
start; its passing output is retained separately as `full-overlap.txt`, and the final suite
runs after restoration. No performance claim is derived from these test durations.
Coverage under concurrent full-suite load fails the FIFO child-process startup deadline;
`coverage-load-failure.txt` retains it. The isolated FIFO diagnostic passes without changing
the assertion or deadline. The separate `npm run test:coverage` passes the complete
instrumented suite and all unchanged AST floors (`coverage.txt`); the load sensitivity
remains a finding, not a silently discarded failure.

Run `npm run test:differential` for the frozen qualification corpus and
`node evals/ci/differential-faults.ts` for maintained faults. Run
`node --test evals/ci/differential*.test.ts` for gate, comparator and corpus-loader checks.
The regression and qualification corpus digests are embedded in `differential-run.ts`.
Publication/history review must include the retained public ledger bytes. Mainnet data reads
do not validate mainnet execution, admission safety, isolated deployment or independent security.
