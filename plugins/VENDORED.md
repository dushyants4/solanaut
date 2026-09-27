# VENDORED.md — where Solanaut's office came from

Solanaut's seven seats, six workflows and four of its tools are the Office's, **vendored as file
copies on 2026-09-27**, not installed. Why: `design/ADR-002-isolation.md`.

| Source | Commit | What was taken |
|---|---|---|
| `dushyants4/office-core` (private), the Office's release channel | `182b7a9ec277f82b3372d5db13e29d72704005cb` | seven seat agents; five commands (`triage`, `close`, `sync`, `battery`, `audit`); six first-party skills (`agent-topology-design`, `context-budget`, `provenance-discipline`, `eval-first`, `harness-audit`, `sdk-surface-design`); six workflows; `tools/lint_plugins.py`, `tools/scaffold.py`, `tools/session_close.py` |
| `dushyants4/office` (private), `main` | `8f39ded5c9c423ba40447ffb3a956ed2bcec420e` (guard last changed in `fb6188b`) | `tools/boundary_guard.py`: the release predates the 2026-09-03 fail-open fix and the seat gate, which exist only on `main` |

## Changed here

- **Names:** marketplace `solanaut-office`, plugins `solanaut-<seat>` (`tools/scaffold.py`), so
  nothing collides with the `office` marketplace this machine enables globally.
- **No licence field** in the manifests until the human chooses Solanaut's licence.
- **`boundaries.toml`** is Solanaut's own; the guard's self-test matrix is rewritten for
  Solanaut's paths, and its redirect pattern now sees quoted targets
  (`evals/harness/boundary_guard.md`).
- **The harness plugin declares no hook.** The guard runs once, as a project hook in
  `.claude/settings.json`.
- Department routing in `triage` and the `core` release lines in `sync` are rewritten for a
  single project with the human as the only other owner.

## Not taken, and why

- `claude-api`, `mcp-builder`, `discernment-nudge`: third-party (anthropics/skills, Apache-2.0),
  1.4 MB between them, and not needed to build a Solana SDK. Take them later through the same
  pinned route if a seat needs one.
- `release_gate.py`, `harvest.py`, `extract.py`, `census_enforcement.py`, `kb/` research, the
  Office's `runs/`, `deploy/`, `design/`: the Office's own history and machinery, and some of it
  Gubernaut-specific.
