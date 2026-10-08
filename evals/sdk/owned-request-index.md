# Owned request-index publication and checkpoint cache recheck

2026-10-08; Linux/Node 26.7.0; base `43f20c0` plus the commit containing this
receipt. Builder-authored component evidence, not independent RT-2. Requirements:
OWN-2, SNP-4/7; accepted ADR-019. Raw evidence: `owned-request-index/`.

The actual kernel-owned store now derives an index from freshly read signed-policy
history, compares its cached history, and publishes a complete immutable generation
before replacing the current pointer. Captured pins, owner identity, source identity
and maintenance exclusion remain enforced. Disk pointers cannot mint trusted roots.
Validation refusals preserve the writer; uncertain storage failures fail it closed.
Full history and previous generations remain retained. No pruning or garbage collection.

Initial missing-capability failures, rename/ctime failure, late pointer disappearance
and D25's missing checkpoint rejection are retained alongside passes. D25 rechecks
cached history after asynchronous checkpoint validation, before replacement.

The publication suite has 21 top-level cases. Its maintained campaign catches 27
final semantic faults and restores both sources. Initial closed-owner, prefix-head
and final-pointer misses are retained. A healthy close/reopen descriptor-reuse case
replaces the earlier failed-store-only oracle; the pointer race is exercised after
parent-directory checking. The prefix-head omission was masked by replay: the final
trial explicitly combines silent normalisation and omitted canonical-byte checking.
It does not retroactively credit the original omission. The captured-pin oracle now
accepts a typed positive-path failure as well as an assertion failure, but rejects
syntax/reference/module failures, signals and timeouts. Single-link trials remove
both checks. Checkpoint maintenance retains all earlier trials and adds D25:
17 semantic catches and one contained zero-progress deadline, with no completion
credit for that deadline. Ambiguous fault-site failures are preserved.

Critical-file omission and mutation-stage/campaign omission gates failed before
registration. The critical floor remains unchanged. Coverage faults pass 30 trials.
The preceding ordinary and serial AST populations pass 740 cases; record coverage
is 253/262 statements and 144/153 branches, index publication 136/142 statements
and 95/101 branches. Exact input hashes are in `coverage-summary.json`.

Installed PKG-2 then found a genuine declaration leak: exported internal metadata
used Node's filesystem type, requiring Node typings in a consumer that does not
need them. The failure and failed fault-campaign baseline are retained. A minimal
structural stat interface keeps every runtime identity check and removes that type
dependency; consumer configuration is unchanged. Eleven installed cases now pass.
Definition 25/seed 25813 is declared before fresh measurement following this
type-only source correction; prior definition 24/seed 25589 evidence is retained.
Source/test populations, selected 464-case baseline, all waits, floors, run limits
and mutation concurrency remain unchanged. No full mutation score is claimed.

Commands, from the repository root:

```sh
node --test packages/sdk/test/request-index-publication.test.ts packages/sdk/test/checkpoint-publication.test.ts
node evals/sdk/request-index-publication-faults.ts
node evals/sdk/checkpoint-publication-faults.ts
node evals/ci/coverage-faults.ts
npm test
npm run typecheck
npm run test:coverage -- --serial
npm run release:prepare
npm run test:package
npm run test:package:faults
node evals/ci/mutation-recovery-faults.ts
```

The full preceding hosted run `37780907635` fails its real staged-baseline wait;
raw log and metadata remain in `hosted-43f20c0/`. H11 has not been accepted or
applied. This component does not wire historical lookup into live admissions,
track a complete live tail, bound index preparation or retained state, qualify
startup/restart, prove power-loss durability, or complete SNP-7/Alpha/1.0.
Final follow-up: definition 25 ordinary and serial AST suites both pass 740 cases,
native typecheck exits zero, all unchanged coverage floors pass with the same
fractions quoted above, and eleven installed cases/seventy-four compiled faults
pass with restoration. Corrected input hashes are retained separately in
`coverage-summary-definition25.json`; the earlier summary is not overwritten.
Initial close passes nine gates and fails the uncommitted-tree gate; it is not
claimed clean before sync. All fifteen fresh isolated recovery/driver faults pass
with restoration under definition 25; output is retained separately.

## Installed runtime dependency inspection

The private compiled tarball SHA-256 is
`5e56377c95a80aa6788f9ddd4eef17ab563021228839c6b0c2a1dad6bdf794f5`.
An explicitly manifested scratch consumer installs it offline with scripts/dev
dependencies disabled. Its lockfile and `npm ls --all --json` show the installed
SDK and @gubernaut/core 1.0.1, without workspace links. `npm audit --json` exits
zero and reports zero known advisories for that graph at this observation date.
This does not qualify the full workspace/ElizaOS graphs or establish absence of
unknown vulnerabilities. No licence/publication/security-audit gate closes.
Pack file inventory, exact lockfile, tree, audit and install outputs are retained
in `runtime-dependencies/`. Regenerate `npm pack --json --ignore-scripts` from
the prepared release, create a fresh scratch package.json first, then run
`npm install --offline --ignore-scripts --omit=dev --no-audit --no-fund <tarball>`,
`npm ls --all --json` and `npm audit --json` in that consumer.
`npm sbom --sbom-format=cyclonedx --omit=dev` also succeeds for that installed
consumer; raw `runtime-dependencies/sbom.cdx.json` retains its exact metadata,
components and edges. This is an SDK candidate graph inventory rooted at a scratch
consumer, not the required independently validated per-package release SBOM set.
Solanaut licence selection and all other package inventories remain owed.

The first attempt lacked a scratch manifest: npm ascended to the workspace,
changed its manifest/lockfile and removed development packages. Exact unintended
diff and failed tree/audit are retained. Those agent-owned changes were restored
from the original revision, followed by `npm ci`; source fault execution during
that disruption is unqualified and retained. No root dependency change remains.
The corrected source campaign again catches all 27 trials with restoration.
Post-restoration ordinary suite passes 740 cases and typecheck exits zero;
every product-source hash still matches the final AST summary.

The existing installed lifecycle case now invokes actual owned publication from
the compiled internal module, verifies its immutable receipt, uncertain-send
lookup, corrupt-pointer refusal, forged-owner refusal and predecessor retention.
An injected compiled digest fault fails that assertion before the expanded
campaign is trusted (`owned-index-installed-runtime-fault-first-red.txt`). Restored
installed population passes all eleven cases. The maintained package campaign
retains all earlier trials and adds module, digest and capability faults.
All 77 final compiled trials pass, followed by a passing restored candidate;
the exact campaign output is retained. No setup failure is credited as a catch.

The unchanged mutation report/staging campaign passes its prior 48 trials on the
candidate. A follow-up adds explicit source/test omission faults for this component;
all 50 trials pass and restore targets. Earlier inventory first-reds remain
retained. No staged inputs, selected populations, seed, wait or floor changes.
Regenerate: `node evals/ci/mutation-faults.ts`. These are gate faults, not a
completed Stryker score. The updated campaign is in the archival follow-up commit.
