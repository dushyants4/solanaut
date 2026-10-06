# Bounded archive verification — SNP-1 foundation

Builder-authored local Linux/Node 26.7.0 evidence, 2026-10-06. Revision is the commit
containing this receipt (`git log -- evals/sdk/archive.md`). Accepted ADR-019 scope;
no signer expansion, new dependency, live transaction or protected gate change.

`verifyArchive` checks newline framing, strict UTF-8, supported record envelopes,
canonical hashes, sequence/predecessor continuity and optional external head/byte pins.
Continuation archives require their starting sequence and predecessor. Options are captured
before asynchronous I/O. The reader uses a fixed chunk and bounded pending line, reads only
the initial declared size and checks descriptor metadata and pathname identity afterwards.
Regular, single-link local Linux files only; observed changes fail with typed errors.

## Failures and remediation

Nine initial stub failures, with the source-refusal case already passing (`archive/red.txt`).
Fractional monotonic timestamps were incorrectly rejected (`archive/fractional-red.txt`);
accept finite nonnegative timestamps without weakening safe-integer sequence checks.
A fractional fixture initially retained its old hash while resealing; corrected that fixture.
Initial mock typing and null-options failures retained (`archive/initial-typecheck.txt`,
`archive/options-red.txt`).

The initial source-size mutation survived because timestamp changes independently rejected
the fixture (`archive/initial-fault-miss.txt`). Added a size-only change with identical timestamp
metadata. Path-replacement coverage samples descriptor metadata before replacement so the
inode check is exercised separately. Oversized unfinished input must stop after one read.
The FIFO case initially hangs on open (`archive/fifo-red.txt`); opening nonblocking allows
the regular-file check to refuse it. All sixteen final faults are caught
(`archive/faults-final.txt`): blocking FIFO open, version, kind, sequence,
predecessor, content hash, complete/unfinished line bounds, source size, pathname identity,
head/digest pins, mutable pin options, fractional clock, sequence overflow and descriptor leak.
Sources restored. Regenerate: `node evals/sdk/archive-faults.ts`.

Two installed consumer tests failed before public exports (`archive/package-red.txt`), then
all six pass (`archive/package-green.txt`). Declarations reject incorrect line-limit types and
unknown pin names. Four package faults caught (`archive/package-faults.txt`). The npm tarball
installs outside this repository without workspace symlinks or a TypeScript loader. Regenerate:
`npm run release:prepare`, `npm run test:package`, `npm run test:package:faults`.

Final root-suite/typecheck/fault aggregation output is retained in `archive/full.txt`,
`archive/typecheck.txt`, `archive/bite.txt`. Regenerate: `npm test`, `npm run typecheck`,
`npm run test:bite`.

Final aggregation: twenty-three maintained campaigns, 163 caught faults, no failed or
skipped campaign and all sources restored (`archive/bite.txt`; `rg -c '^caught '`).
Root tests are rerun after aggregation: the previous successful output overlaps the start
of aggregation and is retained separately as `archive/full-before-final-bite.txt`.
The final sequential run passes 371 tests (`archive/full.txt`); typecheck exits zero.

## Limits

Structural verification is not policy replay, a signed snapshot, authentication of history,
backup recovery or measured bounded-memory restart. Synthetic report-only fixtures exercise
structure, not valid policy history; the installed test uses a real SDK decision. A forged
self-consistent chain needs an independently trusted pin or authentication to detect it.
Empty history is a structural result, never proof of an established guard. Metadata checks
detect observed changes; they do not prevent later changes or hostile concurrent filesystem
manipulation. Use an operator-owned immutable archive on a local filesystem. Existing writer
and established-history protections are unchanged. Full SNP/reliability gates remain owed.
