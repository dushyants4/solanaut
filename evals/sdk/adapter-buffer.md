# D40/ADP-1 — privately own captured wallet bytes

Builder-authored local evidence, 2026-10-10 Toronto, Linux/Node 26.7.0.
Measured claims are scoped in CLAIMS S121.
Reviewed base 32abc738f436b392f41a0a77643838a143eb3d35 plus bound candidate.
Status: **prepared, not integrated**. The exact source/test candidate.patch
passes read-only application validation on the restored original source.
Apply that patch before the regeneration commands below; they describe the
patched candidate, not current unmodified HEAD. Original source/test snapshots,
candidate manifest and the private archive remain separately bound evidence.
Accepted ADR-009 §9 requires comparison with the admitted message and sending
the checked bytes. A Uint8Array constructor copies typed-array input but creates
a view of a raw ArrayBuffer/SharedArrayBuffer. The prior adapter therefore
allows later mutation of admission captures and verified send wire.

All six new cases fail before implementation. For each raw buffer type, a
valid signed wire changes through its backing buffer at the RPC handoff, and
both legacy/versioned object-message branches allow a foreign signed message
after the wallet mutates the backing store. The versioned object fixture uses
legacy message bytes; it proves that shape branch, not a new versioned-format
qualification. The callback deterministically mutates backing storage; this is
not a concurrent worker scheduling or trustworthy RPC experiment.

Privately copy after constructing each buffer view. Serialisation remains one
call and the existing final message/signature checks remain mandatory. Public
methods and trusted SDK semantics remain unchanged. A privileged caller can
still bypass an in-process adapter or misuse its key/RPC authority.

All six focused and 31 combined adapter cases pass. Three source and three
emitted mutation trials remove the private legacy capture, versioned capture
or send capture; every complete six-case trial fails an assertion, with no
cancelled/skipped/todo credit. Exact bytes are restored and combined controls
pass. Earlier S119 helpers, manifests, logs, raw counters and archives are
unchanged historical evidence, not overwritten by these separate helpers.

The actual private tarball installs offline without scripts or a package
symlink. All six cases pass through the installed public wallet export; guard
and transaction builders remain repository fixtures. All 19 existing installed
package cases pass separately. Archive SHA-256:
`55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
The candidate manifest identifies source/evaluation/emitted files. Only the
wallet source and its emitted JavaScript change relative to S119.

```bash
node --test packages/sdk/test/adapter-buffer.test.ts packages/sdk/test/adapter-wire.test.ts packages/sdk/test/adapters.test.ts
uv run --script evals/sdk/adapter-buffer/faults.py
npm run release:prepare
npm pack ./.sandbox/releases/sdk --ignore-scripts --json --pack-destination .sandbox/solanaut-1/adapter-buffer
uv run --script evals/sdk/adapter-buffer/install.py
uv run --script evals/sdk/adapter-buffer/faults.py --compiled
node --test evals/packaging/packed-sdk.test.ts
uv run --script evals/sdk/adapter-buffer/candidate.py
```

The first full native run passes 900 of 901 cases and fails only the unchanged
H11 staged-baseline wait. Preserve native-first.txt; no whole-suite pass follows.
Quiet serial AST also passes 900 of 901 cases and fails only the unchanged H11
wait. Its full output and raw counter reports are archived; no complete floor
or coverage pass follows. Regenerate `node evals/ci/coverage-run.ts --serial`.
The unchanged native diagnostic again passes 900 of 901 and fails H11. Preserve
native-diagnostic.txt alongside both earlier failures. The required full suite
is not green: archive the exact correction/tests as candidate.patch and restore
original product/test inputs instead of integrating this unqualified step.
Final candidate identities match before deferral; rebuild restores the original
S119 product/emitted inputs and typecheck. D40 remains open in current source.
Earlier maintained CI failures S120 remain failed. No
independent security, runtime matrix, bounded state, clean deployment, milestone
or stable release is inferred from these local component results.
