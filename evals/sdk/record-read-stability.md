# Startup record read consistency

Builder-authored local evidence, 2026-10-09 Toronto, Linux/Node 26.7.0,
base `84cac38` plus candidate. ADR-019 recovery/ownership; STO-4, SIG-8, OWN-2.

## Finding and correction

During startup, append, truncation or same-size overwrite after the descriptor
returns its original bytes is accepted into a stale cache. Startup captures the
new metadata after reading, so the pre-append check cannot detect that prior
change. Six manual/kernel cases fail first on missing refusal.

Capture descriptor size and nanosecond modification/change times before reading;
verify current inode identity and matching descriptor metadata afterwards, before
parsing or torn-tail repair. Preserve changed bytes on refusal and release failed
startup ownership. The shared reader also serves owned maintenance. No record or
evaluation format, signer, policy or public interface change is made.

The injections cross actual descriptor reads, preserve changed evidence and prove
successful reopening after stopped operator restoration. Existing torn-tail,
ownership and storage cases/faults remain. The installed previous JavaScript also
fails before rebuilding. This detects observed changes; it is neither an atomic
host snapshot nor defence against privileged later changes.

Definition 40/seed 40529 is declared before full measurement, selecting 550 cases
and retaining every prior source/test, floor, wait and process/product limit.

```bash
node --test --test-isolation=none packages/sdk/test/storage-failures.test.ts packages/sdk/test/ownership.test.ts
node evals/sdk/ownership-faults.ts
npm run typecheck
npm run release:prepare
node --test evals/packaging/packed-sdk.test.ts
node evals/packaging/faults.ts
npm test
npm run test:coverage -- --serial
uv run --script tools/session_close.py --slug codex-solanaut-1
```

## Status

Raw outputs live in `evals/sdk/record-read-stability/`. Wider qualification is
incomplete. CLAIMS S102 records twenty-four focused cases, eleven retained source
faults, fifteen installed cases and all 132 retained compiled faults passing
with restoration. Native tests pass all 856 cases and typecheck exits zero.
Quiet serial AST executes 856: 855 pass and one unchanged real-baseline wait
fails. No complete coverage or floor pass is claimed. Preserve raw reports and
the original wait. Exact bound product/input/emitted-file/archive hashes match
after restoration; authored TypeScript/Markdown diffs are read and checks pass.
No independent security, bounded recovery, full mutation score, atomic content
authentication, signer budget or stable-release milestone is claimed.
Earlier wait failures remain open; local commits/backups only, no remote push.
