# Read-only replay command — local component qualification

2026-10-09 Toronto · builder/integrator execution by root, base `0a199aa`.
Isolated draft prepared on `codex/replay-command-component` from `d0d8dc3`
before the builder's service usage limit; it ran no tests or implementation.
Accepted ADR-010/014/019;
SPEC PKG-3, POL-2, VER-1/2, SNP-1/7/8 and the read-only diagnostic portion of OPR-2.
This is builder-authored component evidence, never Claude's independent campaign.

## Contract frozen before execution

Keep `solanaut-replay <record.jsonl> <policy.json|-> [public-trust.json]` and
the existing source command. Legacy two-argument replay uses its supplied policy;
`-` selects signed policies recorded in history with independent public pins.
Trust JSON contains only `operatorKey`, `guardId` and `cluster`, never a private
key or an authorisation envelope. No new flags, root export, network restriction,
policy semantics, record format, evaluation profile or signer method is added.

The existing success line and first-divergence sequence/field remain. Exit zero
means matched replay, one divergence, and two usage/read/verification failure.
The reviewed reversible presentation choice preserves the `recorded` and
`recomputed` labels with `[redacted]`. Source paths, input contents and raw
exceptions never become diagnostics. No claim of backup freshness, successful
restoration or service readiness follows from matched replay.

Reader ceilings are specified, not measured: public policy/trust JSON at most
1,048,576 bytes each, matching existing policy preparation; archive lines at most
1,048,576 bytes excluding newline, matching existing archive verification's
default. Exact boundaries pass, one-byte excess refuses. Supported safe sources
are regular single-link files on Linux in operator-owned directories. Final
source symlinks, hardlinks, special files,
invalid UTF-8 and observed source changes refuse. Policy/trust are captured once;
history uses the existing two-pass streamed recomputation and complete actual
archive reads. No streamed/bounded-state memory or timing claim is made.

## Prepared acceptance cases

`packages/sdk/test/replay-command.test.ts` covers positional compatibility,
signed policy changes and unresolved/used/latch history, wrong or missing trust,
unsupported signatures/profiles/versions and policy rollback, diagnostic
redaction, framing/tail corruption, exact resource boundaries, filesystem source
safety, two actual complete reads, valid history changes between reads and
unchanged input bytes/directory contents. Its generated Ed25519 keys exist only
in test memory; no devnet key, session, RPC or send is used.

## First failures and corrected fixtures

The draft population initially runs seventeen cases: six pass and eleven fail.
Its rehash fixtures still include the old hash in the body; the first candidate
passes fifteen, with divergence and exact record-boundary cases failing on that
invalid envelope. Retain both outputs. Removing the old hash before resealing
preserves the intended assertions. The corrected original committed command is
then rerun with eighteen cases: six pass, twelve fail at unsafe source/diagnostic,
bound and actual-read assertions. Its FIFO case reproduces a blocking read;
that first-red timeout is not counted as a semantic-fault catch.

The initial candidate also compares comma-joined trust key names; comma-containing
names can imitate the expected field set. The corrected fixture population
passes sixteen of seventeen and fails that exact-field case. Explicit cardinality
and membership fix D30. The final population adds actual descriptor-flag and
observed public-source replacement cases; all nineteen pass with native typecheck.
Real source reads underpin both hook cases; no successful evidence is invented.

The initial installed extension fails because its child fixture imports
`spawnSync` in another scope. Retain that setup error without catch credit, fix
the import scope and rerun the actual earlier compiled candidate. It then fails
the real unsafe-source assertion. The rebuilt candidate passes all eleven
installed cases, with substantive legacy/signed executable, independent-trust,
malformed-source, redaction, UTF-8 and byte-limit checks. No workspace loader flags
or symlinked SDK is used; private version/metadata remain unchanged.

## Semantic faults and integration

The source campaign catches thirteen semantic faults and restores exact bytes.
It covers external pins, divergence exit, complete/fresh source reads, public and
archive ceilings, strict UTF-8, exact fields, no-follow/nonblocking descriptor
flags, observed source stability and both diagnostic/detail redaction. Unsafe
flags are tested through actual opens without a blocking fault trial. Syntax,
setup, signal and timeout output receives no catch credit. Registry omission fails
before adding the command campaign; maintained registry/partition faults retain
all prior trials and restore. Each source trial and root first failure is retained.

Before fresh full measurement, definition 28 and seed 28483 are declared. All
prior selected sources/tests, the 500-case baseline, waits, limits and floors
remain. The CLI stays outside the decoder/policy mutation targets, covered by
the new maintained source/installed campaigns; its bin is already bound by the
complete frozen input inventory. This establishes no full Stryker score.

Regenerating commands after root releases the measurement slot:

```bash
node --test --test-isolation=none packages/sdk/test/replay-command.test.ts
node evals/sdk/replay-command-faults.ts
npm run release:prepare
npm run test:package
npm run test:package:faults
node evals/ci/bite-faults.ts
node evals/ci/bite-partitions-faults.ts
npm test
npm run typecheck
npm run test:coverage -- --serial
node evals/ci/mutation-recovery-faults.ts
```

The complete compiled campaign catches all ninety-nine trials and passes again
after restoration. The first full regression fails the prior POL-4 CLI assertion:
it expects a raw `externally pinned` divergence value. Missing trust still exits
one. Replace only that obsolete detail assertion with exact sequence zero,
`chain` field, both redacted labels and empty stderr. This strengthens the new
presentation contract and keeps the refusal assertion. The failure is retained
in `full-first-red.txt`, including the selected 500-case baseline failure.
Definition 28/seed 28483 already precedes this full execution; the population,
rules, floors, waits and limits are unchanged.

The isolated recovery/driver campaign catches all fifteen faults and restores;
the staging/report campaign catches all fifty-two and restores. Final manifest
verification confirms every bound product/evaluation input has its captured
digest after all campaigns. The exact 500-case selected baseline passes, with
the original twenty-second test wait unchanged. No full mutation score follows.
Complete OPR-2/6/7, restart/memory, independent review, audit, publication
and stable release remain unachieved.

Fresh ordinary and serial AST suites each pass 806 cases; native typecheck exits
zero and every unchanged AST floor passes. Guard coverage remains 470/488
statements and 412/438 branches. Coverage instruments the SDK/signer/firewall
source inventory, not command bins; the command has the separately retained
focused/source/installed fault evidence. Full coverage source digests match the
restored sources and `installed-candidate.json`. That manifest additionally binds
the command bins, corrected assertion and definition 28/seed 28483 inputs.
The private tarball SHA-256 is
`8071c43b0ba98d35cbf4c7b7d5a07503f6019eed76edf51d4a0468112fa145ba`.
The private version remains 0.0.0; `pack.json` identifies its ignored local
tarball. No package publication or stable-version change occurs.
Pre-commit unchanged close passes nine of ten gates, failing only the uncommitted
tree. Claims/knowledge lints and the staged secret scan pass. Authored code/doc
diff whitespace checks pass; raw command outputs are retained verbatim.

Exact preceding archival `0a199aab336fc80431b3d0f360eefd06be06f486` hosted run
`37949577048` never starts jobs. GitHub reports failed recent account payments or
a spending limit needing increase. All job metadata, annotations and failed log
retrieval are retained in `hosted-0a199aa/`; no test execution or code result is
inferred. The exact earlier component run `37949141048` is automatically cancelled
by that archival push; its available partial runtime/AST logs already show the
unchanged baseline-wait failure. Evidence is retained with the owned-admission
receipt. H13 account remediation and H11 wait acceptance are separate human debts.
