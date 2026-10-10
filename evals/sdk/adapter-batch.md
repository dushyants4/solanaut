# D41/ADP-1 — prepared batch membership correction

2026-10-10 Toronto · builder-authored local Linux/Node 26.7.0 evidence.
Reviewed base fc3caff2579450d752545cb52ebcd693c0557b13 plus the candidate.
Accepted ADR-009 §9 and the existing adapter contract require every signed
message to match its admission; visible valid signing cannot be released as
never signed merely because its wallet edits the batch array.

The wallet originally receives the same array used for admissions and cleanup.
After signing both messages, reversing it and returning an empty array makes
the failure path report both admissions expired. Emptying it and throwing does
the same, leaving signed caller objects outside cleanup. A caller array edit
during the RPC await also replaces the requested membership. These three cases
fail first; the ordinary two-message sign-only control passes. Raw initial and
corrected-fixture failures are preserved. The first fixture typecheck rejects
its non-generic signing helper; preserving the transaction subtype corrects the
fixture without changing its population or assertions.

The correction captures membership before the first await and delegates a
separate array to the wallet. Transaction objects remain ordinary caller objects;
their original references stay available for message/signature verification and
cleanup. Validly signed admissions remain unknown and in-flight on the tested
wallet failures. No public method, SDK trust, policy, sensor, signer budget,
receipt format or broadcasting behaviour changes.

All four cases and the combined thirty-five adapter cases pass. Three source
and three emitted omissions fail the complete four-case population, with no
skipped/cancelled/todo credit; exact implementation bytes are restored and
controls pass. The faults omit caller membership capture, omit the wallet's
separate array, or prematurely expire visible valid signing.

The actual private tarball installs offline outside the workspace package graph,
scripts disabled and no SDK symlink. Four cases pass through its installed public
wallet export. Guard/policy/transaction builders remain repository support; this
is not a clean-machine deployment or outside-user study. The existing installed
suite separately passes all nineteen cases. Typecheck passes.

The pre-change full native baseline passes 900 of 901 cases and fails H11's
unchanged staged-baseline wait. That failure remains separate from the three
new deterministic batch failures. The corrected full native suite passes 904
of 905 cases and fails only the unchanged wait, with complete output retained.
The correction cannot integrate under the native-green T2 rule. Exact
product/test snapshots and the source patch retain the candidate; all original
product hashes are restored and typecheck passes. The current committed product
still contains D41. No coverage, runtime matrix or stable milestone is claimed.

The private prepared archive SHA-256 is
`965cd0ee3d28ece4cba128eed79ec349476d61d22e9a52c7635448ce4bbb9ddc`.
candidate.json binds the reviewed base, candidate product, emitted files,
archived tests/helpers and tarball. Final helper controls/faults use the exact
archived tests with only imports relocated; initial helper outputs remain under
initial-helper. The bound restoration check validates original product identity
and retained prepared component artefacts. Scratch emitted output remains the
candidate; rebuild from the committed product before treating it as current.

O7's exact unapplied combined CI draft retains O5 and adds these component
trials, with unchanged runtime matrix and limits. Read-only `git apply --check`
passes. Apply only after product integration qualifies; source trials refuse
the original implementation. No protected workflow is edited.

The already installed Node 24.19.0 separately executes the same four
installed candidate cases and catches the same three installed omissions.
Exact installed bytes and the final control are restored, with runtime output
and full trial logs under node24. This is additional builder-authored component
compatibility evidence, not a full Node 24 native/matrix pass or an integrated
fix. `uv run --script evals/sdk/adapter-batch/node24.py` regenerates it without
installing a runtime. The original product and prepared archive stay unchanged.

```bash
git apply evals/sdk/adapter-batch/product.patch
cp evals/sdk/adapter-batch/batch.candidate.txt packages/sdk/test/adapter-batch.test.ts
node --test packages/sdk/test/adapter-batch.test.ts packages/sdk/test/adapter-buffer.test.ts packages/sdk/test/adapter-wire.test.ts packages/sdk/test/adapters.test.ts
uv run --script evals/sdk/adapter-batch/qualify.py source
npm run release:prepare
npm pack ./.sandbox/releases/sdk --ignore-scripts --json --pack-destination .sandbox/solanaut-1/adapter-batch
npm install --prefix .sandbox/solanaut-1/adapter-batch/consumer --offline --ignore-scripts --no-audit --no-fund ./.sandbox/solanaut-1/adapter-batch/solanaut-sdk-0.0.0.tgz
uv run --script evals/sdk/adapter-batch/qualify.py compiled
uv run --script evals/sdk/adapter-batch/qualify.py installed
node --test evals/packaging/packed-sdk.test.ts
npm test
npm run typecheck
```

These commands stage a temporary prepared candidate, not an authorised commit
despite failing gates. Restore with `git apply --reverse evals/sdk/adapter-batch/product.patch`
and remove the temporary test; `uv run --script evals/sdk/adapter-batch/bind.py --restored`
checks exact original product identity. Never discard a user edit to restore it.

Archive existing outputs before regeneration. Deterministic membership edits are
not concurrent SharedArrayBuffer scheduling, independent security, chain execution
or isolated signing evidence. A wallet with direct key access can still retain or
send signatures outside the trusted SDK wrapper. Protected CI changes, if needed,
are owed drafts; this work does not apply them or accept H9/H11/H14.
