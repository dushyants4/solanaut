# PKG-1/2/3 — existing-runtime build identity

2026-10-11 Toronto, reviewed 5852778 with unchanged integrated D40 product.
Builder-authored same-host Linux x86-64 preparation, not independent evidence,
clean-machine qualification, audited freeze or supported release.

Freeze the current product hashes, approved build/compiler configuration, lock,
installed-package population and runner before execution. Preserve the entire
prior D41 scratch stage byte-for-byte and with modes before either build. Run
the actual approved release build and npm pack sequentially under already
installed Node 26.7.0/npm 11.19.0 and Node 24.19.0/npm 11.17.0. No dependency or
runtime is installed, no package published and no source/version/export changes.

Both builds produce identical 87-file fingerprints, including the generated
package manifest and executable modes. Both 85,442-byte private tarballs have
SHA-256 `55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`,
matching the integrated D40 reference archive. Each runtime passes all nineteen
original installed-package cases, with no skips, cancellations or todo cases.
These include runtime behaviour, private history paths, standalone declaration
checking and CLI behaviour outside the workspace without loader flags. No
root native or full Node runtime matrix pass is inferred.

Four altered comparison manifests refuse: output digest, executable mode,
archive digest and omitted output. Exact comparison semantics already have
earlier S117 planted-fault evidence; these are comparator faults, not product
mutations or maintained CI credit. Fault manifests and explicit refusal text
are retained. All frozen product/build inputs match after measurement.

The runner restores the prior scratch stage in `finally`; full bytes/modes and
the existing D41 binding check pass afterwards. No previous receipt or archive
is overwritten. Raw build/pack/installed outputs, definition, both manifests,
result and restoration records are in `runtime-builds/`.

```sh
uv run --script evals/release/runtime-builds.py
uv run --script evals/sdk/adapter-batch/bind.py --restored
npm run typecheck
```

Regeneration requires a fresh qualification scratch directory. Preserve the
previous `evals/release/runtime-builds/` outputs and
`.sandbox/solanaut-1/runtime-builds/` directory before rerunning; the runner
refuses an existing saved stage rather than destroy it. Stop other build/fault
workers first. The prior-stage backup is a same-host recovery copy, not physical
disk resilience. No successful restore under SIGKILL/power loss is claimed.

Node 22 is not installed here and is unqualified by this run. Existing H11,
maintained fault failures, H9/H10/H14/H15, outside-user evidence, specialist
audit and every R.1–R.5 release gate remain open. Tarball identity is not package
provenance, supply-chain signatures, licence clearance or publication approval.
