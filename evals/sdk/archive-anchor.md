# ANC-3 — externally pinned archive sequence and head

2026-10-06 · builder-authored local Linux evidence · Node 26.7.0. Revision:
commit containing this receipt. This is the structural component of ANC-3, not
authenticated state replay or a deployed anchor programme.

`verifyArchive` accepts `expectedAnchor: {seq, head}`. It captures both values before
asynchronous reads, checks the head at that exact sequence, and refuses absent history.
It checks the entire archive and tail with the existing bounded streaming verifier.
The installed read-only command accepts paired `--anchor-seq` / `--anchor-head` flags;
success is exit zero, anchor disagreement exit one, malformed usage exit two.

## Failures retained

Seven API cases fail first; the malformed-option case already refuses (`initial-red.txt`).
One new CLI case fails first, while its malformed-input case already refuses (`cli-red.txt`).
Installed declarations and the new installed API/CLI case fail against the old candidate
(`installed-red.txt`). Rebuilding the release-only JavaScript and declarations fixes both.

The original FIFO startup test misses its existing one-second readiness deadline during
the concurrent Stryker workload (`archive-regression.txt`). This load-sensitive test failure
is retained; no deadline or assertion is weakened. The package fault harness rejects its
stale six-test count after the installed suite grows to seven (`package-faults-initial.txt`),
despite the export fault being detected. Its strict completed count is updated to seven.

## Focused evidence and regeneration

- `node --test packages/sdk/test/archive-anchor.test.ts packages/sdk/test/archive-cli.test.ts`:
  eighteen cases pass (`archive-anchor/focused-cli.txt`).
- `node evals/sdk/archive-anchor-faults.ts`: nine caught faults (`archive-anchor/faults.txt`).
- `node evals/sdk/archive-anchor-cli-faults.ts`: four caught faults (`archive-anchor/cli-faults.txt`).
- `npm run release:prepare`, `npm run test:package`: seven installed tests pass,
  including consumer declarations and the installed executable (`build.txt`, `installed-final.txt`).
- `npm run typecheck`: zero errors (`typecheck-final.txt`).

All new planted faults restore their sources. Sequential `npm test` passes 457 cases
(`full-final.txt`), after the maintained-inventory check first refuses the two new campaigns
missing from its list (`full.txt`). Both campaigns are now included. Sequential
`npm run test:coverage` passes all unchanged SDK/signer/critical-file floors over 457 cases
(`coverage.txt`, exact source/counter evidence in `coverage-summary.json`). The archive file
covers 87/90 statements and 104/106 branches. `npm run test:bite` catches 260 faults
across all 31 campaigns, with no failed/skipped campaign and restored source fingerprints
(`bite.txt`); this includes the four installed-package faults and all original archive
campaigns. Typecheck after restoration is clean (`typecheck-restored.txt`). Close and
private hosted CI follow sync.

## Trust and remaining work

A complete resealed rewrite before the pinned sequence is refused; a valid rewritten tail
after it remains outside that anchor's coverage. Continuation segments must contain the
pin, not merely begin after it. Caller mutation cannot change the captured pin or receipt.
No RPC, cluster, programme address, guard identity, authority or commitment is authenticated
by this function. The caller must obtain the pin independently from trusted evidence.
It does not verify policy decisions, restore reservations, rebuild Keel or sign snapshots.

ADR-022 proposes the missing enrolment/rotation account contract and changes ANC-1's
instruction surface. It awaits the human; no dependent programme is implemented.
