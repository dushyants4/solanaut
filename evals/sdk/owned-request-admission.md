# Owned serialized proposal consultation — component receipt

2026-10-08 Toronto · accepted ADR-019 · SNP-7, LIF-1/7, OWN-2, POL-4 and
storage refusal. Builder-authored component evidence, including builder-peer
review; not Claude RT-2 or independent release qualification.

Base: `7118ae242b25f50305c0b49d6f9c9c4da2e30df9`. Isolated worktree:
`.sandbox/owned-admission-component`, branch `codex/owned-admission-component`.
Commit carrying this receipt identifies the exact component revision. Node
26.7.0, Linux, existing lockfile dependencies through an uncommitted workspace
`node_modules` symlink. No dependency installation, publication or funded send.
Final evidence captured at `2026-10-09T02:17:08Z` (2026-10-08 locally).

## Contract

Internal `guard.ts` exports `checkOwnedRequest(guard, proposal, identity)` and
`OwnedRequestAdmissionError` (`owned-request-admission`). Neither is a root SDK
export. A WeakMap binds genuine signed guards to their private store, state,
trust and existing synchronous check. Per-guard FIFO captures input before
waiting, consults actual owned current-head evidence, and checks closure and
the live sequence/head before returning a historical decision or synchronously
evaluating and committing verified absence. No await separates that check from
the existing evaluation/commit.

Capability, malformed captured input and unavailable/changed evidence reject
with the typed error. Historical method/payload collisions return the existing
unrecorded fail-closed decision (`seq: -1`). Append failure follows the existing
check's fail-closed answer and leaves the writer unavailable. Rejections do not
poison later queued work. Responses are detached and recursively frozen.

The public synchronous Guard interface and methods retain their behaviour.
All historical maps, store arrays and index construction remain retained.
No eviction, signer wiring, record/profile change or bounded-memory claim.
An exposed synchronous guard cannot have its historical maps evicted: a later
distinct async facade must own the underlying guard privately first.

## Failures and corrections

`first-red.txt`: all fifteen original cases fail because the internal API is
absent. Initial implementation passes those cases (`focused-initial.txt`).

Peer review identifies two additional candidate defects, reproduced before fixes:

- `immutable-first-red.txt`: a fresh reply shares the cached decision object.
  Companion-only reply cloning and recursive freezing now prevent nested
  expiry/amount/telemetry/Keel/request mutation and leave history usable.
- `shared-memory-first-red.txt`: structuredClone preserves SharedArrayBuffer
  backing. Caller replacement of a valid one-lamport message by a valid
  two-lamport message changes the queued admission. Copying the message into
  an ordinary Uint8Array before binding/queueing fixes the captured payload.

`typecheck-initial.txt` retains a test-fixture cluster literal widening error;
the literal annotation fixes it without changing assertions or product rules.
The parent records the confirmed candidate defects in its project records.

## Verification and semantic faults

Focused final population: eighteen cases. Actual disk reads cover prefix/tail
retry, identity/group/method collision, FIFO reservations, duplicate concurrency,
input capture, capability, corrupt/missing evidence, closure, queue recovery,
append failure, old-policy pending/used receipts and latch preservation. A child
test uses the real owned lookup, then a controlled trusted mutation to expose
otherwise inaccessible lookup-to-commit head and closure gaps; it does not invent
successful lookup evidence.

`node evals/sdk/owned-request-admission-faults.ts` catches all twenty-one semantic
faults and restores the exact source. `faults-initial.txt` and `faults-final.txt`
retain both executions; `faults-final/` retains each final trial, baseline and
restoration output. No miss, setup, syntax, signal or timeout receives catch
credit. Faults cover capability, proposal/identity/shared-byte/group/time/height
capture, disk consultation, current head, late closure, collisions, historical
answer/policy retry, admission identity/private context, FIFO/rejection recovery
and detached/deeply frozen replies.

The related suite passes 159 cases, with zero failure/cancellation/skip. Command:

```sh
node --test --test-concurrency=1 packages/sdk/test/owned-request-admission.test.ts packages/sdk/test/request-index-lookup.test.ts packages/sdk/test/request-index-publication.test.ts packages/sdk/test/request-index.test.ts packages/sdk/test/request-identity.test.ts packages/sdk/test/control-request.test.ts packages/sdk/test/signing-history.test.ts packages/sdk/test/signed-policy.test.ts packages/sdk/test/latch-c.test.ts
```

