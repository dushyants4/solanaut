# PKG-1 / CI-2 — installed decoder domains

2026-10-11 Toronto, reviewed 6c61cf3, unchanged integrated D40 archive
SHA-256 `55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
Builder-authored same-host preparation, not independent testing or a release.

Install the actual private tarball offline with scripts disabled in an ephemeral
consumer outside the repository. The SDK package is a real installed directory,
not a workspace symlink. Preserve the original five decoder/codec property
definitions and assertions; relocate only SDK imports to its installed public
exports and oracle/helper imports to explicit repository locations. The external
kit and fast-check oracle still uses the reviewed repository dependencies.
The exact relocated fixture, original input hashes, seed and raw logs are retained.

Before positive controls, plant three isolated installed faults: return an invalid
address encoding; refuse every decoded message; return no resolved instructions.
Each named property fails first. Fault trials select the applicable single case
and use the existing first-failure mode; they do not claim complete successful
property populations. All three are caught, with no skipped/cancelled/todo case.
Restore exact installed bytes before running controls. No shared source, staged
archive or protected gate is mutated; no measured source input changes.

Under fresh seed 101131, already installed Node 26.7.0 and Node 24.19.0 each pass
all five original properties, completing 10,000 runs with zero skips per property.
Each runtime's complete output is retained separately. Installed bytes restore,
all original property/helper/runner input hashes match and the temporary consumer
is removed after execution.

```sh
uv run --script evals/release/installed-properties.py
```

The prerequisite archive is produced by the exact S130 build command. Preserve
previous output before regeneration. No loader flags are used. This does not
establish package provenance, a clean machine, Node 22 support, the full native
runtime matrix, complete mutation score, independent security, real-chain
differential agreement, a publication decision or a stable milestone.
