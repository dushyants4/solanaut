# ADP-1 — verify the serialised sending boundary

Builder-authored local evidence, 2026-10-10 Toronto, Linux/Node 26.7.0.
Reviewed base b5498e8f919181e1cf397dd8dc684b0bf7450a1a plus the bound candidate.
Accepted ADR-009 §9 and SPEC §8 require the adapter to send the checked bytes.
Its object message/signature check previously preceded an unchecked serialize
call, so a foreign object could hand different or malformed bytes to RPC.

Three initial product cases fail because changed messages, invalid signatures
and malformed wire are sent. The initial valid control also fails on comparing
Buffer with Uint8Array; preserve that fixture error, correct representation
before implementation and retain the corrected three-failure/one-pass baseline.
The correction captures one ordinary Uint8Array, decodes the wire, compares its
message and verifies the wallet signature before RPC. Refusal strips exposed
object signatures and uses the existing wallet-changed-message error.

A further adversarial serializer erases an already verified object signature,
then throws. The first correction reports expired, incorrectly freeing its
admission; preserve that separate failure. Capture the known signed identity
before serialisation and report unknown on local refusal even if object evidence
is erased. The admitted reservation remains held. No signing method broadcasts,
public method changes, new signer helper or SDK trust boundary change occurs.

An injected failure in unknown bookkeeping additionally exposes cleanup after
the failing report call. Preserve that regression; strip first, refuse with the
fixed error and retain the original admission if reporting cannot complete.
This fixture replaces the report method; it is not a real disk or power-loss test.

Seven focused cases and all twenty-five combined existing/new adapter cases pass.
Five source and five emitted faults are caught: omitted message comparison,
omitted signature verification, premature reservation release, missing signature
cleanup and serialisation again at send. Every trial completes the full focused population with no
cancelled/skipped/todo/setup credit, then exact bytes are restored and the
combined control passes. Earlier source trials remain in faults-initial; the
added changed-message/admitted-signature case catches message-check omission.

The actual private SDK tarball installs offline outside the repository with
scripts disabled and no package symlink. All seven boundary cases pass through its
public wallet export. Fixture guard and transaction builders remain repository
support; this is not a clean Ubuntu deployment or external-user study. All
nineteen existing installed cases pass. The current archive SHA-256 is
`0cd0d7238242afb7a7b33592f89b6c92cc903fa22df739fd0311dc2b6d707cab`;
the earlier pre-bookkeeping archive
`00c93fd46c3638d74bae9b7cff3650eccbd359afac75215dd5dfbfa72c80520d`
is separately retained with its source/test snapshot and first passing evidence.
The candidate manifest binds source, evaluation and emitted inputs; only the
wallet product source and its emitted JavaScript differ from the preceding
candidate. Earlier archive/manifests remain unchanged evidence.

Full native tests pass all 895 cases and typecheck passes. Earlier pre-bookkeeping
native/AST passes cover 894 cases and unchanged floors; those logs, counter reports
and input snapshots are preserved separately. Final quiet serial AST passes all
895 cases and unchanged complete floors after the bookkeeping correction. Final
summary/source hashes and all counter reports are archived too. No pass erases H11 failures, approves its wait
proposal or qualifies hosted CI or the maintained fault inventory.
Raw first failures, mutation failure, source/emitted trials, build/pack/install,
native/type and coverage output are in adapter-wire/. Final bound source,
evaluation, emitted and archive identities match after final coverage. No independent-security,
isolated signing, mainnet, complete release or percentage milestone is inferred.

```bash
node --test packages/sdk/test/adapter-wire.test.ts packages/sdk/test/adapters.test.ts
uv run --script evals/sdk/adapter-wire/faults.py
npm run release:prepare
npm pack ./.sandbox/releases/sdk --ignore-scripts --json --pack-destination .sandbox/solanaut-1/adapter-wire
uv run --script evals/sdk/adapter-wire/install.py
uv run --script evals/sdk/adapter-wire/faults.py --compiled
node --test evals/packaging/packed-sdk.test.ts
npm test
npm run typecheck
node evals/ci/coverage-run.ts --serial
uv run --script evals/sdk/adapter-wire/candidate.py
```

Exact unapplied CI draft is owner-ci.patch, HANDOFF O4. Its read-only
`git apply --check evals/sdk/adapter-wire/owner-ci.patch` passes. It retains all
existing steps, runtimes and limits; actual matrix/hosted qualification remains
owed after owner application. No protected workflow is edited.
