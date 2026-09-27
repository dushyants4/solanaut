# evals/ — receipts

**Every gate here was shown failing on an injected fault before it was trusted.** A gate never
seen failing might not be checking anything.

| Gate | Shown failing | Then passing | Receipt |
|---|---|---|---|
| `tools/boundary_guard.py --selftest` | 14 territorial cases with a draft policy holding only the secrets rule; then the quoted-redirect case with the full policy | 34/34 | `harness/boundary_guard.md` |
| `npm test` (the guard's evals) | 8 of 9 against a stub that allowed everything | 9/9 | `runs/2026-09-27-setup.md` |
| `npm run typecheck` | an injected type error (`maxLamportsPerTx: "one SOL"`) | clean | `runs/2026-09-27-setup.md` |
| `tools/doctor.py` | a wrong pin (solana 4.3.0), and a PATH without the Solana bins | 12/12 | `runs/2026-09-27-setup.md` |
| `tools/lint_plugins.py`, `tools/scaffold.py --check` | inherited from the Office, where their bite job ran in CI | clean | vendored; not re-shown here yet |
| `tools/kb_lint.py` (session-close gate 4) | its own first run (a quoted non-ASCII path); 8 faults at once in a scratch copy; a dangling register row; an orphan through `session_close.py` | 0 errors | `harness/kb_lint.md` |

Owed: a CI job that re-runs these fault injections on every push (the Office's `bite` job), when
the repository gets CI (H1).