Outputs: `related-tests.txt`, then `related-tests-final.txt` after fixture scratch
was moved under the worktree's ignored directory and the history assertion was
captured by value. Final related execution finishes before the final fault
campaign begins. `npm run typecheck` exits zero (`typecheck-final.txt`), after
fault restoration. No native/fault child survives this component handoff.

## Source scope and integration

`guard.ts`: 638 to 686 physical lines, including blanks/comments; forty-eight
additional general owned SDK bookkeeping lines. Signer app and signer-specific
helpers are unchanged; no SIG-11 achievement or H9 acceptance follows.

Final SHA-256:

```text
de5c02cb01a0295fd05902184b34327cd06d3dbbe3505d87bc03b5d3b6da53d2  packages/sdk/src/guard.ts
e816b7fc39a9e464d11b59177d23f9c3ab3fb964807a96e51fe724645c4be71f  packages/sdk/test/owned-request-admission.test.ts
ce17a5071a5ea678c62df1446e3516227307e7b415b0f9eadf03b396c44efa0e  evals/sdk/owned-request-admission-faults.ts
```

The isolated builder changed no root documents, gates, packaging, signer source
or public exports. Root integration into `d0d8dc3` follows below; this is still
builder-authored evidence, not independent security qualification.

## Root integration

The actual earlier compiled candidate fails the new installed lifecycle check
because the owned admission API is absent (`integration-installed-first-red.txt`).
The corrected candidate passes the existing eleven installed cases, including
historical uncertain-send retry, payload/group/control collisions, concurrent
duplicates, private immutable replies, shared-byte capture, forged guard refusal,
corrupt-index refusal and a real owned lookup-to-commit head gap. The latter uses
the actual compiled lookup and a controlled trusted mutation after its evidence,
without fabricating a successful lookup result. The helper stays absent from the
package root exports; package version and private metadata remain unchanged.

All ninety-one compiled faults catch and the candidate restores, preserving the
previous eighty-two trials and adding nine admission faults. Inventory/staging
omission fails before the new test registration. The maintained staging/report
campaign catches fifty-two trials; registry and partition campaigns catch five
and twelve respectively, with exact restoration. Definition 27 and fresh seed
27241 are declared before expanded measurement; all earlier selected tests and
whole sources, waits, resource limits and score/coverage floors remain. These
checks do not produce a Stryker mutation score or accept H11.

The first full ordinary run passes 786 of 787 cases and fails the retained
baseline-population assertion: it still expects 482 after the declared eighteen
additional selected cases. The actual baseline completes within the unchanged
wait; updating its exact expectation to 500 preserves population enforcement.
Raw output: `integration-ordinary-first-red.txt`. No workload definition, source,
score floor or wait changes for this assertion correction.

Fresh full ordinary and serial AST suites each pass 787 cases, with no failure,
cancellation or skip. Native typecheck exits zero; every unchanged coverage floor
passes. Guard coverage is 470/488 statements and 412/438 branches. Exact AST
source hashes match restored product files and `installed-candidate.json`, which
identifies the private tarball. Raw final outputs and counts are retained beside
`coverage-summary.json`. Source fault campaigns finish before both measurements.
All fifteen fresh isolated recovery/driver faults pass with restoration under
the expanded 500-case selected baseline (`integration-recovery-driver-faults.txt`).
The original population fault demonstrates that omitted selected tests refuse;
the exact count assertion and every wait/limit remain enforced. No full or AST
run overlaps these mutations. No complete Stryker score, bounded-memory or release
claim.

Regenerate from the repository root with source faults and measurements sequential:

```sh
node evals/sdk/owned-request-admission-faults.ts
node evals/sdk/request-index-lookup-faults.ts
node evals/sdk/request-index-publication-faults.ts
node --test evals/ci/mutation-stage.test.ts evals/ci/bite.test.ts evals/ci/bite-partitions.test.ts
node evals/ci/bite-faults.ts
node evals/ci/bite-partitions-faults.ts
node evals/ci/mutation-faults.ts
npm run release:prepare
npm run test:package
npm run test:package:faults
npm test
npm run typecheck
npm run test:coverage -- --serial
node evals/ci/mutation-recovery-faults.ts
```

Exact preceding archival revision `d0d8dc344c902548ac964f16cdd9f223a9f1e4af`
hosted run `37872800833` completes failed. Each runtime and AST suite reports
769 cases, 768 pass and one unchanged staged-baseline wait failure; partition one
fails the same case. Other jobs, the lookup tests and its twenty-six faults pass.
Full job metadata and log: `owned-request-admission/hosted-d0d8dc3/`. That failure
is not replaced by passing local component checks. H9/H10/H11/H12 and all required
Alpha, audit, outside-user and human-controlled release gates remain open.
