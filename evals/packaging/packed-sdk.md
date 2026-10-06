# Private packed SDK — PKG-1 to PKG-3

Measured 2026-10-05, builder-authored evidence, not independent review. Starting revision
`2030ef7`; implementation revision is the commit containing this receipt. Node 26.7.0,
TypeScript 7.0.2, Keel 1.0.1, Linux. No registry publication or chain transaction.

## Failed first

`SOLANAUT_PACKAGE=packages/sdk node --test evals/packaging/packed-sdk.test.ts`:
all four tests fail against the existing source package. Runtime import hits Node's refusal
to strip TypeScript under `node_modules`; the runtime/declaration files and installed commands
are missing, and the consumer typecheck fails. Raw output: `packed-sdk/red.txt`.

The first release compiler configuration targeted ES2022 and rejected `findLast`. Corrected
to ES2023, which is available on the specified runtimes. This build error is recorded separately
from the initial behavioural failures.

## Passes

```bash
npm ci
npm run release:prepare
npm run test:package
npm test
npm run typecheck
```

Four packed-package tests pass: actual installed payment/drain verdicts and Keel byte check;
tarball contents and dependencies; declarations with an invalid telemetry call rejected;
installed replay and table-pin usage exits. Raw output: `packed-sdk/green.txt`.
The consumer lives outside the monorepo, installs offline without scripts or development
dependencies, and uses ordinary Node execution. No workspace symlink or loader flag.

## Planted faults

Each fault modifies the generated candidate, runs `npm run test:package`, then is reverted
by `npm run release:prepare` before the next fault.

| Fault | Detection | Raw output |
|---|---|---|
| runtime export points to source TypeScript | installed runtime import fails | `packed-sdk/fault-export.txt` |
| remove entry declarations | contents and consumer typecheck fail | `packed-sdk/fault-types.txt` |
| omit Keel dependency | runtime, manifest, declarations and CLI fail | `packed-sdk/fault-dependency.txt` |
| remove replay executable shebang | installed CLI fails | `packed-sdk/fault-cli.txt` |

The first consumer folder was inside `.sandbox`: omitting Keel was caught by the manifest
test but runtime resolved the repository's ancestor dependency. This was a harness weakness;
moved the consumer outside the repository and repeated the baseline and all faults. The
retained outputs are from that corrected harness. No missed faults remain in this battery.

## Limits

This verifies the current SDK candidate, not stable deployment, provenance, licence or audit.
The CLI case exercises executable entry points and argument validation, not a fresh RPC read.
Other Node runtimes are configured in CI; this local receipt does not claim they passed.
The full readiness coverage, mutation, fuzz, recovery and reliability gates are still owed.
