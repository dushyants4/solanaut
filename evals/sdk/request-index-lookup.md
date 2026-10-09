# Owned current-head request lookup

2026-10-08; Linux/Node 26.7.0; base `0332c97` plus the commit containing this
receipt. Builder-authored component evidence under accepted ADR-019, requirements
SNP-7, OWN-2 and LIF-1–4/7. Peer review is builder review, not Claude RT-2.
Raw initial failures, passes, faults and misses: `request-index-lookup/`.

The actual kernel-owned record store now has an internal read-only lookup. Fresh
disk history must match cached entries. Captured external policy pins validate
the complete signed current history and independently derive the published prefix.
Lookup authenticates the actual prefix shard, then folds its validated tail for
the requested identity. It preserves admission, redemption, signed bytes,
send-started, immutable reply, latest report and first final outcome. Both current
and index sequence/head pairs accompany the immutable row or qualified absence.
Ownership, record identity/metadata, cache equality and the pointer are rechecked
after asynchronous work. Lookup shares the existing maintenance exclusion.

Missing/corrupt index evidence refuses; lookup never publishes, repairs or deletes
it. Validation refusals do not disable a healthy writer. A copied/manual/closed/
failed store cannot claim the capability. This is evidence through a captured
head, not an admission permit: a future serialized admission path must compare
that head again before committing. No signer wiring, cache eviction or SDK root
export is added. Construction/replay still retain full history and generated
index text; this does not establish bounded memory, startup readiness or SNP-7.

The absent API initially fails all fourteen cases. Initial native typing errors
and fixture corrections are retained: the policy changes through a close/reopen,
and a reason-only change is not a decision divergence, so the dishonest-tail case
changes the actual verdict/rule. No existing gate or test is weakened.
Peer review then reproduces D26: the direct helper folds a caller-mutated history
after validating a captured snapshot, returning an unrecorded reply. Synchronous
history capture fixes the first-red regression. The actual owned caller already
supplied private history; this closes the helper's boundary before use expands.

The final focused population passes eighteen cases. Twenty-six semantic faults
are caught with exact source restoration. The initial manual-owner, healthy
closed-owner and early-cache ordering misses remain retained; actual valid-cache,
reopened-descriptor and pre-pointer-refusal oracles now catch them. Syntax/setup
failures, signals and deadlines receive no catch credit.
The unchanged publication campaign also catches its twenty-seven retained trials
after this validator change. Inventory/staging omission checks fail before the
new test/campaign registration; the maintained staging campaign adds the lookup
test omission without removing prior trials.

The actual earlier compiled candidate fails the installed lifecycle assertion
for the absent lookup API. The corrected candidate passes the existing eleven
installed cases, including uncertain historical sends, new tail request/reply,
complete current absence, forged-owner refusal and corrupt-pointer preservation.
All eighty-two maintained compiled faults catch and the final candidate restores.
Its private tarball/source identities are in `request-index-lookup/installed-candidate.json`;
package version/private metadata stay unchanged. No publication clearance.

Before measurement, definition 26 and fresh seed 26179 are declared in the run
record. Its selected baseline adds these eighteen cases to the prior population,
retaining every earlier source/test, all waits, supervision limits and score/
coverage floors. This is not a completed Stryker mutation score. H11 remains
pending; the unchanged hosted baseline wait is not increased.

Fresh ordinary and serial AST suites each pass 769 cases; native typecheck exits
zero. Every unchanged coverage floor passes: record 293/302 statements and
165/174 branches; index publication/lookup 173/181 statements and 132/140 branches.
The complete source hashes/counts in `coverage-summary.json` match the restored
product files and installed-candidate manifest. All fifteen fresh isolated
recovery/driver faults pass with restoration under the expanded 482-case selected
baseline. The staging/report campaign passes all fifty-one retained/expanded
faults. No source mutation overlaps ordinary or AST measurement.

Regenerate from the repository root, with source faults and measurements sequential:

```sh
node --test --test-isolation=none packages/sdk/test/request-index-lookup.test.ts
node evals/sdk/request-index-lookup-faults.ts
node evals/sdk/request-index-publication-faults.ts
node --test evals/ci/mutation-stage.test.ts evals/ci/bite.test.ts evals/ci/bite-partitions.test.ts
node evals/ci/mutation-faults.ts
npm run release:prepare
npm run test:package
npm run test:package:faults
node evals/ci/mutation-recovery-faults.ts
npm test
npm run typecheck
npm run test:coverage -- --serial
```

The preceding exact hosted `0332c97` run `37851655446` completes failed. Runtime
and AST jobs each fail only the unchanged staged-baseline wait; maintained partition
one fails the same real-baseline case. Other jobs pass. Full log and revision/job
metadata are retained in `../firewall/filter/hosted-0332c97/`; no passing complete
hosted qualification is inferred. Full independent security, Linux isolation,
human operations and all stable-release gates remain required.

Exact implementation `7118ae242b25f50305c0b49d6f9c9c4da2e30df9` is privately
pushed and the unchanged post-push close passes all ten gates. Hosted run
`37871842802` completes failed: each ordinary runtime and AST suite reports
769 cases, 768 pass and one unchanged staged-baseline wait failure. Partition
one fails only the same real-baseline case; partitions two and three pass. The
new lookup campaign catches all 26 faults and restores; new lookup tests pass
on every runtime and under AST. Typechecks and installed package checks pass.
Full exact log and revision/job metadata: `request-index-lookup/hosted-7118ae2/`.
These passing component steps do not replace the failed complete hosted gate.
