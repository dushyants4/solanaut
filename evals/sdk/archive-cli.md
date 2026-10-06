# Read-only archive command — SNP-2

Builder-authored local Linux/Node 26.7.0 evidence, 2026-10-06. Revision is the commit
containing this receipt (`git log -- evals/sdk/archive-cli.md`). This exposes the accepted
archive foundation as an operator command; it does not expand signer RPC or restore state.

`solanaut-verify-archive` accepts an archive path and optional head, SHA-256, continuation
sequence/predecessor and line limit. Success prints a JSON receipt and exits zero.
Archive refusal prints a typed JSON error on stderr and exits one. Invalid, unknown,
duplicate or malformed arguments print usage and exit two. `--help` alone exits zero.
Errors do not echo archive paths or contents. Verification never writes the source.

## Failures

Six tests fail against the usage-only stub; the usage test already passes (`archive-cli/red.txt`).
Two installed-package tests fail before the executable is included in the release artefact
(`archive-cli/package-red.txt`). The initial noncanonical-integer fault survives: first-sequence
fixtures lack continuation identity, so the archive API independently rejects them. Preserve
that miss (`archive-cli/initial-fault-miss.txt`). Added a line-limit case where scientific,
leading-zero, whitespace, plus and fractional spelling would otherwise be accepted numerically.
The definition requires canonical unsigned decimal spelling; no rule or gate was weakened.

## Commands and scope

`node --test packages/sdk/test/archive-cli.test.ts` exercises pinned receipt/source bytes,
both wrong pins, continuation, exact line boundary, strict arguments, help, source refusal
and isolated numeric spelling (`archive-cli/green.txt`). Maintained faults regenerate with
`node evals/sdk/archive-cli-faults.ts` (`archive-cli/faults.txt`); all sources restored.

Installed-package checks execute the compiled binary outside this repository, without
workspace symlinks or loader flags, checking usage, receipt and typed wrong-pin refusal.
Regenerate: `npm run release:prepare`, `npm run test:package`, `npm run test:package:faults`.
Raw outputs are under `archive-cli/package-*`. Full validation: `npm test`,
`npm run typecheck`, `npm run test:bite` (outputs `archive-cli/full.txt`, `typecheck.txt`,
`bite.txt`). These are builder-authored checks, not independent audit evidence.

The structural reader's limits in `evals/sdk/archive.md` remain: no policy replay,
authentication without trusted pins, signed checkpoint, state restoration or backup recovery
qualification. An empty archive can verify structurally and cannot establish a guard.
The command performs no signing or network request. Public publication remains the human's.

Final local validation: eight command cases, seven caught command faults, 379 root tests,
typecheck exit zero, six installed-package cases and four package faults. Full bite passes
twenty-four campaigns / 170 caught faults, none failed or skipped, all sources restored
(`archive-cli/bite.txt`; `rg -c '^caught '`). Pre-push close passes nine gates, with only
the uncommitted-tree finding; final close follows private push. No new dependency.
