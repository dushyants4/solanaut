# Solanaut 1.0 — formal milestone progress

2026-10-08 · read-only internal milestone accounting · reviewed revision a4d1c25.
Root agent and a read-only peer audit agree on the explicit scope and achievements.
This is not independent security evidence or a release decision.

**41% formal milestone completion: 16 of 39 equally weighted milestones.**
The exact calculation is retained in `progress-result.json`. It includes the
approved Beta. No fractional credit is assigned to tested components inside an
uncompleted milestone. The remaining 23 milestones are formally open.

Scope is the roadmap's product milestones through READINESS R.4. It includes the
human-run devnet Phantom leg, and excludes setup/research, optional hackathon
submission, ongoing R.5 and separately authorised mainnet. This denominator
measures milestone completion, not effort, time remaining, security assurance or
the percentage of stable-release gates satisfied.

Achieved IDs: 1.1; 2a.1 through 2a.10; 2b.1 through 2b.4; 2c.1. The checked Beta
review and Alpha-scope approval corroborate the current roadmap/PROGRESS status.
The Beta tag identifies e925f1dfaabc7eedae361764a401baf7f9e9868b.

`progress-manifest.json` freezes every scope/achievement ID, historical source
digest, revision and review date. The regenerating command reads those exact Git
objects and refuses source or scope disagreement. Updating achievements requires
a new reviewed receipt; the script does not infer success from test names, a
passing component receipt or an ID prefix.

Regenerate from the repository root: `uv run --script evals/release/progress.py`.

Substantial component work is visible in the [release evidence map](../../docs/plans/2026-10-07_release-evidence-map.md)
without inflating formal achievements. Isolated startup, bounded history/state,
operational qualification, complete CI/Alpha evidence, outside-user validation,
Claude RT-2, specialist audit, bounty and human-controlled publication remain.
