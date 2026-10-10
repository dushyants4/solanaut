# Current private SDK rebuild identity

Builder-authored local evidence, 2026-10-10 Toronto. Same Linux x86-64 host,
Node 26.7.0, npm and compiler versions retained in `rebuild-current/definition.json`.
Reviewed base e16c9df; unchanged product f1e253f. This is preparation, not a
release freeze, clean-machine installation or supported-deployment claim.

Run the actual approved release preparation twice, sequentially after package
fault workers finish. Pack each generated private SDK with installation scripts
disabled. Both builds match the preceding staged file bytes and modes. Both
tarballs match the current private candidate SHA-256:
`9f241d5424c330cc81239edb4e68236a6133ae9842063696d8f1b70eebdf2c0d`.

The exact-comparison check rejects three deliberately altered comparison
manifests: file digest, executable mode and tarball digest. These are comparator
faults, not product mutations or additional maintained-gate credit. The final
unchanged comparison passes. All bound product, evaluation and compiled input
hashes still match the existing candidate manifest; the original private
archive is untouched. Raw build/pack logs, definition and summary are retained.

```bash
uv run --script evals/release/rebuild-current.py
```

This establishes repeated same-host bytes/modes only. It does not establish
independent builds, different compiler/OS reproducibility, dependency supply-chain
provenance, public attestations, licensed distribution or audited release identity.
No version, private flag, stable export, gate or publication decision changes.
