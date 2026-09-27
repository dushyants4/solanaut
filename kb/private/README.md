# kb/private — confidential notes, on this disk only

Everything in this folder except this README is gitignored (`kb/private/*` in `.gitignore`). It
holds notes on material the human has opened to the agent **explicitly and read-only**, which must
never reach the repository. The repository is private today and meant to go public, and git history
keeps whatever it is given.

## Rules

- **Nothing committed cites, quotes or names what is in here.** Committed documents state an adopted
  idea in Solanaut's own words and cite a public source for it; `design/ADR-004-admission-and-receipts.md`
  shows how.
- No secrets, credentials or personal data, here either.
- **Not backed up by the remote.** This folder is the one deliberate exception to standing rule 7:
  work here lives on this disk only, by design.
- `tools/kb_lint.py` fails if anything in this folder other than this README is tracked by git.
