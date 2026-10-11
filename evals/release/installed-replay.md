# Current installed SDK — frozen mixed replay

2026-10-11 Toronto · builder-authored CI-2 packaging qualification · reviewed
ddc3358 · current D40/Linux, existing Node 26.7.0 and 24.19.0. CLAIMS S139.
No product, original workload, seed, expected head or maintained gate changes.

## Scope and binding

Install the same actual private D40 archive offline/scripts disabled outside
the repository, with no workspace symlink. Archive SHA-256 is
`55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
Freeze runner, original workload, craft helper, lock, new helper and current
product identities before execution. Reuse the original deterministic steps
and expected head; no workload or coefficient tuning occurs.

Relocate runtime guard/codec imports to public `@solanaut/sdk`, and workload
imports to the relocated fixture. Its hand-written craft helper remains an
explicit repository oracle; type-only imports also use the public SDK. No
algorithm, input, analysis or assertion changes. Relocated sources are retained.
The workload's existing fixed synthetic operator fixture signs only in memory;
no actual key file, RPC or transaction send is used.

## Faults before controls

Each isolated installed fault generates the original 10,000-decision workload:

- A fabricated successful replay with zero replayed decisions refuses as
  incomplete, while the original 13,651-entry history/head remain unchanged.
- Omitting report replay diverges after six decisions; the full generated
  history still has 13,651 entries. Generation is not replay completion.
- Substituting landed for reported outcomes produces 14,131 entries and a
  different head. It replays all 10,000 decisions consistently against itself,
  but the independent frozen expected-head comparison refuses it. Self-agreement
  alone would miss this semantic drift.

Every fault exits one under the unchanged original validator. Restore exact
installed guard bytes after each and in cleanup. Preserve complete raw failures,
including the internally consistent changed history, before healthy controls.
Repository source and the shared D41 compiled scratch candidate are untouched.
No miss occurs in these trials; this is not a mutation score or independent audit.

## Healthy results and regeneration

Both existing runtimes generate and replay all 10,000 decisions over 13,651
entries, containing decision, report, redemption and release events. Their head
matches the original expected value:
`cb4674cdc5851f2c1d6645df4c1d36f30eb7cf616b95010b27dbe6487c65254c`.
The original validator controls and typecheck pass. Exact installed restoration,
unchanged bound inputs, removed consumer and completed owned job are recorded.

```sh
uv run --script evals/release/installed-replay.py
node --test evals/ci/replay.test.ts
npm run typecheck
```

Preserve this output directory before a fresh generation; an existing definition
refuses replacement. Owned scratch identity/completion is in
`.sandbox/installed-replay/`; durable raw proof and bindings are here.

## Limits

This is deterministic in-memory SDK generation/replay, not persisted restart,
signed snapshot restore, policy migration, kernel ownership, bounded memory,
power loss, interrupted signing/send or installed service readiness. It creates
no new statistical population and qualifies no live chain or mainnet use.
Node 22/full runtime matrix, H11's failed native gate, AST/mutation/hosted CI,
soak and independent/external release requirements remain. No milestone or
stable/public release follows from this component pass.
