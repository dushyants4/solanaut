# Maintained package fault injections

Measured 2026-10-05 on Node 26.7.0, private candidate from `31abf16`, builder-authored evidence.
The gate was first shown failing manually as recorded in `packed-sdk.md`.

`npm run release:prepare` then `npm run test:package:faults` verifies a passing baseline,
plants each of the same four package faults, checks that the corresponding test fails,
restores original bytes in `finally`, and requires the restored candidate to pass. Every
fault was caught. A setup error cannot count as a caught fault: the runner requires all four
tests to have executed and the expected named failure. CI runs this command on its runtime matrix.

Local output:

```text
caught package fault: export
caught package fault: types
caught package fault: dependency
caught package fault: cli
All package faults caught; restored candidate passes
```

These are package faults, not the complete milestone 3.9 security and reliability injections.
Concurrent use of the generated staging folder is unsupported; CI executes these checks sequentially.

First matrix run `37397657426` failed the offline consumer setup on every runtime:
`ENOTCACHED` for Keel's package metadata. The product tests, typecheck and compilation passed.
`npm ci` supplies tarball bytes without guaranteeing metadata. Added explicit
`npm cache add @gubernaut/core@1.0.1` before the offline battery, retaining its installation
restrictions. Reproduced the corrected setup with a new empty cache at
`.sandbox/package-cold-cache`; then ran the package and fault batteries with that cache.
